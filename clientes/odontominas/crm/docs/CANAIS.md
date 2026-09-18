# Canais de atendimento + caixa compartilhada

Fase de 2026-09-19. Migrations `v30` (aditiva), `v31` (fecha a unicidade) e `v32` (troca de principal atômica).

## Princípio

**Número WhatsApp ≠ atendente.** O número pertence à clínica (`canais`); a atendente acessa o canal pelo
Noryos. `CLÍNICA → CANAIS → CONVERSAS → FILA → RESPONSÁVEL → ATENDENTE → HISTÓRICO`.

## Modelo

| tabela / coluna | papel |
|---|---|
| `canais` | 1 linha por número. `tipo`/`provider` são texto livre (hoje `whatsapp`/`evolution`); sem CHECK pra aceitar instagram/webchat sem migration. |
| `canais.status` | só a **conexão** (`connected/disconnected/connecting/error/unknown`). Pausa administrativa é `ativo=false` (a UI mostra "Pausado"). O status salvo é cache: o envio e o diagnóstico conferem o provider ao vivo. |
| `canais.principal` | 1 por clínica (índice parcial). Usado onde não existe conversa: disparo, alerta interno, evento sem conversa. |
| `canais.credencial_ref` | **nome** de uma env var `EVOLUTION_*` com o token do canal. Nunca o segredo; nunca sai pro navegador. Sem ele, vale a chave global da integração. |
| `conversas.canal_id` | por qual canal a conversa entrou. Trigger `conversas_preencher_canal` garante o valor pra código que ainda não o informa. |
| `conversas.atribuido_a / atribuido_em` | responsável atual (e desde quando). |
| `conversas.finalizada_em` | desempata `respondido` (aguardando paciente) de "finalizada". Limpo quando o paciente escreve. |
| `conversa_eventos` | histórico atômico: `CONVERSATION_ASSIGNED/TRANSFERRED/UNASSIGNED/CLOSED/REOPENED/INTERVENED` com ator, de→para, motivo, canal. |

## Identidade da conversa (decisão)

`UNIQUE (clinica_id, canal_id, telefone)`. O **paciente** continua único por `(clinica_id, telefone)`;
a **conversa** é por canal. O mesmo paciente em "Recepção" e "Comercial" tem duas conversas, sem fusão
automática. A antiga `UNIQUE (clinica_id, telefone)` cai na v31 (depois do deploy).

## Fluxos

- **Webhook:** `body.instance` → `canais(provider, provider_instance_id)` → clínica + canal → telefone
  normalizado → paciente → conversa **daquele canal**. Instância desconhecida: `200 skipped` + log, nada é
  criado. Canal e clínica **nunca** vêm do cliente.
- **Envio:** conversa → `canal_id` → provider/instância → envio (`canais-envio.ts`, único ponto). Canal
  pausado/desconectado = falha controlada (`canal_pausado` / `canal_indisponivel`), **sem fallback** pra
  outro número. Sem conversa → canal principal.
- **Deploy novo (revenda):** clínica sem canais ganha o principal a partir de `EVOLUTION_INSTANCE` no 1º uso.

## Ownership e responsável

`dono_conversa` (humano / agente_ia / fluxo) continua sendo o único roteador de **quem responde**.
`atribuido_a` = **quem é responsável**. Assumir: se a IA era dona, ela para; um Fluxo em `waiting_input`
continua capturando a resposta até o humano de fato responder (regra que já existia). SLA: assumir,
transferir e devolver à fila **não** tocam `aguardando_desde` nem `status`.

## Concorrência

Funções Postgres (`assumir_conversa`, `transferir_conversa`, `desatribuir_conversa`): `UPDATE` condicional
(`atribuido_a IS NULL` / `IS NOT DISTINCT FROM esperado`) + evento na mesma transação. Assumir simultâneo =
1 sucesso + 1 `409 ja_assumida` (com o nome de quem assumiu). Transferência recebe o responsável que a tela
viu; se mudou, `409 conflito`. Provado contra o banco real (ver relatório da fase), não só com mock.

## Quem faz o quê (backend é a autoridade)

- **Responder:** responsável; sem responsável → assume na mesma operação; de outra pessoa → só com
  `conversas.intervir` (auditado); finalizada → só com `conversas.reabrir`.
- **Ver:** `visualizar_todas` = tudo; só `visualizar_proprias` = as suas + a fila sem responsável.
- **Transferir / devolver à fila:** atendente só o que é dela; gerência (`visualizar_todas`/`intervir`)
  qualquer uma. Destino: mesma clínica, ativo, perfil operacional, com `conversas.assumir`.
- **Canais:** ver = `canais.visualizar` (Dona, Gerente, Supervisora, Noryos Suporte); configurar / conectar /
  desconectar = só Dona (e Noryos Admin). Atendente não tem tela de canais, mas vê o nome do canal na conversa.

## Compatibilidade

Disparos, alertas internos e eventos sem conversa → canal principal. Fluxos (NPS, Google Reviews),
Reativação, Agentes e opt-out → canal da conversa. Notas internas: por conversa, independem do canal.
`clinicas.apelido_instancia` e `conversas.instancia_evolution` ficam **deprecated** (não são mais lidos
para decidir roteamento; a instância vem de `canais`).

## Rollback

- **v30** é aditiva: reverter o deploy volta ao envio antigo sem tocar no banco (colunas novas ficam ociosas).
- **v31** (só depois do deploy): reversível **enquanto não existir 2ª conversa do mesmo telefone**. Antes de
  reverter: `select clinica_id, telefone, count(*) from conversas group by 1,2 having count(*) > 1;` — se
  vazio, recriar `conversas_clinica_id_telefone_key unique (clinica_id, telefone)`.
- Tirar a instância global do envio já é o estado atual; o env `EVOLUTION_INSTANCE` só semeia o canal
  principal de um deploy sem canais.

## Não implementado (preparado)

Grupos/setores (`canal → equipe`), distribuição automática (round-robin/menor carga/SLA/presença), presença
online, Kanban, Noryos Ops (a função `verificarSaudeCanal` + `/api/canais/:id/diagnostico` já servem de base),
canais além de WhatsApp, e a ponte de `CONVERSATION_*` para gatilhos do motor de Fluxo (o emissor atual só
dispara gatilhos de negócio; ficou fora pra não forçar um encaixe).
