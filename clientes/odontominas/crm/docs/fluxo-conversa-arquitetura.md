# Fluxo de Conversa — Arquitetura Fase 1 (proposta, 2026-09-17)

Fase 1 da reconstrução do módulo "Ferramentas → Fluxo de Conversa" (decisão em
`_memoria/decisoes.md`, 2026-09-16 e 2026-09-17): arquitetura e schema, **proposta, não aplicada**.
Migration completa em
[`../supabase/migrations/2026-09-17_v20_fluxo_conversa_schema.sql`](../supabase/migrations/2026-09-17_v20_fluxo_conversa_schema.sql).
Fontes: [`fluxo-conversa-auditoria-fase0.md`](./fluxo-conversa-auditoria-fase0.md) (o que existe
hoje) e [`fluxo-conversa-visao.md`](./fluxo-conversa-visao.md) (o que o Rafael pediu). Nenhuma
migration foi aplicada em produção nesta fase; nenhum código de aplicação (worker, rotas, UI) foi
escrito — isso é Fase 2/3, checkpoints separados.

## Por que 4 tabelas, não as 9 conceituais da visão

A visão original sugere `flow_definitions/versions/nodes/edges/executions/execution_steps/sessions/
events/variables` — conceitual, o próprio texto pede "adaptar ao schema existente". Consolidado em
4: `fluxos` (container), `fluxo_versoes` (nós+arestas+config como snapshot jsonb por versão),
`fluxo_execucoes` (1 linha por execução — funde "sessão" e "execução", que são o mesmo conceito
aqui), `fluxo_execucao_eventos` (log passo a passo). Mesmo espírito de "sem tabela de métricas, tudo
calculado ao vivo" já validado em Campanhas — menos tabela, sem sacrificar nenhum requisito da
visão (nó de espera, timeout, loop, sandbox, versionamento, variáveis, log visual — todos cobertos
por colunas, detalhado abaixo).

## `definicao jsonb` em vez de `fluxo_nos`/`fluxo_arestas` relacionais

Decisão fechada: manter jsonb. Um grafo relacional só ganharia integridade referencial de aresta→nó
— e isso é exatamente o tipo de checagem que um validador de schema de aplicação (zod) pega de forma
determinística antes do dado tocar o banco, sem o custo de desmontar/remontar o formato nativo do
editor visual (React Flow ou similar já serializa nós/arestas como array de objetos) a cada leitura/
escrita, nem de precisar copiar N linhas por versão publicada em vez de clonar 1 jsonb.

**Validação de publicação** (nó órfão, loop sem condição, caminho sem saída, variável desconhecida,
nó de integração sem capability) é travessia de grafo em código — vive na biblioteca da engine
(Fase 2), não no editor (Fase 3), porque import/duplicar/API também precisam validar, não só o botão
"Publicar".

**Auto-save do rascunho:** sempre `UPDATE` na mesma linha de `fluxo_versoes` em `status='rascunho'`
— nunca cria linha nova. Só "Publicar" cria uma versão nova de verdade (e marca a anterior como
`substituida`, nunca sobrescrita). Undo/redo do editor vive no estado do cliente; o autosave é rede
de segurança de durabilidade, não a fonte de verdade do histórico de edição.

## Ciclo de vida: `fluxos.status` vs. `fluxo_versoes.status`

Dois níveis, de propósito. `fluxos.status` (`ativo/pausado/arquivado`) é o "Pausar automação"/
"Arquivar" do menu do fluxo — desliga **novos gatilhos** independente de qual versão está publicada.
`fluxo_versoes.status` (`rascunho/publicada/substituida/arquivada`) é sobre qual grafo está no ar. Um
índice único parcial (`fluxo_versoes_publicada_unica_idx`, `where status = 'publicada'`) garante
estruturalmente 1 só versão publicada por fluxo — é essa constraint, não lógica de aplicação, que
impede duas versões ativas ao mesmo tempo.

## Gatilho denormalizado em `fluxos`

`gatilho_tipo`/`gatilho_config` em `fluxos` são cópia do nó "Início" da versão publicada, atualizada
no momento de "Publicar". Motivo: o webhook precisa responder "que fluxo ativo tem este gatilho" em
**toda mensagem recebida** — hot path. Sem a cópia, cada checagem seria abrir o `definicao` jsonb de
todo fluxo ativo da clínica por mensagem. Com a cópia, é
`select * from fluxos where clinica_id=$1 and status='ativo' and gatilho_tipo=$2` — indexável,
barato (`fluxos_gatilho_idx`).

## Arbitragem: Fluxo / Agente de IA / Humano

**O problema:** hoje "humano é dono da conversa" é implícito — `conversas.agente_ativo_id is null`.
Isso quebra assim que existe um 3º candidato (o Fluxo), porque `is null` passaria a significar
"humano OU fluxo", ambíguo exatamente onde mais importa.

**A solução:** coluna discriminadora explícita, `conversas.dono_conversa` (`humano/agente_ia/
fluxo`), checada **antes** de olhar qualquer coluna de detalhe. `agente_ativo_id`/`agente_pausado_ate`/
`ultimo_agente_id` não mudam — continuam a fonte de detalhe de "qual agente"; `dono_conversa` é só o
roteador rápido e indexável de "quem responde agora". `conversas.fluxo_execucao_ativa_id` é o
equivalente pro Fluxo (aponta pra `fluxo_execucoes.id` em andamento).

**Por que não inferir do par de colunas não-nulas:** a própria visão pede um bloco "Iniciar agente de
IA" dentro de um fluxo — nesse handoff, `fluxo_execucao_ativa_id` continua setado (a execução está
pausada esperando o resultado estruturado da IA) **e** `agente_ativo_id` também fica setado (é ele
quem responde agora). Inferir por ausência deixaria esse estado ambíguo por design.
`dono_conversa='agente_ia'` durante o handoff resolve sem ambiguidade; o bloco "Retomar fluxo após
IA" é quem devolve `dono_conversa='fluxo'`, nunca inferência.

**Backfill:** `dono_conversa = 'agente_ia' where agente_ativo_id is not null`, senão `'humano'`
(default da coluna). Reproduz byte a byte a regra implícita atual — nenhuma conversa muda de
comportamento até o motor novo começar a escrever `'fluxo'` de verdade.

**Regra de escrita única (nota pra Fase 2, não muda schema):** centralizar `assumirControle(conversaId,
dono, refId)`/`liberarControle(conversaId)`, usadas pelos três subsistemas — evita `dono_conversa` e
`agente_ativo_id` divergirem por serem escritos em pontos espalhados. Mesmo princípio de "sempre via
função central, nunca duplicar a máquina" já usado em `atualizarStatus()` pro funil.

**Ponto de entrada único pra iniciar um fluxo** (`iniciarExecucaoFluxo(...)`, Fase 2, chamado por
webhook/campanha/cron de inatividade/início manual):
1. `dono_conversa='humano'` → recusa (regra da visão: "se há conversa humana ativa, não iniciar
   fluxo automaticamente").
2. `dono_conversa='agente_ia'` → só assume se `fluxos.pode_interromper_agente_ia=true` (padrão
   `false` — cada fluxo opta explicitamente).
3. Senão, assume via `assumirControle`.

A via inversa (gatilho de Agente de IA tentando ativar com `dono_conversa='fluxo'`) precisa do mesmo
guard do lado de `agentes.ts` — registrado como dependência de Fase 2, fora do escopo desta migration.

## Ponto de integração no webhook

`src/app/api/webhook/evolution/route.ts`, dentro do bloco isolado que hoje decide se a IA responde
(linha ~273-305 do arquivo atual: `if (direcao === "recebida" && conteudo && !optOutDetectado) { try
{ ... } }` — depois da mensagem persistida e do opt-out resolvido, nunca antes). Reestruturado por
dentro:

```
if (direcao === "recebida" && conteudo && !optOutDetectado) {
  try {
    const estado = /* select dono_conversa, agente_ativo_id, agente_pausado_ate, fluxo_execucao_ativa_id */;

    if (estado.dono_conversa === "fluxo" && estado.fluxo_execucao_ativa_id) {
      // handoff pro motor — tenta resolver waiting_input na hora, sem esperar o poller
    } else if (estado.dono_conversa !== "humano") {
      // idêntico ao código atual: deveResponder(...) + processarMensagemRecebida(...)
    }
    // dono_conversa === "humano": nada automático, igual hoje
  } catch (e) { /* isolamento igual ao de hoje — nunca derruba o ack HTTP */ }
}
```

Início de fluxo por gatilho de mensagem (palavra-chave/primeira mensagem/nova conversa) entra no
mesmo bloco, antes do `else if` da IA — se `iniciarExecucaoFluxo` assumir o controle, o `else if` da
IA não roda no mesmo request (é `else if`, não dois `if` independentes), evitando Fluxo e IA
responderem à mesma mensagem.

**Resultado: zero mudança de comportamento pra quem nunca usa Fluxo de Conversa.** Toda conversa
existente fica com `dono_conversa` no valor de backfill; o caminho do Agente de IA roda idêntico.

Proteção de reentrada por reenvio idêntico da Evolution (mesmo `evolution_message_id`) já existe
**antes** deste bloco (insert em `mensagens`, `unique`, trata `23505` como `{ok:true, duplicate:true}`,
linhas 231-238) — um handoff pro motor inserido depois desse ponto herda essa proteção de graça.

## Worker e lock

Clona `disparos-worker.ts`/`disparos-lock.ts`: `setTimeout` recursivo (via `instrumentation.ts`, só
em produção) + `integration_locks` com `provider = 'fluxo_conversa'`, `resource = 'engine'` fixo por
clínica — não por execução. Só existe 1 processo Node vivo hoje; lock por execução resolveria um
problema de escala horizontal que não existe ainda, com custo real (N linhas de lock, limpeza de
cada uma em crash). Revisitar só se/quando réplicas Railway virarem real.

**O lock é adquirido só durante o processamento ativo de 1 passo** (milissegundos), nunca durante a
espera em si. Entre agora e `aguardando_ate` não existe lock nenhum — só a linha parada em
`fluxo_execucoes` com `estado='waiting_time'`/`'waiting_input'`, o mesmo padrão já validado de
`conversas.agente_buffer_ate` (sobrevive a restart porque foi persistido no Postgres, nunca dependeu
do processo vivo).

**Throughput sob carga** (a visão pede teste de 50/100/500 execuções simultâneas): v1 processa 1
execução `due` por ciclo, igual `disparos-worker`. A query de busca já nasce com `LIMIT` parametrizável
(hoje 1) — se o teste de carga da Fase 4 mostrar fila lenta de drenar, subir pra lote (10-20 por
ciclo, mesmo lock clínica-wide, processadas em sequência dentro do mesmo `ciclo()`) é mudança de uma
linha, não re-arquitetura.

## Recovery pós-restart do Railway

TTL curto (segundos, igual `disparos-lock`) nunca cobre a espera em si — só o processamento ativo.
O único cenário real de recovery é o processo cair **no meio do processamento de um passo** (depois
do efeito colateral externo — mensagem mandada — mas antes de gravar "concluído"). Mitigação: o
evento é inserido como `em_andamento` **antes** do efeito colateral, só vira `concluido` depois; no
boot do worker, uma varredura marca `em_andamento` mais antigo que uma janela de graça curta (~2 min,
não o TTL de espera) como `failed`/`recovery_apos_restart` — visível e acionável, melhoria sobre o
que `disparos-worker`/`reativacao.ts` fazem hoje (nenhum tem essa reconciliação), justificada porque
execuções de fluxo ficam pendentes por muito mais tempo (potencialmente dias).

Risco residual aceito (mesma classe dos 5 já mapeados na Fase 0): reenvio de mensagem exatamente
nesse cenário de crash (efeito colateral já aconteceu, confirmação não foi gravada) não é eliminável
sem um `evolution_message_id` que só existe depois da resposta da Evolution — já existe hoje em
`disparos-worker`/`reativacao.ts` do mesmo jeito. Mitigado por log destacado do evento órfão, não por
esquema diferente do resto do sistema.

## Idempotência

Reivindicação atômica de passo:
```sql
UPDATE fluxo_execucoes
SET passos_executados = passos_executados + 1, updated_at = now()
WHERE id = $1 AND aguardando_ate <= now() AND estado IN (...)
RETURNING passos_executados;
```
O valor retornado é a `sequencia`; `INSERT INTO fluxo_execucao_eventos (execucao_id, sequencia, ...)`
só aceita essa `sequencia` uma vez — `23505` = já reivindicado por outro processo/ciclo, pula.
Retries dentro do mesmo passo lógico (nó de webhook/API tentando de novo) atualizam a mesma linha de
evento (`tentativa = tentativa + 1`), nunca inserem linha nova. Mesma filosofia "constraint única +
insert puro + tratar 23505 como sucesso/ocupado" já validada em `campanha_eventos`/`mensagens`/
`integration_locks`.

**Chave `(execucao_id, sequencia)`, não `(execucao_id, no_id, tentativa)`:** um loop controlado
revisita o mesmo `no_id` mais de uma vez legitimamente — `sequencia` identifica a visita, `no_id`
identifica só onde ela aconteceu.

**Duas mensagens legítimas quase simultâneas em `waiting_input`** (ex. paciente manda "1" duas
vezes): `UPDATE ... WHERE estado='waiting_input' RETURNING id` condicional — só quem vê `rowcount=1`
avança a execução; controle de concorrência via `UPDATE` condicional simples do Postgres, sem
precisar de `integration_locks` pra essa race específica.

## Loop — dois mecanismos, nenhum exige tabela nova

- **Design-time** (validação de publicação): travessia do `definicao` jsonb em código — não permite
  publicar `A→B→A` sem condição/espera válida.
- **Runtime, por nó** (`max_iterations` configurável, default pequeno): `select count(*) from
  fluxo_execucao_eventos where execucao_id=$1 and no_id=$2` (índice
  `fluxo_execucao_eventos_execucao_no_idx` já cobre).
- **Runtime, global** (disjuntor de última instância): `fluxo_execucoes.passos_executados` comparado
  a um teto fixo (ex. 500) antes de cada passo — protege contra o que o validador de publicação não
  pegou.

## O que fica pra `reativacao.ts` (decisão já fechada, sem mudança de schema aqui)

O schema já suporta "gatilho por inatividade" como cidadão de primeira classe
(`fluxo_execucoes.gatilho_tipo`, sem FK dedicada). A migração de verdade da automação de reativação
pro motor novo — desligar o cron do GitHub Actions, ligar o fluxo equivalente — só acontece depois do
motor validado pelo teste isolado da Fase 5, como passo explícito e aprovado à parte.

## Ordem recomendada Fase 2 → Fase 3

**Fase 2a — núcleo do motor sem UI:** worker, lock, arbitragem no webhook, validador de grafo,
idempotência — testado contra `definicao` JSON escrito à mão em fixtures, com um conjunto mínimo de
blocos (Início, Mensagem, Espera, Menu numérico, Se/Senão, Finalizar). Toda a lista de testes
unitários que a visão exige (condição, menu, variável, espera, timeout, loop, transferência,
opt-out, retry, concorrência, idempotência) é de nível de engine — nenhum precisa do editor visual
pra existir.

**Fase 2b/3 — editor visual:** só depois do contrato de forma do `definicao` estar congelado (evita
o editor codificar suposições que o motor ainda não executa com segurança). A partir daí, blocos
novos na paleta e suporte a eles na engine podem andar em paralelo, um de cada vez.

O validador de publicação vive na biblioteca da engine (Fase 2), não no editor (Fase 3) — reusado por
importar/duplicar/futura API, não só pelo botão "Publicar".

## Revisão final antes de aplicar (2026-09-17)

Antes de aplicar a migration, o Rafael pediu uma checagem específica de 5 pontos. 3 acharam
problema real, corrigidos direto na `v20` (não são mudança de desenho, são correção de schema):

1. **`created_at`/`updated_at`**: `fluxo_execucao_eventos` não tinha `updated_at`, mas o próprio
   desenho de retry (incrementar `tentativa` na mesma linha) é uma escrita — sem a coluna, não dá
   pra saber quando um retry aconteceu. Adicionado.
2. **Índices**: faltava índice plano em `fluxo_execucoes.conversa_id` (o parcial existente só cobre
   execuções ativas, não histórico), e faltava índice em `fluxo_id`/`versao_id` (métricas por fluxo
   e performance da checagem de FK). Adicionados `fluxo_execucoes_conversa_idx`,
   `fluxo_execucoes_fluxo_criado_idx (fluxo_id, created_at)`, `fluxo_execucoes_versao_idx`.
3. **FKs e ON DELETE preservando histórico** — o achado mais sério: `fluxo_versoes.fluxo_id`,
   `fluxo_execucoes.fluxo_id` e `fluxo_execucoes.versao_id` estavam `on delete cascade`. Como nenhum
   fluxo é excluído de verdade pelo app (só arquivado), isso nunca dispararia em uso normal — mas o
   schema não deveria depender disso pra proteger histórico de execução com paciente real. Trocado
   para `on delete restrict`: uma tentativa de excluir um fluxo/versão com execuções associadas
   falha alto, nunca apaga em cascata silenciosamente.
4. **`is_test`**: já estava correto em `fluxo_execucoes` e `fluxo_execucao_eventos`, sem mudança.
5. **Recovery sem repetir passo concluído**: o mecanismo descrito nas seções acima (evento gravado
   `em_andamento` antes do efeito colateral, `concluido` depois, varredura no boot acha o que ficou
   preso) estava só em prosa — a tabela não tinha coluna nenhuma pra representar esse estado.
   Corrigido: `fluxo_execucao_eventos` ganhou `status text check (in em_andamento/concluido/falhou)`
   default `'em_andamento'`, mais `updated_at`, mais um índice parcial
   (`fluxo_execucao_eventos_em_andamento_idx`, `where status = 'em_andamento'`) pra a varredura de
   recovery não escanear a tabela inteira conforme ela cresce.

Migration `v20` no disco já reflete as 5 correções. Ainda não aplicada — aguardando confirmação.

## O que esta fase NÃO fez

Migration não aplicada em produção. Nenhum arquivo de código (`.ts`/`.tsx`) criado ou alterado.
Nenhuma mensagem real enviada. Nenhuma tabela existente (`conversas`, `agentes_ia`, `campanhas` etc.)
teve dado alterado — só a migration `v20`, ainda no disco, propõe o `alter table conversas`.
