# Kanban comercial (2026-09-18)

Estágio comercial do lead, **integrado** ao CRM (não é um Kanban paralelo).

```
KANBAN = estágio comercial (oportunidade)   ·   TAGS = etiquetas (já existiam)   ·   STATUS = estado da conversa
```

Os três nunca se misturam: mover card não muda tag nem status de conversa; tag não define coluna.

## Modelo (migrations v33 + v34, 100% aditivas)

`paciente → oportunidade → pipeline → estágio`

| tabela | papel |
|---|---|
| `pipelines` | 1 padrão "Comercial" por clínica (seed idempotente `garantir_pipeline_padrao`) |
| `pipeline_estagios` | nome, `ordem`, `tipo` (`open`/`won`/`lost`), `cor`, `ativo` — nada hardcoded no código |
| `motivos_perda` | motivo estruturado por clínica (7 iniciais; customizável no futuro) |
| `oportunidades` | `paciente_id`, `pipeline_id`, `estagio_id`, `responsavel_id`, `conversa_id`, `interesse`, `status`, `versao`, `estagio_entrou_em`, `motivo_perda_*`, `converted_at`, `lost_at` |
| `oportunidade_historico` | histórico de NEGÓCIO: criação, mudança de estágio, mudança de responsável (ator, origem, motivo, `idempotency_key`) |

Reaproveitado (nada duplicado): pacientes (origem/UTM/campanha), conversas (`atribuido_a`, canal, status), `etiquetas`/`conversa_etiquetas`, SLA (`buscarStatusSlaLista`), `canais`, RBAC (`kanban.*` já no catálogo), `auditoria_eventos`, `automacao_eventos` + `emitirEventoAutomacao`.

Derivado, não copiado: canal (da conversa), origem (do paciente), tags (união das conversas do paciente), SLA (serviço existente), tempo no estágio (`estagio_entrou_em`).

## Regras

- **Quando nasce:** 1ª mensagem RECEBIDA de paciente sem oportunidade aberta (webhook) ou conversa iniciada pelo painel. Mensagem em conversa antiga só cria se o paciente **nunca** teve oportunidade (não ressuscita lead ganho/perdido). Índice único parcial: no máximo 1 **aberta** por paciente+pipeline (várias históricas permitidas → multi-oportunidade futura sem mudar o modelo).
- **Mover:** `mover_oportunidade` (Postgres) faz UPDATE condicional por `versao` + histórico na mesma transação. Versão velha → `409 conflito`. `idempotency_key` repetida não duplica histórico nem evento. Estágio `lost` exige motivo estruturado. Reabrir card ganho/perdido é permitido (barrado se já houver outra aberta).
- **`versao` protege o ESTÁGIO.** Trocar responsável não a incrementa.
- **Responsável (decisão):** responsável comercial ≠ responsável de atendimento, mas na 1ª versão *acompanham*: assumir conversa preenche oportunidade **sem** responsável (nunca troca a que já tem); transferir conversa leva a oportunidade **só se** o responsável dela era o anterior da conversa; devolver à fila **não** limpa. Troca manual: `definir_responsavel_oportunidade` (com `esperado`).
- **Conversa principal:** `conversa_id` = conversa que originou a oportunidade; as demais seguem acessíveis pelo paciente.
- **Convertido = conversão comercial.** Não significa pagamento, tratamento concluído nem financeiro (isso é ControleODONTO). **Agendado** não é "atendimento aconteceu" (não dispara NPS/Google).
- **Histórico × auditoria:** histórico = negócio (`oportunidade_historico`); auditoria = quem fez (`OPPORTUNITY_CREATED/STAGE_CHANGED/OWNER_CHANGED/WON/LOST`, só ids).

## RBAC (backend é autoridade; UI só esconde)

| perfil | vê | move |
|---|---|---|
| Dona / Gerente | todos | sim |
| Supervisora | todos | **não** (catálogo só dá `kanban.visualizar`) |
| Atendente | próprios + sem responsável | próprios + sem responsável |
| Noryos Admin/Suporte | sem clínica → 403 no board | — |

## API

`GET /api/kanban` · `POST /api/kanban/oportunidades` · `GET|PATCH /api/kanban/oportunidades/:id` (PATCH só interesse/responsável) · `POST …/:id/mover` · `…/perder` · `…/converter`. 409 traz `versaoAtual`/`estagioAtual`.

## Evento interno

`kanban_stage_changed` (registrado como gatilho `interno` em `fluxo-gatilhos.ts`), emitido por `emitirEventoAutomacao` **só depois** de persistir. Payload em `automacao_eventos.detalhe`: `clinica_id, oportunidade_id, paciente_id, pipeline_id, stage_from, stage_to, actor_id, occurred_at, origem`. `referencia_id` = id da linha de histórico (dedupe). Nenhum fluxo usa esse gatilho ainda → resultado `fluxo_nao_encontrado` (só observabilidade).

## Volume / realtime

Board = consulta dedicada sem mensagens; limites 500 abertos + 100 fechados (aviso `truncado`). Sem Realtime (o projeto não usa): refetch após mover + botão Atualizar.

## Backfill (executado 2026-09-18)

Só conversas abertas com paciente, 1 por paciente: 11 conversas → 10 pacientes → **10 oportunidades** (46 conversas sem paciente e históricas não viram oportunidade). Idempotente.

## Rollback

Ao final da `2026-09-18_v33_kanban_oportunidades.sql` (+ `drop function definir_responsavel_oportunidade`). Chat/conversas/pacientes não dependem do Kanban; os ganchos (webhook, chat, atribuição) são best-effort com try/catch.

## Dívidas / futuro

- Editor de pipeline (`kanban.configurar`): hoje só leitura/seed; renomear/ordenar/desativar estágio sem apagar histórico (FK sem cascade nos estágios).
- Tags ficam na conversa; card usa a união por paciente.
- Cards parados (Novo > 30 min, Follow-up > 3 dias): dado pronto (`estagio_entrou_em`), sem alerta.
- Automações por estágio: consumir `kanban_stage_changed` num Fluxo (Follow-up → aguardar, Perdido → motivo, Agendado → lembrete).
- ControleODONTO: `agendamento criado`/`tratamento iniciado` poderão chamar o mesmo `mover_oportunidade` com `origem='controle_odonto'`.
- Dashboard: leads por estágio, tempo médio no estágio, perdas por motivo, conversão por origem/atendente saem direto de `oportunidades` + `oportunidade_historico`.
- Roteiro real: `npx vite-node --config vitest.config.ts scripts/e2e-kanban.ts` (dados `[TESTE KANBAN]`, não apaga).
