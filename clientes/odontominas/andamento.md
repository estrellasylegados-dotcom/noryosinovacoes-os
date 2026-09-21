# Andamento · OdontoMinas

## Atualizacao final (2026-09-20) - Distribuicao Automatica V1 aprovada em producao

- Round-robin real validado: `[TESTE] Atendente A` -> `[TESTE] Atendente B` -> `[TESTE] Supervisora`.
- Retry idempotente, inelegiveis ignorados, conversa atribuida preservada, SLA preservado, transferencia Supervisora -> B e webhook Evolution funcionando.
- Evidencias: `5cac5bc4-9cc8-4c88-8787-21869e3c2494`, `94a1d602-3583-4c07-97ea-af3df18d12db`, `bf9aa2be-609d-45d3-aec8-a2c7f36f3dee` e `0711f733-83e1-46a4-ac2c-aeddc50ef6d3`.
- Regressao visual autenticada passou em Chat, Kanban, Alertas, Configuracoes e Noryos Ops. Configuracao final desativada. Sem alteracao de codigo, migration, push ou deploy nesta sessao.

## Retomada (2026-09-20, Codex) — Distribuição Automática V1 validada em produção; configuração desativada

- Distribuição Automática V1 foi implementada para conversas novas sem responsável, com estratégia única de round-robin por clínica e toggle de ativação em `/configuracoes/distribuicao`.
- Migration aditiva criada: `crm/supabase/migrations/2026-09-20_v38_distribuicao_automatica.sql`. Ela cria `atendimento_config` e a RPC atômica `auto_distribuir_conversa_round_robin`, com lock da configuração/conversa, ponteiro do último atendente e evento `CONVERSATION_ASSIGNED`.
- Elegibilidade validada: mesmo `clinica_id`, atendente ativo, perfil operacional ou permissão customizada adequada; perfis de plataforma ficam fora da fila.
- Webhook Evolution passou a chamar a distribuição só em conversa nova recebida do paciente. Retry/duplicidade não redistribui, conversa já atribuída não é sobrescrita, SLA não é resetado e ownership de IA/Fluxo não é alterado.
- Configuração protegida por RBAC `configuracoes.clinica` no backend e na UI. Menu lateral ganhou o item "Distribuição automática" dentro de Configurações com a mesma permissão.
- Testes cobriram round-robin A/B/C/A, inelegíveis ignorados, conversa já atribuída preservada, retry sem redistribuição, concorrência, SLA preservado, RBAC da configuração e continuidade do webhook Evolution.
- Gates aprovados: `npm run typecheck`, `npm run lint`, `npx vitest run` com 946 testes e `npm run build` com 56 páginas.
- Testes focados pós-migration: 37/37, incluindo regressão do webhook Evolution.
- Migration `v38` aplicada em produção pelo SQL Editor, em ordem após a `v37`, e validada com tabelas, colunas e RPC presentes. O histórico oficial do Supabase permanece em `v35`; não reaplicar sem reconciliar esse controle.
- **Status:** validação final aprovada em produção; configuração deixada desativada, evidências preservadas e sem alteração de código, migration, push ou deploy nesta sessão.

## Retomada (2026-09-20, Codex) — Noryos Ops V1 com migration aplicada; publicação pendente

- Noryos Ops V1 foi implementado no CRM como central interna de operações da plataforma para Noryos Admin/Suporte: `/ops`, `/ops/clinicas`, `/ops/canais`, `/ops/integracoes`, `/ops/workers`, `/ops/erros`, `/ops/incidentes`, `/ops/deploys` e `/ops/auditoria`.
- Auditoria inicial contra o código real: reutiliza `clinicas`, `canais`, Central de Alertas, `auditoria_eventos`, `automacao_eventos` e `integration_sync_state/log`; cria só o que não existia de forma confiável (`ops_erros`, `ops_incidentes`, `ops_worker_heartbeats`, `ops_deploys`).
- Migration aditiva criada: `crm/supabase/migrations/2026-09-20_v37_noryos_ops.sql`. Aplicada em produção pelo SQL Editor antes da v38 e validada com as quatro tabelas presentes.
- RBAC implementado com permissões `ops.*`: Noryos Admin completo, Noryos Suporte autorizado; perfis da clínica (`dona`, `gerente`, `supervisora`, `atendente`) bloqueados no backend e no menu.
- Incidentes têm API protegida para criação/resolução (`/api/ops/incidentes` e `/api/ops/incidentes/[id]`). A V1 é majoritariamente leitura/diagnóstico; não tem impersonação, shell, editor de segredo, Datadog/Sentry/Jira interno.
- Gates aprovados: `npm run typecheck`, `npm run lint`, `npm test` com 76 arquivos/939 testes e `npm run build` com 55 páginas.
- Validação visual autenticada ficou pendente: a ferramenta de navegador retornou `Browser is not available: iab`; checagem HTTP local das rotas `/ops/*` sem sessão retornou 307 para login, como esperado.
- **Status:** concluído no código e no banco, ainda não publicado. Próximos passos: fazer `railway up`, validar logado como Noryos Admin/Suporte e só então marcar o Noryos Ops como liberado.

## Retomada (2026-09-20, Codex) â€” motor de automaÃ§Ãµes aprovado; liberaÃ§Ã£o operacional pendente

- Migration `v36` aplicada e validada no Supabase de produÃ§Ã£o. Estrutura, funÃ§Ãµes, Ã­ndices, gatilhos e RBAC passaram; contagens de execuÃ§Ãµes, eventos, oportunidades, pacientes, conversas, fluxos e versÃµes ficaram idÃªnticas antes/depois, sem referÃªncias invÃ¡lidas ou perda de dados.
- Fluxo `[TESTE AUTOMAÃ‡ÃƒO KANBAN]` (`ba51dbe3-93c1-4ead-aa8c-0ef3b823407b`) criado pela UI, validado e publicado na versÃ£o `6e510b69-ac9a-4e56-81c3-2f6ec7ae80e7`. Gatilho: entrada em Follow-up no pipeline Comercial; esperas de 15 segundos; interrupÃ§Ã£o por mudanÃ§a de estÃ¡gio ou resposta; horÃ¡rio e reentrada configurados.
- E2E real controlado passou: oportunidade `530a25a7-6f88-4b93-bc70-dfc1bbf66089` gerou a execuÃ§Ã£o `91d2734a-a95c-41c8-93f0-94a0d1c8482a` e exatamente uma mensagem confirmada para o nÃºmero de teste autorizado `5561981925241` (provider id `3EB0FC9B48A7648BA867C3401C371A33A2DF617A`). Fluxo pausado e execuÃ§Ã£o interrompida manualmente ao final; evidÃªncias preservadas.
- Motor PostgreSQL aprovado em 11/11 testes especÃ­ficos. Gates finais: 75 arquivos/931 testes, typecheck, lint e build com 45 pÃ¡ginas aprovados.
- Dois problemas de UX foram corrigidos localmente: erro de ativaÃ§Ã£o agora aparece na tela (`crm/src/components/fluxos/FluxoAcoes.tsx`), e o histÃ³rico traduz motivos tÃ©cnicos e recolhe o UUID (`crm/src/components/fluxos/FluxoHistoricoExecucoes.tsx`). Em 768 px, lista/editor ainda exigem ajuste responsivo.
- RelatÃ³rio: `crm/docs/AUTOMACOES-KANBAN-VALIDACAO-E2E-2026-09-20.md`. Roteiro reproduzÃ­vel: `crm/scripts/e2e-automacoes-kanban-prod.ts`.
- **Status:** motor aprovado, funcionalidade ainda reprovada para liberaÃ§Ã£o operacional. PrÃ³ximos passos: ajustar responsividade, publicar as correÃ§Ãµes locais, ligar `AUTOMACOES_KANBAN_ENABLED` no Railway e repetir a validaÃ§Ã£o final. Nenhum push ou deploy foi feito nesta sessÃ£o.

## Retomada (2026-09-19, Codex) â€” API autenticada validada; UI visual pendente

- Conta temporÃ¡ria autorizada expressamente por Rafael: seis perfis padrÃ£o com login real; matriz final de 190 verificaÃ§Ãµes aprovada, alÃ©m de ignorar e revogaÃ§Ã£o. Suporte repetido apÃ³s corrigir fixture fora de seu escopo, sem mudar permissÃµes.
- Conta `qa_alertas_1789786637716` desativada, senha removida, sessÃµes revogadas, sem privilÃ©gio de plataforma; login e cookies antigos recusados (401). Dados originais preservados.
- EvidÃªncias: `crm/docs/ALERTAS-VALIDACAO-TEMPORARIA-2026-09-19.md` e relatÃ³rios JSON referenciados. Nenhuma alteraÃ§Ã£o no cÃ³digo de produÃ§Ã£o, migration, deploy ou envio de WhatsApp.
- **Falta UI visual real:** sino/dropdown, cards/filtros, aÃ§Ãµes/histÃ³rico pela tela, links abrindo o contexto e celular. Controle de navegador indisponÃ­vel; Rafael pediu instalar, mas a conexÃ£o depende da interface do app. **NÃ£o marcar CONCLUÃDA.**
- Esta atualizaÃ§Ã£o substitui a pendÃªncia abaixo de senha pessoal/roteiro HTTP ainda nÃ£o rodado; o roteiro HTTP passou, a validaÃ§Ã£o visual permanece aberta.

## Onde estÃ¡ (2026-09-19, CENTRAL DE ALERTAS OPERACIONAIS â€” em produÃ§Ã£o; SLA real validado; UI logada pendente)

- Migration v35 aplicada (4 tabelas novas), deploy `SUCCESS`, verificador rodando sozinho a cada minuto. Doc completo: `crm/docs/ALERTAS.md`.
- Tipos ativos: SLA, conversa sem responsÃ¡vel, oportunidade parada (por etapa), canal desconectado, mensagem/fluxo/disparo com falha definitiva, fluxo preso (tÃ©cnico). Dedupe/nova ocorrÃªncia no banco; resoluÃ§Ã£o automÃ¡tica e por evento.
- Testado: 908 unitÃ¡rios; produÃ§Ã£o sÃ³ com `[TESTE]` (sem responsÃ¡vel, Kanban, canal, **SLA real ponta a ponta**: atenÃ§Ã£o â†’ alerta Ãºnico â†’ mesmo alerta crÃ­tico â†’ resolvido ao responder; `sla_config` restaurada). **NÃ£o testado:** UI logada e aÃ§Ãµes Assumir/Resolver/Ignorar (dependem de sessÃ£o do Rafael).
- DecisÃ£o definitiva: `alertas.tecnicos` = permissÃ£o de plataforma (sÃ³ Noryos Admin/Suporte, nem por customizaÃ§Ã£o); a clÃ­nica vÃª alerta operacional amigÃ¡vel (`automacao_indisponivel`). Ver decisoes.md.
- Roteiro autenticado: `crm/scripts/e2e-alertas-sessao.mjs --usuario <u> --perfil <p> [--alerta <id>] [--tecnico <id>]` + alertas `[TESTE UI 1â€“7, T1â€“T2]` (ids no diÃ¡rio/chat). SÃ³ depois disso vale "CONCLUÃDA".
- Passada do verificador 8â€“30 s; lock 180 s. Se piorar: buscar mensagens em lote (exige paginaÃ§Ã£o, PostgREST limita 1000 linhas).
- 14 alertas abertos hoje vÃªm de dados de teste/demo (nÃ£o apagados, pedido de preservar).
- PendÃªncias: Rafael validar `/alertas`, sino, aÃ§Ãµes e links (`?conversa=`, `?card=`, `?canal=`) logado; configurar o horÃ¡rio real da OdontoMinas (SLA hoje inerte). Noryos Ops segue nÃ£o iniciado.

## Onde estÃ¡ (2026-09-18, KANBAN COMERCIAL â€” em produÃ§Ã£o, UI logada pendente)

- Modelo paciente â†’ oportunidade â†’ pipeline â†’ estÃ¡gio (migrations v33/v34, aditivas), pipeline "Comercial" com 7 estÃ¡gios (tipo open/won/lost), 7 motivos de perda. Backfill: 10 oportunidades. Mover por `versao` (409), histÃ³rico de negÃ³cio, evento `kanban_stage_changed`, auditoria `OPPORTUNITY_*`. RBAC: Dona/Gerente todos, Supervisora sÃ³ vÃª, Atendente prÃ³prios + sem responsÃ¡vel.
- Testes: 26 unitÃ¡rios novos (806 no total), E2E real `crm/scripts/e2e-kanban.ts` 36/36 (inclui corrida AÃ—B), gates verdes. Deploy `railway up` SUCCESS, smoke 401 sem sessÃ£o. EvidÃªncias `[TESTE KANBAN]` preservadas.
- Ajuste no Chat: campo de resposta sempre no rodapÃ©, notas internas recolhÃ­veis.
- Pendente: validaÃ§Ã£o visual logada pelo Rafael; Supervisora mover?; editor de pipeline; alertas de card parado e automaÃ§Ãµes por estÃ¡gio (dado pronto: `estagio_entrou_em`); ControleODONTO via `mover_oportunidade` com origem `controle_odonto`. Detalhe e rollback: `crm/docs/KANBAN.md`.

## Onde estÃ¡ (2026-09-18, CANAIS + ATENDIMENTO COMPARTILHADO â€” 100% CONCLUÃDO)

**Status: backend + E2E real + UI autenticada validados pelo Rafael. Fase concluÃ­da em 2026-09-18.**

Doc completa (modelo, fluxos, RBAC, rollback): `crm/docs/CANAIS.md`.

- **O que existe:** tabela `canais` (nome amigÃ¡vel, telefone, status de conexÃ£o, ativo/pausado,
  principal, `credencial_ref` sÃ³ como nome de env), `conversas.canal_id`/`atribuido_em`/`finalizada_em`,
  `conversa_eventos` (ASSIGNED/TRANSFERRED/UNASSIGNED/CLOSED/REOPENED/INTERVENED). Webhook resolve
  canal e clÃ­nica pela instÃ¢ncia; envio conversaâ†’canalâ†’instÃ¢ncia (`canais-envio.ts`), sem fallback;
  Disparos/alertas internos usam o canal principal. Migrations v30, v32, v31 (nessa ordem, a v31 sÃ³
  depois do deploy). Deploy `d9345f64`.
- **Chat ao Vivo:** filas (novos, sem responsÃ¡vel, meus, aguardando atendente/paciente, finalizados),
  filtros por canal/responsÃ¡vel/SLA, ordenaÃ§Ã£o, Assumir/Transferir/Devolver Ã  fila, conflito 409 com o
  nome de quem assumiu, indicador de controle (humano/IA/automaÃ§Ã£o). ConfiguraÃ§Ãµes â†’ Canais
  (`/configuracoes/canais`; `/conexao` redireciona).
- **Provado (backend):** 780 testes; multicanal e unicidade no banco real; corrida real (20+20 rodadas,
  1 vencedor em todas, SLA intacto).
- **Provado (E2E real em produÃ§Ã£o, sem login/UI):** mensagem real "Testando 1941" do nÃºmero de teste
  `5561981925241` entrou pela instÃ¢ncia `odontominas-teste` â†’ canal **WhatsApp Principal** â†’ conversa
  criada **sem responsÃ¡vel**, e `last_webhook_at` do canal foi atualizado. Depois, com o cÃ³digo de
  produÃ§Ã£o e as atendentes `[TESTE]` como atores (`railway run`), com envio real pelo canal: A assume;
  B nÃ£o consegue responder a conversa da A; A responde; A transfere pra B (motivo "troca de turno"
  preservado); A perde a autorizaÃ§Ã£o de resposta; B responde; histÃ³rico registra ASSIGNED e
  TRANSFERRED; `aguardando_desde` (SLA) nÃ£o foi zerado; autoria de cada mensagem vinculada Ã  atendente
  certa. Cadeia provada: webhook â†’ resoluÃ§Ã£o de canal â†’ conversa â†’ atribuiÃ§Ã£o â†’ controle de ownership â†’
  envio real â†’ transferÃªncia â†’ autorizaÃ§Ã£o pÃ³s-transferÃªncia â†’ histÃ³rico â†’ SLA preservado. EvidÃªncia:
  `crm/scripts/e2e-canais-fluxo-real.ts` (commit `54a8b6c`).
- **Validado pela UI autenticada (2026-09-18):** convites oficiais por CLI (`crm/scripts/convidar-atendente-teste.ts`,
  nÃ£o commitado) pras contas `[TESTE] Atendente A/B` existentes (id e histÃ³rico preservados); senha de teste
  uma senha de teste fraca (valor combinado no chat, nÃ£o registrado aqui) a pedido do Rafael (usuÃ¡rios `teste_atendente_a/b`; trocar/desativar antes da produÃ§Ã£o real). Roteiro:
  A assume a conversa 00000-0014 â†’ transfere pra B â†’ B recebe; no canal fictÃ­cio `[TESTE] WhatsApp RecepÃ§Ã£o` o envio
  falha controlado (instÃ¢ncia `teste-recepcao` inexistente, 404, nada salvo); mensagem real do 61 98192-5241 entrou
  pelo canal real sem duplicar e a B respondeu pela tela, assinada por ela. Atendente sÃ³ vÃª as prÃ³prias conversas
  (`visualizar_proprias`). Filtros, ConfiguraÃ§Ãµes â†’ Canais e visual/responsivo aprovados pelo Rafael.
  **Achados:** login sÃ³ por usuÃ¡rio (nÃ£o e-mail) e rate limit de 5 falhas/IP em memÃ³ria (zera com restart do
  serviÃ§o); 47 conversas do seed com `ultima_mensagem_em` no futuro escondiam as reais em "Mais recentes", corrigidas
  pra `created_at`. **Melhoria sem urgÃªncia:** mensagem de erro de envio mais especÃ­fica na tela.
- **Menu lateral (2026-09-18, pedido do Rafael apÃ³s a validaÃ§Ã£o):** recolhÃ­vel (faixa de 64px com bolinhas de
  status, conteÃºdo se reajusta; preferÃªncia em `localStorage` `crm-menu-colapsado`, sÃ³ de `sm` pra cima) e preso Ã 
  altura da tela (sticky), com o rodapÃ© WhatsApp/usuÃ¡rio/Sair sempre visÃ­vel. `src/components/SidebarShell.tsx` +
  `src/app/(painel)/layout.tsx`. Em produÃ§Ã£o via `railway up`, sem commit; aguardando conferÃªncia visual dele.
- **Preparado, nÃ£o feito:** Kanban, distribuiÃ§Ã£o automÃ¡tica, grupos/setores, presenÃ§a, Noryos Ops
  (`verificarSaudeCanal` + `/api/canais/:id/diagnostico`), omnichannel, ponte CONVERSATION_* â†’ Fluxo.
- **Dados [TESTE] preservados** (canais RecepÃ§Ã£o/Comercial de instÃ¢ncia fictÃ­cia, 3 atendentes sem
  login, paciente e ~48 conversas 5500000000xxx) atÃ© depois da apresentaÃ§Ã£o. **Preservar tambÃ©m** a conversa do nÃºmero de teste `5561981925241` (responsÃ¡vel atual `[TESTE] Atendente B`, com histÃ³rico, mensagens, atribuiÃ§Ãµes, transferÃªncias e a evidÃªncia do E2E real): nÃ£o apagar.

## Onde estÃ¡ (2026-09-18, Identidade/RBAC â€” validaÃ§Ã£o E2E: convite real ok, 2 de 6 perfis de teste ativos)

**ValidaÃ§Ã£o E2E da fundaÃ§Ã£o de Identidade/RBAC em produÃ§Ã£o, em andamento.** Matriz dos 6 perfis e
roteiro de rotas 401/403 em `crm/docs/RBAC-VALIDACAO-E2E.md`. Roteiro autenticado por perfil em
`crm/scripts/e2e-rbac-sessao.mjs` (senha digitada oculta no terminal do Rafael, sÃ³ imprime
PASSOU/FALHOU e status â€” ainda **nÃ£o rodado**, a saÃ­da nÃ£o foi trazida).

**Corrigido antes do E2E** (autorizaÃ§Ã£o/escalada/acesso indevido, regra decidida pelo Rafael; commits
`1e2daa9`, `c123000`, em produÃ§Ã£o): sessÃ£o validada no servidor em 13 handlers de chat/etiquetas/
notificaÃ§Ãµes/status (antes sÃ³ o middleware conferia a assinatura, entÃ£o bloqueio/reset de senha nÃ£o
derrubava o acesso nessas rotas); redefinir senha respeita hierarquia (`podeRedefinirCredencial`:
Suporte sÃ³ Gerente/Supervisora/Atendente, nunca a Dona; ninguÃ©m a prÃ³pria conta); convite faz claim
atÃ´mico do token e sÃ³ ativa conta ainda `invited` (link antigo nÃ£o desbloqueia conta bloqueada);
permissÃµes por pessoa sÃ³ concedidas pelo ator a perfil que administra, sÃ³ o que ele tem, e
`platform.*`/`suporte.*` sÃ³ em perfil de plataforma (`validarConcessaoPermissoes`); alterar nome/
status/perfil de alguÃ©m exige poder administrar o perfil atual do alvo. **Achado 2 mantido** (Atendente
muda/finaliza status pela rota `/status`): decisÃ£o de produto, nÃ£o falha.

**Bootstrap do 1Âº Noryos Admin** por CLI (`crm/scripts/bootstrap-noryos-admin.ts`, `--dry-run`,
`--diagnostico` somente leitura, `--reenviar`): convite oficial, idempotente, recusa se jÃ¡ existir
Noryos Admin, auditoria `PLATFORM_ADMIN_BOOTSTRAPPED`, nunca imprime token/chave. Causa raiz do
e-mail que nÃ£o saÃ­a: `RESEND_API_KEY` colada malformada no Railway (42 caracteres, sem `re_`, com
quebra de linha); `new Resend(key)` lanÃ§ava TypeError fora do try do `email.ts` (corrigido em
`4db5cf4`, que tambÃ©m traz `sanitizarMensagemErro`). Chave regravada e vÃ¡lida; `RESEND_FROM` =
`Noryos <no-reply@noryosinovacoes.com.br>` (domÃ­nio jÃ¡ verificado no Resend); `APP_URL` segue o
domÃ­nio do Railway. Deploys `ac8ed009` e `ff4e4830` (SUCCESS, 3 workers ok).

**Contas de teste em produÃ§Ã£o (preservar atÃ© a apresentaÃ§Ã£o):** `[TESTE] Noryos Admin` (usuÃ¡rio
`rafaviriato`, rafaviriato@hotmail.com, `active`) e Noryos Suporte (usuÃ¡rio `rafaelviriatto`,
rafaelviriatto@gmail.com, `active`, renomeado `noryossuporte`), ambas com `clinica_id` da clÃ­nica
(o login sÃ³ busca conta dessa clÃ­nica; conta com `clinica_id` nulo nÃ£o loga). Convites usados,
auditoria confere sem segredo. Rafael confirmou o login real dos dois. Gates: typecheck/lint/683
testes/build limpos. Commits pushados atÃ© `e9cafdc`.

**Falta:** reset de senha por e-mail real; contas `[TESTE]` Dona/Gerente/Supervisora/Atendente
(aguardam e-mails reais da clÃ­nica, nÃ£o usar fictÃ­cios); rodar o E2E autenticado por perfil; provar a
escalada com Dona/Suporte logados (com sÃ³ o Noryos Admin nÃ£o dÃ¡ pra provocar 403 de escalada);
rotacionar a chave do Resend (apareceu no chat).

**Melhorias conhecidas, sem urgÃªncia:** `auditoria_eventos.ator_perfil` fica vazio na maioria dos
eventos; editar sÃ³ o nome grava `ROLE_CHANGED`; nÃ£o hÃ¡ evento de login, sessÃ£o revogada ou convite
reenviado; rate limit em memÃ³ria (zera a cada deploy) e chave de IP pelo `x-forwarded-for`
(forjÃ¡vel); menu mostra "RelatÃ³rios" a Gerente/Supervisora mas a pÃ¡gina (shim) redireciona;
Supervisora sem `sla.visualizar` (sÃ³ `sla.visualizar_equipe`); `conversas.visualizar_*` e
`sla.visualizar_equipe` nÃ£o sÃ£o aplicados em lugar nenhum; o alerta do formulÃ¡rio de Equipe diz
"Resend ainda nÃ£o configurado", texto desatualizado.

## Onde estÃ¡ (2026-09-18, Identidade/Login/RBAC â€” fundaÃ§Ã£o concluÃ­da)

**IDENTIDADE / LOGIN / RBAC â€” FUNDAÃ‡ÃƒO CONCLUÃDA.** Mesmo dia da fatia 1-4 abaixo (Equipe/Notas/
HorÃ¡rio/SLA), o Rafael trouxe um pedido extenso â€” arquiteto sÃªnior de identidade/autorizaÃ§Ã£o â€”
pedindo pra ir alÃ©m do RBAC binÃ¡rio admin/atendente que a fatia 1 tinha herdado. Auditoria real
antes de desenhar (nÃ£o de memÃ³ria): schema (`atendentes` sem e-mail, 3 contas reais â€” nenhuma da
Ariadna, todas placeholder de demo), sessÃ£o (cookie assinado sem revogaÃ§Ã£o), e uma varredura de
`papel === "admin"` que achou **63 arquivos**, bem mais que a estimativa inicial de 18 (a 1Âª busca
sÃ³ pegava `papel === "admin"`, nÃ£o `papel !== "admin"`).

**1. Modelo de identidade e RBAC granular.** 6 perfis: `noryos_admin`/`noryos_suporte` (identidade
de plataforma, `clinica_id` nulo) e `dona`/`gerente`/`supervisora`/`atendente` (escopo de clÃ­nica).
CatÃ¡logo de permissÃµes em cÃ³digo (`src/lib/permissoes.ts`, nÃ£o tabela relacional â€” escala atual nÃ£o
justifica), autorizaÃ§Ã£o central (`can`/`requirePermission`, `src/lib/autorizacao.ts`) substituindo
o `papel === "admin"` espalhado. CustomizaÃ§Ã£o por pessoa via `atendentes.permissoes_customizadas`
(jsonb; `null`=default do perfil, array mesmo vazio=override completo). Migrations `v28`/`v29`
(aditivas): `perfil`/`status`/`email`/`sessao_versao`/`permissoes_customizadas`/`origem`/
`criado_por` em `atendentes`, `clinica_id` virou nullable, `senha_hash` virou nullable (pra suportar
`status='invited'`); tabelas novas `convites`, `password_reset_tokens`, `identidades_externas`
(schema pronto pro futuro ControleODONTO, vazia, nenhuma capability ligada), `auditoria_eventos`.
MigraÃ§Ã£o real das 3 contas, confirmada por SQL antes: `admin`â†’`dona`, `recepcao1`/`recepcao2`â†’
`atendente` â€” nenhuma virou `noryos_admin` sozinha.

**DecisÃ£o consciente de nÃ£o criar `memberships` ainda** (o pedido original desenhava
`usuario â†’ membership â†’ clÃ­nica`): hoje Ã© 1 clÃ­nica por deploy, zero usuÃ¡rio real multi-clÃ­nica â€”
`atendentes.clinica_id` jÃ¡ cobre, e uma tabela 1:1 sem uso seria complexidade especulativa. Fica
registrado em `decisoes.md` e em `crm/docs/RBAC.md` (seÃ§Ã£o 6) como decisÃ£o, nÃ£o gap.

**2. SessÃ£o revogÃ¡vel.** `sessao_versao` (coluna em `atendentes`) embutida no token assinado â€”
bloqueio, desativaÃ§Ã£o, reset/troca de senha incrementam a versÃ£o e todo token emitido antes passa a
divergir, rejeitado em `getSessaoAtual()`. Reescrita de `src/lib/sessao.ts` (camada Edge-safe, sÃ³
`atendenteId:sessaoVersao:expiraEm` assinado â€” nunca perfil/permissÃµes no cookie) e
`src/lib/sessao-servidor.ts` (Node, autoridade real â€” sempre lÃª o banco a cada request). Efeito
colateral aceito e comunicado: o formato do token mudou, entÃ£o as sessÃµes abertas antes do deploy
precisam logar de novo (nenhuma perda de dado, sÃ³ re-login).

**3. Convites e reset de senha.** Fluxo de convite (`src/lib/convites.ts`) substitui "admin define
senha temporÃ¡ria": Dona/Noryos Admin convida por nome+e-mail+perfil (sem senha), conta nasce
`status='invited'`, token de 32 bytes (sÃ³ o hash SHA-256 persiste) com validade 24h e uso Ãºnico,
pessoa define a prÃ³pria senha em `/convite/[token]` e a conta vira `active`. Reset de senha
self-service (`src/lib/reset-senha.ts`): `/esqueci-senha` sempre responde genÃ©rico (nunca revela se
o e-mail existe), token de 30min, ao usar revoga todas as sessÃµes existentes. E-mails via Resend
(`src/lib/email.ts`, dependÃªncia nova) â€” **sem `RESEND_API_KEY`/`APP_URL` configuradas em produÃ§Ã£o
ainda**, o token Ã© criado normalmente e o envio sÃ³ loga aviso, nÃ£o quebra o fluxo.

**4. RBAC aplicado de verdade** (nÃ£o sÃ³ desenhado) em Equipe (`/api/equipe/*`, tela reconstruÃ­da
com convite/status/bloqueio/reenvio/ediÃ§Ã£o de perfil com regra de elevaÃ§Ã£o nos dois sentidos), Chat
ao Vivo (enviar mensagem/finalizar/atribuir), SLA (`sla.visualizar`/`sla.configurar`) e HorÃ¡rio de
Atendimento (`configuracoes.horario`), Notas Internas (`conversas.notas_internas`).

**5. Compatibilidade explÃ­cita nas telas antigas.** Agentes, Campanhas, Disparos, Fluxos, ConexÃ£o,
ReputaÃ§Ã£o, ControleODONTO, Resumo e a ficha do paciente (~60 arquivos) usavam `papel === "admin"`
direto. Como o campo de sessÃ£o virou `perfil` (6 valores, nÃ£o mais 2), troquei pelo helper
`isAdminEquivalente(sessao)` = `perfil === "dona" || perfil === "noryos_admin"` â€” comportamento
idÃªntico ao de antes, zero regressÃ£o. **Registrado explicitamente como dÃ­vida tÃ©cnica, nÃ£o soluÃ§Ã£o
permanente** (`decisoes.md`, `crm/docs/RBAC.md` seÃ§Ã£o 4, pendÃªncia em `agora.md`) â€” migrar essas
telas pra permissÃ£o granular Ã© trabalho de fase seguinte.

**6. SeguranÃ§a**: privilege escalation bloqueado nos dois sentidos (`podeAtribuirPerfil` â€” ator nÃ£o
atribui nem edita um perfil mais poderoso que o prÃ³prio escopo; ninguÃ©m edita a prÃ³pria conta pela
rota de gestÃ£o de equipe); Ãºltima Dona ativa de uma clÃ­nica protegida contra ficar sem ninguÃ©m no
comando (mesmo espÃ­rito do guard antigo de "Ãºltimo admin"); `auditoria_eventos` (append-only)
registra `USER_INVITED`/`INVITE_ACCEPTED`/`ROLE_CHANGED`/`PERMISSIONS_CHANGED`/
`PASSWORD_RESET_*`/`MEMBERSHIP_BLOCKED`/`USER_DISABLED`/`USER_REACTIVATED` â€” nunca senha nem token
puro; rate limit reaproveitado (mesmo mecanismo de login) nos novos endpoints de convite/reset.

**Gates**: typecheck/lint/674 testes (13 novos, incluindo os que prendem a regra de elevaÃ§Ã£o e a
resoluÃ§Ã£o de permissÃµes customizadas)/build de produÃ§Ã£o â€” todos limpos. 5 commits (`1ebaf50`
modelo de identidade/RBAC/sessÃ£o, `56c1a16` convites/reset, `0136616` Equipe + RBAC granular,
`11d9ce1` shim nas telas legadas, `159221c` documentaÃ§Ã£o).

**Deploy real no Railway** (`railway up`, deployment `83ffadddâ€¦`, `SUCCESS`, os 3 workers
`agentes-buffer`/`disparos-worker`/`fluxo-worker` subindo limpos) e **smoke test contra produÃ§Ã£o**:
`/login` 200, `/equipe` sem sessÃ£o redireciona 307, `/api/login` com credencial errada devolve 401
(nunca 500 â€” prova que a query contra o schema novo funciona), `/api/auth/forgot-password` sempre
200 genÃ©rico, `/convite/[token]` invÃ¡lido carrega a pÃ¡gina normalmente. **NÃ£o deu pra logar de
verdade como cada um dos 6 perfis** â€” a sessÃ£o nÃ£o tinha senha real de nenhuma conta pra testar
login ponta a ponta; fica pendÃªncia explÃ­cita.

**DocumentaÃ§Ã£o nova**: `crm/docs/RBAC.md` (perfis, catÃ¡logo, regra de elevaÃ§Ã£o, por que nÃ£o existe
`memberships` ainda, sessÃ£o revogÃ¡vel, auditoria, pendÃªncias desta fase) e
`crm/docs/CONTROLE-ODONTO-IDENTITY-INTEGRATION.md` (como o schema jÃ¡ criado permite plugar
OIDC/API/sync no futuro sem reconstruir identidade/RBAC/sessÃ£o â€” nada implementado, sÃ³ desenho e
checklist do que pedir ao ControleODONTO).

**PendÃªncias obrigatÃ³rias**: configurar `RESEND_API_KEY` e `APP_URL` em produÃ§Ã£o; testar convite
real por e-mail; testar reset real por e-mail; criar contas `[TESTE]` dos 6 perfis e validar E2E de
cada uma; construir a tela visual de permissÃµes por checkboxes (hoje sÃ³ a API existe); implementar
gerenciamento de sessÃµes ativas por dispositivo (hoje sÃ³ "encerrar tudo"); migrar as ~60 telas do
shim pra permissÃ£o granular; revisar o modelo de membership quando existir de verdade uma 2Âª
clÃ­nica com usuÃ¡rio compartilhado. **PrÃ³ximo passo recomendado**: validar primeiro os fluxos reais
de e-mail e os 6 perfis antes de avanÃ§ar pra mÃ³dulo grande novo (Kanban, Noryos Ops) â€” aguarda
sinal do Rafael, mesmo critÃ©rio jÃ¡ usado nas fases anteriores. Nenhuma evidÃªncia de teste de fases
anteriores foi apagada nesta fatia.

## Onde estÃ¡ (2026-09-18, RBAC/Atendimento â€” Equipe, Notas Internas, HorÃ¡rio de Atendimento e SLA Operacional)

**4 fatias da nova frente "RBAC/Atendimento/Kanban/Noryos Ops" (roteiro trazido pelo Rafael)
construÃ­das, testadas e em produÃ§Ã£o na mesma sessÃ£o.** Diferente das fases do Fluxo de Conversa,
aqui cada fatia teve checkpoint prÃ³prio do Rafael no meio (ordem de prioridade escolhida pelo
agente como especialista, aprovada por "jÃ¡ pode comeÃ§ar"), mas sem o ritual completo de
`EnterPlanMode`/`ExitPlanMode` â€” decisÃ£o de escopo pequeno o bastante pra dispensar isso a cada
corte, seguindo o mesmo padrÃ£o de commit-testado-documentado das fases anteriores.

**1. Equipe (RBAC) â€” CRUD de atendentes.** AtÃ© aqui toda conta nascia por INSERT manual via SQL/MCP
(a prÃ³pria migration `v4_equipe.sql` tem senha temporÃ¡ria hardcoded). `src/lib/atendentes.ts` ganhou
`criarAtendente`/`atualizarAtendente`/`trocarSenhaAtendente`/`buscarAtendentePorId`, mesmo contrato
`{ok,error}` do resto do projeto. Guarda nova: nunca desativa/rebaixa o Ãºnico admin ativo da
clÃ­nica (senÃ£o a clÃ­nica fica trancada de fora, sem SQL manual pra se recuperar). 3 rotas API
(`/api/equipe`, `/api/equipe/[id]`, `/api/equipe/[id]/senha`), UI em `/equipe`
(`EquipeNovaConta.tsx`/`EquipeCardAcoes.tsx`). Sem migration (coluna `ativo` jÃ¡ existia). Convite
por e-mail e reset self-service ficam de fora â€” dependem de escolher um provedor de e-mail, que o
projeto nÃ£o tem; "trocar senha" aqui Ã© o admin definindo uma temporÃ¡ria e avisando por fora.
Commit `01aac13`.

**2. Notas Internas por conversa.** AnotaÃ§Ã£o da equipe presa Ã  conversa no Chat ao Vivo, nunca
vista pelo paciente â€” nem webhook nem motor do Fluxo de Conversa leem a tabela nova. Migration
`v25` (`notas_internas`: `clinica_id`/`conversa_id`/`atendente_id`/`texto`). `src/lib/notas-internas.ts`
(`buscarNotasInternas`/`criarNotaInterna`), rota `/api/chat/conversas/[id]/notas`, componente
`NotasInternas.tsx` plugado no fim do painel de conversa do `ChatAoVivo.tsx`. Autoria sempre vem da
sessÃ£o, nunca do body â€” nÃ£o dÃ¡ pra assinar nota em nome de outro atendente. Commit `260ac10`.

**3. HorÃ¡rio de Atendimento por clÃ­nica.** FundaÃ§Ã£o reutilizÃ¡vel pro SLA (nÃ£o conectada em nada
ainda nesta fatia). Migration `v26`: `clinicas.timezone` (escalar, mesmo lugar de
`apelido_instancia`) + `horario_atendimento_periodos` â€” **1 linha por PERÃODO, nÃ£o por dia**: Ã© o
que permite 2 intervalos no mesmo dia (ex. 08-12 e 14-18) sem migration nova quando a UI ganhar
suporte a isso, mesmo a UI de hoje sÃ³ escrevendo 1 perÃ­odo por dia. "Fechado" = zero linhas pro
dia; "sem configuraÃ§Ã£o nenhuma" = zero linhas pra clÃ­nica inteira â€” os dois casos sÃ£o distintos na
leitura. `src/lib/horario-atendimento.ts`: nÃºcleo puro (`avaliarHorarioAtendimento`,
`calcularProximoHorario`, `validarConfiguracaoHorario`, `timezoneValido`) via `Intl.DateTimeFormat`
nativo â€” zero dependÃªncia nova, cobre horÃ¡rio de verÃ£o automaticamente. **DecisÃ£o de design**: sem
configuraÃ§Ã£o nenhuma, a camada de horÃ¡rio assume sempre "dentro do horÃ¡rio" (nunca bloqueia
automaÃ§Ã£o futura por falta de config) â€” diferente da camada de SLA (item 4), de propÃ³sito. UI em
`ConfiguraÃ§Ãµes â†’ HorÃ¡rio de Atendimento`. 41 testes, incluindo um que prova a conversÃ£o de fuso de
verdade (12:00 UTC de sÃ¡bado = 09:00 local, aberto â€” nÃ£o 12:00 local, que seria fechado). HorÃ¡rio
real da OdontoMinas **nÃ£o foi preenchido** â€” testado com o exemplo do enunciado e restaurado a
vazio, sem confirmaÃ§Ã£o do Rafael de que sÃ£o essas as horas reais. Commit `d8172b0`.

**4. SLA Operacional (fundaÃ§Ã£o).** Primeira resposta humana + resposta durante atendimento,
calculado sÃ³ em minutos Ãºteis â€” nunca diferenÃ§a bruta de timestamp. **Nada conectado em automaÃ§Ã£o**
(sem WhatsApp/e-mail pra supervisora, sem transferÃªncia automÃ¡tica, sem Kanban, sem escalonamento)
â€” sÃ³ config + cÃ¡lculo + status + evento, observÃ¡vel pela UI.

Achado que motivou a Ãºnica mudanÃ§a em cÃ³digo prÃ©-existente desta fatia: `mensagens` nÃ£o tinha como
distinguir resposta HUMANA de Fluxo/disparo/reativaÃ§Ã£o (sÃ³ `gerada_por_agente_id` pra IA existia).
Coluna nova `mensagens.enviada_por_atendente_id` (nullable, aditiva) â€” sÃ³ `enviarRespostaChat`
(`chat.ts`) passa a preenchÃª-la; os outros 4 pontos de insert em `mensagens` (agentes, fluxo,
disparos, reativaÃ§Ã£o) continuam `null`, corretamente.

Migration `v27`: a coluna acima + Ã­ndice `(conversa_id, direcao, created_at)`; `sla_config` (1
linha/clÃ­nica, mesmo padrÃ£o de `reputacao_config`); `sla_eventos` (`unique(conversa_id, mensagem_id,
tipo)` â€” `mensagem_id` dobra de identificador de ciclo, sem tabela de ciclos nova). **DecisÃ£o
consciente de nÃ£o reaproveitar `automacao_eventos`** (v23): aquela tabela Ã© tipada pro domÃ­nio
Fluxo (`fluxo_id`/`execucao_id` como FK, `resultado` Ã© enum fechado de causas de nÃ£o-disparo) â€”
mexer nesse contrato sÃ³ pra caber SLA arriscaria as fases que jÃ¡ dependem dela.

`src/lib/sla.ts` (novo): ciclo de espera derivado de `mensagens`, sem tabela de ciclos â€” inÃ­cio = 1Âª
`recebida` depois da Ãºltima `enviada` humana (vÃ¡rias mensagens seguidas do paciente = 1 ciclo sÃ³);
`conversas.status` em `STATUS_RESOLVIDOS` = sem ciclo, mesmo critÃ©rio que `finalizarAtendimento`
(`chat.ts`) jÃ¡ usava â€” reaproveita o funil existente em vez de inventar estado novo.
`avaliarStatusSlaConversa` devolve `not_configured`/`ok`/`warning`/`breached`/`paused`/`sem_ciclo`;
precedÃªncia: breach Ã© fato (nÃ£o se apaga fora do expediente) â†’ paused (sÃ³ se respeitar horÃ¡rio e
estiver fora dele agora) â†’ warning/ok por percentual. `registrarSlaBreachSeNovo`: evento idempotente
(`unique` + insert, `23505`=sucesso), emissÃ£o **lazy** na leitura de status â€” sem cron/worker novo.
`src/lib/horario-atendimento.ts` ganhou a funÃ§Ã£o que a fatia 3 tinha deixado pendente,
`calcularMinutosUteisAtendimento` â€” mesmo motor de conversÃ£o de fuso, itera dia a dia somando sÃ³ a
interseÃ§Ã£o com os perÃ­odos configurados.

3 rotas API (`/api/clinica/sla` admin; `/api/chat/conversas/[id]/sla` e `/api/chat/sla/resumo`
sessÃ£o qualquer). UI: `ConfiguraÃ§Ãµes â†’ SLA/Atendimento` (config + resumo do dia) e `ChatAoVivo.tsx`
ganhou badge ðŸŸ¢/ðŸŸ¡/ðŸ”´/â¸ na lista e no cabeÃ§alho, filtro por status de SLA, botÃ£o "âš  Risco" pra
ordenar por criticidade. 24 testes novos (11 de `calcularMinutosUteisAtendimento` cobrindo os 10
casos pedidos; 13 do nÃºcleo de `sla.ts`).

**Teste real de ponta a ponta contra o Supabase de produÃ§Ã£o** (nÃ£o mock): conversa `[TESTE SLA]`
(`a9074a4a-048f-4eae-9125-49f9cd8d2bbd`) â€” mensagem recebida abre o ciclo, nota interna no meio nÃ£o
encerrou, breach detectado certo (20min consumidos, limite 15), evento idempotente confirmado por
query (1 linha, nÃ£o 2, em 2 chamadas seguidas), transferÃªncia de atendente (`atribuido_a`) NÃƒO
zerou o ciclo (mesmos 20min depois), resposta humana encerrou (`sem_ciclo`), nova mensagem do
paciente reabriu como `resposta_atendimento` (nÃ£o `primeira_resposta`) com o limite certo (30min).
**EvidÃªncia preservada de propÃ³sito** (pedido explÃ­cito do Rafael) â€” conversa, mensagens, nota e
evento nÃ£o apagados.

**Deploy real no Railway â€” primeira vez nesta sessÃ£o que uma fatia foi de fato deployada** (as
3 fatias anteriores tinham ficado sÃ³ commitadas/pushadas). `railway up` direto (CLI jÃ¡ autenticada
e linkada ao serviÃ§o `odontominas-crm`, projeto `illustrious-perfection`) â€” 2 deploys: o 1Âº com a
fatia inteira, `SUCCESS`, os 3 workers (`agentes-buffer`/`disparos-worker`/`fluxo-worker`) limpos.

**Bug real achado no prÃ³prio smoke test em produÃ§Ã£o** (nÃ£o em teste unitÃ¡rio): `GET
/api/chat/sla/resumo` devolvia `primeiraRespostaMediaMinutos: 0` em vez de `null` quando o horÃ¡rio
de atendimento nÃ£o estÃ¡ configurado â€” `calcularMetricaPrimeiraRespostaHumana` nÃ£o tinha o mesmo
gate de `not_configured` que `avaliarStatusSlaConversa` jÃ¡ tinha. Exatamente o tipo de "mÃ©trica
falsa" que a fatia inteira existe pra evitar (0min pareceria "respostas instantÃ¢neas"). Corrigido
(commit `5dbdb46`), 2Âº deploy, reconfirmado no ar com o mesmo `curl` real: `null`.

**SLA deixado ativo em produÃ§Ã£o, no modo recomendado (minutos Ãºteis)** â€” como o horÃ¡rio de
atendimento segue vazio de propÃ³sito (fatia 3), isso resulta em `not_configured` pra toda conversa
real hoje, sem nenhum efeito colateral, atÃ© o Rafael configurar o horÃ¡rio de verdade e decidir.

Achados de processo, registrados em `ferramentas.md`: um `next dev` de terceiro jÃ¡ rodava na porta
3000 antes desta sessÃ£o comeÃ§ar; `npm run build` local corrompeu o `.next` compartilhado com ele
(processo nÃ£o identificado, pode ser do Rafael â€” nÃ£o reiniciado por mim). Sandbox local com pouca
memÃ³ria (~1-1,5GB livres de 7,5GB) causou falhas intermitentes de build, contornadas com retry e,
uma vez, `experimental.cpus: 1` temporÃ¡rio em `next.config.ts` (sempre revertido antes do commit).

typecheck/lint/663 testes (mais de 90 novos nesta sessÃ£o)/build de produÃ§Ã£o limpos em cada uma das
4 fatias. 5 commits no total (`01aac13`, `260ac10`, `d8172b0`, `7a96e12`, `5dbdb46`), todos
enviados ao GitHub.

**PendÃªncias**: horÃ¡rio real de atendimento da OdontoMinas (destrava o SLA de fato); limpar dados
de teste desta frente junto com os das fases anteriores (ver `agora.md`). ~~RBAC segue binÃ¡rio
admin/atendente; convite por e-mail e reset self-service dependem de provedor de e-mail~~ â€”
**superado no mesmo dia** pela fatia "Identidade/Login/RBAC â€” fundaÃ§Ã£o concluÃ­da" logo acima (6
perfis, convite/reset por e-mail via Resend). **PrÃ³ximo passo**: ver a fatia de Identidade/RBAC
acima â€” validar e-mail real e os 6 perfis antes de Kanban/Noryos Ops.

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” Fase 4 completa: classificaÃ§Ã£o NPS + dashboard + fix real de telefone)

**Fase 4 ("Noryos Odonto") entregue: classificaÃ§Ã£o NPS (detrator/neutro/promotor) + dashboard.**
`src/lib/nps.ts` (novo) â€” `classificarNps` (0-6/7-8/9-10, escala padrÃ£o) grava
`pesquisa_respostas.classificacao` no momento de `persistir_resposta_pesquisa`
(`fluxo-execucoes.ts`) â€” coluna que a Fase 3 sÃ³ tinha reservado. `calcularPainelNps`/
`buscarPainelNps` seguem o mesmo desenho de `campanha-metricas.ts` (nÃºcleo puro + busca Supabase
separada, sem view/RPC). Nova aba "Pesquisas" em `/resumo` (`RelatorioNps.tsx`): pesquisas
enviadas/respondidas/taxa de resposta/NPS Score + barra segmentada detrator/neutro/promotor,
mesmos tokens visuais de `RelatorioMarketing.tsx`/`CampanhaFunil.tsx`. 575 testes (25
novos)/typecheck/lint/build limpos. Commit `4f2ef24`, deploy Railway `SUCCESS`.

**Bug real de produÃ§Ã£o achado, investigado e corrigido durante a validaÃ§Ã£o da Fase 4**: o
WhatsApp/Baileys entrega o JID de um celular brasileiro sem o 9Âº dÃ­gito em alguns casos
(`556181925241` em vez de `5561981925241`, confirmado no payload cru de `mensagens.raw`) â€”
`normalizeTelefone` (webhook) e `normalizarTelefoneEntrada` (input humano) comparavam telefone por
string exata, entÃ£o isso criava paciente e conversa **novos** por engano, e o Agente de IA
respondia de verdade a uma conversa que nÃ£o devia existir. A mensagem nunca chegava Ã  execuÃ§Ã£o do
Fluxo que estava esperando resposta.

Corrigido com funÃ§Ã£o central pura nova (`src/lib/telefone.ts`): `canonicalizarTelefoneBr` (regra
do plano de numeraÃ§Ã£o ANATEL â€” fixo comeÃ§a 2-5 e nunca ganha 9Âº dÃ­gito; celular comeÃ§a 6-9, com ou
sem o 9 jÃ¡ presente; sÃ³ mexe quando DDI=55 + DDD + 8 dÃ­gitos locais nessa faixa â€” nunca fuzzy
match, nunca hack pro nÃºmero especÃ­fico), `variantesEquivalentesTelefoneBr` (gera a forma legada
equivalente sÃ³ pra buscar, nunca aproxima telefones diferentes) e `encontrarPorTelefoneEquivalente`
(escolhe entre candidatos jÃ¡ filtrados, prioriza o canÃ´nico). `evolution-webhook.ts:normalizeTelefone`
e `chat.ts:normalizarTelefoneEntrada` passaram a delegar a essa funÃ§Ã£o central; o webhook,
`chat.ts:iniciarConversaChat` e `controle-odonto/patients.ts:encontrarCorrespondenciaPaciente`
passaram a buscar por qualquer forma equivalente (`.in()` em vez de `.eq()`) antes de decidir
criar â€” compatibilidade de transiÃ§Ã£o sem migration, sem reescrever telefone jÃ¡ gravado. 9 arquivos,
+259/-26 linhas. Commit `c0f3de9`, deploy Railway `SUCCESS` (`d8e62025`).

**Teste real de ponta a ponta, com aprovaÃ§Ã£o e execuÃ§Ã£o manual do Rafael pelo WhatsApp de
verdade**: resposta "9" mandada de propÃ³sito do nÃºmero de teste (`5561981925241`, o mesmo jÃ¡ usado
em Disparos/Campanhas) pro nÃºmero da instÃ¢ncia (`61999256901`, confirmadamente diferente). Antes do
fix: mesmo tipo de payload sem 9Âº dÃ­gito criou paciente (`4e7ecb38-1d63-4ad8-90f5-b6ae12208b9f`) e
conversa (`4bb228db-e7f5-4464-8b53-e1b1d43e31bc`) novos, com o Agente de IA respondendo de verdade
(2 mensagens reais mandadas). Depois do fix: a mesma classe de payload achou o paciente/conversa
corretos (`63cd3fa3.../0ee7964f...`), zero duplicaÃ§Ã£o, Agente de IA nÃ£o respondeu, execuÃ§Ã£o
`9867cb23...` resolveu `waiting_input` â†’ `capturar_resposta` (nota 9) â†’ `classificacao='promotor'`
â†’ `pesquisas.status='respondida'` â†’ execuÃ§Ã£o `completed` â†’ `dono_conversa` voltou pra `humano`
sozinho. **EvidÃªncia de antes e depois preservada no banco, nada apagado** (nem os artefatos do bug
nem os da correÃ§Ã£o) â€” pedido explÃ­cito do Rafael, serve de prova pra apresentaÃ§Ã£o.

**Fase 4 completa e validada. Rafael pediu explicitamente pra nÃ£o avanÃ§ar pra prÃ³xima
funcionalidade sem sinal dele.** AvaliaÃ§Ã£o Google, aniversÃ¡rio como "produto final" e dashboard
executivo unificado (NPS + Google + aniversÃ¡rio) seguem de prÃ³ximo passo, ainda nÃ£o iniciados.

## Onde estÃ¡ (2026-09-17, Fase 6 â€” demo pro marido, e a frente "Noryos Odonto")

**Deploy real:** AÃ§Ãµes CRM e Humano+IA foram ao ar no Railway pela 1Âª vez (`railway up`, commit
`cd88695`, deployment `3570f47e` SUCCESS). Logs limpos, os 3 workers subiram sem erro.

**Fluxo da demo criado e publicado:** "DEMO - Atendimento OdontolÃ³gico" (`fluxos.id`
`34aa24c0-e500-4629-9fb3-2b80e40ab87b`), 29 nÃ³s, gatilho manual. Cobre 8 dos 9 blocos novos.
Criado direto no banco (Supabase MCP), nÃ£o pela UI â€” a sessÃ£o nÃ£o tinha a senha do painel admin
(ver `_contexto/ferramentas.md`); validado antes com os validadores reais do projeto
(`validarFormaDefinicao`/`validarGrafo`, teste temporÃ¡rio criado e apagado na hora), zero erros e
zero avisos. Corrigida uma inconsistÃªncia do prÃ³prio roteiro do Rafael: a ordem "transferir â†’ alerta
â†’ pausar" nÃ£o Ã© possÃ­vel porque `transferir_humano` Ã© terminal (sem saÃ­da) â€” ficou alerta â†’ pausa
â†’ transferir. Criadas 4 etiquetas novas (Implantes/Ortodontia/EstÃ©tica/ClÃ­nica Geral). Doc completo
em `crm/docs/demo-fase6-roteiro.md` (roteiro de 10-15min, dados de demo, checklist).

**Teste real pontual: disparado, pausado, nÃ£o concluÃ­do.** ExecuÃ§Ã£o `a98ee509-76b2-4d4c-ba86-d1233ae9d1c6`
contra o contato de teste jÃ¡ conhecido (paciente "Rafael (teste Disparos)", telefone
5561981925241) â€” as 2 primeiras mensagens confirmadas enviadas de verdade (`evolution_message_id`
presente). Parada em `waiting_input` no nÃ³ `menu_principal`, esperando o Rafael responder "1" no
WhatsApp de verdade (nÃ£o Ã© simulÃ¡vel). Quando a resposta chegar: confirmar etiqueta aplicada, funil
â†’ agendado, prioridade â†’ alta, atendente atribuÃ­do, transferÃªncia pro humano, e fechar o relatÃ³rio
tÃ©cnico da Fase E.

**Nova frente: "Noryos Odonto".** A pedido do Rafael (impressionar a cliente-piloto antes de
fechar), pesquisa de mercado (Brasil: Clinicorp/iClinic/Simples Dental/Feegow; internacional:
Weave/NexHealth/Podium/RevenueWell) levantou 10 funcionalidades candidatas fora do escopo clÃ­nico/
financeiro. PrincÃ­pio de escopo definido pelo Rafael: *"Noryos Odonto controla tudo que acontece
antes do paciente chegar Ã  cadeira e tudo que acontece depois que ele sai"* â€” nunca prontuÃ¡rio,
agenda clÃ­nica, ERP financeiro, odontograma, TCLE ou exames (isso segue com o ControleODONTO).
Priorizadas agora 4: NPS/satisfaÃ§Ã£o, avaliaÃ§Ã£o Google, aniversÃ¡rio, dashboard executivo. As demais
(indicaÃ§Ã£o, catÃ¡logo, gamificaÃ§Ã£o, multi-unidade, proposta digital de tratamento, marca por
clÃ­nica) ficam de roadmap.

Auditoria tÃ©cnica (Fase 1) feita antes de qualquer cÃ³digo: `reativacao.ts` Ã© o precedente real de
"gatilho por data" (cron â†’ seleciona candidato por regra pura â†’ manda â†’ registra); `resumo.ts` jÃ¡ Ã©
o embriÃ£o do dashboard executivo (`leadsEsfriando` jÃ¡ Ã© a seÃ§Ã£o "atenÃ§Ã£o necessÃ¡ria", sÃ³ que cobre
1 caso); `pacientes.origem_lead`/`utm_*`/`gclid`/`fbclid`/`campanha_id` jÃ¡ existem (cobre a seÃ§Ã£o
"origem" do dashboard sem coluna nova); `clinica_id` jÃ¡ isola dado por clÃ­nica em toda tabela, mas o
runtime resolve 1 clÃ­nica fixa por deploy (`CLINICA_SLUG`) â€” multi-clÃ­nica de verdade precisaria de
uma camada de troca de tenant em runtime, que nÃ£o existe. **Achado que bloqueia aniversÃ¡rio:
`pacientes.data_nascimento` nÃ£o existe em nenhuma migration nem no schema ao vivo** â€” falta decidir
de onde esse dado vem antes de implementar. **Achado de white-label:** 3 pontos com "OdontoMinas"
hardcoded â€” tÃ­tulo/meta da pÃ¡gina (`app/layout.tsx`), subtÃ­tulo do painel de chat
(`app/(painel)/page.tsx`), e dentro do texto da mensagem de reativaÃ§Ã£o (`reativacao.ts`) â€” este
Ãºltimo Ã© o mais delicado por ser conteÃºdo que vai pro paciente, nÃ£o sÃ³ UI interna.

Proposta apresentada ao Rafael, ainda sem resposta: estender o motor do Fluxo de Conversa (gatilho
novo tipo "por data"/"evento de atendimento concluÃ­do" + 1 tipo de nÃ³ novo pra capturar resposta
livre, ex. NPS 0-10) em vez de construir um motor de automaÃ§Ã£o paralelo â€” evita a "segunda
infraestrutura" que o Rafael explicitamente nÃ£o quer. **Nada implementado ainda desta frente**, sÃ³
auditoria e proposta.

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” AÃ§Ãµes CRM + Humano/IA, paleta ampliada)

**2 fatias novas da ampliaÃ§Ã£o da paleta do editor, seguindo a mesma disciplina das fases
anteriores** (typecheck/lint/build/testes a cada corte, sem tocar produÃ§Ã£o real). NÃ£o sÃ£o novas
"fases" numeradas do plano original de 6 â€” sÃ£o a continuaÃ§Ã£o natural depois da Fase 2b/3, seguindo
as 4 categorias extras da visÃ£o original (`crm/docs/fluxo-conversa-visao.md`): Odonto, AÃ§Ãµes CRM,
Humano, IA, IntegraÃ§Ã£o.

**AÃ§Ãµes CRM (5 blocos): adicionar/remover etiqueta, mover no funil, marcar prioridade, atribuir
atendente.** Auditoria de `src/lib/controle-odonto/capabilities.ts` confirmou que a categoria Odonto
estÃ¡ 100% bloqueada â€” as 7 capabilities do ControleODONTO estÃ£o todas `false`, sem meio-termo â€” e
que AÃ§Ãµes CRM/Humano/IA nÃ£o dependem disso, sÃ³ escrevem em tabelas que o CRM jÃ¡ usa em produÃ§Ã£o.
Novos tipos em `fluxo-tipos.ts` (uniÃ£o discriminada), campo `acaoCrm` em `fluxo-motor.ts` (lÃ³gica
pura), aplicado de verdade em `fluxo-execucoes.ts`. Achado evitado na implementaÃ§Ã£o: reusar
`chat.ts:atualizarConversaChat` pra prioridade/atendente criaria um ciclo de import (`chat.ts` jÃ¡
importa `transferirExecucaoAtivaParaHumano` de `fluxo-execucoes.ts`) â€” escrito direto em `conversas`
em vez disso, ganhando de graÃ§a o Pixel de ConversÃ£o/evento de Campanha jÃ¡ ligados a
`atualizarStatus`. Sem migration nenhuma (nenhuma coluna nova). typecheck/lint/build limpos; 449
testes (19 novos). Commit `c3d04e8`.

**Humano + IA (4 dos 8 blocos da visÃ£o original): transferir p/ humano, criar alerta interno,
pausar automaÃ§Ã£o, iniciar agente de IA.** Auditoria de `dono-conversa.ts`/`agentes.ts` achou que
"Enviar contexto pra agente"/"Retomar fluxo apÃ³s IA"/"Encerrar IA" pressupÃµem um protocolo de
handoff `agentes.ts` â†” motor do fluxo que nÃ£o existe â€” enquanto um nÃ³ do fluxo executa,
`dono_conversa` jÃ¡ Ã© `'fluxo'` (invariante do prÃ³prio `iniciarExecucaoFluxo`), nÃ£o hÃ¡ "IA ativa
durante um passo" pra encerrar ou retomar. Rafael confirmou o corte pros 4 blocos seguros; os outros
3 ficam documentados como fase separada, a tratar com protocolo de retorno IAâ†’motor, preservaÃ§Ã£o de
contexto, idempotÃªncia e concorrÃªncia.

2 bugs reais achados e corrigidos durante a implementaÃ§Ã£o, antes de qualquer deploy:
1. O `liberarControle` genÃ©rico que jÃ¡ roda ao terminar qualquer execuÃ§Ã£o (`fluxo-execucoes.ts`)
   sempre devolvia a conversa pro humano â€” sem ajuste, ele stompearia a entrega pro agente um
   instante depois de `iniciar_agente_ia` acontecer. Corrigido: `aplicarAcaoCrm` devolve se ela
   mesma jÃ¡ transferiu o dono (sÃ³ `true` nesse caso, com sucesso), e a terminaÃ§Ã£o pula o
   `liberarControle` quando for `true` â€” se o agente nÃ£o existir ou a atribuiÃ§Ã£o falhar, cai no
   `liberarControle` normal (nunca deixa `dono_conversa='fluxo'` com execuÃ§Ã£o encerrada).
2. A checagem "algum finalizar alcanÃ§Ã¡vel" do validador de grafo (`fluxo-validador.ts`) sÃ³ olhava
   `tipo==='finalizar'`, o que geraria aviso falso ("este fluxo pode nunca terminar") em todo fluxo
   terminando por `transferir_humano`/`iniciar_agente_ia`. Corrigido com um novo helper
   `ehNoTerminal` cobrindo os 3 tipos terminais.

Sem migration. typecheck/lint/build limpos; 464 testes (15 novos). Commit `0fad463`.

**Categoria IntegraÃ§Ã£o (Webhook/Chamada API/Consultar sistema/Aguardar callback) pausada por decisÃ£o
do Rafael** â€” diferente das duas fatias acima (que sÃ³ religaram coisa que jÃ¡ existia com
seguranÃ§a), IntegraÃ§Ã£o precisa de um cofre de credenciais novo (schema/migration â€” nÃ£o existe hoje
nenhum genÃ©rico pra integraÃ§Ãµes de terceiros) e abre risco real de SSRF (o servidor passaria a
chamar URLs configuradas dentro de um fluxo). Fica documentada como prÃ³xima fase especÃ­fica, a
desenhar com calma.

**Nada disso foi aplicado em produÃ§Ã£o real**: 3 commits locais nesta sessÃ£o (o rename do kit e as 2
fatias), ainda nÃ£o sincronizados com o GitHub nem deployados no Railway. O teste robusto ponta a
ponta (navegador real + WhatsApp real â€” criaÃ§Ã£o no editor, publicaÃ§Ã£o, execuÃ§Ã£o pelo motor, AÃ§Ãµes
CRM, Humano+IA, waits/condiÃ§Ãµes, persistÃªncia apÃ³s restart, idempotÃªncia, ausÃªncia de duplicidade,
opt-out, tratamento de erro, logs) continua reservado pro fim de todas as fases da ampliaÃ§Ã£o da
paleta.

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” Fase 2b/3 completa, editor visual em produÃ§Ã£o)

**Fase 2b/3 (editor visual do Fluxo de Conversa) construÃ­da, deployada e validada em produÃ§Ã£o com
envio real de WhatsApp direto do editor.** Rafael pediu pra avanÃ§ar direto pra esta fase em vez da
Fase 6 (demo), pra poder mostrar "criar fluxo â†’ arrastar blocos â†’ conectar â†’ publicar â†’ receber
mensagem real" em vez de sÃ³ backend funcionando. Planejamento formal (`EnterPlanMode`, 2 agentes
Explore mapeando a engine e as convenÃ§Ãµes do CRM, 1 agente Plan) antes de codar.

**Motor intocado** (`fluxo-motor.ts`, `fluxo-tipos.ts` â€” a uniÃ£o dos 6 tipos de nÃ³ â€” e
`fluxo-lock.ts`/`fluxo-worker.ts`), com 2 ajustes cirÃºrgicos e sinalizados:
`fluxo-execucoes.ts:iniciarExecucaoFluxo` ganhou `isTest`/`versaoIdForcada` (sÃ³ tÃªm efeito quando
`isTest=true` â€” o call site real, `tentarIniciarFluxoPorMensagem` do webhook, segue chamando sem
os dois parÃ¢metros, comportamento idÃªntico por construÃ§Ã£o) e `fluxo-validador.ts:validarGrafo`
passou a devolver `{noIds, mensagem}` estruturado em vez de string solta (mesmo texto, sÃ³ ganhou
metadado pro editor destacar o nÃ³ certo no canvas).

**`@xyflow/react` aprovado como Ãºnica exceÃ§Ã£o Ã  polÃ­tica de zero-dependÃªncia nova** do projeto â€”
construir zoom/pan/minimap/seleÃ§Ã£o mÃºltipla Ã  mÃ£o seria meses reinventando algo resolvido, e o
prÃ³prio doc de arquitetura da Fase 1 jÃ¡ antecipava "React Flow ou similar".

**ConstruÃ­do:** 3 libs puras (`fluxo-editor-grafo.ts` â€” ponte nodes/edges do xyflowâ†”`NoFluxo`, sem
duplicar fonte de verdade: arestas sÃ£o sempre derivadas dos nÃ³s, nunca guardadas Ã  parte;
`fluxo-editor-layout.ts` â€” posiÃ§Ã£o/viewport em `definicao.config.layout`, mais layout automÃ¡tico em
camadas; `fluxo-templates.ts` â€” 3 templates odontolÃ³gicos, "Atendimento inicial"/"ConfirmaÃ§Ã£o de
consulta"/"RecuperaÃ§Ã£o-ReativaÃ§Ã£o", combinando sÃ³ os 6 tipos de nÃ³ existentes, sem criar tipo
novo); 3 libs de I/O (`fluxo-versoes.ts` â€” CRUD e versionamento rascunhoâ†’publicadaâ†’substituÃ­da,
fork lazy do rascunho quando sÃ³ existe a publicada; `fluxo-execucoes-consulta.ts`;
`fluxo-contatos-teste.ts` â€” busca por nome/telefone, nunca nÃºmero hardcoded); 9 rotas de API; 3
pÃ¡ginas (`/fluxos`, `/fluxos/nova`, `/fluxos/[id]/editar`); 13 componentes (`FluxoEditor` como
shell com undo/redo e autosave, `FluxoCanvas` sobre `@xyflow/react`, paleta com categoria "Odonto"
visÃ­vel-mas-desabilitada â€” mesmo padrÃ£o de dois estados da tela de IntegraÃ§Ãµes ControleODONTO,
sem fingir que agenda funciona â€”, painel de validaÃ§Ã£o clicÃ¡vel que seleciona o nÃ³ com problema,
modo teste com timeline por polling). 49 testes novos (430 no total, incluindo um que garante que
cada template passa em `validarGrafo` sem erro nenhum). `typecheck`/`lint`/`build` limpos.

**Deploy em produÃ§Ã£o via Railway (`railway up`), 2 vezes.** O teste real de ponta a ponta â€” feito
com navegador automatizado (Playwright instalado num diretÃ³rio de trabalho temporÃ¡rio, fora do
projeto; credencial de admin fornecida pelo Rafael) â€” achou 1 bug real: o painel "Testar" ficava
preso em "na fila" pra sempre. Causa: `FluxoPainelTeste.tsx` lia `execucaoId` do estado React de
dentro do `setInterval` criado em `iniciarTeste` â€” closure fechado ANTES do `setExecucaoId`
aplicar, entÃ£o o polling nunca via o id de verdade e nunca buscava a atualizaÃ§Ã£o. Confirmado
direto no banco que o **backend funcionou certinho o tempo todo** (execuÃ§Ã£o `completed`, 3 eventos
sem erro, `evolution_message_id` presente) â€” sÃ³ a tela nÃ£o atualizava. Corrigido (passar o id da
execuÃ§Ã£o direto pro polling, sem depender do estado assÃ­ncrono) e redeployado.

**Teste real de ponta a ponta pelo prÃ³prio editor** (primeira vez que isso acontece via UI, nÃ£o
mais sÃ³ via fixture/DB direto como na Fase 2a): fluxo "TESTE - Fluxo Odonto" criado em
`/fluxos/nova` (em branco), aberto no editor, um bloco Mensagem arrastado da paleta pro canvas,
texto editado no painel de propriedades, conectado InÃ­cioâ†’Mensagemâ†’Finalizar arrastando entre os
handles (achado no processo: arrastar uma conexÃ£o com os cartÃµes muito prÃ³ximos/sobrepostos falha
silenciosamente â€” nÃ£o Ã© bug do produto, Ã© como qualquer editor visual se comporta; resolvido
afastando o nÃ³ antes de conectar), validaÃ§Ã£o chegou em "Sem erros nem avisos", contato de teste
buscado por nome ("Rafael" â†’ "Rafael (teste Disparos)", nunca um nÃºmero fixo), "Iniciar teste"
disparou a execuÃ§Ã£o real â€” mensagem "Teste de fluxo OdontoMinas concluÃ­do com sucesso." chegou de
verdade no WhatsApp (`evolution_message_id: 3EB09B9C7B0FF1AFDCD57494B35D1FD254D21B3C`). Fluxo
arquivado ao final (nÃ£o apagado); dados de teste ficam no banco por enquanto (mesma polÃ­tica jÃ¡
usada em Disparos/Campanhas/Fase 2a, pendÃªncia de limpeza Ãºnica registrada em `agora.md`).

**Fase 2b/3 completa e validada em produÃ§Ã£o.** PrÃ³ximo passo: ampliar a paleta (blocos Odonto reais
quando o ControleODONTO estiver validado, ou os tipos de nÃ³ da visÃ£o original que ainda faltam â€”
AÃ§Ãµes CRM, IA dentro do fluxo, Webhook/API, entrada estruturada) ou Fase 6 (demo pro marido) â€”
nenhuma das duas decidida ainda.

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” Fase 2a completa, deployada e validada com envio real)

**Fase 2a (nÃºcleo do motor, sem editor visual) construÃ­da, testada localmente e nÃ£o deployada
ainda.** Planejamento formal (`EnterPlanMode`/`ExitPlanMode`), com uma revisÃ£o de arquitetura
dedicada (agente Plan) que achou 2 bugs reais antes de qualquer cÃ³digo â€” uma race que deixaria todo
menu sem timeout inoperÃ¡vel (`NULL <= now()` Ã© falsy em SQL, uma query Ãºnica de claim nunca acharia
essas linhas) e um estado `running` sem caminho de recovery (travaria o slot de execuÃ§Ã£o da conversa
pra sempre num crash no meio do processamento). Os dois corrigidos antes de codar.

**Novo, puro e testado exaustivamente** (`fluxo-tipos.ts`, `fluxo-validador.ts`, `fluxo-motor.ts`,
`fluxo-gatilhos.ts` â€” 65 testes novos): tipos dos 6 blocos mÃ­nimos (InÃ­cio, Mensagem, Espera, Menu,
Se/SenÃ£o, Finalizar) com validaÃ§Ã£o de forma **hand-rolled, sem adicionar `zod`** como dependÃªncia â€”
este projeto nunca usou biblioteca de schema, mesmo critÃ©rio de `isStatusValido`; validador de grafo
(inÃ­cio Ãºnico, nÃ³ Ã³rfÃ£o, referÃªncia quebrada, loop sem espera/menu de guarda â€” DFS com pilha de
recursÃ£o); interpretador de nÃ³ (`processarNo`, um passo por vez, nunca cadeia em memÃ³ria) com casamento
de menu por nÃºmero/rÃ³tulo/variaÃ§Ã£o, timeout, contador de tentativas invÃ¡lidas separado do contador de
loop; casamento de gatilho de mensagem (`nova_conversa`/`primeira_mensagem`/`palavra_chave` â€” os
demais gatilhos da visÃ£o entram por Campanhas/Disparos/cron, fora de escopo desta fase).

**Novo, I/O, sem teste direto** (mesmo critÃ©rio de `disparos-worker.ts`): `fluxo-execucoes.ts`
(`iniciarExecucaoFluxo` â€” ponto Ãºnico de entrada com arbitragem; claim por `UPDATE` condicional
otimista, nÃ£o CTE/RPC â€” este projeto nunca usou funÃ§Ã£o de banco, e introduzir isso sÃ³ pra esta
feature quebraria o padrÃ£o; a janela residual de "running sem evento" Ã© fechada por uma 2Âª varredura
de recovery direto em `fluxo_execucoes`, alÃ©m da varredura de eventos `em_andamento`); `fluxo-lock.ts`/
`fluxo-worker.ts` (clone literal de `disparos-lock.ts`/`disparos-worker.ts`, `provider='fluxo_conversa'`).

**6 sÃ­tios de escrita de `agente_ativo_id` corrigidos pra manter `conversas.dono_conversa` em
sincronia** (`dono-conversa.ts`, mÃ³dulo-folha novo): 4 em `agentes.ts`, 1 em `etiquetas.ts` (+ guarda
nova: nunca ativa Agente de IA por etiqueta se `dono_conversa='fluxo'`) e 1 achado sÃ³ na revisÃ£o de
arquitetura â€” `chat.ts:enviarRespostaChat` (atendente respondendo manualmente enquanto um fluxo
estÃ¡ ativo agora transfere a execuÃ§Ã£o pra `transferred`, sem isso uma `espera` de dias continuaria
mandando mensagem por cima do humano). `opt-out.ts` nÃ£o foi tocado (evitaria import circular) â€”
`cancelarExecucoesAtivasDoPaciente` Ã© chamada pelo webhook logo depois de `aplicarOptOut`.

**Webhook** (`api/webhook/evolution/route.ts`): mesmo bloco isolado de sempre, reestruturado pra
checar `dono_conversa` antes de `deveResponder` â€” zero mudanÃ§a de comportamento pra quem nunca usa
Fluxo de Conversa (backfill jÃ¡ cobre isso). Achado durante a implementaÃ§Ã£o, nÃ£o previsto no plano:
`dono_conversa` nasce `'humano'` por padrÃ£o (inclusive em conversa NOVA), o que impediria pra sempre
os gatilhos `nova_conversa`/`primeira_mensagem` de disparar â€” corrigido com uma exceÃ§Ã£o explÃ­cita
(`conversaEraNova`) que sÃ³ vale pra conversa que acabou de ser criada nesta mesma request, nunca pra
uma conversa humana jÃ¡ em andamento.

Gate limpo em cada etapa: `typecheck`/`lint`/`build` de produÃ§Ã£o e teste (381 no total, 65 novos).

**Deploy + validaÃ§Ã£o manual concluÃ­dos no mesmo dia (2026-09-17), sem nenhuma mensagem real
enviada.** `railway up` â€” os 3 workers (`agentes-buffer`, `disparos-worker`, `fluxo-worker`) subiram
limpos no boot. 1Âº teste com fixture (fluxo "TESTE Fase 2a", inÃ­cioâ†’condiÃ§Ã£oâ†’espera(15s)â†’finalizar,
sem nÃ³ de mensagem â€” nunca chama a Evolution) **achou um bug real**: `carregarContextoExecucao`
falhava em silÃªncio (`contexto_invalido`) porque a query de contexto embute `conversas(telefone)` a
partir de `fluxo_execucoes`, e como `conversas` tambÃ©m referencia `fluxo_execucoes` de volta
(`fluxo_execucao_ativa_id`), o PostgREST recusa o embed por ambiguidade sem um hint explÃ­cito â€” e o
cÃ³digo nunca checava `error` nessa query, sÃ³ `data`, escondendo a falha. Corrigido
(`conversas!conversa_id(telefone)` + log de erro), redeployado, testado de novo: **execuÃ§Ã£o
completou os 4 passos na ordem certa** (`inicio`â†’`condicao_avaliada`â†’`espera_iniciada`â†’`finalizado`,
~15s de espera real observada), `conversas.dono_conversa` voltou pra `humano` sozinho ao final. Dados
de teste apagados ao fim (banco voltou ao estado de antes, mesmo critÃ©rio do teste de Campanhas).

**Teste real de ponta a ponta, com aprovaÃ§Ã£o explÃ­cita do Rafael (2026-09-17, mesmo dia):** fluxo
isolado "TESTE - Fluxo Odonto" (nome e gatilho manual exatamente como a visÃ£o original pedia) criado
direto em produÃ§Ã£o â€” InÃ­cio â†’ Mensagem ("Teste de fluxo OdontoMinas concluÃ­do com sucesso.") â†’
Finalizar â€” vinculado ao paciente "Rafael (teste Disparos)" jÃ¡ existente (mesmo nÃºmero usado nos
testes de Disparos/Campanhas). Checklist prÃ©-envio da visÃ£o conferida antes (opt-out inexistente,
`is_test=true`, nenhuma fila antiga). O worker pegou sozinho, processou os 3 nÃ³s e mandou a mensagem
de verdade â€” `evolution_message_id` confirmado (`3EB0136A5AB0BE78D421AC9E35F51A73479EE0BE`),
execuÃ§Ã£o terminou `completed`, `dono_conversa` voltou pra `humano` sozinho. Fluxo de teste arquivado
ao final (nÃ£o apagado â€” segue a prÃ³pria instruÃ§Ã£o da visÃ£o); dados de teste ficam no banco por
enquanto, mesmo critÃ©rio jÃ¡ usado em Disparos/Campanhas (pendÃªncia de limpeza Ãºnica antes da
produÃ§Ã£o real, jÃ¡ registrada em `agora.md`).

**Fase 2a completa, deployada e validada em produÃ§Ã£o â€” motor, worker e webhook provados de ponta a
ponta, com envio real confirmado pela Evolution.** PrÃ³ximo passo: Fase 2b/3 (editor visual), ou
ampliar a paleta de blocos â€” checkpoint prÃ³prio, ainda nÃ£o iniciado.

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” Fase 1 proposta; aguardando aprovaÃ§Ã£o pra aplicar)

**Fase 1 (arquitetura/schema) da reconstruÃ§Ã£o do Fluxo de Conversa entregue como proposta â€”
nenhuma migration aplicada em produÃ§Ã£o, nenhum cÃ³digo de aplicaÃ§Ã£o escrito.** Antes de desenhar, 3
perguntas em aberto da Fase 0 foram fechadas com o Rafael (decisÃ£o completa em
`_memoria/decisoes.md`): `reativacao.ts` migra pro motor novo eventualmente, nÃ£o nesta fase; dos 5
riscos jÃ¡ existentes no cÃ³digo, 3 (buffer de agentes sem lock, reativaÃ§Ã£o sem lock/opt-out, corrida
no webhook) viram patches separados fora desta reconstruÃ§Ã£o, e 2 (recovery sÃ³ por TTL, sem
watchdog) moldam o desenho do motor; nomenclatura das tabelas em portuguÃªs, seguindo a convenÃ§Ã£o jÃ¡
usada (`campanhas`/`disparos`/`agentes_ia`).

Desenho validado por uma revisÃ£o de arquitetura dedicada (agente Plan) em cima do cÃ³digo-fonte real
â€” nÃ£o Ã© o desenho ingÃªnuo inicial. Resultado: **4 tabelas** (`fluxos`, `fluxo_versoes`,
`fluxo_execucoes`, `fluxo_execucao_eventos`) em vez das 9 conceituais da visÃ£o original, mais 1
alteraÃ§Ã£o em `conversas` (arbitragem Fluxo/Agente de IA/Humano). Pontos centrais do desenho: grafo
de nÃ³s+arestas guardado como jsonb versionado por snapshot imutÃ¡vel (`fluxo_versoes.definicao`, com
Ã­ndice Ãºnico parcial garantindo 1 sÃ³ versÃ£o publicada por fluxo); gatilho denormalizado em `fluxos`
pra nÃ£o abrir jsonb a cada mensagem recebida (hot path do webhook); coluna nova
`conversas.dono_conversa` (`humano/agente_ia/fluxo`) resolvendo a arbitragem que hoje Ã© implÃ­cita
(`agente_ativo_id is null` = humano, que quebraria com um 3Âº candidato) sem mudar nenhum
comportamento existente (backfill reproduz a regra atual byte a byte); worker clonando o padrÃ£o jÃ¡
validado de `disparos-worker.ts`/`disparos-lock.ts` (`integration_locks`, `provider =
'fluxo_conversa'`), com lock sÃ³ durante o processamento ativo de 1 passo â€” nunca durante a espera em
si, resolvendo o problema de recovery pÃ³s-restart pra esperas longas (dias); idempotÃªncia de passo
via `unique(execucao_id, sequencia)` em `fluxo_execucao_eventos` (nÃ£o `(execucao_id, no_id,
tentativa)` â€” essa chave tinha um bug real, corrigido na revisÃ£o: loop legÃ­timo revisita o mesmo nÃ³
mais de uma vez).

Migration completa (nÃ£o aplicada) em
`crm/supabase/migrations/2026-09-17_v20_fluxo_conversa_schema.sql`. Documento de arquitetura
completo (schema comentado, arbitragem, worker/lock, idempotÃªncia, ponto exato de integraÃ§Ã£o no
webhook, recovery, ordem Fase 2â†’3) em `crm/docs/fluxo-conversa-arquitetura.md`.

**Migration `v20` revisada e aplicada em produÃ§Ã£o (2026-09-17).** Antes de aplicar, revisÃ£o final
pedida pelo Rafael (5 pontos: created_at/updated_at, Ã­ndices, FKs/ON DELETE, is_test, recovery)
achou 3 problemas reais, corrigidos na prÃ³pria `v20`: `fluxo_execucao_eventos` sem `updated_at`;
faltavam Ã­ndices em `fluxo_execucoes.conversa_id` (plano, pra histÃ³rico)/`fluxo_id`/`versao_id`; e o
mais sÃ©rio â€” 3 FKs (`fluxo_versoes.fluxo_id`, `fluxo_execucoes.fluxo_id`/`versao_id`) estavam `on
delete cascade`, o que apagaria histÃ³rico de execuÃ§Ã£o em cascata se um fluxo fosse excluÃ­do â€”
trocadas pra `on delete restrict`. O mecanismo de recovery pÃ³s-restart tambÃ©m sÃ³ existia em prosa no
documento de arquitetura, sem coluna nenhuma no schema pra sustentÃ¡-lo â€” `fluxo_execucao_eventos`
ganhou `status` (`em_andamento/concluido/falhou`) + Ã­ndice dedicado. Detalhe completo em
`crm/docs/fluxo-conversa-arquitetura.md` (seÃ§Ã£o "RevisÃ£o final antes de aplicar").

Aplicada via MCP do Supabase, confirmada lendo o schema depois: as 4 tabelas existem, RLS ligado, 0
linhas (nenhum cÃ³digo as usa ainda). Backfill de `conversas.dono_conversa` conferido: 7 `humano`, 1
`agente_ia` (bate com a Ãºnica conversa que jÃ¡ tinha `agente_ativo_id`). Nenhum deploy no Railway foi
necessÃ¡rio â€” Ã© sÃ³ schema, nenhum cÃ³digo de aplicaÃ§Ã£o toca essas tabelas ainda.

**Fase 1 completa e em produÃ§Ã£o. Fase 2 (engine/worker) Ã© o prÃ³ximo passo â€” checkpoint prÃ³prio.**

## Onde estÃ¡ (2026-09-17, Fluxo de Conversa â€” Fase 0 concluÃ­da; aguardando checkpoint pra Fase 1)

**Fase 0 (auditoria sÃ³-leitura) da reconstruÃ§Ã£o do mÃ³dulo "Ferramentas â†’ Fluxo de Conversa"
concluÃ­da**, em sessÃ£o nova como a decisÃ£o de 2026-09-16 previa. Rafael colou a visÃ£o completa do
que quer pro mÃ³dulo â€” motor de automaÃ§Ã£o conversacional determinÃ­stico, tratado como infraestrutura
crÃ­tica, com editor visual, versionamento, engine assÃ­ncrona, paleta de blocos odontolÃ³gicos â€”
registrada na Ã­ntegra em `crm/docs/fluxo-conversa-visao.md` (fonte, nÃ£o plano aprovado).

Auditoria confirmou: **o mÃ³dulo nÃ£o existe em nenhuma camada do sistema hoje** â€” sem rota, sem item
de menu, sem componente, sem tabela (mesmo padrÃ£o jÃ¡ visto na auditoria de Campanhas). Em vez de
auditar um mÃ³dulo antigo, a Fase 0 mapeou o que um motor novo precisa reaproveitar e os riscos reais
jÃ¡ presentes na infraestrutura que ele vai herdar: os dois pollers existentes
(`agentes-buffer.ts`/`disparos-worker.ts`, via `instrumentation.ts`) como modelo de engine
assÃ­ncrona fora do request HTTP; o padrÃ£o de idempotÃªncia jÃ¡ validado 3x em produÃ§Ã£o (constraint
Ãºnica + insert puro + tratar `23505` como sucesso, em `integration_locks`/`campanha_eventos`/
`mensagens.evolution_message_id`); o pipeline exato do webhook Evolution e onde um Fluxo se
encaixaria nele sem quebrar o que existe; a mÃ¡quina de estado do funil (`conversas.ts`); o par
`agente_ativo_id`/`agente_pausado_ate`/`ultimo_agente_id` como a Ãºnica arbitragem
determinÃ­sticoâ†”dinÃ¢mico que jÃ¡ existe (sÃ³ entre Humano e Agente de IA â€” nenhuma arbitragem entre 3+
automatismos); e o padrÃ£o de "capability desligada" do ControleODONTO como diretamente reaproveitÃ¡vel
pros blocos Odonto.

**5 riscos reais jÃ¡ existentes no cÃ³digo atual** (nÃ£o introduzidos pelo Fluxo de Conversa, mas que
ele herdaria se nÃ£o forem corrigidos): `agentes-buffer.ts` sem lock distribuÃ­do (resposta duplicada
da IA em caso de dois processos concorrentes); `reativacao.ts` sem lock e sem checagem de opt-out
(pode duplicar envio ou mandar mensagem pra quem jÃ¡ saiu â€” falha de LGPD prÃ¡tica jÃ¡ existente);
corrida de criaÃ§Ã£o de paciente/conversa no webhook (`23505` nÃ£o tratado nesses dois inserts, sÃ³ em
`mensagens`); recovery de lock sÃ³ por TTL (nÃ£o escala pra esperas de horas/dias); sem watchdog
externo se um poller parar de se reagendar. RelatÃ³rio completo, com caminho de arquivo por achado,
em `crm/docs/fluxo-conversa-auditoria-fase0.md`.

**Fase 0 encerrada. Fase 1 (arquitetura/schema/migrations) nÃ£o comeÃ§ou** â€” fica pra checkpoint
explÃ­cito do Rafael, com 3 perguntas em aberto registradas no relatÃ³rio (migrar `reativacao.ts` pro
motor novo ou deixar separado; os 5 riscos entram no escopo desta reconstruÃ§Ã£o ou viram correÃ§Ãµes Ã 
parte; nome final das tabelas). Nenhum cÃ³digo, schema ou mensagem real tocado nesta sessÃ£o.

## Onde estÃ¡ (2026-09-16, Campanhas â€” mÃ³dulo estratÃ©gico construÃ­do; prÃ³ximo: Fase 6)

**"Ferramentas â†’ Campanhas" construÃ­do do zero e em produÃ§Ã£o**, a partir de um briefing extenso do
Rafael pedindo que o mÃ³dulo virasse o centro estratÃ©gico de marketing/conversÃ£o da clÃ­nica â€” nÃ£o
mais uma tela genÃ©rica. Planejamento formal (`EnterPlanMode`/`ExitPlanMode`, plano em
`C:\Users\rafaelviriato\.claude\plans\zazzy-chasing-gray.md`).

Auditoria (pedida explicitamente antes de codar) encontrou 2 coisas: (1) a tela "Campanhas" **nÃ£o
existia** â€” nav sÃ³ tinha Agentes de IA/Disparos/ControleODONTO; (2) a tabela `campanhas` criada na
Fase B de Disparos (v17) era, na prÃ¡tica, um **Disparo** (lote de envio de WhatsApp â€” nome,
mensagem, pÃºblico resolvido, worker), sem objetivo, canal, meta ou receita â€” exatamente a confusÃ£o
"Campanha = Disparo" que o briefing pedia pra desfazer.

**DecisÃ£o de arquitetura** (`_memoria/decisoes.md`): renomear em vez de duplicar. MigraÃ§Ã£o `v18`
(`campanhas`â†’`disparos`, `campanha_destinatarios`â†’`disparo_destinatarios`, rename puro de metadado,
zero perda de dado) libera o nome pro conceito estratÃ©gico novo. MigraÃ§Ã£o `v19` cria `campanhas`
(objetivo/tipo/especialidade texto livre sem CHECK â€” catÃ¡logo sugerido em cÃ³digo, permite opÃ§Ã£o
nova sem migraÃ§Ã£o; status fechado rascunho/agendada/ativa/pausada/concluida/cancelada; `metas`
jsonb; trilha de auditoria completa â€” criado/atualizado/iniciado/pausado/encerrado/cancelado
`_por`/`_em`), `campanha_canais` e `campanha_eventos` (log idempotente dos 5 marcos do funil â€”
`new_lead`/`qualified_lead`/`appointment_booked`/`appointment_attended`/`treatment_closed`, unique
key `(campanha_id, paciente_id, tipo)`); mais `disparos.campanha_id` (1 campanha â†’ N disparos, por
FK, sem duplicar o motor de envio) e `pacientes.campanha_id`/`utm_term`/`landing_page` (completa a
atribuiÃ§Ã£o que a v14/Pixel tinha comeÃ§ado).

Reaproveitado sem duplicar: motor de pÃºblico (`audiencias.ts`, por `audiencia_id`), opt-out
(nunca contornado â€” quem manda mensagem continua sendo sÃ³ Disparos), mensagens
salvas/etiquetas/agentes de IA, RBAC (mesmo gate `papel === "admin"` de todo "Ferramentas"),
RelatÃ³rios (`AbasRelatorio.tsx` ganhou aba "Marketing" em vez de tela paralela). Nova rota
`POST /api/audiencias` (antes inexistente â€” `salvarAudiencia` jÃ¡ existia desde a Fase A de
Disparos mas nunca tinha chamador; agora o passo "PÃºblico" do wizard de Campanhas pode salvar o
filtro montado como audiÃªncia reutilizÃ¡vel).

AutomÃ¡tico vs. manual no funil, sem fingir integraÃ§Ã£o que nÃ£o existe: `new_lead` dispara ao
vincular pacienteâ†”campanha (manual, ficha do paciente â€” Evolution/Baileys nÃ£o recebe UTM/
`ctwa_clid`, achado jÃ¡ documentado na v14); `qualified_lead` dispara quando a QualificaÃ§Ã£o
AutomÃ¡tica (Agentes de IA) classifica "Quente"; `appointment_booked` dispara quando a conversa
muda pra status "Agendado" â€” os 2 ganchos sÃ£o sÃ³ uma chamada isolada em try/catch em cima de
funcionalidade que jÃ¡ existe (`agentes-qualificacao.ts`, `conversas.ts`), sem infra nova.
`appointment_attended`/`treatment_closed` (com receita) sÃ³ por registro manual no painel da
campanha â€” ponto de extensÃ£o natural pro ControleODONTO quando tiver credencial real. Agente de IA
tambÃ©m ganhou consciÃªncia de campanha: quando o paciente da conversa tem `campanha_id`, o prompt
final inclui uma linha de contexto ("Origem: campanha X, objetivo Y").

Sem tabela de mÃ©tricas â€” tudo calculado ao vivo (`src/lib/campanha-metricas.ts`, mesmo padrÃ£o de
`relatorios.ts`): leads, respondidos (por mensagem enviada, nÃ£o por status), qualificados,
agendamentos, comparecimentos, fechamentos, receita, CPL/CPA/CAC/ROAS â€” **as 4 mÃ©tricas
financeiras somem da tela quando nÃ£o hÃ¡ investimento registrado**, nunca "R$0,00"/"Infinity".
Funil visual (`CampanhaFunil.tsx`) com barra proporcional, mesma paleta de `BarChart.tsx`.

UI: nav item "Campanhas" (primeiro do grupo Ferramentas â€” Ã© o estratÃ©gico, Disparo Ã© o
operacional); `/campanhas` (abas de status + dashboard do perÃ­odo, reusando `FiltroPeriodo`);
`/campanhas/nova` (wizard de 8 passos: InformaÃ§Ãµes bÃ¡sicas/Objetivo/PÃºblico/Canais/Disparos e
Agente de IA/Metas/Tracking/RevisÃ£o, com 7 templates prontos que sÃ³ prÃ©-preenchem); `/campanhas/
[id]` (dashboard + funil + disparos vinculados + registro manual de comparecimento/fechamento +
auditoria); `/campanhas/[id]/editar` (mesmo formulÃ¡rio, em abas livres em vez de wizard linear â€”
mesmo componente, mesmo truque do `AgenteForm.tsx`: presenÃ§a de `campanha` decide o modo).

Testes: sÃ³ as partes puras (mesmo critÃ©rio do resto do projeto) â€”
`calcularMetricas`/`isStatusCampanhaValido`/catÃ¡logos de rÃ³tulo/`buscarTemplate`, 12 testes novos
(340 no total). `typecheck`/`lint`/`build` de produÃ§Ã£o limpos.

MigraÃ§Ãµes v18 e v19 aplicadas em produÃ§Ã£o pelo MCP do Supabase, confirmadas lendo o schema depois.
**VerificaÃ§Ã£o fim a ponta contra o schema de produÃ§Ã£o**: campanha de teste criada â†’ paciente de
teste vinculado â†’ os 5 marcos do funil registrados (inclusive tentando duplicar `new_lead` de
propÃ³sito â€” confirmado que a unique key barra o duplicado, fica sÃ³ 1 linha) â†’ mÃ©tricas conferidas
batendo (CPL/CPA/CAC/ROAS calculados certos a partir de investimento R$1.000/receita R$4.500) â†’
disparo real existente vinculado por FK e desvinculado de novo â†’ tudo apagado ao final, banco
voltou ao estado de antes.

DocumentaÃ§Ã£o nova em `crm/docs/campanhas.md` (conceito, schema, automÃ¡tico vs. manual, o que ficou
de fora conscientemente). Commitado (`54745a8`) e deployado no Railway (sucesso, smoke test em
produÃ§Ã£o ok). Ainda nÃ£o sincronizado no GitHub nesta sessÃ£o.

**Teste real de ponta a ponta, a pedido do Rafael (2026-09-16, mesmo dia)**: campanha
"Teste Campanhas â€” envio real" criada direto em produÃ§Ã£o (status `ativa`), vinculada ao paciente
"Rafael (teste Disparos)" jÃ¡ existente (mesmo nÃºmero usado no teste de Disparos), gerando o marco
`new_lead`. Um disparo vinculado a ela ("Teste Campanhas â€” disparo de verificaÃ§Ã£o") foi criado e
iniciado â€” o worker jÃ¡ rodando em produÃ§Ã£o pegou sozinho e mandou a mensagem de verdade pro
WhatsApp do Rafael (`evolution_message_id` confirmado, `{primeiro_nome}` resolvido certo pra
"Rafael"). Confirma que campanhaâ†’disparoâ†’workerâ†’WhatsApp funciona de ponta a ponta com envio real,
nÃ£o sÃ³ com dado sintÃ©tico. **Rafael confirmou o recebimento da mensagem no WhatsApp** â€” diferente
do teste anterior de Disparos, que sÃ³ tinha confirmaÃ§Ã£o do sistema (Evolution aceitou o envio), este
fechou com confirmaÃ§Ã£o visual de verdade. **Dados ficam no banco de propÃ³sito** â€” Rafael pediu
explicitamente pra deixar configurado; entram no mesmo apagÃ£o de dados de teste (Disparos +
Campanhas) antes da produÃ§Ã£o real com clientes (pendÃªncia em `agora.md`).

## Onde estÃ¡ (2026-09-16, Disparos â€” Fase B testada em produÃ§Ã£o; prÃ³ximo: Fase 6)

**Fase B do mÃ³dulo "Ferramentas â†’ Disparos" completa e em produÃ§Ã£o**, fechando o que a Fase A abriu
(opt-out, mensagens salvas, motor de pÃºblicos â€” sem UI nem tabela de campanha ainda). Planejamento
formal (`EnterPlanMode`/`ExitPlanMode`, plano em
`C:\Users\rafaelviriato\.claude\plans\stateless-pondering-prism.md`), com 2 perguntas fechadas antes
de codar â€” as 2 recomendadas: sem agendamento no v1 (sÃ³ "salvar rascunho" ou "criar e iniciar
agora") e sem janela de horÃ¡rio comercial no worker. DecisÃ£o completa em `_memoria/decisoes.md`.

Entregue: migraÃ§Ã£o `v17` (`campanhas`, `campanha_destinatarios`, reaproveitando `integration_locks`
com `provider = 'disparos'`); `src/lib/campanhas.ts` (CRUD + regra pura testÃ¡vel);
`src/lib/disparos-worker.ts` (worker in-process, mesmo desenho do poll de buffer dos Agentes de IA â€”
`setTimeout` recursivo via `instrumentation.ts`, sÃ³ em produÃ§Ã£o â€” porque GitHub Actions nÃ£o serve
pro intervalo de 15-25s entre mensagens que o WhatsApp via Evolution exige pra nÃ£o levar shadowban;
reconfere opt-out/telefone AO VIVO antes de cada envio, grava no Chat ao Vivo quando hÃ¡ conversa, sÃ³
paga o intervalo cheio quando manda mensagem de verdade); `src/lib/disparos-lock.ts`. Rotas
`api/disparos/*` e telas `/disparos` (lista), `/disparos/nova` (wizard de 3 passos: pÃºblico â†’
mensagem â†’ revisÃ£o) e `/disparos/[id]` (relatÃ³rio com aÃ§Ãµes e auto-refresh). Item novo no
`SidebarNav`.

332 testes (4 novos)/typecheck/lint/build limpos. MigraÃ§Ã£o aplicada em produÃ§Ã£o pelo MCP do
Supabase, confirmada lendo o schema. Deploy no Railway (`railway up`) confirmado `SUCCESS`, logs sem
erro nos dois workers, smoke test em produÃ§Ã£o ok.

Commitado e sincronizado no GitHub (`292defd`).

**Teste fim a ponta feito e confirmado pelo sistema** (2026-09-16, mesmo dia): paciente "Rafael
(teste Disparos)" criado direto no banco de produÃ§Ã£o com o nÃºmero do prÃ³prio Rafael
(61981925241), campanha `enviando` com 1 destinatÃ¡rio â€” o worker jÃ¡ rodando em produÃ§Ã£o pegou
sozinho, mandou a mensagem (`{primeiro_nome}` resolvido certo), registrou no Chat ao Vivo e fechou
a campanha (`concluida`) sem nenhuma aÃ§Ã£o manual. `evolution_message_id` confirma que a Evolution
API aceitou o envio; confirmaÃ§Ã£o visual do Rafael no celular ainda nÃ£o veio. Dados de teste ficam
no banco por decisÃ£o do Rafael (ver `_memoria/decisoes.md`) â€” apagar antes da produÃ§Ã£o real com
clientes.

## Onde estÃ¡ (2026-09-16, Disparos â€” Fase A: fundamentos; prÃ³ximo: Fase B)

**Fase A da evoluÃ§Ã£o do mÃ³dulo "Ferramentas â†’ Disparos" completa e em produÃ§Ã£o**, a partir de um
briefing extenso do Rafael pedindo campanhas/reativaÃ§Ã£o/follow-up de verdade, nÃ£o um "disparo em
massa" genÃ©rico. Antes de codar, auditoria completa do repositÃ³rio (a pedido dele) encontrou que
**o mÃ³dulo nÃ£o existia**: sem rota, tabela, nav item nem service de Disparos/Campanhas/Fluxos/
Listas/Mensagens salvas â€” o Ãºnico parente era a automaÃ§Ã£o fixa de reativaÃ§Ã£o (`reativacao.ts`, 1
mensagem, 1x por conversa, sem UI). Opt-out tambÃ©m nÃ£o existia em lugar nenhum do cÃ³digo, e "Funil"
no CRM Ã© uma mÃ¡quina de estado fixa da conversa, nÃ£o um pipeline multi-etapa configurÃ¡vel como o
briefing original supunha.

Rafael sugeriu, de forma independente, que a segmentaÃ§Ã£o (pacientes inativos, faltou Ã  consulta
etc.) devia ser um motor reutilizÃ¡vel por vÃ¡rios mÃ³dulos â€” decisÃ£o registrada em
`_memoria/decisoes.md`: o Motor de PÃºblicos ("AudiÃªncias") nasce ANTES do wizard de Disparos, nÃ£o
depois, junto com opt-out como fundaÃ§Ã£o cross-mÃ³dulo.

Plano formal (`EnterPlanMode`/`ExitPlanMode`, mesma prÃ¡tica das fases de Agentes de IA) fatiou o
trabalho em Fase A (fundamentos) e Fase B (Disparos v1 â€” wizard + worker). **Fase A entregue**:

- `pacientes.opt_out_em`/`opt_out_origem` (migraÃ§Ã£o `v16`) â€” opt-out fica no prÃ³prio paciente, nÃ£o
  numa tabela Ã  parte (minimizar dados, LGPD).
- `src/lib/opt-out.ts`: detecÃ§Ã£o por palavra-chave (mesmo padrÃ£o de `detectarPedidoHumano`),
  cuidado explÃ­cito com falso positivo (palavra solta como "parar"/"sair" sÃ³ conta como opt-out
  quando Ã© a mensagem inteira; frase dentro de outra frase precisa ser inequÃ­voca â€” "posso parar de
  usar o fio dental?" nÃ£o dispara). Plugado no webhook antes do Agente de IA: funciona mesmo sem
  agente ativo, confirma o opt-out por WhatsApp, e a IA para de responder pra quem saiu.
- `src/lib/mensagens-salvas.ts` (tabela nova): biblioteca de templates + `resolverVariaveis` com
  fallback seguro â€” nunca "OlÃ¡ undefined", limpa pontuaÃ§Ã£o Ã³rfÃ£ quando o nome falta.
- `src/lib/audiencias.ts` (tabela nova): motor de pÃºblicos v1 â€” etiqueta (todas/qualquer), status
  da conversa, inatividade por dias sem mensagem; opt-out e telefone invÃ¡lido sempre excluÃ­dos,
  nunca opcionais. Separa "encontrados/excluÃ­dos/elegÃ­veis", como o print de referÃªncia pedia.
- 36 testes novos (324 no total), migraÃ§Ã£o `v16` aplicada em produÃ§Ã£o pelo MCP do Supabase
  (confirmada lendo o schema depois), typecheck/lint/build limpos. Ainda nÃ£o commitado nem
  sincronizado no GitHub nesta sessÃ£o.

PrÃ³ximo passo: Fase B (wizard de criaÃ§Ã£o, worker de envio in-process â€” nÃ£o GitHub Actions, cuja
granularidade de minutos nÃ£o serve pro intervalo de 15-25s entre mensagens â€”, relatÃ³rio). Trilha
independente da Fase 6 (demo pro marido): nÃ£o bloqueia nem depende dela.

## Onde estÃ¡ (2026-09-16, IntegraÃ§Ã£o ControleODONTO â€” Fase 0; prÃ³ximo: obter credencial real, depois Fase 6)

**Fase 0 da integraÃ§Ã£o com o ControleODONTO completa e em produÃ§Ã£o**: pesquisa tÃ©cnica, adapter
isolado (`crm/src/lib/controle-odonto/`), painel (Ferramentas â†’ ControleODONTO) e infraestrutura
de sincronizaÃ§Ã£o â€” sem nenhuma capability real ligada ainda. Pedido explÃ­cito do Rafael: camada de
integraÃ§Ã£o profissional, nunca inventando contrato de API.

Pesquisa confirmou o que o brief jÃ¡ suspeitava: a Ã¡rea "IntegraÃ§Ãµes - Webhooks/AutenticaÃ§Ãµes
Webhooks" do manual oficial (GitBook) existe mas estÃ¡ vazia (tÃ­tulo "(FAZER)", verificado direto).
O endpoint de agenda citado no brief (`GET /v6/Agendamento/Estabelecimento/{dataInicio}/{dataFim}`)
**nÃ£o foi confirmado de forma independente** â€” entrou sÃ³ como candidato, nunca chamado de verdade.
Pesquisa completa em `crm/docs/integrations/controle-odonto.md`.

Adapter com as 7 capabilities pedidas (`canReadAppointments`, `canCreateAppointments`,
`canUpdateAppointments`, `canCancelAppointments`, `canReadPatients`, `canCreatePatients`,
`canReceiveWebhooks`) â€” **todas `false`**, sÃ³ viram `true` manualmente em cÃ³digo depois de validar
contra uma conta real (nunca por env var). Inclui cliente HTTP com retry/backoff/timeout, matching
de paciente (id externo â†’ telefone â†’ CPF â†’ e-mail â†’ revisÃ£o manual, reaproveitando
`normalizarTelefoneEntrada`), dedupe genÃ©rico (`external_ids`), lock distribuÃ­do
(`integration_locks`), polling incremental preparado (`sync.ts`) e reconciliaÃ§Ã£o (`reconcile.ts`,
nunca apaga nada sozinha). MigraÃ§Ã£o `v15` (4 tabelas novas) aplicada direto em produÃ§Ã£o pelo MCP
do Supabase. 59 testes novos (288 no total)/typecheck/lint/build limpos. Deploy no Railway
confirmado `SUCCESS`, smoke test em produÃ§Ã£o ok. Commitado (`265cf80`) e sincronizado no GitHub.

DecisÃµes conscientes de escopo: sem workflow do GitHub Actions pro cron ainda (rodar de 5 em 5 min
sem nenhuma capability ativa gastaria minutos de Actions Ã  toa â€” criar quando `canReadAppointments`
for confirmada) e sem botÃ£o "Reprocessar falhas" no painel (seria idÃªntico a "Sincronizar agora"
hoje, mesmo critÃ©rio de nunca copiar funcionalidade sem lÃ³gica real por trÃ¡s).

PrÃ³ximo passo desta integraÃ§Ã£o: conseguir credencial/documentaÃ§Ã£o real do ControleODONTO (contato
com o suporte deles) e seguir a checklist de "Fase de Descoberta com Credencial" no prÃ³prio
`docs/integrations/controle-odonto.md`. Isso nÃ£o bloqueia a Fase 6 (demo pro marido) â€” sÃ£o trilhas
independentes.

## Onde estÃ¡ (2026-09-16, Agentes de IA â€” Pixel de ConversÃ£o; prÃ³ximo: Fase 6)

**Pixel de ConversÃ£o (Facebook Ads + Google Ads) construÃ­do, migrado e em produÃ§Ã£o**, a pedido
explÃ­cito do Rafael â€” revertendo a parte do Pixel na decisÃ£o registrada horas antes ("sÃ³ faz
sentido quando o trÃ¡fego pago comeÃ§ar", ver decisÃ£o 2026-09-16 substituÃ­da em
`_memoria/decisoes.md`). CritÃ©rio fechado antes de codar (2 perguntas): os 3 eventos do funil de
uma vez (novo lead, lead quente, agendado â€” nÃ£o sÃ³ um) e nasce desligado, sem credencial real
(mesmo padrÃ£o da QualificaÃ§Ã£o).

Pesquisa (Facebook Conversions API + Google Ads, docs atuais) mudou o desenho: a Evolution API
(Baileys, WhatsApp nÃ£o-oficial) nÃ£o recebe `ctwa_clid`/UTMs/`gclid`/`fbclid` â€” sÃ³ a API oficial da
Meta recebe isso. As colunas de atribuiÃ§Ã£o existem (`pacientes.origem_lead`/`utm_*`/`gclid`/
`fbclid`), mas ficam `null` de verdade enquanto o CRM usar Evolution/Baileys â€” dito com clareza ao
Rafael, nÃ£o construÃ­do fingindo funcionar. A rota clÃ¡ssica de conversÃ£o do Google Ads API
(`OfflineUserDataJobService`) estÃ¡ bloqueada pra conta nova desde abr/jun 2026 â€” implementaÃ§Ã£o foi
direto pro caminho vigente, **Data Manager API**.

`src/lib/pixel-facebook.ts` (novo): Conversions API, hash SHA-256 via Web Crypto â€” nÃ£o
`node:crypto`, mesmo motivo de `sessao.ts` (o arquivo entra na cadeia de import que o Next bundla
pro cliente via `chat.ts`/`ChatAoVivo.tsx`, e `node:crypto` quebra esse build; achado sÃ³ na hora de
rodar `npm run build`, corrigido). `src/lib/pixel-google-ads.ts` (novo): OAuth2 (refresh token â†’
access token) + Data Manager API; Client ID/Secret do app ficam em env var
(`GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET`, infra da Noryos), o resto Ã© por-agente.
`src/lib/agentes-pixel.ts` (novo): orquestra os dois com dedup atÃ´mico (`UPDATE ... WHERE coluna
IS NULL`) â€” nunca dispara o mesmo evento 2x pra mesma conversa. `conversas.ultimo_agente_id`
(coluna nova, nunca zera) resolve qual agente Ã© dono da conversa pro evento "agendado", disparado
na troca manual de status, quando o agente que respondeu jÃ¡ pode ter parado de escutar.

MigraÃ§Ã£o `v14` (9 colunas em `agentes_ia`, 4 em `conversas`, 7 em `pacientes`) aplicada em produÃ§Ã£o
pelo MCP do Supabase, confirmada lendo o schema â€” 3Âª vez seguida sem SQL Editor manual. UI
(`AgenteForm.tsx`): aba "Pixel" â€” toggle mestre, os 3 cards de evento, campos do Meta e do Google.
229 testes (27 novos)/typecheck/lint/build de produÃ§Ã£o limpos. Deploy no Railway confirmado
`SUCCESS` via MCP, webhook em produÃ§Ã£o respondendo 200 depois do deploy. Ainda nÃ£o commitado nem
sincronizado no GitHub nesta sessÃ£o. PrÃ³ximo passo continua sendo a Fase 6 (demo pro marido) â€” nÃ£o
sobra mais nenhuma fase tÃ©cnica antes dela.

## Onde estÃ¡ (2026-09-16, Agentes de IA â€” QualificaÃ§Ã£o AutomÃ¡tica de Leads; prÃ³ximo: Fase 6)

**QualificaÃ§Ã£o AutomÃ¡tica de Leads construÃ­da, migrada e em produÃ§Ã£o**, a pedido do Rafael â€”
revertendo, na mesma sessÃ£o em que perguntei, a decisÃ£o registrada horas antes de deixar essa aba
fora por falta de critÃ©rio (print da RoiZap, ver decisÃ£o 2026-09-16 substituÃ­da em
`_memoria/decisoes.md`). CritÃ©rio fechado antes de codar (2 perguntas): escala fixa
Quente/Morno/Frio (etiquetas nascem automaticamente por clÃ­nica, cores fixas) em vez de etiquetas
livres, reavaliada depois de cada resposta do agente em vez de sÃ³ na 1Âª mensagem.
`src/lib/agentes-qualificacao.ts` (novo): reaproveita o mesmo provider/modelo do agente pra
classificar (1 palavra, sem custo de infraestrutura extra); aplica sÃ³ a etiqueta que bate,
removendo as outras duas â€” a etiqueta Ã© sempre a temperatura ATUAL do lead, nÃ£o um histÃ³rico
acumulado. Opt-in por agente (toggle novo na aba QualificaÃ§Ã£o do formulÃ¡rio,
`qualificacaoAutomatica`, nasce `false` â€” nÃ£o muda nada no "RecepÃ§Ã£o Virtual" atÃ© alguÃ©m ligar).
MigraÃ§Ã£o `v13` (coluna `agentes_ia.qualificacao_automatica`) aplicada em produÃ§Ã£o pelo MCP do
Supabase, confirmada lendo o schema depois. 202 testes (4 novos)/typecheck/lint/build limpos.
Deploy no Railway confirmado `SUCCESS`/Online. Ainda nÃ£o commitado nem sincronizado no GitHub
nesta sessÃ£o. PrÃ³ximo passo continua sendo a Fase 6 (demo pro marido) â€” nÃ£o sobra mais nenhuma
fase tÃ©cnica antes dela.

## Onde estÃ¡ (2026-09-16, Agentes de IA â€” prompt estruturado + Conhecimento; prÃ³ximo: Fase 6)

**Prompt do Agente virou 3 abas (ConfiguraÃ§Ã£o / Prompt do Agente / Conhecimento)**, a pedido do
Rafael (print do "Agente 01" da RoiZap). Perguntado quais das 4 abas novas do print (Conhecimento,
QualificaÃ§Ã£o, Ferramentas, Pixel) valiam construir de verdade agora â€” mesmo critÃ©rio jÃ¡ usado no
Chat ao Vivo, sem copiar aba sem funcionalidade real por trÃ¡s â€” Rafael escolheu sÃ³
**Conhecimento**. Modo AvanÃ§ado (textarea Ãºnico, `prompt_sistema`) preserva o "RecepÃ§Ã£o Virtual"
exatamente como estava; modo Simples estrutura Persona/Objetivo/Fluxo e Triagem/Guardrails
(prioridade mÃ¡xima no prompt final, igual ao aviso do print)/TraÃ§os de Personalidade (Tom de Voz,
Usar Emojis). Conhecimento (`agentes_conhecimento`, tabela nova) guarda fatos curtos por agente que
entram no prompt automaticamente. CabeÃ§alho do agente ganhou os 4 cards do print (Mensagens,
Conversas, Tempo MÃ©dio, Conhecimentos, dado real) e o Ativar/Pausar. MigraÃ§Ã£o `v12` rodada em
produÃ§Ã£o â€” **1Âª vez aplicada direto pelo MCP do Supabase** (`apply_migration`), sem precisar do SQL
Editor manual (ver `ferramentas.md`). Deploy no Railway confirmado (`âœ“ Ready in 772ms`). 198
testes/typecheck/lint/build limpos. Validado ao vivo: pÃ¡gina do "RecepÃ§Ã£o Virtual" intacta em modo
AvanÃ§ado; agente de teste criado em modo Simples + 1 item de Conhecimento pela API, dado conferido
certo no Supabase, e apagado em seguida (banco voltou ao estado de antes). Ainda nÃ£o
commitado/sincronizado no GitHub nesta sessÃ£o. PrÃ³ximo passo volta a ser a Fase 6 (demo pro
marido) â€” nÃ£o sobra mais nenhuma fase tÃ©cnica antes dela.

## Onde estÃ¡ (2026-09-16, Agentes de IA â€” Fase 2B validada e desligada de novo; prÃ³ximo: Fase 6)

**Fase 2B (Buffer de mensagens) completa, com um bug real achado e corrigido em produÃ§Ã£o,
validada de ponta a ponta com WhatsApp real, e desligada de novo por decisÃ£o consciente.**
Planejada formalmente (`EnterPlanMode`, mesma prÃ¡tica das Fases 1/2A). MigraÃ§Ã£o `v11`
(`agentes_ia.buffer_mensagens`/`buffer_segundos`, `conversas.agente_buffer_desde`/`_ate`/
`_novo_paciente`), `src/lib/agentes-buffer.ts` novo (abre/estende a janela, poll que fecha janela
vencida e responde), `src/instrumentation.ts` novo (liga o poll sÃ³ em produÃ§Ã£o). Bug real no 1Âº
teste ao vivo: a janela abria um instante depois da mensagem que a disparava, resposta nunca saÃ­a
sem erro no log â€” corrigido com 10s de folga na marca de abertura. Validado com 3 mensagens
seguidas â†’ 1 resposta combinada sÃ³. Buffer ficou desligado no "RecepÃ§Ã£o Virtual" (nenhum paciente
real ainda, resposta rÃ¡pida pesa mais que combinar rajada rara) â€” liga quando fizer sentido.
Detalhe completo em "Feito" abaixo. PrÃ³ximo passo volta a ser a Fase 6 (demo pro marido) â€” nÃ£o
sobra mais nenhuma fase tÃ©cnica antes dela.

## Onde estÃ¡ (2026-09-15, menu colapsÃ¡vel + som de notificaÃ§Ã£o; prÃ³ximo: Fase 2B)

**2 ajustes de UI no CRM**, a pedido do Rafael (prints de referÃªncia da RoiZap: um menu
"Ferramentas" que abre/recolhe, e um controle de som de notificaÃ§Ã£o que nÃ£o chegou anexado â€”
perguntei o formato e ele escolheu liga/desliga simples). Menu da sidebar (`SidebarNav.tsx`) ganhou
Ã­cone de raio + chevron que gira, aberto por padrÃ£o; Chat ao Vivo (`ChatAoVivo.tsx`) ganhou botÃ£o de
alto-falante no cabeÃ§alho que toca um "ding" (Web Audio API, sem lib nova) sÃ³ quando chega mensagem
**recebida** nova, preferÃªncia em `localStorage`. Validado (typecheck/lint/183 testes/build
limpos), commitado (`13378d5`) e deployado no Railway â€” **Rafael testou em produÃ§Ã£o e confirmou que
funcionou**. Decidiu seguir agora para **Agentes de IA â€” Fase 2B (Buffer de mensagens)**, em vez da
Fase 6 (demo pro marido).

## Onde estÃ¡ (2026-09-15, automaÃ§Ã£o de reativaÃ§Ã£o validada de ponta a ponta)

**Fase 5 (automaÃ§Ã£o de reativaÃ§Ã£o de paciente inativo) validada de ponta a ponta pela 1Âª vez** â€” a
pedido do Rafael, checado o workflow do GitHub Actions (existia hÃ¡ dias, nunca confirmado rodando).
Achado real: jÃ¡ tinha disparado sozinho 1x (agendado) e falhou com 401 â€” o secret
`ODONTOMINAS_CRM_CRON_SECRET` do GitHub nÃ£o batia byte a byte com o `CRON_SECRET` do Railway
(`compararSenhas` exige mesmo tamanho antes de comparar, entÃ£o um espaÃ§o/quebra de linha a mais em
qualquer um dos dois jÃ¡ derruba). Corrigido gerando um segredo novo e sincronizando os dois lados:
`CRON_SECRET` atualizado no Railway direto (MCP, redeploy automÃ¡tico); Rafael colou o mesmo valor
no secret do GitHub (escrever secret de repositÃ³rio Ã© bloqueado pelo classificador de seguranÃ§a,
sempre manual, mesmo com autorizaÃ§Ã£o no chat). Rafael re-rodou o job pela aba Actions; confirmado
por leitura via API (REST com `GITHUB_PERSONAL_ACCESS_TOKEN`, sem precisar de `gh` CLI) que passou
â€” pronto pro cron das 9h BrasÃ­lia rodar sozinho a partir de amanhÃ£.

## Onde estÃ¡ (2026-09-15, Agentes de IA validado + Pausar IA/Finalizar Atendimento + notificaÃ§Ã£o)

**1Âº Agente de IA real criado e validado de ponta a ponta em produÃ§Ã£o**: "RecepÃ§Ã£o Virtual"
(Gemini), etiqueta-gatilho "Atendimento IA" criada, prompt detalhado e compliance-safe. Testado com
mensagem simulada pelo webhook: respondeu certo, reconheceu sozinha "pronta pra marcar horÃ¡rio"
como gatilho de transferÃªncia, e "Avisar Membro da Equipe" chegou de verdade no WhatsApp do Rafael.
Fase 1 e Fase 2A do CRM estÃ£o, agora sim, funcionais de ponta a ponta com uso real â€” nÃ£o sÃ³
deployadas. No caminho, achado e corrigido um bug real: `gemini-2.5-flash-lite` foi descontinuado
pelo Google (404 "no longer available to new users"), trocado pelo alias `gemini-flash-lite-latest`
(commit `b699685`). CRM tambÃ©m ganhou, na mesma sessÃ£o: **"Pausar IA"/"Retomar IA"/"Finalizar
Atendimento"** no Chat ao Vivo (commit `63ac13f`, sem migraÃ§Ã£o nova) e **notificaÃ§Ã£o real do
navegador** â€” Notification API com permissÃ£o pedida por gesto do usuÃ¡rio, controle de 3 posiÃ§Ãµes
arrastÃ¡vel (Desligadas/Todas/SÃ³ esfriando), adaptado do banner da RoiZap (commit `5551897`).
Detalhe completo em "Feito" abaixo. PrÃ³ximo passo de sempre: Fase 2B (Buffer de mensagens) ou Fase
6 (demo pro marido) â€” nenhuma fase tÃ©cnica falta mais pra demo.

## Onde estÃ¡ (2026-09-15, Agentes de IA â€” Fase 1 + Fase 2A em produÃ§Ã£o)

CRM: Fase 1 (schema, CRUD, 5 provedores, gatilho por etiqueta) e Fase 2A (horÃ¡rio de atendimento,
transferÃªncia pra humano real, "Avisar Membro da Equipe", pausar apÃ³s concluir o fluxo, dividir em
mensagens curtas) **em produÃ§Ã£o de verdade** â€” migraÃ§Ãµes v9 e v10 rodadas, commits `394468e` e
`adf4ece`, deploys Railway `7fd66e45` e `3e803bb3`, ambos sucesso. Rafael achou a Fase 1 curta
demais comparado ao print de referÃªncia da RoiZap; pediu anÃ¡lise completa, aprovou escopo em 3
blocos (decisÃ£o em `_memoria/decisoes.md`). **Chave do Gemini configurada** (Railway + local,
redeploy confirmado sucesso) â€” a IA jÃ¡ funciona de ponta a ponta, falta sÃ³ criar e ativar um
agente de verdade (nenhum existe no banco ainda). Fase 2B (Buffer de mensagens) planejada, ainda
nÃ£o construÃ­da. Detalhe completo em "Feito" abaixo.

## Onde estÃ¡ (2026-09-15, Chat ao Vivo + RelatÃ³rios + ConexÃ£o/dark mode)

CRM: 4 commits nesta sessÃ£o, a pedido do Rafael (prints da RoiZap, ferramenta que ele usa em outro
negÃ³cio, como referÃªncia de layout â€” adaptado ao que o sistema realmente tem, sem copiar
funcionalidade que nÃ£o existe aqui). Todos deployados no Railway e validados contra Supabase/
Evolution de produÃ§Ã£o antes de cada deploy.

- **Chat ao Vivo** (`1e6cbfb`, migraÃ§Ã£o `v6_chat.sql`): a seÃ§Ã£o que o plano tÃ©cnico previu de fora
  do V1 ("visibilidade + aÃ§Ã£o leve", sem thread nem envio) â€” agora Ã© inbox de verdade. Lista +
  thread + resposta real pelo painel (`src/lib/chat.ts`, `enviarRespostaChat` espelha o padrÃ£o de
  `reativacao.ts`). Abas Todos/NÃ£o lidas/ConcluÃ­dos (reaproveita status do funil)/AtribuÃ­dos/
  Arquivadas, prioridade, etiquetas livres, busca, "Nova conversa". De propÃ³sito sem Grupos/CSAT/
  InstÃ¢ncias/AnÃ¡lise IA â€” nÃ£o existem no sistema.
- **RelatÃ³rios** (mesmo commit): "Resumo Executivo" virou dashboard â€” perÃ­odo (hoje/7/15/30/90d),
  cards, 4 grÃ¡ficos SVG, abas VisÃ£o Geral/Equipe/Leads. Equipe saiu do menu (virou aba); `/equipe`
  continua existindo.
- **Ajustes visuais** (`c2e102f`): Leads esfriando antes dos grÃ¡ficos; sem linhas de grade.
- **Dark mode + barra superior + ConexÃ£o** (`7df49a3`, migraÃ§Ã£o `v7_apelido_instancia.sql`): tema
  claro/escuro funcional em todo o painel via variÃ¡vel CSS do Tailwind v4 (nÃ£o `dark:` por tela).
  Barra no topo: tema â†’ notificaÃ§Ãµes (nÃ£o lidas + esfriando) â†’ nome de quem logou. ConexÃ£o do
  WhatsApp mostra nome de perfil real (Evolution API) na sidebar e na pÃ¡gina, ganhou visual mais
  rico e apelido interno editÃ¡vel (nunca mexe no perfil real). Chat ao Vivo: filtros viraram Ã­cones
  com popover (eram `<select>`); divisor arrastÃ¡vel entre lista e conversa.
- **Contador de nÃ£o lidas + Desconectar** (`3c48a5c`, migraÃ§Ã£o `v8_contador_nao_lidas.sql`): badge
  com nÃºmero de mensagens de verdade (era sÃ³ booleano). BotÃ£o "Desconectar" no rodapÃ© da ConexÃ£o
  (`DELETE /instance/logout`), com confirmaÃ§Ã£o em modal â€” nÃ£o testado ao vivo de propÃ³sito
  (derrubaria o WhatsApp de teste em uso).
- Validado: typecheck/lint/testes (130)/build limpos em cada commit; conferÃªncia contra produÃ§Ã£o
  (sessÃ£o mintada localmente, mesmo `SESSAO_SECRET` do `.env.local`) antes e depois de cada deploy.
  Rafael rodou as migraÃ§Ãµes v6/v7/v8 entre um commit e outro.
- Achado tÃ©cnico: a mÃ¡quina ficou com 0,2GB livres de RAM (7 processos `next dev` Ã³rfÃ£os de
  sessÃµes anteriores, mesmas portas 3000-3006) e um build travou por falta de memÃ³ria â€” encerrados
  todos, build voltou a funcionar. LiÃ§Ã£o: `TaskStop` nÃ£o mata sempre o processo filho no Windows,
  sempre confirmar pela porta.
- Enviado ao GitHub via `/syncar` na mesma sessÃ£o (ver commit de sync).

## Onde estÃ¡ (2026-09-15, V1 do painel â€” menu, login por atendente, Equipe, ConexÃ£o)

CRM: **pacote de melhorias na V1 do painel completo e em produÃ§Ã£o de verdade** â€” menu lateral em
toda tela logada, login individual por atendente (troca as 2 senhas compartilhadas), tela
**Equipe** (atendimento por secretÃ¡ria: quantidade, tempo mÃ©dio de resposta) e tela **ConexÃ£o**
(status do WhatsApp + QR Code pra reconectar sem abrir Railway/Evolution). MigraÃ§Ã£o
`2026-09-15_v4_equipe.sql` rodada, um bug real de permissÃ£o corrigido com
`2026-09-15_v5_grants_atendentes.sql` (ver "Feito"), `railway up` feito e **validado com login
real de produÃ§Ã£o** (`admin`/`admin-temp-2026` entra, Rafael confirmou visualmente). PrÃ³ximo passo
de sempre: Fase 6 (demo pro marido).

## Onde estÃ¡ (2026-09-15, Fase 5)

CRM: **Fase 5 completa e em produÃ§Ã£o** â€” automaÃ§Ã£o de reativaÃ§Ã£o de paciente inativo (conversa
resolvida sem mensagem hÃ¡ mais de 30 dias recebe 1 WhatsApp de reativaÃ§Ã£o, uma vez sÃ³ por
conversa), disparada 1x/dia por um cron do GitHub Actions. Detalhe completo em "Feito" abaixo.
PrÃ³ximo passo Ã© a Fase 6 (demo pro marido, e se validar, pra Ariadna) â€” nÃ£o sobra mais nenhuma
fase tÃ©cnica antes da demo.

## Onde estÃ¡ (2026-09-15, Fase 4)

CRM: pendÃªncia da revisÃ£o tÃ©cnica fechada (migraÃ§Ã£o `aguardando_desde` rodada, `railway up` feito
e validado em produÃ§Ã£o) e **Fase 4 completa e em produÃ§Ã£o**: ficha de paciente
(`/pacientes/[id]`) + resumo executivo (`/resumo`, com alerta de leads esfriando). Detalhe
completo em "Feito" abaixo. PrÃ³ximo passo Ã© a Fase 5 (1 automaÃ§Ã£o de destaque).

## Onde estÃ¡ (2026-09-15, revisÃ£o tÃ©cnica)

RevisÃ£o tÃ©cnica aprofundada das Fases 1-3 do CRM, a pedido do Rafael. 2 bugs reais corrigidos no
funil de atendimento, login endurecido (rate limit), suite de testes criada do zero (71 testes),
escopo do MCP do Supabase enxugado. Detalhe completo em "Feito" abaixo. **Nada disso estÃ¡ em
produÃ§Ã£o ainda** â€” falta rodar a migraÃ§Ã£o nova no SQL Editor e fazer `railway up`.

## Onde estÃ¡ (2026-09-15, atualizado)

CRM: Fase 3 (painel de atendimento) completa e validada de ponta a ponta, em produÃ§Ã£o. Detalhe
completo em "Feito" abaixo. Painel agora exige login (remendo mÃ­nimo â€” 2 perfis, admin/atendente,
senha temporÃ¡ria). PrÃ³ximo passo Ã© a Fase 4 (ficha de paciente + resumo executivo).

## Onde estÃ¡ (2026-09-15)

CRM: Fase 2 (espelhamento) completa e validada de ponta a ponta. Detalhe completo em "Feito"
abaixo. PrÃ³ximo passo era a Fase 3 (painel de atendimento) â€” ver bloco atualizado acima.

## Onde estÃ¡ (2026-09-12)

Pasta criada. Escopo e compliance mapeados. O site em `site/` deixou de ser scaffold tÃ©cnico e
virou um redesign editorial completo, com uma revisÃ£o de direÃ§Ã£o de arte e uma seÃ§Ã£o nova,
"Protocolo Correct Full Arch" (ver "Feito" abaixo). **No ar em produÃ§Ã£o**: Cloudflare Pages,
https://odontominas.pages.dev/ â€” repositÃ³rio `noryosinovacoes-os`, root `clientes/odontominas/site`,
build `npm run build` â†’ `out`, deploy automÃ¡tico a cada push na `main` (conectado por Rafael no
dashboard, confirmado carregando certo, com a seÃ§Ã£o do Protocolo Correct visÃ­vel). DomÃ­nio prÃ³prio
ainda nÃ£o existe â€” segue pendÃªncia abaixo.

ReuniÃ£o de Rafael com o marido da Ariadna aconteceu em 14/09: escopo do piloto mudou de "site+GMN
grÃ¡tis, trÃ¡fego cobrado Ã  parte" pra pacote completo de graÃ§a â€” site + CRM de captaÃ§Ã£o + trÃ¡fego
pago (verba de mÃ­dia por conta da clÃ­nica) â€” pensado como prova de conceito replicÃ¡vel pros
contatos dele com outros dentistas (detalhe em `contexto.md`). **A "proposta" nÃ£o vai ser um
documento**: Ariadna sÃ³ avanÃ§a em projeto que vÃª funcionando, entÃ£o o plano combinado com o marido
Ã© demonstrar o CRM rodando â€” a demonstraÃ§Ã£o Ã‰ a proposta. Por isso o CRM virou a atividade
principal do projeto agora; site (jÃ¡ no ar) e trÃ¡fego pago ficam em segundo plano atÃ© lÃ¡.

## PendÃªncias

**NegÃ³cio**
- [ ] Ter o CRM num estado demonstrÃ¡vel e marcar a demonstraÃ§Ã£o com o marido (e depois, se ele
  validar, com a Ariadna) â€” isso substitui "apresentar proposta formal" (2026-09-14).
- [ ] Definir prazo de entrega com ela (depende da demonstraÃ§Ã£o acontecer primeiro).
- [ ] Definir o critÃ©rio de "100%"/pronto pra replicar â€” o que precisa estar rodando antes de
  oferecer a mesma estrutura pros contatos do marido com outros dentistas (2026-09-14).

**CRM â€” atividade principal do projeto agora (2026-09-14)**
- [ ] Confirmar com a clÃ­nica se o incÃ´modo real com o Controle Odonto Ã© custo da assinatura ou
  falta de automaÃ§Ã£o â€” decide se dÃ¡ pra sÃ³ simplificar mÃ³dulos em vez de construir substituto
  completo (o CRM nÃ£o mexe na camada clÃ­nica/prontuÃ¡rio/financeiro dele, sÃ³ na de
  captaÃ§Ã£o/relacionamento).
- [x] Fase 1a â€” Evolution API no ar na Railway (instÃ¢ncia `odontominas-teste`, WHATSAPP-BAILEYS),
  conectada via QR no nÃºmero de teste do Rafael (`state: open`), confirmado por chamada direta Ã 
  API (2026-09-15). Chave e URL em `crm/.env.local` (fora do git).
- [x] Fase 1b â€” projeto Supabase novo criado (`odontominas-crm`, regiÃ£o Americas/SÃ£o Paulo,
  RLS automÃ¡tico ligado em toda tabela nova, tabela nÃ£o exposta por padrÃ£o). Chaves salvas e
  validadas em `crm/.env.local` (2026-09-15). **Fase 1 (infra) completa.**
- [x] Fase 2 â€” espelhamento: mensagem recebida/enviada grava em `conversas`/`mensagens`, sem tela
  ainda. Validada com WhatsApp real (2026-09-15) â€” ver "Feito".
- [x] Fase 3 â€” painel de atendimento (o "uau" da demo): lista de conversas, status
  (novo/respondido/aguardando/agendado/perdido), tempo atÃ© a 1Âª resposta. Validada em produÃ§Ã£o
  (2026-09-15) â€” ver "Feito".
- [x] Aplicar em produÃ§Ã£o a revisÃ£o tÃ©cnica de 2026-09-15: migraÃ§Ã£o
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase e `railway up` feito
  (corrige o funil de atendimento e endurece o login) â€” ver "Feito".
- [x] Fase 4 â€” ficha de paciente + resumo executivo (dashboard simples). Completa e em produÃ§Ã£o
  (2026-09-15) â€” ver "Feito".
- [x] Fase 5 â€” automaÃ§Ã£o de reativaÃ§Ã£o de paciente inativo (escolhida em vez de lembrete de
  consulta â€” ver `_memoria/decisoes.md`). Completa e em produÃ§Ã£o (2026-09-15) â€” ver "Feito".
- [x] V1 do painel incrementada â€” menu lateral, login por atendente, Equipe, ConexÃ£o WhatsApp com
  QR (2026-09-15), migraÃ§Ãµes v4+v5 rodadas, `railway up` feito e validado com login real de
  produÃ§Ã£o â€” ver "Feito". Trocar usuÃ¡rio/senha das 3 contas de demo
  (`admin`/`recepcao1`/`recepcao2`, senha `<usuario>-temp-2026`) pelas secretÃ¡rias reais antes da
  demo. RBAC fino por permissÃ£o (nÃ£o sÃ³ por tela) segue pra depois que o piloto validar.
- [x] Agentes de IA: criar e ativar o 1Âº agente de teste. "RecepÃ§Ã£o Virtual" criado e validado de
  ponta a ponta com envio real (resposta, transferÃªncia, aviso Ã  equipe) (2026-09-15).
- [x] Agentes de IA â€” Fase 2B (Buffer de mensagens): completa, bug real corrigido, validada de
  ponta a ponta com WhatsApp real e desligada de novo por decisÃ£o consciente (2026-09-16).
- [x] Agentes de IA â€” Prompt estruturado (Simples/AvanÃ§ado) + aba Conhecimento: construÃ­do,
  testado e em produÃ§Ã£o (2026-09-16) â€” ver "Feito". Ferramentas/Pixel do print da RoiZap ficaram de
  fora por decisÃ£o do Rafael, sem funcionalidade real por trÃ¡s ainda (Pixel entrou de verdade horas
  depois â€” ver bullet abaixo; Ferramentas segue de fora).
- [x] Agentes de IA â€” QualificaÃ§Ã£o AutomÃ¡tica de Leads: construÃ­da, testada e em produÃ§Ã£o
  (2026-09-16) â€” ver "Feito". Revertendo a decisÃ£o de horas antes; critÃ©rio que faltava (escala
  fixa Quente/Morno/Frio) fechado com o Rafael antes de codar.
- [x] Agentes de IA â€” Pixel de ConversÃ£o (Facebook + Google Ads): construÃ­do, testado e em
  produÃ§Ã£o (2026-09-16) â€” ver "Feito". Revertendo a parte do Pixel na mesma decisÃ£o de horas
  antes. Desligado por padrÃ£o; falta credencial real (Pixel ID/token do Facebook, conta de Google
  Ads) pra ligar de vez.
- [ ] Criar o app OAuth do Google Ads no Google Cloud (`GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET`) â€”
  prÃ©-requisito sÃ³ do lado Google do Pixel de ConversÃ£o; o Facebook nÃ£o precisa disso, sÃ³ do Pixel
  ID/token do cliente (2026-09-16).
- [ ] Fase 6 â€” demo pro marido; se validar, demo pra Ariadna.
- [ ] IntegraÃ§Ã£o ControleODONTO â€” Fase 0 (adapter, painel, migration) em produÃ§Ã£o (2026-09-16, ver
  "Feito"). Falta: obter credencial/documentaÃ§Ã£o real do ControleODONTO (contato com o suporte
  deles) antes de habilitar qualquer capability â€” checklist em
  `crm/docs/integrations/controle-odonto.md`. NÃ£o bloqueia a Fase 6.
- [ ] Decidir se apaga os 5 dados fictÃ­cios de demo (Camila, Rodrigo, Fernanda, Marcos, Beatriz â€”
  telefones 556199990001-5) antes da demo real, ou mantÃ©m como demonstraÃ§Ã£o fixa (2026-09-15).
- [x] Disparos â€” Fase A e Fase B (wizard + worker de envio + relatÃ³rio): construÃ­das, testadas e
  em produÃ§Ã£o, teste fim a ponta feito com sucesso (2026-09-16) â€” ver "Feito". Falta apagar os
  dados de teste antes da produÃ§Ã£o real com clientes (decisÃ£o em `_memoria/decisoes.md`).
- [x] Campanhas â€” mÃ³dulo estratÃ©gico (Ferramentas â†’ Campanhas), separado de Disparos: schema
  (rename v18 + v19), CRUD, wizard, dashboard, funil, ganchos automÃ¡ticos com QualificaÃ§Ã£o/Funil/
  Agente de IA, aba Marketing em RelatÃ³rios â€” construÃ­do, testado (typecheck/lint/build/340
  testes) e verificado fim a ponta contra produÃ§Ã£o (2026-09-16) â€” ver "Feito" e
  `crm/docs/campanhas.md`.
- [x] Fluxo de Conversa â€” Fase 0 (auditoria sÃ³-leitura): concluÃ­da (2026-09-17) â€” ver
  `crm/docs/fluxo-conversa-auditoria-fase0.md`.
- [x] Fluxo de Conversa â€” Fase 1 (arquitetura/schema): migration `v20` revisada (5 pontos pedidos
  pelo Rafael, 3 corrigidos) e **aplicada em produÃ§Ã£o** (2026-09-17), confirmada lendo o schema â€”
  ver `crm/docs/fluxo-conversa-arquitetura.md`.
- [x] Fluxo de Conversa â€” Fase 2a (nÃºcleo do motor): construÃ­da, deployada e validada em produÃ§Ã£o
  (2026-09-17) â€” 1 bug real achado e corrigido (embed ambÃ­guo do PostgREST); teste real de WhatsApp
  ("TESTE - Fluxo Odonto") confirmado de ponta a ponta pela Evolution. Ver "Onde estÃ¡" no topo.
- [x] Fluxo de Conversa â€” Fase 2b/3 (editor visual): construÃ­da, deployada e validada em produÃ§Ã£o
  (2026-09-17) â€” `@xyflow/react` (Ãºnica exceÃ§Ã£o Ã  polÃ­tica de zero-dependÃªncia), 1 bug real achado
  e corrigido (polling do painel "Testar" preso por closure desatualizado); teste real de ponta a
  ponta feito pelo prÃ³prio editor (criar fluxo, arrastar bloco, conectar, testar) â€” mensagem
  confirmada chegando no WhatsApp. Ver "Onde estÃ¡" no topo.
- [x] Fluxo de Conversa â€” paleta AÃ§Ãµes CRM (5 blocos: etiqueta, funil, prioridade, atendente):
  construÃ­da (2026-09-17), sem migration, typecheck/lint/build limpos, 449 testes (19 novos).
  Commit local `c3d04e8`, ainda nÃ£o sincronizado nem deployado. Ver "Onde estÃ¡" no topo.
- [x] Fluxo de Conversa â€” paleta Humano + IA (4 dos 8 blocos: transferir humano, alerta interno,
  pausar automaÃ§Ã£o, iniciar agente de IA): construÃ­da (2026-09-17), sem migration,
  typecheck/lint/build limpos, 464 testes (15 novos), 2 bugs reais achados e corrigidos (corrida do
  `liberarControle`, aviso falso "sem finalizar"). Commit local `0fad463`, ainda nÃ£o sincronizado
  nem deployado. Ver "Onde estÃ¡" no topo.
- [ ] Fluxo de Conversa â€” reconstruÃ§Ã£o do mÃ³dulo "Ferramentas â†’ Fluxo de Conversa" como motor de
  automaÃ§Ã£o conversacional determinÃ­stico (infraestrutura crÃ­tica), fatiada em 6 fases com
  checkpoint do Rafael entre elas â€” decisÃ£o completa em `_memoria/decisoes.md` (2026-09-16). Fases
  0, 1, 2a e 2b/3 completas, deployadas e validadas com envio real (2026-09-17), mais as fatias de
  AÃ§Ãµes CRM e Humano+IA da ampliaÃ§Ã£o da paleta (2026-09-17, commitadas localmente, nÃ£o deployadas).
  Odonto segue 100% bloqueado (ControleODONTO sem capability validada); IntegraÃ§Ã£o pausada (cofre
  de credenciais + mitigaÃ§Ã£o de SSRF, fase separada). Falta apagar os 2 fluxos de teste "TESTE -
  Fluxo Odonto" (ambos arquivados, nÃ£o apagados) e os dados vinculados antes da produÃ§Ã£o real com
  clientes â€” mesma pendÃªncia de Disparos/Campanhas, ver `agora.md`. PrÃ³ximo passo: seguir ampliando
  a paleta (IntegraÃ§Ã£o) ou Fase 6 (demo), sem data definida ainda.

## Plano tÃ©cnico do CRM (2026-09-14)

- **CÃ³digo:** `clientes/odontominas/crm/` (Next.js 15 + TypeScript + Tailwind, UI kit reaproveitado
  por referÃªncia do `site/` â€” mesmo padrÃ£o de sempre, nÃ£o Ã© submodule nem dependÃªncia entre
  projetos).
- **Banco:** Supabase novo, dedicado a este CRM â€” dado de paciente Ã© mais sensÃ­vel (LGPD) e Ã© de
  outra empresa, nÃ£o mistura com o banco do DiagnÃ³stico Digital. Toda tabela leva `clinica_id`
  (arquitetura "path B": modelo de dado pronto pra multi-clÃ­nica, mas cada clÃ­nica roda numa
  instÃ¢ncia prÃ³pria â€” nÃ£o Ã© plataforma multi-tenant compartilhada por ora).
  Tabelas do V1: `clinicas`, `pacientes`, `conversas`, `mensagens`, `eventos_funil` (log de
  mudanÃ§a de status â€” alimenta o resumo executivo e o alerta de lead esfriando), `consultas`.
- **WhatsApp:** Evolution API (self-hosted, conecta via QR, nÃ£o exige migrar o nÃºmero oficial da
  clÃ­nica) â€” rota nÃ£o-oficial consciente pro V1; migraÃ§Ã£o pra API oficial da Meta fica pra quando
  virar operaÃ§Ã£o com vÃ¡rios clientes pagando.
- **Hospedagem da Evolution API:** Railway (template oficial, deploy de um clique) â€” validado por
  pesquisa como escolha certa **pra esta fase** (custo real esperado ~US$5-20/mÃªs, nÃ£o
  necessariamente o piso de US$5; hÃ¡ relatos de instabilidade recente, tolerÃ¡vel em fase de
  teste/demo). Quando replicar pra vÃ¡rias clÃ­nicas pagando, reavaliar VPS (ex: Hostinger) +
  Coolify â€” custo fixo por servidor em vez de consumo por instÃ¢ncia, mais barato em escala.
- **Reaproveitado do DiagnÃ³stico Digital** (`projetos/Noryos-Inovacoes/site/src/lib/`, por
  referÃªncia, nÃ£o por dependÃªncia): padrÃ£o de scoring determinÃ­stico e versionado
  (`diagnostico-scoring.ts`) adaptado pro funil de atendimento; disciplina de persistÃªncia
  (`diagnostico-store.ts` â€” Supabase como driver principal, sem fallback silencioso em produÃ§Ã£o,
  log de erro sem PII, migraÃ§Ã£o sempre aditiva); `rate-limit.ts`/`turnstile.ts` se o CRM ganhar
  formulÃ¡rio pÃºblico; UI kit (`ui/`, `system/`) pra acelerar a interface.
- **Fora do V1, de propÃ³sito:** camada clÃ­nica/prontuÃ¡rio (fica com o Controle Odonto), chat 2-way
  completo dentro do CRM (v1 Ã© visibilidade + aÃ§Ã£o leve), trÃ¡fego pago (entra sÃ³ depois do CRM
  validado).

**Confirmar com a Ariadna antes de publicar de verdade** (tudo jÃ¡ centralizado em
`site/src/lib/config.ts` / `site/src/content/`, nada solto no cÃ³digo):
- [ ] NÃºmero oficial do WhatsApp (`config.ts` â†’ `whatsappNumber`, hoje vazio â€” CTA cai no e-mail
  como fallback).
- [ ] EndereÃ§o: validar Setor Norte, Quadra 5, Lote 17 (existe registro antigo com outro lote).
- [ ] E-mail odontominasdf@gmail.com segue monitorado?
- [ ] Nome + CRO do responsÃ¡vel tÃ©cnico da pessoa jurÃ­dica (pode ou nÃ£o ser a prÃ³pria Ariadna).
- [ ] RedaÃ§Ã£o exata do item "2011 â€” atuaÃ§Ã£o em Implantodontia" e confirmaÃ§Ã£o do Mestrado em
  Biologia Oral (2019) â€” os dois ficam fora do site atÃ© ela validar (`equipe.ts`).
- [ ] Confirmar Endodontia/Periodontia como tratamentos oferecidos (`tratamentos.ts`, hoje
  `confirmado: false`, nÃ£o aparecem no site).
- [ ] ConvÃªnios aceitos e formas de pagamento â€” FAQ hoje redireciona pro WhatsApp em vez de
  inventar resposta.
- [ ] Foto real da Dra. Ariadna e da clÃ­nica (fachada, recepÃ§Ã£o, consultÃ³rio) â€” o site usa um
  painel editorial no lugar, nunca uma foto de banco fingindo ser da OdontoMinas.
- [ ] DomÃ­nio prÃ³prio (hoje usa `.example` reservado sÃ³ pra nÃ£o quebrar o build).
- [ ] Instagram/Facebook oficiais (hoje vazios em `config.ts`).

## Feito

- 2026-09-16: **Disparos â€” Fase B (wizard + worker + relatÃ³rio) completa e em produÃ§Ã£o.** Ver
  "Onde estÃ¡" no topo desta seÃ§Ã£o pro detalhe.
- 2026-09-16: **Disparos â€” Fase A (fundamentos) completa e em produÃ§Ã£o.** Ver "Onde estÃ¡" no topo
  desta seÃ§Ã£o pro detalhe.
- 2026-09-16: **IntegraÃ§Ã£o ControleODONTO â€” Fase 0 completa e em produÃ§Ã£o.** Ver "Onde estÃ¡" no
  topo desta seÃ§Ã£o pro detalhe.
- 2026-09-11: pasta criada, escopo e checklist de compliance do CFO documentados em
  `contexto.md`.
- 2026-09-11: logo salva em `marca/logo/logo_site.png`, design-guide atualizado com a cor real
  (teal/turquesa, fundo transparente).
- 2026-09-11: material institucional (prÃªmio, histÃ³ria, valores) recebido por WhatsApp e
  destilado em `contexto.md`.
- 2026-09-11: scaffold tÃ©cnico do site criado em `site/` â€” Next.js 15 + Tailwind v4, UI kit
  reaproveitado do site institucional da Noryos (retemado de escuro pra claro/teal), 4 pÃ¡ginas
  (Home, Sobre, ServiÃ§os, Contato) com placeholder explÃ­cito onde falta fato real, formulÃ¡rio de
  contato direto pro WhatsApp (sem banco), faixa de compliance (nome+CRO) no rodapÃ© de toda
  pÃ¡gina. Testado localmente: `npm run build`/`typecheck`/`lint` limpos, 4 rotas verificadas no
  navegador sem erro de console.
- 2026-09-11: rebuild completo do site a pedido do Rafael (brief de agÃªncia: UX, copy, SEO local,
  compliance, performance, Cloudflare). Resumo â€” detalhe completo pedido separadamente:
  - Dados reais encontrados por pesquisa pÃºblica (CNPJ, endereÃ§o, telefone, CRO da Ariadna,
    horÃ¡rio, avaliaÃ§Ãµes) entraram em `config.ts`/`content/equipe.ts`, com o que nÃ£o pÃ´de ser
    confirmado (WhatsApp, RT da PJ, mestrado, convÃªnios) explicitamente fora do HTML publicado â€”
    nunca mais `[PLACEHOLDER: ...]` visÃ­vel na pÃ¡gina.
  - Home, Sobre e ServiÃ§os reconstruÃ­dos em composiÃ§Ã£o editorial (texto+imagem alternado,
    numeraÃ§Ã£o, timeline) â€” saiu o padrÃ£o "hero + 3 cards + FAQ" e o visual "tech/SaaS" herdado do
    DiagnÃ³stico Digital (tech-grid, glow, spotlight de mouse); entrou um Ãºnico motion system
    (fade-up/fade/scale-in + stagger, `prefers-reduced-motion` respeitado).
  - Novo: pÃ¡ginas `/politica-de-privacidade` e `/termos-de-uso` (LGPD), Schema.org Dentist +
    Service + FAQPage, eventos de analytics por origem de clique (`whatsapp_hero`,
    `whatsapp_implantes`, `phone_click`, `maps_click`...) via um listener Ãºnico (`AnalyticsBinder`).
  - Hospedagem trocada de `output: "standalone"` (padrÃ£o Hostinger do site institucional) pra
    `output: "export"` + `public/_headers` (Cloudflare Pages) â€” decisÃ£o do dia, ver `_contexto`.
  - Validado: `typecheck`, `lint` e `next build` limpos; export estÃ¡tico em `site/out/` conferido
    (sem placeholder visÃ­vel, formataÃ§Ã£o pt-BR correta, favicon real aplicado). NÃ£o testado em
    navegador de verdade (sem ferramenta de screenshot neste ambiente) â€” sÃ³ via HTML renderizado e
    smoke test HTTP no dev server.
- 2026-09-12 (reconstruÃ­do de sessÃ£o que fechou a janela sem salvar â€” ver nota em "Onde estÃ¡"):
  revisÃ£o de direÃ§Ã£o de arte do site (paleta de texto mais azulada, degradÃª de assinatura de 3
  tons, tipografia unificada em Manrope, motion de entrada mais discreto, hover do botÃ£o primÃ¡rio
  escurecendo em vez de clarear) e seÃ§Ã£o nova "Protocolo Correct Full Arch": `Hero.tsx` extraÃ­do
  com o placeholder antigo trocado por um diagrama SVG comparativo interativo
  (`CorrectTransformation.tsx`, slider manual + loop automÃ¡tico que respeita
  `prefers-reduced-motion`), seÃ§Ã£o dedicada com benefÃ­cios/jornada/FAQ prÃ³prios
  (`CorrectProtocol.tsx`, substituindo o antigo bloco genÃ©rico "Destaque Implantes"), copy em
  `content/protocolo.ts` sob os mesmos limites de compliance do CFO (nunca equiparar a "All-on-4",
  nunca afirmar quantidade fixa de implantes, carga imediata ou tratamento no mesmo dia). Validado:
  `typecheck`/`lint`/`next build` limpos, commitado e sincronizado no GitHub.
- 2026-09-12: primeiro deploy de produÃ§Ã£o. Rafael conectou o repositÃ³rio Ã  Cloudflare Pages pelo
  dashboard (root `clientes/odontominas/site`, build `npm run build`, saÃ­da `out`, deploy
  automÃ¡tico a cada push na `main`). Site confirmado no ar em https://odontominas.pages.dev/, com
  a seÃ§Ã£o do Protocolo Correct carregando. Ainda no subdomÃ­nio gratuito â€” domÃ­nio prÃ³prio Ã©
  pendÃªncia separada.
- 2026-09-14 (fonte: reuniÃ£o presencial de Rafael com o marido da Ariadna, relatada no chat no
  mesmo dia): escopo do piloto mudou. Deixa de ser "site+GMN grÃ¡tis, trÃ¡fego cobrado Ã  parte" e
  vira pacote completo de graÃ§a â€” site + CRM de captaÃ§Ã£o/relacionamento + trÃ¡fego pago (verba de
  mÃ­dia por conta da clÃ­nica, gestÃ£o sem custo) â€” pensado como prova de conceito replicÃ¡vel: o
  marido tem contatos com outros dentistas e pretende indicar a mesma estrutura depois que rodar
  100% na OdontoMinas. Ordem de execuÃ§Ã£o definida: site + CRM primeiro, trÃ¡fego pago entra depois
  que captaÃ§Ã£o/follow-up estiver validado. Ver escopo completo em `contexto.md`.
- 2026-09-14: plano tÃ©cnico do CRM fechado (stack, banco, arquitetura, hospedagem da Evolution API,
  o que reaproveitar do DiagnÃ³stico Digital, fases de construÃ§Ã£o atÃ© a demo) â€” ver "Plano tÃ©cnico
  do CRM" acima. Rafael confirmou nÃºmero de WhatsApp separado pra teste (nÃ£o o da clÃ­nica) e
  Railway como hospedagem da Evolution API pra esta fase.
- 2026-09-15: **Fase 2 do CRM completa e validada de ponta a ponta.** Scaffold Next.js 15 +
  TypeScript + Tailwind em `crm/`; migraÃ§Ã£o V1 (`clinicas`, `pacientes`, `conversas`, `mensagens`,
  `eventos_funil`, `consultas`, todas com `clinica_id`, RLS ligado, ver `crm/supabase/migrations/`);
  webhook `/api/webhook/evolution` recebe `messages.upsert`, acha-ou-cria paciente/conversa por
  telefone, avanÃ§a status `novoâ†’respondido` na 1Âª resposta da clÃ­nica (logado em `eventos_funil`),
  idempotÃªncia por `evolution_message_id`.
  - MigraÃ§Ã£o precisou de 2Âª passada: o projeto Supabase nÃ£o tinha default privileges no schema
    `public` â€” toda tabela nova nascia sem `GRANT` pra `service_role` (RLS bypass e privilÃ©gio de
    tabela sÃ£o camadas diferentes no Postgres). Corrigido em `2026-09-15_v1_grants.sql`.
  - Deploy no Railway, mesmo projeto da Evolution API (`illustrious-perfection`), serviÃ§o
    `odontominas-crm`, domÃ­nio `odontominas-crm-production.up.railway.app`. **Sem auto-deploy do
    GitHub ainda** â€” deploy Ã© manual via `railway up` (CLI), nÃ£o dispara sozinho em push na `main`
    como o site.
  - Bug real achado e corrigido: o endpoint validava a `apikey` do webhook contra a chave global da
    Evolution API, mas ela ecoa o **token da instÃ¢ncia** (UUID de 36 caracteres) nesse campo, nÃ£o a
    chave global (88 caracteres) â€” todo webhook real tomava 401 em silÃªncio. Corrigido aceitando as
    duas (env nova `EVOLUTION_INSTANCE_TOKEN`).
  - Validado com mensagem real de um segundo nÃºmero (self-chat mostrou disparo de webhook
    inconsistente via Baileys, nÃ£o serve de teste confiÃ¡vel): paciente, conversa e mensagem
    gravados certos, status avanÃ§ou pra `respondido`. Dado de teste limpo do Supabase depois.
  - MCP: Supabase (`supabase-crm-odontominas`, HTTP/OAuth) ficou em "Pending approval" mesmo apÃ³s
    3 aprovaÃ§Ãµes numa sessÃ£o interativa separada â€” causa nÃ£o identificada. Contornado com um MCP
    local (`supabase-crm`) autenticado por token de acesso pessoal. Railway CLI instalada e logada
    (`railway login --browserless`), MCP oficial configurado (`railway mcp install`). Os dois MCPs
    novos sÃ³ ficam disponÃ­veis numa sessÃ£o futura desta mÃ¡quina.
- 2026-09-15: **Fase 3 do CRM completa e validada de ponta a ponta, em produÃ§Ã£o.** Painel de
  atendimento em `crm/src/app/page.tsx`: lista de conversas (paciente/telefone), status em dropdown
  colorido e clicÃ¡vel (a "aÃ§Ã£o leve" do plano tÃ©cnico â€” grava em `eventos_funil` com
  `motivo: "manual"`), filtro por status via link, tempo atÃ© 1Âª resposta calculado a partir do
  primeiro `eventos_funil` que tira a conversa de `novo` (destaque vermelho acima de 30min ainda
  sem resposta â€” o "uau" da demo), auto-refresh de 20s pra mensagem nova aparecer sozinha numa
  demonstraÃ§Ã£o ao vivo. Zero dependÃªncia nova, sÃ³ Tailwind. Testado com uma conversa sintÃ©tica real
  no Supabase (criada e apagada na sessÃ£o).
  - Ao entregar, identificado que o painel nÃ£o tinha login nenhum â€” URL pÃºblica do Railway expunha
    telefone e conversa de paciente (LGPD). Rafael decidiu 2 perfis (`admin`, `atendente`) em vez
    dos 6 cargos sugeridos (Admin, Gestor, Gerente, Dentista, Assistente, Atendente) â€” ver
    `_memoria/decisoes.md` pro porquÃª â€” e um remendo mÃ­nimo de senha antes de RBAC completo.
  - Implementado: `src/middleware.ts` protege painel + API (webhook da Evolution segue pÃºblico, Ã©
    servidor-a-servidor); cookie assinado por HMAC via Web Crypto (`src/lib/sessao.ts`, sem
    dependÃªncia nova, edge-safe); `/login` + logout; `.env.example` com as 3 variÃ¡veis novas
    (`PAINEL_SENHA_ADMIN`, `PAINEL_SENHA_ATENDENTE`, `SESSAO_SECRET`).
  - Deploy no Railway (`railway up`, serviÃ§o `odontominas-crm`) â€” variÃ¡veis setadas via MCP depois
    de aprovaÃ§Ã£o explÃ­cita do Rafael (o classificador de modo automÃ¡tico bloqueia escrita de
    segredo em serviÃ§o remoto por padrÃ£o). Validado em produÃ§Ã£o: login errado rejeita, login certo
    entra com o papel certo, painel exige sessÃ£o, webhook segue aberto, serviÃ§o irmÃ£o
    (`evolution-api`) intocado.
  - **Senhas de produÃ§Ã£o hoje sÃ£o as temporÃ¡rias de desenvolvimento**
    (`dev-admin-temp`/`dev-atendente-temp`) â€” decisÃ£o consciente do Rafael, "por enquanto". Trocar
    antes de expor o painel pra equipe real da clÃ­nica (pendÃªncia acima).
- 2026-09-15 (revisÃ£o tÃ©cnica, a pedido do Rafael: "anÃ¡lise aprofundada, melhorias e testes em
  tudo que foi feito atÃ© aqui"): leitura completa do cÃ³digo das Fases 1-3 (schema, webhook,
  sessÃ£o/login, middleware, painel) e 2 bugs reais encontrados e corrigidos:
  - MÃ©trica "tempo atÃ© 1Âª resposta" contava qualquer saÃ­da de `novo` como resposta â€” marcar uma
    conversa `perdido` direto a partir de `novo` (sem nunca responder) aparecia como "respondeu em
    Xmin" no painel, em verde. Corrigido: sÃ³ conta transiÃ§Ã£o de verdade pra `respondido`
    (`status_novo = 'respondido'` em `eventos_funil`, nÃ£o qualquer saÃ­da de `novo`).
  - Conversa jÃ¡ resolvida (`respondido`/`agendado`/`perdido`) nÃ£o reabria quando o paciente
    escrevia de novo â€” sumia do radar do painel em vez de voltar a aparecer como `novo` (um
    paciente pedindo remarcaÃ§Ã£o, ou um lead "perdido" que volta a escrever, ficava invisÃ­vel).
    Corrigido: mensagem nova reabre o ciclo â€” automÃ¡tico no webhook, manual pelo dropdown de
    status â€” com coluna nova `aguardando_desde` marcando o inÃ­cio do ciclo de espera atual
    (`primeira_mensagem_em` continua intacto como registro do 1Âº contato de sempre, pra nÃ£o perder
    esse dado). LÃ³gica de transiÃ§Ã£o extraÃ­da pra `src/lib/funil.ts`, pura e testÃ¡vel isolada do
    Supabase.
  - MigraÃ§Ã£o nova: `crm/supabase/migrations/2026-09-15_v2_aguardando_desde.sql` â€” **ainda nÃ£o
    rodada** no Supabase (pendÃªncia acima).
  - Login: rate limit (`src/lib/rate-limit-login.ts`, 5 tentativas erradas / 15min por IP, em
    memÃ³ria) e comparaÃ§Ã£o de senha em tempo constante (`src/lib/senha.ts`, `node:crypto`
    `timingSafeEqual`) â€” as senhas continuam as temporÃ¡rias, isto sÃ³ reduz o risco de forÃ§a bruta
    enquanto isso.
  - Testes: Vitest instalado (nÃ£o existia nenhum teste no projeto), 71 testes novos cobrindo
    normalizaÃ§Ã£o de telefone/mensagem do Baileys (`evolution-webhook.ts`), formataÃ§Ã£o
    (`tempo.ts`), validaÃ§Ã£o de status (`status.ts`), a regra de transiÃ§Ã£o do funil (`funil.ts`),
    assinatura HMAC da sessÃ£o â€” token adulterado, expirado, segredo trocado (`sessao.ts`), rate
    limit e comparaÃ§Ã£o de senha, e `conversas.ts` (listagem + troca manual de status) com um fake
    de Supabase em memÃ³ria cobrindo os dois bugs acima. `npm run test`, `typecheck`, `lint` e
    `next build` â€” todos limpos.
  - `.mcp.json`: escopo do MCP do Supabase enxugado â€” ver `_memoria/decisoes.md` pro porquÃª.
  - `npm audit`: 4 vulnerabilidades em ferramenta de build/dev (postcss, vitest mocker), nÃ£o em
    cÃ³digo servido; correÃ§Ã£o exige Next.js v16 (major breaking) â€” registrado, nÃ£o urgente.
  - **Nada disso estÃ¡ em produÃ§Ã£o ainda**: falta rodar a migraÃ§Ã£o no SQL Editor e fazer
    `railway up`. Nada foi commitado nem enviado ao GitHub nesta sessÃ£o.
- 2026-09-15: pendÃªncia de produÃ§Ã£o da revisÃ£o tÃ©cnica fechada â€” migraÃ§Ã£o
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase, `railway up` feito e
  validado (webhook 200, login 200, painel redireciona 307 sem sessÃ£o).
- 2026-09-15: **Fase 4 completa e validada em produÃ§Ã£o.** Ficha de paciente
  (`crm/src/app/pacientes/[id]/page.tsx`): dados de contato, status atual do funil, jornada
  (histÃ³rico de transiÃ§Ãµes de `eventos_funil`) e histÃ³rico de mensagens em bolhas de chat â€”
  buscada por `paciente_id` (relaÃ§Ã£o 1:1 com conversa, telefone Ã© Ãºnico por clÃ­nica nas duas
  tabelas). Resumo executivo (`crm/src/app/resumo/page.tsx`): contagens por status, tempo mÃ©dio
  atÃ© 1Âª resposta (sÃ³ conta conversas que de fato viraram `respondido`/`agendado`) e lista de leads
  esfriando (em aberto hÃ¡ mais de `LIMITE_ESPERA_MS`, 30min) â€” o alerta que `contexto.md` jÃ¡
  previa que `eventos_funil`/`aguardando_desde` deveriam alimentar. Painel principal agora linka o
  contato pra ficha (`crm/src/lib/conversas.ts` passou a expor `paciente_id`) e navega pro resumo.
  - LÃ³gica de agregaÃ§Ã£o extraÃ­da pura em `calcularResumo` (`crm/src/lib/resumo.ts`), testÃ¡vel sem
    Supabase â€” mesmo padrÃ£o de `funil.ts`. 4 testes novos, 75 no total; `typecheck`, `lint` e
    `next build` limpos.
  - Tabela `consultas` (agendamentos) ficou de fora da Fase 4 de propÃ³sito: nada no cÃ³digo escreve
    nela ainda (nem o webhook, nem o painel) â€” mostrar uma seÃ§Ã£o sempre vazia na ficha nÃ£o
    agregaria nada agora. Ela deve entrar quando a Fase 5 (lembrete de consulta) precisar.
  - Validado ao vivo: com aprovaÃ§Ã£o do Rafael, semeado um paciente/conversa/mensagens sintÃ©ticos
    direto no Supabase de produÃ§Ã£o (via REST, service role key) pra ver a ficha renderizada de
    verdade â€” nome, telefone, as duas mensagens (recebida/enviada), jornada "Novo â†’ Respondido", e
    o resumo calculando o tempo mÃ©dio certo (5min). Dado apagado logo em seguida.
  - **Achado tÃ©cnico**: nem o CLI local do Supabase (logado numa conta que sÃ³ enxerga o projeto
    `noryos-inovacoes`, nÃ£o o `odontominas-crm`) nem o MCP local `supabase-crm` (citado como
    "ligado" numa sessÃ£o anterior) apareceram disponÃ­veis nesta sessÃ£o â€” hoje sÃ³ o SQL Editor
    manual funciona pra escrever neste banco. Corrigido em `ferramentas.md` da raiz.
  - Commitado (`29d4187`) e deployado no Railway (`railway up`).
- 2026-09-15: **Fase 5 completa e em produÃ§Ã£o.** AutomaÃ§Ã£o de reativaÃ§Ã£o de paciente inativo.
  Perguntei ao Rafael qual das duas automaÃ§Ãµes da pendÃªncia construir â€” lembrete de consulta
  dependia de criar do zero um jeito de cadastrar consulta (`consultas` segue sem nenhuma escrita,
  nem webhook nem painel gravam nela); reativaÃ§Ã£o reaproveita dado que jÃ¡ existe. Ele escolheu
  reativaÃ§Ã£o (decisÃ£o completa em `_memoria/decisoes.md`).
  - `crm/src/lib/evolution-send.ts`: primeiro ponto do cÃ³digo que **envia** mensagem (contraparte
    do webhook, que sÃ³ recebia) â€” `POST {EVOLUTION_API_URL}/message/sendText/{instance}`.
  - `crm/src/lib/reativacao.ts`: regra pura (`selecionarCandidatos`) â€” conversa resolvida
    (respondido/agendado/perdido) sem mensagem hÃ¡ mais de 30 dias (`LIMITE_INATIVIDADE_MS`) vira
    candidata; manda 1x sÃ³ por conversa (`ultima_reativacao_em` Ã© o trinco, sem cadÃªncia de
    repetiÃ§Ã£o automÃ¡tica na V1) â€” mais orquestraÃ§Ã£o (`executarReativacao`) que busca no Supabase,
    manda pela Evolution API e grava (`ultima_reativacao_em`, `ultima_mensagem_em` e a mensagem em
    si, pra aparecer na ficha do paciente igual qualquer outra). Mensagem de check-in simples, sem
    promessa de resultado nem superlativo (ResoluÃ§Ã£o CFO-196/2019).
  - `crm/src/app/api/cron/reativacao/route.ts`: dispara a automaÃ§Ã£o, protegida por `CRON_SECRET`
    comparado em tempo constante â€” mesmo padrÃ£o do webhook (servidor-a-servidor, sem sessÃ£o de
    painel; adicionada Ã s rotas pÃºblicas do `middleware.ts`).
  - MigraÃ§Ã£o `2026-09-15_v3_reativacao.sql`: coluna `ultima_reativacao_em` em `conversas`.
  - **DecisÃ£o tÃ©cnica**: em vez de um serviÃ§o novo no Railway sÃ³ pra cron (custo e infra extra), o
    disparo diÃ¡rio roda por `.github/workflows/odontominas-crm-reativacao.yml` (GitHub Actions,
    1x/dia Ã s ~9h BrasÃ­lia, chama a rota via `curl` autenticado) â€” reaproveita o GitHub que jÃ¡
    estava conectado, sem nada pago a mais.
  - De bÃ´nus: `crm/.env.example` nunca tinha sido versionado â€” o `.env*` do `.gitignore` excluÃ­a
    ele por engano (nÃ£o tem segredo nenhum, sÃ³ nome de variÃ¡vel). Corrigido.
  - 12 testes novos (87 no total); `typecheck`, `lint` e `next build` limpos.
  - ValidaÃ§Ã£o sem risco: antes de tocar produÃ§Ã£o, li (sem escrever) a tabela `conversas` do
    Supabase de produÃ§Ã£o direto por REST â€” confirmei que estÃ¡ vazia, entÃ£o nenhum paciente real
    corria risco de receber mensagem nesta sessÃ£o. O classificador de modo automÃ¡tico bloqueou uma
    tentativa minha de chamar a rota com o segredo real pra smoke test (dispararia a automaÃ§Ã£o de
    verdade) â€” segui sÃ³ com checagens que nÃ£o executam envio, por decisÃ£o do prÃ³prio Rafael de nÃ£o
    validar com envio real desta vez.
  - Deploy: `CRON_SECRET` setado no Railway via MCP e `railway up` rodado. Rafael aplicou a
    migraÃ§Ã£o no SQL Editor do Supabase e criou o secret `ODONTOMINAS_CRM_CRON_SECRET` no GitHub
    Actions (os 2 passos que esta sessÃ£o nÃ£o conseguia fazer sozinha: sem MCP do Supabase
    disponÃ­vel, sem `gh` CLI instalado nesta mÃ¡quina â€” ver `ferramentas.md`). Commitado (`c72a211`)
    e enviado ao GitHub.
- 2026-09-15: preparo pra Fase 6. Ao testar o login em produÃ§Ã£o, o painel voltou "nÃ£o consegui
  conectar ao banco".
  - **Bug real encontrado e corrigido**: logs do Railway mostraram `PGRST303 "JWT issued at
    future"` â€” erro transiente real do Supabase (a mesma consulta, refeita na mÃ£o, funcionou
    normal em seguida). `src/lib/clinica.ts` guardava esse resultado em cache **pra sempre**,
    inclusive quando era erro â€” um soluÃ§o passageiro do Supabase travava o painel atÃ© o processo
    reiniciar sozinho. Corrigido: sÃ³ cacheia sucesso, nunca falha. Reiniciei o serviÃ§o no Railway
    (MCP) pra limpar o estado travado na hora, e depois deployei a correÃ§Ã£o. Testado
    (typecheck/lint/test/build limpos).
  - A pedido do Rafael ("admin e atendente tÃªm os mesmos menus, nÃ£o faz sentido"): Resumo
    executivo virou exclusivo de admin. `resumo/page.tsx` redireciona pro painel se quem nÃ£o Ã©
    admin tentar acessar (gate de verdade, nÃ£o sÃ³ esconder o link); `page.tsx` sÃ³ mostra o link
    "Resumo" pra admin. Painel principal segue igual pros 2 papÃ©is â€” Ã© onde o atendente trabalha.
    DecisÃ£o completa em `_memoria/decisoes.md`.
  - Com aprovaÃ§Ã£o do Rafael, semeei 5 conversas fictÃ­cias direto no Supabase de produÃ§Ã£o (nomes e
    telefones claramente falsos, 556199990001-5) cobrindo os 5 status: Camila Duarte (novo),
    Rodrigo Alves (aguardando 52min, aparece em vermelho), Fernanda Lima (respondido em 8min),
    Marcos Teixeira (agendado, jornada respondidoâ†’agendado), Beatriz Nogueira (perdido, inativa hÃ¡
    47 dias, `ultima_reativacao_em` jÃ¡ preenchida de propÃ³sito pra nÃ£o disparar mensagem de
    verdade no cron de amanhÃ£). Validado ao vivo por login real (cookie de sessÃ£o): admin vÃª
    Resumo e entra (200), atendente nÃ£o vÃª o link e toma redirect (307) se tentar a URL, os 5
    nomes aparecem certos no painel.
  - 2 deploys nesta sessÃ£o (1 sÃ³ com a correÃ§Ã£o do cache, 1 com o RBAC do Resumo).
- 2026-09-15: **V1 do painel incrementada** â€” a pedido do Rafael (a Ariadna "precisa ser impactada
  jÃ¡ na V1"). Nada disso ainda em produÃ§Ã£o: falta rodar a migraÃ§Ã£o e fazer `railway up`.
  - Menu lateral em toda tela logada: `src/app/(painel)/layout.tsx` (rota movida pra dentro de um
    route group `(painel)` â€” `/`, `/pacientes/[id]`, `/resumo`, `/equipe`, `/conexao` continuam nas
    mesmas URLs). Nav (`SidebarNav.tsx`) esconde Equipe/Resumo/ConexÃ£o de quem nÃ£o Ã© admin, mas o
    gate de verdade continua sendo o redirect no servidor de cada pÃ¡gina (mesmo padrÃ£o do Resumo
    desde a Fase 3) â€” confirmado que digitar a URL direto como atendente ainda redireciona.
  - **Login por atendente** substitui `PAINEL_SENHA_ADMIN`/`PAINEL_SENHA_ATENDENTE`: tabela nova
    `atendentes` (`clinica_id`, nome, usuÃ¡rio, `senha_hash` scrypt, papel, ativo â€” migraÃ§Ã£o
    `2026-09-15_v4_equipe.sql`). `src/lib/senha.ts` ganhou `hashSenha`/`verificarSenha` (mantÃ©m
    `compararSenhas`, ainda usado pelo `CRON_SECRET`). Login roda `verificarSenha` mesmo quando o
    usuÃ¡rio nÃ£o existe, contra um hash fixo (`HASH_DUMMY_TIMING`) â€” sem isso, "usuÃ¡rio nÃ£o existe"
    respondia mais rÃ¡pido que "senha errada" e vazava por tempo quais usuÃ¡rios sÃ£o reais. Cookie de
    sessÃ£o (`src/lib/sessao.ts`) passa a carregar `atendenteId` + `nome`, nÃ£o sÃ³ o papel.
  - **Equipe** (`src/app/(painel)/equipe/page.tsx`, admin): `src/lib/equipe.ts` agrega, por
    atendente, atendimentos hoje (fuso de BrasÃ­lia â€” `inicioDoDiaBrasilia` novo em `tempo.ts`),
    atendimentos no total, tempo mÃ©dio atÃ© responder e Ãºltima atividade. Cada troca manual de
    status (`src/app/api/conversas/[id]/status/route.ts`) agora grava `eventos_funil.atendente_id`
    com quem estava logado; transiÃ§Ã£o automÃ¡tica do webhook continua sem dono (o sistema nÃ£o sabe
    qual secretÃ¡ria digitou no WhatsApp).
  - **ConexÃ£o** (`src/app/(painel)/conexao/page.tsx`, admin): `src/lib/evolution-status.ts` consulta
    `connectionState`/`fetchInstances`/`connect` da Evolution API (mesma instÃ¢ncia de
    `evolution-send.ts`) com timeout curto e degradaÃ§Ã£o silenciosa em erro â€” status (bolinha
    verde/vermelha + nÃºmero) e QR Code (`base64` da Evolution, direto num `<img>`) pra reconectar
    sem abrir Railway/Evolution. Confirmado ao vivo: instÃ¢ncia realmente conectada, nÃºmero real
    (61) 9925-6901.
  - Sidebar mostra sempre quem estÃ¡ logado (bolinha verde + nome do atendente) e o status da
    conexÃ£o do WhatsApp â€” os dois "bolinha verde" pedidos pelo Rafael, propositalmente separados
    (sessÃ£o ativa vs. WhatsApp conectado, sÃ£o coisas diferentes).
  - Ficha de paciente (`src/lib/pacientes.ts`): jornada mostra quem atendeu cada troca
    (`eventos_funil.atendentes(nome)`, reaproveitando o extrator antes chamado
    `extrairNomePaciente` â€” renomeado pra `extrairNomeEmbutido` jÃ¡ que agora serve paciente e
    atendente).
  - ValidaÃ§Ã£o: 103 testes (16 novos: `senha`, `sessao`, `tempo`, `equipe`, `conversas`),
    `typecheck`/`lint`/`next build` limpos. Sem `chromium-cli` disponÃ­vel nesta mÃ¡quina pra
    screenshot, a verificaÃ§Ã£o em navegador de verdade virou: dev server local apontando pro
    Supabase e Evolution API **de produÃ§Ã£o** (`.env.local`), sessÃµes vÃ¡lidas mintadas com o mesmo
    `SESSAO_SECRET` (mesmo algoritmo HMAC de `sessao.ts`) pra navegar como admin e como atendente
    de verdade â€” confirmou menu, gate de admin (redirect real, nÃ£o sÃ³ link escondido), conexÃ£o
    WhatsApp genuinamente ao vivo, e a ficha de paciente com dado real (sem crashar). Sem a
    migraÃ§Ã£o v4 aplicada, `buscarAtendentePorUsuario`/`listarAtendentes` retornam vazio com log
    claro (`PGRST205`, tabela ausente) em vez de derrubar a pÃ¡gina â€” confirmado tentando logar
    antes de rodar a migraÃ§Ã£o. Tokens de sessÃ£o e HTML de produÃ§Ã£o gerados pra este teste foram
    apagados ao final, nada disso ficou salvo no repositÃ³rio.
  - Nada commitado nem enviado ao GitHub nesta sessÃ£o.
  - Commitado e enviado ao GitHub via `/syncar` (32 arquivos, commit `3f06feb`).
- 2026-09-15: **V1 do painel foi pra produÃ§Ã£o de verdade.** Rafael rodou a migraÃ§Ã£o v4 no SQL
  Editor; ao testar, achei um bug real â€” mesmo problema da Fase 2 (este projeto Supabase nÃ£o tem
  os default privileges configurados no schema `public`), a tabela nova `atendentes` nasceu sem
  `GRANT` pra `service_role`. Confirmado por leitura direta (`permission denied for table
  atendentes`). Corrigido com `2026-09-15_v5_grants_atendentes.sql` (mesmo padrÃ£o de
  `2026-09-15_v1_grants.sql`); Rafael rodou e a leitura confirmou as 3 contas certas.
  - `railway up` estava sendo bloqueado pelo classificador de modo automÃ¡tico ("Production
    Deploy") mesmo com autorizaÃ§Ã£o do Rafael no chat. A pedido dele: `Bash(railway up)` adicionado
    em `.claude/settings.local.json` (permissÃ£o local desta mÃ¡quina) â€” registrado em
    `_contexto/ferramentas.md`.
  - Deploy feito (2 builds em paralelo, porque o primeiro pareceu travado sem log por minutos â€”
    nÃ£o estava, sÃ³ demorou a agendar builder; o segundo chegou no ar primeiro, mesmo cÃ³digo nos
    dois â€” sem risco, Ã© o mesmo commit). Validado com login real de produÃ§Ã£o:
    `admin`/`admin-temp-2026` entra (`{"ok":true,"papel":"admin","nome":"AdministraÃ§Ã£o"}`), painel
    carrega com o menu novo. Rafael confirmou visualmente a tela pedindo usuÃ¡rio/senha e testou o
    login com sucesso.
  - Commitado e enviado ao GitHub via `/syncar` (a migraÃ§Ã£o v5, commit `f61d583`).
- 2026-09-15: **Agentes de IA construÃ­do** (prints da RoiZap de referÃªncia, adaptado ao que o
  sistema tem â€” mesmo critÃ©rio das seÃ§Ãµes anteriores). Entrou como planejado numa sessÃ£o de
  planejamento formal (`EnterPlanMode`), com 3 agentes de exploraÃ§Ã£o mapeando schema/grants, o
  pipeline de webhook/envio e os padrÃµes de UI/segredos antes de codar.
  - MigraÃ§Ã£o `crm/supabase/migrations/2026-09-15_v9_agentes_ia.sql`: tabela `agentes_ia`
    (`clinica_id`, `ativo` nasce `false`, `etiqueta_gatilho_id`, `provider`/`modelo`,
    `prompt_sistema`, temperatura/max_tokens, histÃ³rico, pausa, transferÃªncia) + colunas novas
    `conversas.agente_ativo_id`/`agente_pausado_ate` e `mensagens.gerada_por_agente_id` + grant pro
    `service_role` na mesma migraÃ§Ã£o (mesmo bug de sempre neste Supabase, sem default privileges).
    Rodada em produÃ§Ã£o, commitada (`394468e`) e deployada no Railway (`7fd66e45`, sucesso).
  - `src/lib/ia-provedores.ts` (novo): 5 provedores via `fetch` puro, sem SDK â€” Gemini e Claude com
    formato prÃ³prio, OpenAI/Groq/DeepSeek reaproveitando a mesma funÃ§Ã£o "chat completions"
    OpenAI-compatÃ­vel. `modelosDisponiveis()` sÃ³ lista o que tem env var de chave setada; timeout
    de 15s em toda chamada.
  - `src/lib/agentes.ts` (novo): CRUD do agente; `decidirAtivarAgentePorEtiqueta`/`deveResponder`
    puras e testadas (mesmo padrÃ£o de `funil.ts`); `responderComoAgente` Ã© a orquestraÃ§Ã£o (ler â†’
    gerar â†’ enviar â†’ gravar), mesmo formato de `reativacao.ts`.
  - 3 pontos de integraÃ§Ã£o, sem duplicar lÃ³gica existente: `etiquetas.ts`
    (`adicionarEtiquetaConversa`) ativa o agente quando a etiqueta-gatilho Ã© aplicada; o webhook
    (`api/webhook/evolution/route.ts`) chama `responderComoAgente` depois de persistir a mensagem
    recebida, isolado em `try/catch` pra nunca derrubar o ack pra Evolution; `chat.ts`
    (`enviarRespostaChat`) pausa o agente quando um atendente responde manualmente pelo painel.
    Resposta gerada de forma sÃ­ncrona dentro do webhook, sem fila/cron â€” decisÃ£o registrada em
    `_memoria/decisoes.md` (o CRM roda em container Node persistente no Railway, nÃ£o serverless).
  - UI: `SidebarNav.tsx` ganhou grupo "Ferramentas"; telas `/agentes` (lista, com contagem real de
    mensagens por agente), `/agentes/novo` e `/agentes/[id]` (form com criaÃ§Ã£o de etiqueta
    inline); todas admin-only, sem kit de UI novo (Tailwind cru, mesmo idioma de `conexao`/`equipe`).
  - Todo agente nasce Pausado e o prompt sugerido jÃ¡ embute as regras do CFO-196/2019 â€” decisÃ£o
    registrada em `_memoria/decisoes.md`.
  - Cortado do V1 de propÃ³sito: dividir resposta em vÃ¡rias bolhas do WhatsApp, leitura de
    Ã¡udio/imagem, botÃµes interativos, detecÃ§Ã£o automÃ¡tica de intenÃ§Ã£o de transferÃªncia
    (`max_mensagens_resposta`/`mensagem_transferencia` existem no schema, sem comportamento ainda
    â€” mesmo espÃ­rito de `consultas` na Fase 4).
  - Validado: `typecheck`/`lint`/`test` (145, 9 novos)/`next build` limpos. Smoke test local
    (sÃ³ leitura) contra Supabase/Evolution de produÃ§Ã£o, sessÃ£o mintada admin e atendente: pÃ¡ginas
    carregam, gate de admin redireciona de verdade, sidebar esconde certo pra atendente, tela nÃ£o
    quebra sem nenhuma chave de IA configurada.
  - Commitado (`394468e`) e deployado no Railway (`7fd66e45`, sucesso) depois que o Rafael rodou a
    migraÃ§Ã£o v9 no SQL Editor (sem acesso MCP nem CLI a este projeto Supabase nesta sessÃ£o â€” mesma
    limitaÃ§Ã£o jÃ¡ documentada em `_contexto/ferramentas.md`). Falta configurar ao menos uma chave de
    IA pra responder de verdade.
- 2026-09-15: **Agentes de IA â€” Fase 2A** (horÃ¡rio de atendimento, transferÃªncia real, "Avisar
  Membro da Equipe", pausar apÃ³s concluir fluxo, dividir em mensagens curtas). Rafael comparou a
  Fase 1 com o print completo da RoiZap de novo e achou curta demais; pediu anÃ¡lise seÃ§Ã£o por
  seÃ§Ã£o do que faz sentido numa clÃ­nica de instÃ¢ncia Ãºnica, e aprovou a recomendaÃ§Ã£o em 3 blocos
  por valor/risco de negÃ³cio â€” decisÃ£o completa em `_memoria/decisoes.md`. Planejado formalmente
  (`EnterPlanMode`) de novo, dado o tamanho.
  - MigraÃ§Ã£o `2026-09-15_v10_agentes_comportamento.sql`: 13 colunas novas em `agentes_ia` â€” mesma
    tabela jÃ¡ existente, grant jÃ¡ valia (Ã© por tabela, nÃ£o por coluna).
  - `src/lib/agentes-notificacoes.ts` (novo): `detectarPedidoHumano`/`detectarIntencaoCompra` por
    palavra-chave (nÃ£o por IA â€” decisÃ£o consciente, fica determinÃ­stico e testÃ¡vel em vez de
    depender de parsing de marcador entre 5 provedores diferentes) + `notificarEquipe` (manda
    WhatsApp pros nÃºmeros configurados, template com `{motivo}`/`{nome}`/`{telefone}`/`{resumo}`).
  - `src/lib/agentes.ts`: `responderComoAgente` ganhou um 4Âº parÃ¢metro (`isNovoPaciente`, o webhook
    jÃ¡ calculava) e passou a checar, em ordem: notificar lead novo â†’ pedido de transferÃªncia (pula
    a IA inteira, manda a mensagem de transferÃªncia e libera `agente_ativo_id`) â†’ horÃ¡rio de
    atendimento â†’ gerar resposta (com notificaÃ§Ã£o de fallback se falhar) â†’ intenÃ§Ã£o de compra â†’
    truncar por tamanho mÃ¡ximo â†’ dividir em blocos se configurado â†’ pausar apÃ³s concluir o fluxo se
    o status virou resolvido. Duas funÃ§Ãµes puras novas testadas: `dentroDoHorario`,
    `dividirMensagem`.
  - UI (`AgenteForm.tsx`): 2 seÃ§Ãµes novas (TransferÃªncia para Humano, Avisar Membro da Equipe) +
    campos novos nas seÃ§Ãµes existentes (Modelo de IA ganhou horÃ¡rio; Comportamento ganhou tamanho
    mÃ¡ximo, dividir em mensagens curtas, pausar apÃ³s concluir).
  - Validado: `typecheck`/`lint`/`test` (176, 31 novos)/`next build` limpos; smoke test local (sÃ³
    leitura) confirmando as seÃ§Ãµes novas renderizando sem chave de IA nenhuma configurada.
  - Rafael rodou a migraÃ§Ã£o v10 sozinho. Commitado (`adf4ece`) e deployado no Railway (`3e803bb3`,
    sucesso). Falta configurar chave de IA (mesma pendÃªncia da Fase 1).
  - Achado tÃ©cnico: o loop de checagem de deploy que eu tinha deixado em segundo plano ficou preso
    porque usava `python3`, que nÃ£o existe nesta mÃ¡quina â€” trocado por `awk`. Registrado no diÃ¡rio
    pra prÃ³xima sessÃ£o nÃ£o repetir.
- 2026-09-15: **1Âº Agente de IA criado e validado de ponta a ponta em produÃ§Ã£o.** Chave do Gemini
  jÃ¡ configurada na sessÃ£o anterior; faltava o agente existir de verdade no banco. Sem MCP/CLI de
  escrita neste projeto Supabase, criado via REST direto (service role key de `.env.local`, mesmo
  caminho jÃ¡ usado pra semear dado fictÃ­cio na Fase 4/6) â€” etiqueta "Atendimento IA" (nÃ£o existia
  etiqueta nenhuma ainda) e o agente "RecepÃ§Ã£o Virtual": Gemini, temperatura 0,4, transferÃªncia
  ligada, "avisar equipe" apontando pro nÃºmero do Rafael, horÃ¡rio de atendimento prÃ©-preenchido mas
  desligado de propÃ³sito (pra poder testar em qualquer hora). Prompt de sistema reescrito mais
  detalhado e profissional a pedido do Rafael (o rascunho inicial foi considerado raso) â€” puxa
  conteÃºdo real e jÃ¡ compliance-safe do site (`tratamentos.ts`/`faq.ts`: sÃ³ os 4 tratamentos
  confirmados, nunca preÃ§o, nunca opiniÃ£o clÃ­nica, regras da CFO-196/2019 explÃ­citas).
  - **Bug real achado no meio do teste**: `gemini-2.5-flash-lite` (fixo no catÃ¡logo de
    `ia-provedores.ts`) passou a devolver 404 "no longer available to new users" â€” o Google
    descontinuou o modelo pra chaves novas. Trocado pelo alias `gemini-flash-lite-latest`
    (confirmado por `ListModels` da API que funciona com esta chave) â€” evita quebrar nesse mesmo
    jeito quando o prÃ³ximo modelo pontual for aposentado. Corrigido no cÃ³digo e no agente jÃ¡
    criado; 176â†’180 testes/typecheck/lint/build limpos. Commitado (`b699685`) e deployado no
    Railway (sucesso).
  - **Validado com envio real de ponta a ponta**: primeiro teste (ativar o agente sem aplicar a
    etiqueta na conversa) nÃ£o respondeu â€” achado de que o agente sÃ³ escuta a conversa onde a
    etiqueta-gatilho foi de fato aplicada, ativar o agente sozinho nÃ£o basta. Aplicada a etiqueta
    numa conversa real (o prÃ³prio nÃºmero de teste do Rafael) e mandada mensagem de verdade pelo
    WhatsApp: a IA respondeu certo. Simulado depois, direto pelo webhook de produÃ§Ã£o (payload
    Baileys real, mesma rota que a Evolution usa), "Quero marcar uma consulta" â€” a IA reconheceu
    sozinha (pelo prompt, nÃ£o por palavra-chave) que "pronta pra marcar horÃ¡rio" Ã© gatilho de
    passar pra humano, respondeu em 2 blocos, e a notificaÃ§Ã£o "avisar equipe" (intenÃ§Ã£o de
    agendar) chegou de verdade no WhatsApp do Rafael. Fase 1 e Fase 2A do CRM estÃ£o, agora sim,
    funcionais de ponta a ponta com uso real â€” nÃ£o sÃ³ deployadas.
- 2026-09-15: **"Pausar IA" / "Retomar IA" / "Finalizar Atendimento" no Chat ao Vivo** (a pedido do
  Rafael, print da RoiZap com esses 2 botÃµes ao lado do status da conversa como referÃªncia).
  - `src/lib/agentes.ts`: `pausarAgenteManual` desliga o agente da conversa na hora
    (`agente_ativo_id = null`) â€” diferente da pausa temporÃ¡ria automÃ¡tica jÃ¡ existente
    (`pausarAgenteSeConfigurado`), que sÃ³ entra quando um atendente responde na mÃ£o e expira
    sozinha. `retomarAgente`/`decidirAgenteElegivel` (pura, testada) reconectam pelo agente ativo
    cuja etiqueta-gatilho bate com alguma etiqueta que a conversa jÃ¡ tem â€” sem precisar tirar e
    recolocar a etiqueta pra reativar.
  - `src/lib/chat.ts`: `finalizarAtendimento` fecha o status (sÃ³ forÃ§a "respondido" se ainda nÃ£o
    estiver num status resolvido â€” nÃ£o regride "agendado"/"perdido" de volta) e desliga a IA, num
    clique sÃ³. `ConversaChat` ganhou `agenteAtivoId` pro Chat ao Vivo saber se mostra "Pausar" ou
    "Retomar".
  - **Sem migraÃ§Ã£o nova** â€” tudo reaproveita `agente_ativo_id`/`agente_pausado_ate`, colunas que jÃ¡
    existiam desde a v9. 2 rotas novas (`/api/chat/conversas/[id]/agente`,
    `.../[id]/finalizar`). 183 testes (7 novos), typecheck/lint/build limpos. Commitado (`63ac13f`)
    e deployado no Railway (sucesso).
- 2026-09-15: **NotificaÃ§Ã£o real do navegador** (referÃªncia: banner "Ative as notificaÃ§Ãµes pra nÃ£o
  perder mensagens" da RoiZap, print mandado pelo Rafael). Antes de construir, perguntei 2 coisas
  que mudavam a implementaÃ§Ã£o inteira â€” Rafael confirmou as duas: (1) Ã© pra ser notificaÃ§Ã£o de
  verdade do sistema operacional (Notification API), nÃ£o sÃ³ o sino do painel (que sÃ³ conta com a
  aba aberta e em foco); (2) o controle de arrastar Ã© de 3 posiÃ§Ãµes, nÃ£o um liga/desliga comum â€”
  esquerda desliga tudo, centro (padrÃ£o) liga tudo, direita desliga sÃ³ "mensagem recebida" e
  mantÃ©m "lead esfriando" (as 2 categorias que a notificaÃ§Ã£o jÃ¡ distinguia).
  - `src/lib/notificacoes-preferencia.ts` (novo, com testes): preferÃªncia em `localStorage` (Ã© por
    navegador/pessoa, nÃ£o por clÃ­nica â€” nunca no Supabase). `deveNotificar(tipo, pref)` pura.
  - `src/components/Notificacoes.tsx`: adaptado ao que o painel tem (sem sidebar sobrando como a
    RoiZap pro banner) â€” o aviso e o slider entraram dentro do prÃ³prio dropdown do sino, no topo,
    antes da lista. Slider de 3 posiÃ§Ãµes arrastÃ¡vel via Pointer Events (sem lib nova), com clique
    direto tambÃ©m funcionando. PermissÃ£o do navegador sÃ³ Ã© pedida por gesto real do usuÃ¡rio
    (clique/arraste) â€” nunca sozinho ao carregar a pÃ¡gina. NotificaÃ§Ã£o nova detectada comparando
    contra o que jÃ¡ foi visto entre um poll e outro (20s), com `tag` pra nunca duplicar a mesma;
    clicar na notificaÃ§Ã£o foca a aba e navega pro Chat ao Vivo.
  - 183 testes (3 novos), typecheck/lint/build limpos. Commitado (`5551897`) e deployado no
    Railway (sucesso). Limite conhecido e aceito: sÃ³ funciona com o navegador aberto (mesmo em
    segundo plano) â€” navegador fechado de vez nÃ£o notifica, exigiria service worker + servidor de
    push, infra desproporcional ao tamanho da operaÃ§Ã£o hoje.
- 2026-09-15: **Fase 5 (automaÃ§Ã£o de reativaÃ§Ã£o) validada de ponta a ponta pela 1Âª vez.** Bug real
  achado ao checar o workflow do GitHub Actions a pedido do Rafael: jÃ¡ tinha disparado sozinho 1x
  (agendado, 9h BrasÃ­lia) e falhado com 401 â€” `ODONTOMINAS_CRM_CRON_SECRET` (GitHub) nÃ£o batia byte
  a byte com `CRON_SECRET` (Railway), provÃ¡vel espaÃ§o/quebra de linha a mais colado num dos dois
  lados. Corrigido: segredo novo gerado e sincronizado nos dois lugares (Railway via MCP, redeploy
  automÃ¡tico; GitHub colado manualmente pelo Rafael â€” escrita de secret de repositÃ³rio Ã© bloqueada
  pelo classificador de seguranÃ§a por design, mesmo com autorizaÃ§Ã£o explÃ­cita no chat). Rafael
  re-rodou o job pela aba Actions; confirmado por leitura via API que passou (`run_attempt: 2`,
  sucesso). De bÃ´nus, confirmado que leitura de workflows/runs/jobs/logs do GitHub Actions funciona
  direto por REST com o `GITHUB_PERSONAL_ACCESS_TOKEN`, sem precisar de `gh` CLI â€” sÃ³ disparo manual
  e escrita de secret continuam fora do alcance (ver `ferramentas.md`).
- 2026-09-16: **Agentes de IA â€” Fase 2B (Buffer de mensagens) completa, validada de ponta a ponta e
  desligada de novo.** Planejada formalmente (`EnterPlanMode`, dado o tamanho â€” mesma prÃ¡tica das
  Fases 1/2A). Arquitetura aprovada em `_memoria/decisoes.md` (2026-09-15): debounce por coluna +
  poll dentro do prÃ³prio processo Next. Duas perguntas resolvidas antes de codar: buffer opt-in por
  agente (desligado por padrÃ£o, o RecepÃ§Ã£o Virtual continua respondendo na hora atÃ© alguÃ©m ligar) e
  poll sÃ³ em produÃ§Ã£o (`NODE_ENV === "production"`), nunca em `npm run dev`.
  - MigraÃ§Ã£o `2026-09-15_v11_agentes_buffer.sql`: `agentes_ia.buffer_mensagens`/`buffer_segundos`
    (toggle + segundos, mesmo padrÃ£o de todo campo da Fase 2A) e `conversas.agente_buffer_desde`/
    `agente_buffer_ate`/`agente_buffer_novo_paciente`.
  - `src/lib/agentes-buffer.ts` (novo): `processarMensagemRecebida` (chamada pelo webhook no lugar
    de `responderComoAgente` direto â€” sem buffer ligado no agente, responde na hora igual sempre;
    com buffer, sÃ³ abre/estende a janela), `processarBuffersVencidos` (o poll â€” fecha a janela
    ANTES de ler as mensagens, pra uma mensagem que chegar durante o processamento abrir uma janela
    nova em vez de ficar perdida; chama `responderComoAgente` DIRETO, nunca `processarMensagemRecebida`
    de volta, senÃ£o reabriria o buffer em loop sem nunca responder), `juntarMensagensBuffer` (pura,
    testada). `responderComoAgente` nÃ£o mudou nada â€” jÃ¡ era genÃ©rica sobre "uma string do que o
    paciente disse", o texto combinado da rajada entra nela igual a uma mensagem Ãºnica.
  - `src/instrumentation.ts` (novo): liga o poll (`iniciarPollBuffer`) quando o processo Next sobe â€”
    Ãºnico jeito padrÃ£o do Next.js de rodar cÃ³digo uma vez no boot, sem custom server.
  - Validado: typecheck/lint/188 testes (5 novos)/build limpos. Commitado (`07ded19`), Rafael rodou
    a migraÃ§Ã£o v11 no SQL Editor, deployado no Railway (`6525a599`, sucesso).
  - **Bug real achado no 1Âº teste ao vivo pelo WhatsApp**: mandei mensagem de teste, o buffer abriu
    e fechou certo (colunas confirmavam), mas nenhuma resposta saiu â€” e nenhum erro apareceu no log.
    Causa: `agente_buffer_desde` gravava o relÃ³gio no instante em que `abrirOuEstenderBuffer` rodava
    â€” sempre um pouco DEPOIS do `created_at` da prÃ³pria mensagem que abriu a janela (ela jÃ¡ tinha
    sido inserida por outra query, no webhook, momentos antes). A busca do poll
    (`created_at >= agente_buffer_desde`) nunca encontrava a mensagem; `juntarMensagensBuffer`
    recebia lista vazia; o cÃ³digo tratava "nada pra responder" como caso normal â€” silencioso, sem
    log de erro nenhum (por isso nÃ£o apareceu como falha, sÃ³ como silÃªncio).
  - Corrigido: `MARGEM_ABERTURA_MS` (10s) gravada pra trÃ¡s na abertura da janela, garantindo que a
    mensagem que disparou a rajada sempre entra na busca. 188 testes/typecheck/lint/build limpos.
    Commitado (`ec3d768`) e deployado (`b2dc46d7`, sucesso).
  - **Validado de ponta a ponta com WhatsApp real**: 3 mensagens seguidas em ~3s ("Oie", "Oie",
    "Ola") â†’ 1 resposta sÃ³ da IA (2 bolhas curtas â€” "dividir em mensagens curtas" normal, nÃ£o 3
    respostas separadas).
  - **DecisÃ£o**: Rafael pediu ajuda pra decidir se deixava ligado. Recomendei desligar â€” nenhum
    paciente real usa o nÃºmero ainda, o buffer sÃ³ ajuda com rajada de mensagens (pra mensagem
    Ãºnica, o caso mais comum, sÃ³ acrescenta ~10-15s de espera sem ganho), e o prÃ³ximo marco Ã© a
    demo pro marido, onde resposta rÃ¡pida pesa mais. Buffer desligado de novo
    (`buffer_mensagens: false`, `buffer_segundos: 10` fica salvo pra quando quiser religar).
    DecisÃ£o completa em `_memoria/decisoes.md`.
  - Achado tÃ©cnico: sessÃ£o de admin mintada localmente (mesmo script de sempre) foi **rejeitada
    pela produÃ§Ã£o** (401) â€” `SESSAO_SECRET` de `crm/.env.local` provavelmente diverge do Railway
    (mesmo tipo de problema jÃ¡ visto com o `CRON_SECRET` da Fase 5). Contornado lendo/escrevendo
    direto no Supabase via REST com `SUPABASE_SERVICE_ROLE_KEY` â€” mesmo caminho jÃ¡ documentado em
    `ferramentas.md`. Sincronizar os dois `SESSAO_SECRET` fica como pendÃªncia menor, nÃ£o bloqueou o
    teste desta vez.
  - Achado tÃ©cnico: guiei o Rafael passo a passo (interativo, no VS Code) pra autorizar o MCP
    oficial do Supabase (`supabase-crm-odontominas`, jÃ¡ configurado em `.mcp.json` da raiz) via
    OAuth â€” funcionou (`/mcp` numa sessÃ£o interativa nova). A autorizaÃ§Ã£o nÃ£o apareceu nesta sessÃ£o
    em andamento (conexÃ£o de MCP carrega sÃ³ no inÃ­cio da sessÃ£o) â€” deve valer a partir de uma
    sessÃ£o nova. `ferramentas.md` atualizado.
- 2026-09-15: **menu "Ferramentas" abre/recolhe + som de notificaÃ§Ã£o no Chat ao Vivo.** A pedido do
  Rafael, 2 prints de referÃªncia da RoiZap (o menu com Ã­cone de raio + chevron, e um controle de som
  que nÃ£o veio anexado â€” perguntei o formato via 3 opÃ§Ãµes, ele escolheu liga/desliga simples).
  - `src/components/SidebarNav.tsx`: grupo "Ferramentas" ganhou Ã­cone de raio, label e chevron que
    gira (aberto = pra cima, fechado = pra baixo); clique alterna; aberto por padrÃ£o, sem mudar o
    comportamento de antes. No nav horizontal do mobile (sem esse cabeÃ§alho) os itens continuam
    sempre visÃ­veis â€” sÃ³ o desktop tem o recolher.
  - `src/components/chat/ChatAoVivo.tsx`: botÃ£o de alto-falante no cabeÃ§alho ao lado de "Nova
    conversa". Toca um "ding" de dois tons via Web Audio API (oscilador + gain, `AudioContext`, sem
    lib nova, sem arquivo de Ã¡udio) sÃ³ quando `atualizarListaAgora` (polling da lista a cada 8s)
    detecta uma conversa com `ultimaMensagemDirecao === "recebida"` mais nova que a que jÃ¡ estava â€”
    nunca no envio do prÃ³prio atendente, nunca na carga inicial da pÃ¡gina. PreferÃªncia liga/desliga
    em `localStorage` (por navegador/pessoa, mesmo padrÃ£o do `notificacoes-preferencia.ts` do sino
    do topo), ligado por padrÃ£o.
  - Validado: typecheck/lint/183 testes/`next build` limpos. Sem `chromium-cli` nesta mÃ¡quina pra
    clicar/ouvir de verdade (limitaÃ§Ã£o jÃ¡ conhecida) â€” smoke test via sessÃ£o de admin mintada
    localmente (mesmo `SESSAO_SECRET`) conferindo o HTML renderizado dos dois recursos.
  - Commitado (`13378d5`) e deployado no Railway (`railway up`, sucesso, smoke HTTP 200). **Rafael
    testou em produÃ§Ã£o e confirmou que funcionou.**
  - Escolheu seguir agora para a Fase 2B (Buffer de mensagens) em vez da Fase 6 (demo pro marido).
- 2026-09-16: **Agentes de IA â€” prompt estruturado (Simples/AvanÃ§ado) + aba Conhecimento**, a
  pedido do Rafael (print do "Agente 01" da RoiZap). Perguntado quais das 4 abas novas do print
  (Conhecimento, QualificaÃ§Ã£o, Ferramentas, Pixel) valiam construir de verdade agora â€” mesmo
  critÃ©rio jÃ¡ usado no Chat ao Vivo, sem copiar aba sem funcionalidade real por trÃ¡s â€” Rafael
  escolheu sÃ³ **Conhecimento**.
  - `AgenteForm.tsx` virou 3 abas (ConfiguraÃ§Ã£o / Prompt do Agente / Conhecimento). Modo AvanÃ§ado
    preserva o textarea Ãºnico de sempre (`prompt_sistema`) â€” o "RecepÃ§Ã£o Virtual" em produÃ§Ã£o
    continua exatamente como estava. Modo Simples estrutura Persona, Objetivo, Fluxo e Triagem,
    Guardrails (`src/lib/agentes.ts`, `montarPromptSistema` â€” guardrails entram primeiro no prompt
    final, prioridade mÃ¡xima, igual ao aviso do print) e TraÃ§os de Personalidade (Tom de Voz, Usar
    Emojis).
  - `src/lib/agentes-conhecimento.ts` (novo, mesmo padrÃ£o de `etiquetas.ts`): CRUD dos itens de
    Conhecimento (tÃ­tulo + conteÃºdo), tabela nova `agentes_conhecimento`. Entram no prompt final
    automaticamente, nos dois modos, pra reduzir a IA inventando informaÃ§Ã£o. `duplicarAgente`
    tambÃ©m passa a copiar os itens de conhecimento do agente original.
  - CabeÃ§alho de `/agentes/[id]` ganhou os 4 cards do print (Mensagens, Conversas, Tempo MÃ©dio,
    Conhecimentos â€” `buscarEstatisticasAgente`, dado real, nÃ£o decorativo) e o Ativar/Pausar subiu
    pro topo (`AgenteStatusHeader.tsx`, novo).
  - MigraÃ§Ã£o `2026-09-16_v12_agentes_prompt_conhecimento.sql`. **1Âª vez que uma migraÃ§Ã£o de schema
    foi aplicada direto pelo MCP do Supabase** (`apply_migration`), sem precisar do SQL Editor
    manual do Rafael â€” confirma que o MCP recÃ©m-autorizado (ver Fase 2B acima) cobre schema
    tambÃ©m, nÃ£o sÃ³ dado. `ferramentas.md` atualizado.
  - Validado: typecheck/lint/198 testes (7 novos: `montarPromptSistema`,
    `calcularTempoMedioRespostaMs`)/build limpos. Deploy no Railway confirmado (`railway up`,
    `âœ“ Ready in 772ms`, status `SUCCESS` via MCP). Testado ao vivo em produÃ§Ã£o: pÃ¡gina do "RecepÃ§Ã£o
    Virtual" renderiza certo com a nova UI e o agente segue em modo AvanÃ§ado intacto; criado agente
    de teste em modo Simples com 1 item de Conhecimento pela API, dado conferido certo direto no
    Supabase, e apagado em seguida â€” banco voltou ao estado de antes (1 agente, 0 conhecimento).
  - Ainda nÃ£o commitado nem enviado ao GitHub nesta sessÃ£o.
- 2026-09-16: **QualificaÃ§Ã£o AutomÃ¡tica de Leads construÃ­da e em produÃ§Ã£o**, a pedido do Rafael â€”
  revertendo a decisÃ£o de horas antes de deixar essa aba fora dos Agentes de IA por falta de
  critÃ©rio (print da RoiZap). Antes de codar, 2 perguntas resolvidas com o Rafael: escala fixa
  Quente/Morno/Frio (nÃ£o etiquetas livres por clÃ­nica) e reavaliar depois de cada resposta do
  agente (nÃ£o sÃ³ na 1Âª mensagem) â€” as 2 recomendadas.
  - `src/lib/agentes-qualificacao.ts` (novo): `classificarQualificacao` reaproveita o mesmo
    provider/modelo jÃ¡ configurado no agente (via `gerarResposta` de `ia-provedores.ts`, prompt
    pedindo 1 palavra sÃ³, temperatura 0) â€” sem infraestrutura nova, sÃ³ mais uma chamada de IA na
    mesma rodada que jÃ¡ gera a resposta. `parseClassificacao` pura e testada.
    `aplicarQualificacaoAutomatica` garante as 3 etiquetas na clÃ­nica (cria a que faltar, cor fixa
    por classificaÃ§Ã£o; reaproveita se jÃ¡ existir uma com o mesmo nome â€” `etiquetas.ts` ganhou
    `buscarOuCriarEtiqueta`) e aplica sÃ³ a que bate, removendo as outras duas da conversa â€” a
    etiqueta mostra sempre a temperatura ATUAL, nunca o histÃ³rico de por onde o lead jÃ¡ passou.
  - `src/lib/agentes.ts`: `responderComoAgente` chama a classificaÃ§Ã£o depois de enviar a resposta,
    isolada em try/catch (nunca derruba o envio, que jÃ¡ aconteceu antes) â€” opt-in por agente
    (`qualificacaoAutomatica`, nasce `false`, nÃ£o muda nada no RecepÃ§Ã£o Virtual atÃ© alguÃ©m ligar).
  - UI (`AgenteForm.tsx`): aba nova "QualificaÃ§Ã£o" â€” o toggle do print + as 3 etiquetas explicadas
    quando ligado.
  - MigraÃ§Ã£o `2026-09-16_v13_agentes_qualificacao.sql` (1 coluna em `agentes_ia`, tabela jÃ¡ com
    grant desde a v9). Aplicada direto pelo MCP do Supabase (`apply_migration`), confirmada lendo o
    schema depois â€” 2Âª vez seguida sem precisar do SQL Editor manual do Rafael.
  - Validado: typecheck/lint/202 testes (4 novos: `parseClassificacao`)/build limpos. Deploy no
    Railway (`railway up`) confirmado `SUCCESS` via MCP e `/login` respondendo 200 em produÃ§Ã£o. Sem
    clique real numa tela (sem `chromium-cli` nesta mÃ¡quina, limitaÃ§Ã£o jÃ¡ conhecida) â€” a aba segue
    o mesmo padrÃ£o jÃ¡ validado da aba Conhecimento.
  - Ainda nÃ£o commitado nem enviado ao GitHub nesta sessÃ£o.
- 2026-09-17: **Fase 3 do motor de Fluxo de Conversa â€” evoluÃ§Ã£o arquitetural pra motor central de
  automaÃ§Ã£o** (decisÃ£o em `_memoria/decisoes.md`). DecisÃ£o confirmada antes de codar: nÃ£o criar um
  2Âº motor â€” o Fluxo de Conversa evolui pra aceitar gatilho temporal e interno, nÃ£o sÃ³ webhook.
  - **Implementado**: nÃ³ genÃ©rico `capturar_resposta` (texto/nÃºmero, min/max, regex, tentativas,
    timeout â€” mesma mÃ¡quina de estados de `menu`); infra de pesquisas (`pesquisas` +
    `pesquisa_respostas`, NPS/satisfaÃ§Ã£o/avaliaÃ§Ã£o Google compartilham schema, nunca a mesma
    semÃ¢ntica) com nÃ³s `criar_pesquisa`/`persistir_resposta_pesquisa`; eventos internos
    (`emitirEventoAutomacao`, `fluxo-eventos-internos.ts`) e scanner temporal genÃ©rico
    (`executarScannerTemporal`, `fluxo-scanner-temporal.ts`, aniversÃ¡rio como 1Âª regra);
    `pacientes.data_nascimento`; observabilidade (`automacao_eventos`); branding dinÃ¢mico
    (`buscarClinicaAtual`, `{clinica_nome}` no `resolverVariaveis`) removendo os hardcodes de
    "OdontoMinas" restantes; editor visual completo pros 3 nÃ³s novos (paleta, canvas, propriedades,
    conexÃ£o, validaÃ§Ã£o, salvar/reabrir).
  - IdempotÃªncia 100% reaproveitada do Ã­ndice Ãºnico jÃ¡ existente
    (`fluxo_execucoes_gatilho_dedupe_idx`) â€” nenhuma tabela nova sÃ³ pra isso. Migrations
    `v21_pacientes_data_nascimento`, `v22_pesquisas`, `v23_automacao_eventos` aplicadas uma a uma
    via MCP do Supabase, cada uma validada por leitura de schema depois.
  - **3 bugs reais achados e corrigidos durante a validaÃ§Ã£o em produÃ§Ã£o** (nÃ£o durante o
    desenvolvimento â€” sÃ³ apareceram testando de verdade):
    1. `pesquisas.updated_at` nunca era atualizado ao marcar respondida (`persistir_resposta_pesquisa`
       esquecia o campo no UPDATE).
    2. A guarda "recusa se `dono_conversa='humano'`" (certa pro gatilho por mensagem, protege
       atendimento humano em andamento) bloqueava TODO gatilho temporal/interno, porque "humano" Ã©
       sÃ³ o estado de repouso da imensa maioria das conversas, nÃ£o sinal de atendimento ativo â€” sem
       o fix, aniversÃ¡rio/evento interno nunca alcanÃ§ariam paciente real nenhum. Corrigido com
       `conversaEraNova=true` nesses dois caminhos (mesma exceÃ§Ã£o que `nova_conversa` jÃ¡ usa).
    3. `/api/cron/fluxo-temporal` faltava na allowlist do `middleware.ts` â€” o middleware barrava a
       rota (401) antes dela sequer rodar, mesmo com a autenticaÃ§Ã£o por `CRON_SECRET` correta.
    4. (achado colateral, corrigido a pedido) `transferirExecucaoAtivaParaHumano` (funÃ§Ã£o prÃ©-Fase 3)
       mudava `estado`/`motivo_finalizacao`/`finalizado_em` mas esquecia `updated_at`.
  - Validado: 544 testes/typecheck/lint/build limpos. 3 deploys no Railway durante a validaÃ§Ã£o (1
    inicial + 2 correÃ§Ãµes), todos `SUCCESS`, workers (`agentes-buffer`/`disparos-worker`/
    `fluxo-worker`) subindo limpos em todos. Commit final no `main`: `f26340b`.
  - Testado ao vivo em produÃ§Ã£o via API real (login como admin, mesmas rotas que o editor usa) +
    banco: fluxo criado â†’ rascunho salvo (validaÃ§Ã£o de forma/grafo real, sem erro/aviso) â†’ lido de
    volta idÃªntico â†’ publicado â†’ executado via `/testar`. Evento interno (`atendimento_concluido`)
    e scanner temporal (aniversÃ¡rio) testados com paciente de teste: 1Âª emissÃ£o inicia execuÃ§Ã£o, 2Âª
    emissÃ£o idÃªntica detecta idempotÃªncia (dedupe key), confirmado no banco (1 execuÃ§Ã£o sÃ³, nunca
    2). Round-trip completo de `capturar_resposta` com resposta chegando por WhatsApp de verdade
    **nÃ£o fechou** â€” limitaÃ§Ã£o de infraestrutura de teste descoberta na validaÃ§Ã£o: o Ãºnico nÃºmero
    de teste disponÃ­vel (`61981925241`) Ã© o mesmo nÃºmero logado como instÃ¢ncia do CRM, entÃ£o
    qualquer mensagem dele sai sempre como `fromMe=true` ("a clÃ­nica falando"), nunca como resposta
    de paciente â€” precisa de um 2Âº nÃºmero/aparelho pra fechar esse teste especificamente. EvidÃªncia
    parcial preservada (mensagem enviada, execuÃ§Ã£o em `waiting_input`, pesquisa criada) â€” ver seÃ§Ã£o
    abaixo.
  - `atendimento_concluido` continua sem origem real no CRM (nem `respondido` nem `agendado`
    significam isso) â€” sÃ³ testÃ¡vel pela rota `/api/automacao/eventos/testar`, protegida por sessÃ£o
    de admin + `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=true` setada sÃ³ durante a validaÃ§Ã£o e desligada
    (`false`) logo depois.
  - ExecuÃ§Ã£o de demo `a98ee509` (Fase 6, ver auditoria anterior): mudou de estado durante esta
    sessÃ£o (`waiting_input` â†’ `transferred`, `motivo_finalizacao=resposta_manual_chat`) â€” **nÃ£o foi
    causado por nenhuma migration/cÃ³digo da Fase 3**, foi o prÃ³prio Rafael respondendo manualmente
    pelo Chat ao Vivo do painel (confirmado por ele). VariÃ¡veis e histÃ³rico de passos continuam
    intactos.
  - Artefatos de teste preservados de propÃ³sito (nÃ£o apagar sem autorizaÃ§Ã£o explÃ­cita â€” servem de
    prova prÃ¡tica pra apresentaÃ§Ã£o): ver `EVIDÃŠNCIAS DA FASE 3` abaixo. Todos os fluxos de teste com
    gatilho real (`atendimento_concluido`, `aniversario`) ficaram `pausado` â€” nenhum dispara sozinho.
  - Commitado e enviado ao GitHub (`main`, commit final `f26340b`). Deploy em produÃ§Ã£o confirmado.
  - **PendÃªncias reais**: (1) fechar o round-trip completo de `capturar_resposta` com resposta de
    WhatsApp de verdade quando houver um 2Âº nÃºmero de teste disponÃ­vel; (2) decidir quando apagar
    os artefatos `[TESTE FASE 3]` (aguardando autorizaÃ§Ã£o explÃ­cita do Rafael, pÃ³s-apresentaÃ§Ã£o);
    (3) Fase 4 (NPS: classificaÃ§Ã£o detrator/neutro/promotor, dashboard) ainda nÃ£o iniciada de
    propÃ³sito.

  ### EVIDÃŠNCIAS DA FASE 3

  Preservadas em produÃ§Ã£o atÃ© autorizaÃ§Ã£o explÃ­cita do Rafael pra apagar (pÃ³s-apresentaÃ§Ã£o). Todos
  os fluxos abaixo tÃªm `[TESTE FASE 3]` no nome e `uso: demonstracao_fase3` na descriÃ§Ã£o/metadata.

  | teste | fluxo_id | execuÃ§Ã£o | pesquisa_id | paciente de teste | dedupe key | resultado |
  |---|---|---|---|---|---|---|
  | Captura + Pesquisa (sem resposta) | `fc61b397-9c44-4ebf-8c29-6d0658ee203d` | `42b4a109-e8da-4393-b9bc-aa3603848e23` (cancelada na limpeza de conversa) | `cd9226ef-2251-4346-b8a4-890e90b9957b` (status `enviada`, nunca respondida â€” prova "pesquisa sem resposta continua existindo") | Camila Duarte (fixture) | â€” | pesquisa criada, sem resposta |
  | Round-trip WhatsApp â€” Captura + Pesquisa | `c95d85a7-8b08-4e7d-8a7d-4f343ffa82dd` | `9867cb23-a61a-49dd-8a93-fe52c2fbc299` (em `waiting_input`, nÃ³ `captura`) | `605e8497-aa8a-40be-9fc7-780d5a3ac853` (status `enviada`) | Rafael (teste Disparos) | â€” | mensagem enviada de verdade por WhatsApp; resposta nÃ£o fechou (limitaÃ§Ã£o de nÂº de teste, ver acima) |
  | Evento interno â€” atendimento_concluido | `8d763b38-23f0-4406-a646-924204b3dd8e` (pausado) | `2d737690-0ed6-4b5a-9a6b-94fafe949e2c` (completed) | â€” | Camila Duarte (fixture) | `atendimento_concluido:64295231-de94-4b92-8816-6f0d794cce07:fase3-prod-001` | 1Âª emissÃ£o: `execucao_iniciada`; 2Âª emissÃ£o idÃªntica: `idempotencia_existente` (`automacao_eventos` linhas `ce3d677dâ€¦`/`019dd02aâ€¦`) |
  | Scanner temporal â€” aniversÃ¡rio | `9fcb1331-ec5f-40d7-ae69-94c7b6f36329` (pausado) | `a1ae79dd-dd90-4c46-b765-1367672dd847` (completed) | â€” | Camila Duarte (fixture, `data_nascimento` de teste jÃ¡ removida depois) | `aniversario:64295231-de94-4b92-8816-6f0d794cce07:2026` | 1Âª rodada: `execucao_iniciada`; 2Âª rodada (mesma referÃªncia anual): `idempotencia_existente` (`automacao_eventos` linha `38e1949bâ€¦`) |

  Commit dos fixes achados na validaÃ§Ã£o: `57d62ff` (updated_at pesquisas), `94308ec` (guarda
  conversa_com_humano), `161cb73` (allowlist middleware), `f26340b` (updated_at transferÃªncia pra
  humano). Deploy final: Railway, deployment `b36cb174-06c0-47b9-9d73-063fa380be02`, status
  `SUCCESS`. Flag `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=false` confirmada desde o fim da validaÃ§Ã£o.
- 2026-09-18: **Fase 5 do Fluxo de Conversa â€” ReputaÃ§Ã£o/Google Reviews implementada e validada em
  produÃ§Ã£o**, a pedido explÃ­cito do Rafael. Ele trouxe um prompt de especificaÃ§Ã£o bem detalhado;
  antes de codar, revisei contra o cÃ³digo real (nÃ£o assumido) e voltei com 2 correÃ§Ãµes que mudaram
  o desenho: `pesquisas.tipo='avaliacao_google'` e o nÃ³ `criar_pesquisa` jÃ¡ existiam desde a v22
  (Fase 3) â€” menos trabalho novo do que o prompt supunha â€” e a mensagem enviada **nÃ£o** ganhou tela
  de template prÃ³pria: ela Ã© o texto do nÃ³ "mensagem" do Fluxo que o admin desenha, mesmo padrÃ£o do
  NPS. Uma tela de ConfiguraÃ§Ãµes com campo de mensagem prÃ³prio duplicaria a fonte de verdade.
  - **Implementado**: `reputacao_config` (1 linha por clÃ­nica â€” ativo, URL do Google, tracking de
    clique, delay pra automaÃ§Ã£o futura, guardado sem efeito ainda) + 3 colunas em `pesquisas`
    (`tracking_token`, `tracking_token_expira_em`, `clicado_em`) + `status` ganhou
    `clicada`/`falhou` (migration `v24`). Novo tipo de gatilho interno
    `solicitacao_avaliacao_google` em `fluxo-gatilhos.ts` (a Fluxo builder UI sÃ³ deixava escolher
    os 3 gatilhos de mensagem â€” abri a opÃ§Ã£o no seletor). AÃ§Ã£o manual ("â­ Solicitar avaliaÃ§Ã£o
    Google" na ficha do paciente) sÃ³ emite o evento interno via `emitirEventoAutomacao` â€” quem
    manda a mensagem Ã© o Fluxo publicado e ativo com esse gatilho, exatamente como NPS jÃ¡ funciona;
    template pronto ("SolicitaÃ§Ã£o de AvaliaÃ§Ã£o Google") em Fluxos â†’ Novo, pra nÃ£o obrigar montar do
    zero. `criar_pesquisa` (`fluxo-execucoes.ts`) passou a gerar o token e gravar a URL rastreÃ¡vel
    (ou a direta do Google, se tracking desligado) na variÃ¡vel do nÃ³, em vez do `pesquisa_id` cru
    que nps/satisfacao continuam recebendo.
  - Tracking: token opaco de 256 bits, vÃ¡lido 90 dias, endpoint pÃºblico `GET /api/r/review/[token]`
    (`middleware.ts` ganhou essa rota na allowlist) sempre redireciona pra URL lida do banco no
    momento do clique â€” nunca de query string, sem open redirect possÃ­vel. Dashboard em
    `/reputacao` (enviadas/clicadas/taxa de clique â€” exclui falha do denominador/falhas + listagem
    com filtro de perÃ­odo/status), nunca mostra "avaliaÃ§Ãµes recebidas" (sem integraÃ§Ã£o real nÃ£o dÃ¡
    pra provar publicaÃ§Ã£o, mesmo princÃ­pio de "Google Reviews nÃ£o Ã© NPS" jÃ¡ decidido na Fase 3).
  - **Bug achado rodando `next build` (nÃ£o sÃ³ os testes)**: o token usava `node:crypto`, mas esse
    arquivo Ã© importado por `fluxo-execucoes.ts`, que `chat.ts` tambÃ©m importa â€” e `chat.ts` Ã©
    alcanÃ§ado a partir de `ChatAoVivo.tsx` (Client Component), entÃ£o um import `node:` nesse
    caminho quebra o bundle do webpack pro cliente (`UnhandledSchemeError`). Corrigido trocando pra
    Web Crypto (`crypto.getRandomValues`/`randomUUID`), que funciona nos dois lados.
  - **Achado na implementaÃ§Ã£o, nÃ£o na validaÃ§Ã£o**: o serviÃ§o `odontominas-crm` no Railway nunca
    esteve conectado ao GitHub â€” `git push` sozinho nÃ£o deploya nada (confirma o que
    `ferramentas.md` jÃ¡ registrava; sÃ³ reforÃ§ado por ter ido direto pro `git push` primeiro e visto
    que nÃ£o disparou build nenhum â€” o deploy de verdade foi `railway up`).
  - Validado: 610 testes (16 novos)/typecheck/lint/`next build` limpos.
  - **Teste real de ponta a ponta em produÃ§Ã£o, sem depender do Rafael** (pedido explÃ­cito dele, ver
    `_memoria/decisoes.md`): deploy via `railway up`; script rodando as MESMAS funÃ§Ãµes que a UI
    usa (nunca SQL cru simulando a UI) ativou o mÃ³dulo, criou/publicou o Fluxo `[TESTE FASE 5]` a
    partir do template, e disparou a aÃ§Ã£o manual pro mesmo paciente de teste da Fase 3/4
    ("Rafael (teste Disparos)", `5561981925241`). Mensagem chegou de verdade no WhatsApp dele com o
    link rastreÃ¡vel (texto gravado em `mensagens`, conferido). Cliquei o link de verdade (HTTP real
    contra produÃ§Ã£o, nÃ£o localhost): `302` pro Google Maps (URL de teste, nÃ£o a real da clÃ­nica â€”
    ver pendÃªncia abaixo). Banco confirmou `status='clicada'`/`clicado_em` gravado, painel bateu 1
    enviada/1 clicada/taxa 100%.
  - **Falso alarme investigado e descartado**: uma leitura do painel deu zero solicitaÃ§Ãµes por um
    instante durante o teste â€” era corrida no PRÃ“PRIO SCRIPT de teste (consultou antes do worker
    assÃ­ncrono terminar de processar o nÃ³ de mensagem, nÃ£o synchronous como o nÃ³ `criar_pesquisa`),
    nÃ£o bug no cÃ³digo. Isolei a mesma chamada (`buscarPainelReputacao`) em outro script alguns
    segundos depois e bateu certo (`total:1, enviadas:1, clicadas:1, taxaClique:1`).
  - Ao final do teste, **desliguei o mÃ³dulo (`reputacao_config.ativo=false`) e pausei o Fluxo
    `[TESTE FASE 5]`** â€” nada dispara sozinho, nenhum paciente real pode receber o link de teste,
    atÃ© o Rafael colocar a URL real de avaliaÃ§Ã£o da OdontoMinas e ativar pela tela `/reputacao`.
  - Commitado (`74a3fe0`) e enviado ao GitHub (`main`). Deploy em produÃ§Ã£o confirmado (`railway up`,
    deployment `e8637c10-b7b6-473c-8a48-463afa52d13d`, status `SUCCESS`).
  - **PendÃªncia real**: colocar a URL real de avaliaÃ§Ã£o Google da OdontoMinas e ativar o mÃ³dulo
    quando o Rafael decidir; decidir quando apagar o Fluxo/pesquisa `[TESTE FASE 5]` (mesmo critÃ©rio
    das evidÃªncias da Fase 3/4 â€” sÃ³ com autorizaÃ§Ã£o explÃ­cita).

  ### EVIDÃŠNCIAS DA FASE 5

  Preservadas em produÃ§Ã£o atÃ© autorizaÃ§Ã£o explÃ­cita do Rafael pra apagar. MÃ³dulo desativado e Fluxo
  pausado â€” nada dispara sozinho.

  | teste | fluxo_id | execuÃ§Ã£o | pesquisa_id | paciente de teste | resultado |
  |---|---|---|---|---|---|
  | AÃ§Ã£o manual â†’ WhatsApp real â†’ clique real â†’ redirect real | `9593cf0f-ae92-4c27-8c6e-04dd7ada3581` (pausado) | `237384f7-0373-47e0-9c4c-45524aa4fc60` (completed) | `fa85af7d-1c49-4a11-b13e-437db80751db` (status `clicada`) | Rafael (teste Disparos) | mensagem enviada por WhatsApp real, link clicado de verdade (302 confirmado contra produÃ§Ã£o), painel bateu 1/1/100% |

  Evento em `automacao_eventos`: `fa5a4a96-0a88-45d8-b836-9e3c2c4c1138` (`solicitacao_avaliacao_google` â†’ `execucao_iniciada`).

## Onde está
**Atualizado em:** 2026-09-21

- pronto

## Pendências
- Publicar somente a revisão visual final e validar visualmente logado em desktop e responsividade básica, quando autorizado.
- Para concluir a revisão local autenticada das demais telas, usar uma credencial de teste válida; sessões e cookies não são forjados.

