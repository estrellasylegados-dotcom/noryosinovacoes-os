# Fluxo de Conversa — Auditoria Fase 0 (2026-09-17)

Fase 0 da reconstrução do módulo "Ferramentas → Fluxo de Conversa" (decisão completa em
`_memoria/decisoes.md`, 2026-09-16): auditoria só-leitura, sem código novo, sem migration, sem
mensagem real. Visão completa do que o módulo deve virar está em
[`fluxo-conversa-visao.md`](./fluxo-conversa-visao.md). Este documento é o retrato do que existe
**hoje**, pra servir de base pra Fase 1 (arquitetura/schema) — que só começa com checkpoint
explícito do Rafael, nunca automaticamente a partir deste relatório.

## Conclusão em uma linha

**O módulo não existe em nenhuma camada do sistema hoje** — sem rota, sem item de menu, sem
componente, sem tabela. `SidebarNav.tsx` só tem, no grupo "Ferramentas": Campanhas, Agentes de IA,
Disparos, ControleODONTO. Zero ocorrência de "Fluxo de Conversa"/"FlowBuilder"/`flow_*` em
`src/`. Mesmo padrão já visto na auditoria de Campanhas (2026-09-16): a palavra "reconstrução" da
decisão original era sobre uma visão de referência (print de outra ferramenta), não sobre código
existente neste projeto. Por isso a Fase 0 virou, na prática, o mapeamento de tudo que um motor novo
precisa reaproveitar e dos riscos reais já presentes na infraestrutura que ele vai herdar.

## 1. Padrão de execução assíncrona (o "motor" mais próximo que existe hoje)

`src/instrumentation.ts` (hook `register()` do Next.js, só roda em produção — `NEXT_RUNTIME ===
"nodejs" && NODE_ENV === "production"`, nunca em `npm run dev`, pra não ter dois processos disputando
o mesmo Supabase/Evolution) liga dois pollers, os únicos "motores" que existem:

- **`src/lib/agentes-buffer.ts`** — `setTimeout` recursivo, 3000ms fixo, **sem lock distribuído**
  (só uma flag em memória contra chamada dupla dentro do mesmo processo). Fecha a janela de buffer
  **antes** de ler as mensagens da rajada, pra mensagem chegando durante o processamento abrir janela
  nova em vez de se perder.
- **`src/lib/disparos-worker.ts`** — mesmo padrão de `setTimeout` recursivo, intervalo variável
  (5000ms ocioso / 3000ms ocupado-mas-lock-preso / 500ms imediato após pular destinatário / 15–25s
  aleatório só quando manda mensagem de verdade, exigência da Evolution contra shadowban). **Usa
  lock real** via `src/lib/disparos-lock.ts` → tabela `integration_locks`.

**Assimetria real:** `disparos-worker` tem lock distribuído, `agentes-buffer` não. Isso é uma lacuna
herdável (ver Riscos, item 1).

**Prós do padrão:** zero infraestrutura nova (sem fila externa/Redis), sobrevive a restart porque
estado fica no Postgres, backoff natural. **Contras:** só 1 poll por processo vivo (nada impede
escalar réplicas no Railway no futuro), latência mínima = intervalo do poll, sem watchdog externo se
o `ciclo()` parar de se reagendar.

**Para o Fluxo de Conversa:** o padrão (setTimeout recursivo + lock via `integration_locks` com
`provider` novo, no molde de `disparos-lock.ts`) é tecnicamente reaproveitável — mas deve seguir o
modelo do `disparos-worker` (com lock), nunca o do `agentes-buffer` (sem lock), porque idempotência
forte é requisito explícito da especificação.

## 2. Webhook do WhatsApp (Evolution API) — onde o Fluxo se encaixa

Único arquivo: `src/app/api/webhook/evolution/route.ts`. Pipeline de uma mensagem recebida, em
ordem: autenticação por `apikey` no payload → filtra grupo/broadcast → normaliza telefone → acha-ou-
cria paciente → acha-ou-cria conversa (aplica a máquina de estado se já existir, grava
`eventos_funil`) → **insere mensagem** (único ponto com idempotência real hoje — `unique` em
`evolution_message_id`, erro `23505` tratado como sucesso) → **opt-out por palavra-chave** (checado
antes de tudo que gera envio automático) → **Agente de IA** (só depois da mensagem persistida, em
try/catch isolado, decide via `deveResponder()`).

**Onde um Fluxo se encaixaria:** depois do opt-out e no lugar/ao lado do Agente de IA — mesmo ponto
de decisão que hoje resolve "a IA responde?" precisaria resolver "quem é dono desta conversa: Fluxo,
Agente de IA, ou ninguém?". A ordem opt-out-antes-de-tudo é uma invariante que o Fluxo tem que
herdar, nunca contornar.

**Idempotência do webhook:** existe pra mensagem (`evolution_message_id` unique + `23505` tratado).
**Não existe** pra criação de paciente/conversa: ambos têm `unique(clinica_id, telefone)` no banco,
mas o código não trata `23505` nesses dois inserts — numa corrida de duas mensagens quase
simultâneas do mesmo número novo, a segunda perde a mensagem em vez de reconciliar (ver Riscos, item
3).

## 3. Máquina de estado da conversa (funil)

`src/lib/conversas.ts` + `src/lib/funil.ts` + `src/lib/status.ts`. Status: `novo | aguardando |
respondido | agendado | perdido`; os três últimos são "resolvidos" e qualquer mensagem nova do
paciente numa conversa resolvida **reabre** pra `novo`. Muda por: webhook (`decidirTransicaoWebhook`),
Agente de IA (reaproveita a mesma função fingindo `fromMe=true` — não duplica regra), ou manual
(`atualizarStatus`, painel).

**Hooks automáticos já disparados em transição pra `agendado`:** Pixel de Conversão (via
`ultimo_agente_id`), evento de campanha `appointment_booked` (idempotente por unique key), e em
`agentes-qualificacao.ts` o evento `qualified_lead` quando classifica "quente" — todos isolados em
try/catch, nunca derrubam a troca de status.

Um Fluxo de Conversa deve **ler e escrever este mesmo `conversas.status` via `atualizarStatus`**,
nunca criar uma segunda máquina de estado paralela.

## 4. Idempotência e locks já validados em produção

Padrão único, repetido 3x e testado em produção — **nunca lock otimista em memória, sempre
constraint única no banco + insert puro + tratar `23505` como sucesso/ocupado**:

- `integration_locks`: chave primária composta `(clinica_id, provider, resource)` — a exclusão
  mútua É a PK, não um `SELECT FOR UPDATE`. Usada por `disparos-lock.ts` (`provider: "disparos"`) e
  `controle-odonto/lock.ts` (`provider: "controle_odonto"`) — cada arquivo com `provider` fixo por
  design, sem import compartilhado.
- `campanha_eventos`: unique key `(campanha_id, paciente_id, tipo)`, `registrarEventoCampanha` insere
  puro e trata `23505` como `{ ok: true, novo: false }`.
- `mensagens.evolution_message_id`: mesmo tratamento em `webhook`, `chat.ts`, `reativacao.ts`,
  `disparos-worker.ts`, `agentes.ts`.

Este é o padrão diretamente aplicável pra "nunca executar nó de fluxo 2x" — uma unique key por
execução/passo seguiria exatamente o que já está validado, sem inventar mecanismo novo (desenho da
chave é decisão de schema, Fase 1).

## 5. Opt-out

`src/lib/opt-out.ts`: detecção determinística (sem IA), por substring pra frases e por
mensagem-inteira pra palavras soltas (evita falso positivo tipo "posso parar de usar o fio dental?").
Checado hoje em 3 pontos, todos antes de envio automático: webhook (inline), `audiencias.ts`
(snapshot ao montar público de campanha/disparo), e `disparos-worker.ts` (**reconfere ao vivo** no
momento exato de cada envio, porque o snapshot pode ter horas).

**Gap real encontrado:** `src/lib/reativacao.ts` **não checa opt-out em lugar nenhum** — a query nem
traz a coluna. É uma falha de LGPD prática já existente hoje, não introduzida pelo Fluxo de Conversa
— mas o Fluxo precisa sempre importar `opt-out.ts`, nunca reimplementar nem copiar o comportamento
da reativação nesse ponto.

## 6. A automação mais próxima de um "fluxo" hoje: reativação

`src/lib/reativacao.ts` + `src/app/api/cron/reativacao/route.ts` + GitHub Actions
(`cron: "0 12 * * *"` ~9h Brasília, mais `workflow_dispatch` manual, auth por `x-cron-secret`).
Regra: conversa resolvida, nunca reativada antes, última mensagem há mais de 30 dias → 1 mensagem,
1x pra sempre (trinco por `ultima_reativacao_em`, sem cadência). **Sem lock** (diferente de
disparos/controle-odonto) e **sem opt-out** (item 5) — lê todos os candidatos em memória antes de
escrever qualquer coisa, então duas execuções concorrentes (retry do Actions + disparo manual, por
exemplo) podem mandar a mesma mensagem 2x. Sem UI, 100% invisível no painel.

Fase 1 vai precisar decidir se esta automação migra pra dentro do motor novo (evita ter dois motores
de automação paralelos no sistema) ou continua separada — não é uma conclusão desta auditoria,
fica registrado como pergunta em aberto.

## 7. Orquestração dos Agentes de IA — a fronteira determinístico/dinâmico que já existe

`src/lib/agentes.ts` (1038 linhas): transferência pra humano é **determinística por palavra-chave**
(`detectarPedidoHumano`) e acontece **antes** de chamar a IA — se bate, a IA nem é invocada.
Checagem de horário de atendimento também é determinística. Só a geração da resposta em si é
dinâmica (IA).

**Sinais que já existem pra "quem é dono da conversa":**
- `conversas.agente_ativo_id` — quem está no controle agora (`null` = ninguém/humano).
- `conversas.agente_pausado_ate` — pausa temporária depois de resposta manual de humano.
- `conversas.ultimo_agente_id` — sobrevive a `agente_ativo_id` zerado (usado por pixel depois que o
  "dono" já soltou a conversa).
- `pausarAgenteManual`/`retomarAgente` — "Pausar IA"/"Retomar IA" no Chat ao Vivo.

**O que não existe:** nenhuma arbitragem entre 3+ automatismos candidatos a responder a mesma
mensagem — hoje só há a dupla Humano/Agente-de-IA. Um Fluxo de Conversa nascendo do zero herda a
mesma pergunta que `deveResponder()` resolve pra IA, mas precisa de uma política própria de
prioridade (Fluxo vs. Agente de IA vs. Humano) que hoje não tem equivalente nenhum no sistema.

## 8. ControleODONTO — padrão de "capability desligada" (diretamente reaproveitável)

`src/lib/controle-odonto/capabilities.ts`: as 7 capabilities (`canReadAppointments` etc.) estão
**todas `false`** hoje, mesmo com a integração habilitada — nenhuma foi validada contra conta real,
por design. Cada função que chamaria a API externa checa a capability **como primeira linha**, antes
de montar qualquer request. Na UI há dois estados visuais distintos: banner cinza ("ainda não
configurada") vs. banner âmbar ("configurada mas não validada — nenhuma chamada é feita"). Esse par
é diretamente copiável pros blocos "Odonto" do Fluxo de Conversa (o bloco aparece no editor, mas com
o mesmo aviso âmbar, sem quebrar o resto do fluxo) — exatamente o que a especificação pede
("Indisponível — integração não configurada").

## 9. RBAC

Gate sempre `sessao?.papel === "admin"`, repetido como helper local em cada rota (não é middleware
central) — mesmo padrão em Campanhas, Disparos, Agentes, ControleODONTO. Os 4 itens de "Ferramentas"
no `SidebarNav.tsx` têm `adminOnly: true`. Um item "Fluxo de Conversa" se encaixaria no mesmo grupo,
com o mesmo padrão.

## Riscos concretos já existentes hoje (não introduzidos pelo Fluxo de Conversa — herdados se não corrigidos)

1. **`agentes-buffer.ts` sem lock distribuído** — se dois processos Node chegarem a rodar ao mesmo
   tempo (rolling deploy do Railway, ou réplicas no futuro), os dois podem competir pela mesma janela
   de buffer e gerar **resposta duplicada da IA** pro mesmo paciente.
2. **`reativacao.ts` sem lock e sem opt-out** — corrida entre execuções concorrentes pode duplicar o
   envio; ausência de checagem de opt-out pode mandar mensagem pra quem já pediu pra sair.
3. **Corrida de criação em paciente/conversa no webhook** — `unique(clinica_id, telefone)` existe no
   banco, mas o código não trata `23505` nesses dois inserts; mensagem concorrente do mesmo número
   novo pode se perder em vez de reconciliar.
4. **Recovery de lock após crash é só por TTL** — se o processo morrer segurando um lock, ele fica
   preso até o `expires_at` passar. Aceitável pra janelas de segundos (uso atual); um motor com
   `waiting_until` de horas/dias precisaria de estratégia mais explícita.
5. **Sem watchdog externo** — se um `ciclo()` parar de se reagendar por uma exceção que escape do
   try/catch, não há alerta, só log.

## Gaps — o que a especificação exige e hoje não existe nada parecido

- Nó de espera com `waiting_until` (aguardar até X e retomar depois).
- Editor visual de fluxo (grafo de nós) — toda automação hoje é código fixo ou formulário.
- Versionamento de fluxo (draft/published/paused/archived, execuções presas à versão original).
- Timeout de input do paciente ("se não responder em X, faça Y").
- Detecção de loop (não existe grafo de execução nenhum hoje).
- Modo teste/sandbox (`is_test=true`) — tudo hoje roda direto em produção.
- Arbitragem entre 3+ automatismos concorrentes pela mesma conversa.
- Log/auditoria de execução com granularidade de passo (`eventos_funil` só registra status, não
  passo-a-passo de automação).

## Onde cada coisa fica no código (referência rápida)

`src/instrumentation.ts`, `src/lib/agentes-buffer.ts`, `src/lib/disparos-worker.ts`,
`src/lib/disparos-lock.ts`, `src/app/api/webhook/evolution/route.ts`, `src/lib/conversas.ts`,
`src/lib/funil.ts`, `src/lib/status.ts`, `src/lib/opt-out.ts`, `src/lib/reativacao.ts`,
`src/app/api/cron/reativacao/route.ts`, `.github/workflows/odontominas-crm-reativacao.yml`,
`src/lib/agentes.ts`, `src/lib/agentes-qualificacao.ts`, `src/lib/controle-odonto/capabilities.ts`,
`src/lib/controle-odonto/config.ts`, `src/lib/controle-odonto/lock.ts`,
`src/components/SidebarNav.tsx`, `src/lib/campanha-eventos.ts`, `src/lib/evolution-webhook.ts`,
`supabase/migrations/2026-09-15_v1_schema.sql`, `supabase/migrations/2026-09-16_v15_controle_odonto.sql`.

## Tabelas de produção hoje (confirmadas via MCP do Supabase, `list_tables`)

`clinicas`, `pacientes`, `conversas`, `mensagens`, `eventos_funil`, `consultas`, `atendentes`,
`etiquetas`, `conversa_etiquetas`, `agentes_ia`, `agentes_conhecimento`, `audiencias`, `disparos`,
`disparo_destinatarios`, `campanhas`, `campanha_canais`, `campanha_eventos`, `mensagens_salvas`,
`external_ids`, `integration_sync_log`, `integration_sync_state`, `integration_locks`. Nenhuma
tabela `flow_*` existe.

## Próximo passo

Fase 0 encerrada. Fase 1 (arquitetura/schema/migrations, propostas antes de aplicar) só começa com
aprovação explícita do Rafael — checkpoint, não continuação automática. Perguntas que ficam em
aberto pra Fase 1, sem resposta definida aqui:

- `reativacao.ts` migra pra dentro do motor novo, ou continua como automação separada?
- Os 5 riscos já existentes (seção "Riscos") entram no escopo desta reconstrução, ou viram
  correções pontuais à parte, antes ou depois?
- Nome final das tabelas (`flow_*` da visão é conceitual, adaptar ao que já existe: `clinica_id` em
  toda tabela, padrão `criado_em`/`atualizado_em` em português usado no resto do schema).
