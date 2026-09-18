# Andamento · OdontoMinas

## Onde está (2026-09-18, Identidade/Login/RBAC — fundação concluída)

**IDENTIDADE / LOGIN / RBAC — FUNDAÇÃO CONCLUÍDA.** Mesmo dia da fatia 1-4 abaixo (Equipe/Notas/
Horário/SLA), o Rafael trouxe um pedido extenso — arquiteto sênior de identidade/autorização —
pedindo pra ir além do RBAC binário admin/atendente que a fatia 1 tinha herdado. Auditoria real
antes de desenhar (não de memória): schema (`atendentes` sem e-mail, 3 contas reais — nenhuma da
Ariadna, todas placeholder de demo), sessão (cookie assinado sem revogação), e uma varredura de
`papel === "admin"` que achou **63 arquivos**, bem mais que a estimativa inicial de 18 (a 1ª busca
só pegava `papel === "admin"`, não `papel !== "admin"`).

**1. Modelo de identidade e RBAC granular.** 6 perfis: `noryos_admin`/`noryos_suporte` (identidade
de plataforma, `clinica_id` nulo) e `dona`/`gerente`/`supervisora`/`atendente` (escopo de clínica).
Catálogo de permissões em código (`src/lib/permissoes.ts`, não tabela relacional — escala atual não
justifica), autorização central (`can`/`requirePermission`, `src/lib/autorizacao.ts`) substituindo
o `papel === "admin"` espalhado. Customização por pessoa via `atendentes.permissoes_customizadas`
(jsonb; `null`=default do perfil, array mesmo vazio=override completo). Migrations `v28`/`v29`
(aditivas): `perfil`/`status`/`email`/`sessao_versao`/`permissoes_customizadas`/`origem`/
`criado_por` em `atendentes`, `clinica_id` virou nullable, `senha_hash` virou nullable (pra suportar
`status='invited'`); tabelas novas `convites`, `password_reset_tokens`, `identidades_externas`
(schema pronto pro futuro ControleODONTO, vazia, nenhuma capability ligada), `auditoria_eventos`.
Migração real das 3 contas, confirmada por SQL antes: `admin`→`dona`, `recepcao1`/`recepcao2`→
`atendente` — nenhuma virou `noryos_admin` sozinha.

**Decisão consciente de não criar `memberships` ainda** (o pedido original desenhava
`usuario → membership → clínica`): hoje é 1 clínica por deploy, zero usuário real multi-clínica —
`atendentes.clinica_id` já cobre, e uma tabela 1:1 sem uso seria complexidade especulativa. Fica
registrado em `decisoes.md` e em `crm/docs/RBAC.md` (seção 6) como decisão, não gap.

**2. Sessão revogável.** `sessao_versao` (coluna em `atendentes`) embutida no token assinado —
bloqueio, desativação, reset/troca de senha incrementam a versão e todo token emitido antes passa a
divergir, rejeitado em `getSessaoAtual()`. Reescrita de `src/lib/sessao.ts` (camada Edge-safe, só
`atendenteId:sessaoVersao:expiraEm` assinado — nunca perfil/permissões no cookie) e
`src/lib/sessao-servidor.ts` (Node, autoridade real — sempre lê o banco a cada request). Efeito
colateral aceito e comunicado: o formato do token mudou, então as sessões abertas antes do deploy
precisam logar de novo (nenhuma perda de dado, só re-login).

**3. Convites e reset de senha.** Fluxo de convite (`src/lib/convites.ts`) substitui "admin define
senha temporária": Dona/Noryos Admin convida por nome+e-mail+perfil (sem senha), conta nasce
`status='invited'`, token de 32 bytes (só o hash SHA-256 persiste) com validade 24h e uso único,
pessoa define a própria senha em `/convite/[token]` e a conta vira `active`. Reset de senha
self-service (`src/lib/reset-senha.ts`): `/esqueci-senha` sempre responde genérico (nunca revela se
o e-mail existe), token de 30min, ao usar revoga todas as sessões existentes. E-mails via Resend
(`src/lib/email.ts`, dependência nova) — **sem `RESEND_API_KEY`/`APP_URL` configuradas em produção
ainda**, o token é criado normalmente e o envio só loga aviso, não quebra o fluxo.

**4. RBAC aplicado de verdade** (não só desenhado) em Equipe (`/api/equipe/*`, tela reconstruída
com convite/status/bloqueio/reenvio/edição de perfil com regra de elevação nos dois sentidos), Chat
ao Vivo (enviar mensagem/finalizar/atribuir), SLA (`sla.visualizar`/`sla.configurar`) e Horário de
Atendimento (`configuracoes.horario`), Notas Internas (`conversas.notas_internas`).

**5. Compatibilidade explícita nas telas antigas.** Agentes, Campanhas, Disparos, Fluxos, Conexão,
Reputação, ControleODONTO, Resumo e a ficha do paciente (~60 arquivos) usavam `papel === "admin"`
direto. Como o campo de sessão virou `perfil` (6 valores, não mais 2), troquei pelo helper
`isAdminEquivalente(sessao)` = `perfil === "dona" || perfil === "noryos_admin"` — comportamento
idêntico ao de antes, zero regressão. **Registrado explicitamente como dívida técnica, não solução
permanente** (`decisoes.md`, `crm/docs/RBAC.md` seção 4, pendência em `agora.md`) — migrar essas
telas pra permissão granular é trabalho de fase seguinte.

**6. Segurança**: privilege escalation bloqueado nos dois sentidos (`podeAtribuirPerfil` — ator não
atribui nem edita um perfil mais poderoso que o próprio escopo; ninguém edita a própria conta pela
rota de gestão de equipe); última Dona ativa de uma clínica protegida contra ficar sem ninguém no
comando (mesmo espírito do guard antigo de "último admin"); `auditoria_eventos` (append-only)
registra `USER_INVITED`/`INVITE_ACCEPTED`/`ROLE_CHANGED`/`PERMISSIONS_CHANGED`/
`PASSWORD_RESET_*`/`MEMBERSHIP_BLOCKED`/`USER_DISABLED`/`USER_REACTIVATED` — nunca senha nem token
puro; rate limit reaproveitado (mesmo mecanismo de login) nos novos endpoints de convite/reset.

**Gates**: typecheck/lint/674 testes (13 novos, incluindo os que prendem a regra de elevação e a
resolução de permissões customizadas)/build de produção — todos limpos. 5 commits (`1ebaf50`
modelo de identidade/RBAC/sessão, `56c1a16` convites/reset, `0136616` Equipe + RBAC granular,
`11d9ce1` shim nas telas legadas, `159221c` documentação).

**Deploy real no Railway** (`railway up`, deployment `83ffaddd…`, `SUCCESS`, os 3 workers
`agentes-buffer`/`disparos-worker`/`fluxo-worker` subindo limpos) e **smoke test contra produção**:
`/login` 200, `/equipe` sem sessão redireciona 307, `/api/login` com credencial errada devolve 401
(nunca 500 — prova que a query contra o schema novo funciona), `/api/auth/forgot-password` sempre
200 genérico, `/convite/[token]` inválido carrega a página normalmente. **Não deu pra logar de
verdade como cada um dos 6 perfis** — a sessão não tinha senha real de nenhuma conta pra testar
login ponta a ponta; fica pendência explícita.

**Documentação nova**: `crm/docs/RBAC.md` (perfis, catálogo, regra de elevação, por que não existe
`memberships` ainda, sessão revogável, auditoria, pendências desta fase) e
`crm/docs/CONTROLE-ODONTO-IDENTITY-INTEGRATION.md` (como o schema já criado permite plugar
OIDC/API/sync no futuro sem reconstruir identidade/RBAC/sessão — nada implementado, só desenho e
checklist do que pedir ao ControleODONTO).

**Pendências obrigatórias**: configurar `RESEND_API_KEY` e `APP_URL` em produção; testar convite
real por e-mail; testar reset real por e-mail; criar contas `[TESTE]` dos 6 perfis e validar E2E de
cada uma; construir a tela visual de permissões por checkboxes (hoje só a API existe); implementar
gerenciamento de sessões ativas por dispositivo (hoje só "encerrar tudo"); migrar as ~60 telas do
shim pra permissão granular; revisar o modelo de membership quando existir de verdade uma 2ª
clínica com usuário compartilhado. **Próximo passo recomendado**: validar primeiro os fluxos reais
de e-mail e os 6 perfis antes de avançar pra módulo grande novo (Kanban, Noryos Ops) — aguarda
sinal do Rafael, mesmo critério já usado nas fases anteriores. Nenhuma evidência de teste de fases
anteriores foi apagada nesta fatia.

## Onde está (2026-09-18, RBAC/Atendimento — Equipe, Notas Internas, Horário de Atendimento e SLA Operacional)

**4 fatias da nova frente "RBAC/Atendimento/Kanban/Noryos Ops" (roteiro trazido pelo Rafael)
construídas, testadas e em produção na mesma sessão.** Diferente das fases do Fluxo de Conversa,
aqui cada fatia teve checkpoint próprio do Rafael no meio (ordem de prioridade escolhida pelo
agente como especialista, aprovada por "já pode começar"), mas sem o ritual completo de
`EnterPlanMode`/`ExitPlanMode` — decisão de escopo pequeno o bastante pra dispensar isso a cada
corte, seguindo o mesmo padrão de commit-testado-documentado das fases anteriores.

**1. Equipe (RBAC) — CRUD de atendentes.** Até aqui toda conta nascia por INSERT manual via SQL/MCP
(a própria migration `v4_equipe.sql` tem senha temporária hardcoded). `src/lib/atendentes.ts` ganhou
`criarAtendente`/`atualizarAtendente`/`trocarSenhaAtendente`/`buscarAtendentePorId`, mesmo contrato
`{ok,error}` do resto do projeto. Guarda nova: nunca desativa/rebaixa o único admin ativo da
clínica (senão a clínica fica trancada de fora, sem SQL manual pra se recuperar). 3 rotas API
(`/api/equipe`, `/api/equipe/[id]`, `/api/equipe/[id]/senha`), UI em `/equipe`
(`EquipeNovaConta.tsx`/`EquipeCardAcoes.tsx`). Sem migration (coluna `ativo` já existia). Convite
por e-mail e reset self-service ficam de fora — dependem de escolher um provedor de e-mail, que o
projeto não tem; "trocar senha" aqui é o admin definindo uma temporária e avisando por fora.
Commit `01aac13`.

**2. Notas Internas por conversa.** Anotação da equipe presa à conversa no Chat ao Vivo, nunca
vista pelo paciente — nem webhook nem motor do Fluxo de Conversa leem a tabela nova. Migration
`v25` (`notas_internas`: `clinica_id`/`conversa_id`/`atendente_id`/`texto`). `src/lib/notas-internas.ts`
(`buscarNotasInternas`/`criarNotaInterna`), rota `/api/chat/conversas/[id]/notas`, componente
`NotasInternas.tsx` plugado no fim do painel de conversa do `ChatAoVivo.tsx`. Autoria sempre vem da
sessão, nunca do body — não dá pra assinar nota em nome de outro atendente. Commit `260ac10`.

**3. Horário de Atendimento por clínica.** Fundação reutilizável pro SLA (não conectada em nada
ainda nesta fatia). Migration `v26`: `clinicas.timezone` (escalar, mesmo lugar de
`apelido_instancia`) + `horario_atendimento_periodos` — **1 linha por PERÍODO, não por dia**: é o
que permite 2 intervalos no mesmo dia (ex. 08-12 e 14-18) sem migration nova quando a UI ganhar
suporte a isso, mesmo a UI de hoje só escrevendo 1 período por dia. "Fechado" = zero linhas pro
dia; "sem configuração nenhuma" = zero linhas pra clínica inteira — os dois casos são distintos na
leitura. `src/lib/horario-atendimento.ts`: núcleo puro (`avaliarHorarioAtendimento`,
`calcularProximoHorario`, `validarConfiguracaoHorario`, `timezoneValido`) via `Intl.DateTimeFormat`
nativo — zero dependência nova, cobre horário de verão automaticamente. **Decisão de design**: sem
configuração nenhuma, a camada de horário assume sempre "dentro do horário" (nunca bloqueia
automação futura por falta de config) — diferente da camada de SLA (item 4), de propósito. UI em
`Configurações → Horário de Atendimento`. 41 testes, incluindo um que prova a conversão de fuso de
verdade (12:00 UTC de sábado = 09:00 local, aberto — não 12:00 local, que seria fechado). Horário
real da OdontoMinas **não foi preenchido** — testado com o exemplo do enunciado e restaurado a
vazio, sem confirmação do Rafael de que são essas as horas reais. Commit `d8172b0`.

**4. SLA Operacional (fundação).** Primeira resposta humana + resposta durante atendimento,
calculado só em minutos úteis — nunca diferença bruta de timestamp. **Nada conectado em automação**
(sem WhatsApp/e-mail pra supervisora, sem transferência automática, sem Kanban, sem escalonamento)
— só config + cálculo + status + evento, observável pela UI.

Achado que motivou a única mudança em código pré-existente desta fatia: `mensagens` não tinha como
distinguir resposta HUMANA de Fluxo/disparo/reativação (só `gerada_por_agente_id` pra IA existia).
Coluna nova `mensagens.enviada_por_atendente_id` (nullable, aditiva) — só `enviarRespostaChat`
(`chat.ts`) passa a preenchê-la; os outros 4 pontos de insert em `mensagens` (agentes, fluxo,
disparos, reativação) continuam `null`, corretamente.

Migration `v27`: a coluna acima + índice `(conversa_id, direcao, created_at)`; `sla_config` (1
linha/clínica, mesmo padrão de `reputacao_config`); `sla_eventos` (`unique(conversa_id, mensagem_id,
tipo)` — `mensagem_id` dobra de identificador de ciclo, sem tabela de ciclos nova). **Decisão
consciente de não reaproveitar `automacao_eventos`** (v23): aquela tabela é tipada pro domínio
Fluxo (`fluxo_id`/`execucao_id` como FK, `resultado` é enum fechado de causas de não-disparo) —
mexer nesse contrato só pra caber SLA arriscaria as fases que já dependem dela.

`src/lib/sla.ts` (novo): ciclo de espera derivado de `mensagens`, sem tabela de ciclos — início = 1ª
`recebida` depois da última `enviada` humana (várias mensagens seguidas do paciente = 1 ciclo só);
`conversas.status` em `STATUS_RESOLVIDOS` = sem ciclo, mesmo critério que `finalizarAtendimento`
(`chat.ts`) já usava — reaproveita o funil existente em vez de inventar estado novo.
`avaliarStatusSlaConversa` devolve `not_configured`/`ok`/`warning`/`breached`/`paused`/`sem_ciclo`;
precedência: breach é fato (não se apaga fora do expediente) → paused (só se respeitar horário e
estiver fora dele agora) → warning/ok por percentual. `registrarSlaBreachSeNovo`: evento idempotente
(`unique` + insert, `23505`=sucesso), emissão **lazy** na leitura de status — sem cron/worker novo.
`src/lib/horario-atendimento.ts` ganhou a função que a fatia 3 tinha deixado pendente,
`calcularMinutosUteisAtendimento` — mesmo motor de conversão de fuso, itera dia a dia somando só a
interseção com os períodos configurados.

3 rotas API (`/api/clinica/sla` admin; `/api/chat/conversas/[id]/sla` e `/api/chat/sla/resumo`
sessão qualquer). UI: `Configurações → SLA/Atendimento` (config + resumo do dia) e `ChatAoVivo.tsx`
ganhou badge 🟢/🟡/🔴/⏸ na lista e no cabeçalho, filtro por status de SLA, botão "⚠ Risco" pra
ordenar por criticidade. 24 testes novos (11 de `calcularMinutosUteisAtendimento` cobrindo os 10
casos pedidos; 13 do núcleo de `sla.ts`).

**Teste real de ponta a ponta contra o Supabase de produção** (não mock): conversa `[TESTE SLA]`
(`a9074a4a-048f-4eae-9125-49f9cd8d2bbd`) — mensagem recebida abre o ciclo, nota interna no meio não
encerrou, breach detectado certo (20min consumidos, limite 15), evento idempotente confirmado por
query (1 linha, não 2, em 2 chamadas seguidas), transferência de atendente (`atribuido_a`) NÃO
zerou o ciclo (mesmos 20min depois), resposta humana encerrou (`sem_ciclo`), nova mensagem do
paciente reabriu como `resposta_atendimento` (não `primeira_resposta`) com o limite certo (30min).
**Evidência preservada de propósito** (pedido explícito do Rafael) — conversa, mensagens, nota e
evento não apagados.

**Deploy real no Railway — primeira vez nesta sessão que uma fatia foi de fato deployada** (as
3 fatias anteriores tinham ficado só commitadas/pushadas). `railway up` direto (CLI já autenticada
e linkada ao serviço `odontominas-crm`, projeto `illustrious-perfection`) — 2 deploys: o 1º com a
fatia inteira, `SUCCESS`, os 3 workers (`agentes-buffer`/`disparos-worker`/`fluxo-worker`) limpos.

**Bug real achado no próprio smoke test em produção** (não em teste unitário): `GET
/api/chat/sla/resumo` devolvia `primeiraRespostaMediaMinutos: 0` em vez de `null` quando o horário
de atendimento não está configurado — `calcularMetricaPrimeiraRespostaHumana` não tinha o mesmo
gate de `not_configured` que `avaliarStatusSlaConversa` já tinha. Exatamente o tipo de "métrica
falsa" que a fatia inteira existe pra evitar (0min pareceria "respostas instantâneas"). Corrigido
(commit `5dbdb46`), 2º deploy, reconfirmado no ar com o mesmo `curl` real: `null`.

**SLA deixado ativo em produção, no modo recomendado (minutos úteis)** — como o horário de
atendimento segue vazio de propósito (fatia 3), isso resulta em `not_configured` pra toda conversa
real hoje, sem nenhum efeito colateral, até o Rafael configurar o horário de verdade e decidir.

Achados de processo, registrados em `ferramentas.md`: um `next dev` de terceiro já rodava na porta
3000 antes desta sessão começar; `npm run build` local corrompeu o `.next` compartilhado com ele
(processo não identificado, pode ser do Rafael — não reiniciado por mim). Sandbox local com pouca
memória (~1-1,5GB livres de 7,5GB) causou falhas intermitentes de build, contornadas com retry e,
uma vez, `experimental.cpus: 1` temporário em `next.config.ts` (sempre revertido antes do commit).

typecheck/lint/663 testes (mais de 90 novos nesta sessão)/build de produção limpos em cada uma das
4 fatias. 5 commits no total (`01aac13`, `260ac10`, `d8172b0`, `7a96e12`, `5dbdb46`), todos
enviados ao GitHub.

**Pendências**: horário real de atendimento da OdontoMinas (destrava o SLA de fato); limpar dados
de teste desta frente junto com os das fases anteriores (ver `agora.md`). ~~RBAC segue binário
admin/atendente; convite por e-mail e reset self-service dependem de provedor de e-mail~~ —
**superado no mesmo dia** pela fatia "Identidade/Login/RBAC — fundação concluída" logo acima (6
perfis, convite/reset por e-mail via Resend). **Próximo passo**: ver a fatia de Identidade/RBAC
acima — validar e-mail real e os 6 perfis antes de Kanban/Noryos Ops.

## Onde está (2026-09-17, Fluxo de Conversa — Fase 4 completa: classificação NPS + dashboard + fix real de telefone)

**Fase 4 ("Noryos Odonto") entregue: classificação NPS (detrator/neutro/promotor) + dashboard.**
`src/lib/nps.ts` (novo) — `classificarNps` (0-6/7-8/9-10, escala padrão) grava
`pesquisa_respostas.classificacao` no momento de `persistir_resposta_pesquisa`
(`fluxo-execucoes.ts`) — coluna que a Fase 3 só tinha reservado. `calcularPainelNps`/
`buscarPainelNps` seguem o mesmo desenho de `campanha-metricas.ts` (núcleo puro + busca Supabase
separada, sem view/RPC). Nova aba "Pesquisas" em `/resumo` (`RelatorioNps.tsx`): pesquisas
enviadas/respondidas/taxa de resposta/NPS Score + barra segmentada detrator/neutro/promotor,
mesmos tokens visuais de `RelatorioMarketing.tsx`/`CampanhaFunil.tsx`. 575 testes (25
novos)/typecheck/lint/build limpos. Commit `4f2ef24`, deploy Railway `SUCCESS`.

**Bug real de produção achado, investigado e corrigido durante a validação da Fase 4**: o
WhatsApp/Baileys entrega o JID de um celular brasileiro sem o 9º dígito em alguns casos
(`556181925241` em vez de `5561981925241`, confirmado no payload cru de `mensagens.raw`) —
`normalizeTelefone` (webhook) e `normalizarTelefoneEntrada` (input humano) comparavam telefone por
string exata, então isso criava paciente e conversa **novos** por engano, e o Agente de IA
respondia de verdade a uma conversa que não devia existir. A mensagem nunca chegava à execução do
Fluxo que estava esperando resposta.

Corrigido com função central pura nova (`src/lib/telefone.ts`): `canonicalizarTelefoneBr` (regra
do plano de numeração ANATEL — fixo começa 2-5 e nunca ganha 9º dígito; celular começa 6-9, com ou
sem o 9 já presente; só mexe quando DDI=55 + DDD + 8 dígitos locais nessa faixa — nunca fuzzy
match, nunca hack pro número específico), `variantesEquivalentesTelefoneBr` (gera a forma legada
equivalente só pra buscar, nunca aproxima telefones diferentes) e `encontrarPorTelefoneEquivalente`
(escolhe entre candidatos já filtrados, prioriza o canônico). `evolution-webhook.ts:normalizeTelefone`
e `chat.ts:normalizarTelefoneEntrada` passaram a delegar a essa função central; o webhook,
`chat.ts:iniciarConversaChat` e `controle-odonto/patients.ts:encontrarCorrespondenciaPaciente`
passaram a buscar por qualquer forma equivalente (`.in()` em vez de `.eq()`) antes de decidir
criar — compatibilidade de transição sem migration, sem reescrever telefone já gravado. 9 arquivos,
+259/-26 linhas. Commit `c0f3de9`, deploy Railway `SUCCESS` (`d8e62025`).

**Teste real de ponta a ponta, com aprovação e execução manual do Rafael pelo WhatsApp de
verdade**: resposta "9" mandada de propósito do número de teste (`5561981925241`, o mesmo já usado
em Disparos/Campanhas) pro número da instância (`61999256901`, confirmadamente diferente). Antes do
fix: mesmo tipo de payload sem 9º dígito criou paciente (`4e7ecb38-1d63-4ad8-90f5-b6ae12208b9f`) e
conversa (`4bb228db-e7f5-4464-8b53-e1b1d43e31bc`) novos, com o Agente de IA respondendo de verdade
(2 mensagens reais mandadas). Depois do fix: a mesma classe de payload achou o paciente/conversa
corretos (`63cd3fa3.../0ee7964f...`), zero duplicação, Agente de IA não respondeu, execução
`9867cb23...` resolveu `waiting_input` → `capturar_resposta` (nota 9) → `classificacao='promotor'`
→ `pesquisas.status='respondida'` → execução `completed` → `dono_conversa` voltou pra `humano`
sozinho. **Evidência de antes e depois preservada no banco, nada apagado** (nem os artefatos do bug
nem os da correção) — pedido explícito do Rafael, serve de prova pra apresentação.

**Fase 4 completa e validada. Rafael pediu explicitamente pra não avançar pra próxima
funcionalidade sem sinal dele.** Avaliação Google, aniversário como "produto final" e dashboard
executivo unificado (NPS + Google + aniversário) seguem de próximo passo, ainda não iniciados.

## Onde está (2026-09-17, Fase 6 — demo pro marido, e a frente "Noryos Odonto")

**Deploy real:** Ações CRM e Humano+IA foram ao ar no Railway pela 1ª vez (`railway up`, commit
`cd88695`, deployment `3570f47e` SUCCESS). Logs limpos, os 3 workers subiram sem erro.

**Fluxo da demo criado e publicado:** "DEMO - Atendimento Odontológico" (`fluxos.id`
`34aa24c0-e500-4629-9fb3-2b80e40ab87b`), 29 nós, gatilho manual. Cobre 8 dos 9 blocos novos.
Criado direto no banco (Supabase MCP), não pela UI — a sessão não tinha a senha do painel admin
(ver `_contexto/ferramentas.md`); validado antes com os validadores reais do projeto
(`validarFormaDefinicao`/`validarGrafo`, teste temporário criado e apagado na hora), zero erros e
zero avisos. Corrigida uma inconsistência do próprio roteiro do Rafael: a ordem "transferir → alerta
→ pausar" não é possível porque `transferir_humano` é terminal (sem saída) — ficou alerta → pausa
→ transferir. Criadas 4 etiquetas novas (Implantes/Ortodontia/Estética/Clínica Geral). Doc completo
em `crm/docs/demo-fase6-roteiro.md` (roteiro de 10-15min, dados de demo, checklist).

**Teste real pontual: disparado, pausado, não concluído.** Execução `a98ee509-76b2-4d4c-ba86-d1233ae9d1c6`
contra o contato de teste já conhecido (paciente "Rafael (teste Disparos)", telefone
5561981925241) — as 2 primeiras mensagens confirmadas enviadas de verdade (`evolution_message_id`
presente). Parada em `waiting_input` no nó `menu_principal`, esperando o Rafael responder "1" no
WhatsApp de verdade (não é simulável). Quando a resposta chegar: confirmar etiqueta aplicada, funil
→ agendado, prioridade → alta, atendente atribuído, transferência pro humano, e fechar o relatório
técnico da Fase E.

**Nova frente: "Noryos Odonto".** A pedido do Rafael (impressionar a cliente-piloto antes de
fechar), pesquisa de mercado (Brasil: Clinicorp/iClinic/Simples Dental/Feegow; internacional:
Weave/NexHealth/Podium/RevenueWell) levantou 10 funcionalidades candidatas fora do escopo clínico/
financeiro. Princípio de escopo definido pelo Rafael: *"Noryos Odonto controla tudo que acontece
antes do paciente chegar à cadeira e tudo que acontece depois que ele sai"* — nunca prontuário,
agenda clínica, ERP financeiro, odontograma, TCLE ou exames (isso segue com o ControleODONTO).
Priorizadas agora 4: NPS/satisfação, avaliação Google, aniversário, dashboard executivo. As demais
(indicação, catálogo, gamificação, multi-unidade, proposta digital de tratamento, marca por
clínica) ficam de roadmap.

Auditoria técnica (Fase 1) feita antes de qualquer código: `reativacao.ts` é o precedente real de
"gatilho por data" (cron → seleciona candidato por regra pura → manda → registra); `resumo.ts` já é
o embrião do dashboard executivo (`leadsEsfriando` já é a seção "atenção necessária", só que cobre
1 caso); `pacientes.origem_lead`/`utm_*`/`gclid`/`fbclid`/`campanha_id` já existem (cobre a seção
"origem" do dashboard sem coluna nova); `clinica_id` já isola dado por clínica em toda tabela, mas o
runtime resolve 1 clínica fixa por deploy (`CLINICA_SLUG`) — multi-clínica de verdade precisaria de
uma camada de troca de tenant em runtime, que não existe. **Achado que bloqueia aniversário:
`pacientes.data_nascimento` não existe em nenhuma migration nem no schema ao vivo** — falta decidir
de onde esse dado vem antes de implementar. **Achado de white-label:** 3 pontos com "OdontoMinas"
hardcoded — título/meta da página (`app/layout.tsx`), subtítulo do painel de chat
(`app/(painel)/page.tsx`), e dentro do texto da mensagem de reativação (`reativacao.ts`) — este
último é o mais delicado por ser conteúdo que vai pro paciente, não só UI interna.

Proposta apresentada ao Rafael, ainda sem resposta: estender o motor do Fluxo de Conversa (gatilho
novo tipo "por data"/"evento de atendimento concluído" + 1 tipo de nó novo pra capturar resposta
livre, ex. NPS 0-10) em vez de construir um motor de automação paralelo — evita a "segunda
infraestrutura" que o Rafael explicitamente não quer. **Nada implementado ainda desta frente**, só
auditoria e proposta.

## Onde está (2026-09-17, Fluxo de Conversa — Ações CRM + Humano/IA, paleta ampliada)

**2 fatias novas da ampliação da paleta do editor, seguindo a mesma disciplina das fases
anteriores** (typecheck/lint/build/testes a cada corte, sem tocar produção real). Não são novas
"fases" numeradas do plano original de 6 — são a continuação natural depois da Fase 2b/3, seguindo
as 4 categorias extras da visão original (`crm/docs/fluxo-conversa-visao.md`): Odonto, Ações CRM,
Humano, IA, Integração.

**Ações CRM (5 blocos): adicionar/remover etiqueta, mover no funil, marcar prioridade, atribuir
atendente.** Auditoria de `src/lib/controle-odonto/capabilities.ts` confirmou que a categoria Odonto
está 100% bloqueada — as 7 capabilities do ControleODONTO estão todas `false`, sem meio-termo — e
que Ações CRM/Humano/IA não dependem disso, só escrevem em tabelas que o CRM já usa em produção.
Novos tipos em `fluxo-tipos.ts` (união discriminada), campo `acaoCrm` em `fluxo-motor.ts` (lógica
pura), aplicado de verdade em `fluxo-execucoes.ts`. Achado evitado na implementação: reusar
`chat.ts:atualizarConversaChat` pra prioridade/atendente criaria um ciclo de import (`chat.ts` já
importa `transferirExecucaoAtivaParaHumano` de `fluxo-execucoes.ts`) — escrito direto em `conversas`
em vez disso, ganhando de graça o Pixel de Conversão/evento de Campanha já ligados a
`atualizarStatus`. Sem migration nenhuma (nenhuma coluna nova). typecheck/lint/build limpos; 449
testes (19 novos). Commit `c3d04e8`.

**Humano + IA (4 dos 8 blocos da visão original): transferir p/ humano, criar alerta interno,
pausar automação, iniciar agente de IA.** Auditoria de `dono-conversa.ts`/`agentes.ts` achou que
"Enviar contexto pra agente"/"Retomar fluxo após IA"/"Encerrar IA" pressupõem um protocolo de
handoff `agentes.ts` ↔ motor do fluxo que não existe — enquanto um nó do fluxo executa,
`dono_conversa` já é `'fluxo'` (invariante do próprio `iniciarExecucaoFluxo`), não há "IA ativa
durante um passo" pra encerrar ou retomar. Rafael confirmou o corte pros 4 blocos seguros; os outros
3 ficam documentados como fase separada, a tratar com protocolo de retorno IA→motor, preservação de
contexto, idempotência e concorrência.

2 bugs reais achados e corrigidos durante a implementação, antes de qualquer deploy:
1. O `liberarControle` genérico que já roda ao terminar qualquer execução (`fluxo-execucoes.ts`)
   sempre devolvia a conversa pro humano — sem ajuste, ele stompearia a entrega pro agente um
   instante depois de `iniciar_agente_ia` acontecer. Corrigido: `aplicarAcaoCrm` devolve se ela
   mesma já transferiu o dono (só `true` nesse caso, com sucesso), e a terminação pula o
   `liberarControle` quando for `true` — se o agente não existir ou a atribuição falhar, cai no
   `liberarControle` normal (nunca deixa `dono_conversa='fluxo'` com execução encerrada).
2. A checagem "algum finalizar alcançável" do validador de grafo (`fluxo-validador.ts`) só olhava
   `tipo==='finalizar'`, o que geraria aviso falso ("este fluxo pode nunca terminar") em todo fluxo
   terminando por `transferir_humano`/`iniciar_agente_ia`. Corrigido com um novo helper
   `ehNoTerminal` cobrindo os 3 tipos terminais.

Sem migration. typecheck/lint/build limpos; 464 testes (15 novos). Commit `0fad463`.

**Categoria Integração (Webhook/Chamada API/Consultar sistema/Aguardar callback) pausada por decisão
do Rafael** — diferente das duas fatias acima (que só religaram coisa que já existia com
segurança), Integração precisa de um cofre de credenciais novo (schema/migration — não existe hoje
nenhum genérico pra integrações de terceiros) e abre risco real de SSRF (o servidor passaria a
chamar URLs configuradas dentro de um fluxo). Fica documentada como próxima fase específica, a
desenhar com calma.

**Nada disso foi aplicado em produção real**: 3 commits locais nesta sessão (o rename do kit e as 2
fatias), ainda não sincronizados com o GitHub nem deployados no Railway. O teste robusto ponta a
ponta (navegador real + WhatsApp real — criação no editor, publicação, execução pelo motor, Ações
CRM, Humano+IA, waits/condições, persistência após restart, idempotência, ausência de duplicidade,
opt-out, tratamento de erro, logs) continua reservado pro fim de todas as fases da ampliação da
paleta.

## Onde está (2026-09-17, Fluxo de Conversa — Fase 2b/3 completa, editor visual em produção)

**Fase 2b/3 (editor visual do Fluxo de Conversa) construída, deployada e validada em produção com
envio real de WhatsApp direto do editor.** Rafael pediu pra avançar direto pra esta fase em vez da
Fase 6 (demo), pra poder mostrar "criar fluxo → arrastar blocos → conectar → publicar → receber
mensagem real" em vez de só backend funcionando. Planejamento formal (`EnterPlanMode`, 2 agentes
Explore mapeando a engine e as convenções do CRM, 1 agente Plan) antes de codar.

**Motor intocado** (`fluxo-motor.ts`, `fluxo-tipos.ts` — a união dos 6 tipos de nó — e
`fluxo-lock.ts`/`fluxo-worker.ts`), com 2 ajustes cirúrgicos e sinalizados:
`fluxo-execucoes.ts:iniciarExecucaoFluxo` ganhou `isTest`/`versaoIdForcada` (só têm efeito quando
`isTest=true` — o call site real, `tentarIniciarFluxoPorMensagem` do webhook, segue chamando sem
os dois parâmetros, comportamento idêntico por construção) e `fluxo-validador.ts:validarGrafo`
passou a devolver `{noIds, mensagem}` estruturado em vez de string solta (mesmo texto, só ganhou
metadado pro editor destacar o nó certo no canvas).

**`@xyflow/react` aprovado como única exceção à política de zero-dependência nova** do projeto —
construir zoom/pan/minimap/seleção múltipla à mão seria meses reinventando algo resolvido, e o
próprio doc de arquitetura da Fase 1 já antecipava "React Flow ou similar".

**Construído:** 3 libs puras (`fluxo-editor-grafo.ts` — ponte nodes/edges do xyflow↔`NoFluxo`, sem
duplicar fonte de verdade: arestas são sempre derivadas dos nós, nunca guardadas à parte;
`fluxo-editor-layout.ts` — posição/viewport em `definicao.config.layout`, mais layout automático em
camadas; `fluxo-templates.ts` — 3 templates odontológicos, "Atendimento inicial"/"Confirmação de
consulta"/"Recuperação-Reativação", combinando só os 6 tipos de nó existentes, sem criar tipo
novo); 3 libs de I/O (`fluxo-versoes.ts` — CRUD e versionamento rascunho→publicada→substituída,
fork lazy do rascunho quando só existe a publicada; `fluxo-execucoes-consulta.ts`;
`fluxo-contatos-teste.ts` — busca por nome/telefone, nunca número hardcoded); 9 rotas de API; 3
páginas (`/fluxos`, `/fluxos/nova`, `/fluxos/[id]/editar`); 13 componentes (`FluxoEditor` como
shell com undo/redo e autosave, `FluxoCanvas` sobre `@xyflow/react`, paleta com categoria "Odonto"
visível-mas-desabilitada — mesmo padrão de dois estados da tela de Integrações ControleODONTO,
sem fingir que agenda funciona —, painel de validação clicável que seleciona o nó com problema,
modo teste com timeline por polling). 49 testes novos (430 no total, incluindo um que garante que
cada template passa em `validarGrafo` sem erro nenhum). `typecheck`/`lint`/`build` limpos.

**Deploy em produção via Railway (`railway up`), 2 vezes.** O teste real de ponta a ponta — feito
com navegador automatizado (Playwright instalado num diretório de trabalho temporário, fora do
projeto; credencial de admin fornecida pelo Rafael) — achou 1 bug real: o painel "Testar" ficava
preso em "na fila" pra sempre. Causa: `FluxoPainelTeste.tsx` lia `execucaoId` do estado React de
dentro do `setInterval` criado em `iniciarTeste` — closure fechado ANTES do `setExecucaoId`
aplicar, então o polling nunca via o id de verdade e nunca buscava a atualização. Confirmado
direto no banco que o **backend funcionou certinho o tempo todo** (execução `completed`, 3 eventos
sem erro, `evolution_message_id` presente) — só a tela não atualizava. Corrigido (passar o id da
execução direto pro polling, sem depender do estado assíncrono) e redeployado.

**Teste real de ponta a ponta pelo próprio editor** (primeira vez que isso acontece via UI, não
mais só via fixture/DB direto como na Fase 2a): fluxo "TESTE - Fluxo Odonto" criado em
`/fluxos/nova` (em branco), aberto no editor, um bloco Mensagem arrastado da paleta pro canvas,
texto editado no painel de propriedades, conectado Início→Mensagem→Finalizar arrastando entre os
handles (achado no processo: arrastar uma conexão com os cartões muito próximos/sobrepostos falha
silenciosamente — não é bug do produto, é como qualquer editor visual se comporta; resolvido
afastando o nó antes de conectar), validação chegou em "Sem erros nem avisos", contato de teste
buscado por nome ("Rafael" → "Rafael (teste Disparos)", nunca um número fixo), "Iniciar teste"
disparou a execução real — mensagem "Teste de fluxo OdontoMinas concluído com sucesso." chegou de
verdade no WhatsApp (`evolution_message_id: 3EB09B9C7B0FF1AFDCD57494B35D1FD254D21B3C`). Fluxo
arquivado ao final (não apagado); dados de teste ficam no banco por enquanto (mesma política já
usada em Disparos/Campanhas/Fase 2a, pendência de limpeza única registrada em `agora.md`).

**Fase 2b/3 completa e validada em produção.** Próximo passo: ampliar a paleta (blocos Odonto reais
quando o ControleODONTO estiver validado, ou os tipos de nó da visão original que ainda faltam —
Ações CRM, IA dentro do fluxo, Webhook/API, entrada estruturada) ou Fase 6 (demo pro marido) —
nenhuma das duas decidida ainda.

## Onde está (2026-09-17, Fluxo de Conversa — Fase 2a completa, deployada e validada com envio real)

**Fase 2a (núcleo do motor, sem editor visual) construída, testada localmente e não deployada
ainda.** Planejamento formal (`EnterPlanMode`/`ExitPlanMode`), com uma revisão de arquitetura
dedicada (agente Plan) que achou 2 bugs reais antes de qualquer código — uma race que deixaria todo
menu sem timeout inoperável (`NULL <= now()` é falsy em SQL, uma query única de claim nunca acharia
essas linhas) e um estado `running` sem caminho de recovery (travaria o slot de execução da conversa
pra sempre num crash no meio do processamento). Os dois corrigidos antes de codar.

**Novo, puro e testado exaustivamente** (`fluxo-tipos.ts`, `fluxo-validador.ts`, `fluxo-motor.ts`,
`fluxo-gatilhos.ts` — 65 testes novos): tipos dos 6 blocos mínimos (Início, Mensagem, Espera, Menu,
Se/Senão, Finalizar) com validação de forma **hand-rolled, sem adicionar `zod`** como dependência —
este projeto nunca usou biblioteca de schema, mesmo critério de `isStatusValido`; validador de grafo
(início único, nó órfão, referência quebrada, loop sem espera/menu de guarda — DFS com pilha de
recursão); interpretador de nó (`processarNo`, um passo por vez, nunca cadeia em memória) com casamento
de menu por número/rótulo/variação, timeout, contador de tentativas inválidas separado do contador de
loop; casamento de gatilho de mensagem (`nova_conversa`/`primeira_mensagem`/`palavra_chave` — os
demais gatilhos da visão entram por Campanhas/Disparos/cron, fora de escopo desta fase).

**Novo, I/O, sem teste direto** (mesmo critério de `disparos-worker.ts`): `fluxo-execucoes.ts`
(`iniciarExecucaoFluxo` — ponto único de entrada com arbitragem; claim por `UPDATE` condicional
otimista, não CTE/RPC — este projeto nunca usou função de banco, e introduzir isso só pra esta
feature quebraria o padrão; a janela residual de "running sem evento" é fechada por uma 2ª varredura
de recovery direto em `fluxo_execucoes`, além da varredura de eventos `em_andamento`); `fluxo-lock.ts`/
`fluxo-worker.ts` (clone literal de `disparos-lock.ts`/`disparos-worker.ts`, `provider='fluxo_conversa'`).

**6 sítios de escrita de `agente_ativo_id` corrigidos pra manter `conversas.dono_conversa` em
sincronia** (`dono-conversa.ts`, módulo-folha novo): 4 em `agentes.ts`, 1 em `etiquetas.ts` (+ guarda
nova: nunca ativa Agente de IA por etiqueta se `dono_conversa='fluxo'`) e 1 achado só na revisão de
arquitetura — `chat.ts:enviarRespostaChat` (atendente respondendo manualmente enquanto um fluxo
está ativo agora transfere a execução pra `transferred`, sem isso uma `espera` de dias continuaria
mandando mensagem por cima do humano). `opt-out.ts` não foi tocado (evitaria import circular) —
`cancelarExecucoesAtivasDoPaciente` é chamada pelo webhook logo depois de `aplicarOptOut`.

**Webhook** (`api/webhook/evolution/route.ts`): mesmo bloco isolado de sempre, reestruturado pra
checar `dono_conversa` antes de `deveResponder` — zero mudança de comportamento pra quem nunca usa
Fluxo de Conversa (backfill já cobre isso). Achado durante a implementação, não previsto no plano:
`dono_conversa` nasce `'humano'` por padrão (inclusive em conversa NOVA), o que impediria pra sempre
os gatilhos `nova_conversa`/`primeira_mensagem` de disparar — corrigido com uma exceção explícita
(`conversaEraNova`) que só vale pra conversa que acabou de ser criada nesta mesma request, nunca pra
uma conversa humana já em andamento.

Gate limpo em cada etapa: `typecheck`/`lint`/`build` de produção e teste (381 no total, 65 novos).

**Deploy + validação manual concluídos no mesmo dia (2026-09-17), sem nenhuma mensagem real
enviada.** `railway up` — os 3 workers (`agentes-buffer`, `disparos-worker`, `fluxo-worker`) subiram
limpos no boot. 1º teste com fixture (fluxo "TESTE Fase 2a", início→condição→espera(15s)→finalizar,
sem nó de mensagem — nunca chama a Evolution) **achou um bug real**: `carregarContextoExecucao`
falhava em silêncio (`contexto_invalido`) porque a query de contexto embute `conversas(telefone)` a
partir de `fluxo_execucoes`, e como `conversas` também referencia `fluxo_execucoes` de volta
(`fluxo_execucao_ativa_id`), o PostgREST recusa o embed por ambiguidade sem um hint explícito — e o
código nunca checava `error` nessa query, só `data`, escondendo a falha. Corrigido
(`conversas!conversa_id(telefone)` + log de erro), redeployado, testado de novo: **execução
completou os 4 passos na ordem certa** (`inicio`→`condicao_avaliada`→`espera_iniciada`→`finalizado`,
~15s de espera real observada), `conversas.dono_conversa` voltou pra `humano` sozinho ao final. Dados
de teste apagados ao fim (banco voltou ao estado de antes, mesmo critério do teste de Campanhas).

**Teste real de ponta a ponta, com aprovação explícita do Rafael (2026-09-17, mesmo dia):** fluxo
isolado "TESTE - Fluxo Odonto" (nome e gatilho manual exatamente como a visão original pedia) criado
direto em produção — Início → Mensagem ("Teste de fluxo OdontoMinas concluído com sucesso.") →
Finalizar — vinculado ao paciente "Rafael (teste Disparos)" já existente (mesmo número usado nos
testes de Disparos/Campanhas). Checklist pré-envio da visão conferida antes (opt-out inexistente,
`is_test=true`, nenhuma fila antiga). O worker pegou sozinho, processou os 3 nós e mandou a mensagem
de verdade — `evolution_message_id` confirmado (`3EB0136A5AB0BE78D421AC9E35F51A73479EE0BE`),
execução terminou `completed`, `dono_conversa` voltou pra `humano` sozinho. Fluxo de teste arquivado
ao final (não apagado — segue a própria instrução da visão); dados de teste ficam no banco por
enquanto, mesmo critério já usado em Disparos/Campanhas (pendência de limpeza única antes da
produção real, já registrada em `agora.md`).

**Fase 2a completa, deployada e validada em produção — motor, worker e webhook provados de ponta a
ponta, com envio real confirmado pela Evolution.** Próximo passo: Fase 2b/3 (editor visual), ou
ampliar a paleta de blocos — checkpoint próprio, ainda não iniciado.

## Onde está (2026-09-17, Fluxo de Conversa — Fase 1 proposta; aguardando aprovação pra aplicar)

**Fase 1 (arquitetura/schema) da reconstrução do Fluxo de Conversa entregue como proposta —
nenhuma migration aplicada em produção, nenhum código de aplicação escrito.** Antes de desenhar, 3
perguntas em aberto da Fase 0 foram fechadas com o Rafael (decisão completa em
`_memoria/decisoes.md`): `reativacao.ts` migra pro motor novo eventualmente, não nesta fase; dos 5
riscos já existentes no código, 3 (buffer de agentes sem lock, reativação sem lock/opt-out, corrida
no webhook) viram patches separados fora desta reconstrução, e 2 (recovery só por TTL, sem
watchdog) moldam o desenho do motor; nomenclatura das tabelas em português, seguindo a convenção já
usada (`campanhas`/`disparos`/`agentes_ia`).

Desenho validado por uma revisão de arquitetura dedicada (agente Plan) em cima do código-fonte real
— não é o desenho ingênuo inicial. Resultado: **4 tabelas** (`fluxos`, `fluxo_versoes`,
`fluxo_execucoes`, `fluxo_execucao_eventos`) em vez das 9 conceituais da visão original, mais 1
alteração em `conversas` (arbitragem Fluxo/Agente de IA/Humano). Pontos centrais do desenho: grafo
de nós+arestas guardado como jsonb versionado por snapshot imutável (`fluxo_versoes.definicao`, com
índice único parcial garantindo 1 só versão publicada por fluxo); gatilho denormalizado em `fluxos`
pra não abrir jsonb a cada mensagem recebida (hot path do webhook); coluna nova
`conversas.dono_conversa` (`humano/agente_ia/fluxo`) resolvendo a arbitragem que hoje é implícita
(`agente_ativo_id is null` = humano, que quebraria com um 3º candidato) sem mudar nenhum
comportamento existente (backfill reproduz a regra atual byte a byte); worker clonando o padrão já
validado de `disparos-worker.ts`/`disparos-lock.ts` (`integration_locks`, `provider =
'fluxo_conversa'`), com lock só durante o processamento ativo de 1 passo — nunca durante a espera em
si, resolvendo o problema de recovery pós-restart pra esperas longas (dias); idempotência de passo
via `unique(execucao_id, sequencia)` em `fluxo_execucao_eventos` (não `(execucao_id, no_id,
tentativa)` — essa chave tinha um bug real, corrigido na revisão: loop legítimo revisita o mesmo nó
mais de uma vez).

Migration completa (não aplicada) em
`crm/supabase/migrations/2026-09-17_v20_fluxo_conversa_schema.sql`. Documento de arquitetura
completo (schema comentado, arbitragem, worker/lock, idempotência, ponto exato de integração no
webhook, recovery, ordem Fase 2→3) em `crm/docs/fluxo-conversa-arquitetura.md`.

**Migration `v20` revisada e aplicada em produção (2026-09-17).** Antes de aplicar, revisão final
pedida pelo Rafael (5 pontos: created_at/updated_at, índices, FKs/ON DELETE, is_test, recovery)
achou 3 problemas reais, corrigidos na própria `v20`: `fluxo_execucao_eventos` sem `updated_at`;
faltavam índices em `fluxo_execucoes.conversa_id` (plano, pra histórico)/`fluxo_id`/`versao_id`; e o
mais sério — 3 FKs (`fluxo_versoes.fluxo_id`, `fluxo_execucoes.fluxo_id`/`versao_id`) estavam `on
delete cascade`, o que apagaria histórico de execução em cascata se um fluxo fosse excluído —
trocadas pra `on delete restrict`. O mecanismo de recovery pós-restart também só existia em prosa no
documento de arquitetura, sem coluna nenhuma no schema pra sustentá-lo — `fluxo_execucao_eventos`
ganhou `status` (`em_andamento/concluido/falhou`) + índice dedicado. Detalhe completo em
`crm/docs/fluxo-conversa-arquitetura.md` (seção "Revisão final antes de aplicar").

Aplicada via MCP do Supabase, confirmada lendo o schema depois: as 4 tabelas existem, RLS ligado, 0
linhas (nenhum código as usa ainda). Backfill de `conversas.dono_conversa` conferido: 7 `humano`, 1
`agente_ia` (bate com a única conversa que já tinha `agente_ativo_id`). Nenhum deploy no Railway foi
necessário — é só schema, nenhum código de aplicação toca essas tabelas ainda.

**Fase 1 completa e em produção. Fase 2 (engine/worker) é o próximo passo — checkpoint próprio.**

## Onde está (2026-09-17, Fluxo de Conversa — Fase 0 concluída; aguardando checkpoint pra Fase 1)

**Fase 0 (auditoria só-leitura) da reconstrução do módulo "Ferramentas → Fluxo de Conversa"
concluída**, em sessão nova como a decisão de 2026-09-16 previa. Rafael colou a visão completa do
que quer pro módulo — motor de automação conversacional determinístico, tratado como infraestrutura
crítica, com editor visual, versionamento, engine assíncrona, paleta de blocos odontológicos —
registrada na íntegra em `crm/docs/fluxo-conversa-visao.md` (fonte, não plano aprovado).

Auditoria confirmou: **o módulo não existe em nenhuma camada do sistema hoje** — sem rota, sem item
de menu, sem componente, sem tabela (mesmo padrão já visto na auditoria de Campanhas). Em vez de
auditar um módulo antigo, a Fase 0 mapeou o que um motor novo precisa reaproveitar e os riscos reais
já presentes na infraestrutura que ele vai herdar: os dois pollers existentes
(`agentes-buffer.ts`/`disparos-worker.ts`, via `instrumentation.ts`) como modelo de engine
assíncrona fora do request HTTP; o padrão de idempotência já validado 3x em produção (constraint
única + insert puro + tratar `23505` como sucesso, em `integration_locks`/`campanha_eventos`/
`mensagens.evolution_message_id`); o pipeline exato do webhook Evolution e onde um Fluxo se
encaixaria nele sem quebrar o que existe; a máquina de estado do funil (`conversas.ts`); o par
`agente_ativo_id`/`agente_pausado_ate`/`ultimo_agente_id` como a única arbitragem
determinístico↔dinâmico que já existe (só entre Humano e Agente de IA — nenhuma arbitragem entre 3+
automatismos); e o padrão de "capability desligada" do ControleODONTO como diretamente reaproveitável
pros blocos Odonto.

**5 riscos reais já existentes no código atual** (não introduzidos pelo Fluxo de Conversa, mas que
ele herdaria se não forem corrigidos): `agentes-buffer.ts` sem lock distribuído (resposta duplicada
da IA em caso de dois processos concorrentes); `reativacao.ts` sem lock e sem checagem de opt-out
(pode duplicar envio ou mandar mensagem pra quem já saiu — falha de LGPD prática já existente);
corrida de criação de paciente/conversa no webhook (`23505` não tratado nesses dois inserts, só em
`mensagens`); recovery de lock só por TTL (não escala pra esperas de horas/dias); sem watchdog
externo se um poller parar de se reagendar. Relatório completo, com caminho de arquivo por achado,
em `crm/docs/fluxo-conversa-auditoria-fase0.md`.

**Fase 0 encerrada. Fase 1 (arquitetura/schema/migrations) não começou** — fica pra checkpoint
explícito do Rafael, com 3 perguntas em aberto registradas no relatório (migrar `reativacao.ts` pro
motor novo ou deixar separado; os 5 riscos entram no escopo desta reconstrução ou viram correções à
parte; nome final das tabelas). Nenhum código, schema ou mensagem real tocado nesta sessão.

## Onde está (2026-09-16, Campanhas — módulo estratégico construído; próximo: Fase 6)

**"Ferramentas → Campanhas" construído do zero e em produção**, a partir de um briefing extenso do
Rafael pedindo que o módulo virasse o centro estratégico de marketing/conversão da clínica — não
mais uma tela genérica. Planejamento formal (`EnterPlanMode`/`ExitPlanMode`, plano em
`C:\Users\rafaelviriato\.claude\plans\zazzy-chasing-gray.md`).

Auditoria (pedida explicitamente antes de codar) encontrou 2 coisas: (1) a tela "Campanhas" **não
existia** — nav só tinha Agentes de IA/Disparos/ControleODONTO; (2) a tabela `campanhas` criada na
Fase B de Disparos (v17) era, na prática, um **Disparo** (lote de envio de WhatsApp — nome,
mensagem, público resolvido, worker), sem objetivo, canal, meta ou receita — exatamente a confusão
"Campanha = Disparo" que o briefing pedia pra desfazer.

**Decisão de arquitetura** (`_memoria/decisoes.md`): renomear em vez de duplicar. Migração `v18`
(`campanhas`→`disparos`, `campanha_destinatarios`→`disparo_destinatarios`, rename puro de metadado,
zero perda de dado) libera o nome pro conceito estratégico novo. Migração `v19` cria `campanhas`
(objetivo/tipo/especialidade texto livre sem CHECK — catálogo sugerido em código, permite opção
nova sem migração; status fechado rascunho/agendada/ativa/pausada/concluida/cancelada; `metas`
jsonb; trilha de auditoria completa — criado/atualizado/iniciado/pausado/encerrado/cancelado
`_por`/`_em`), `campanha_canais` e `campanha_eventos` (log idempotente dos 5 marcos do funil —
`new_lead`/`qualified_lead`/`appointment_booked`/`appointment_attended`/`treatment_closed`, unique
key `(campanha_id, paciente_id, tipo)`); mais `disparos.campanha_id` (1 campanha → N disparos, por
FK, sem duplicar o motor de envio) e `pacientes.campanha_id`/`utm_term`/`landing_page` (completa a
atribuição que a v14/Pixel tinha começado).

Reaproveitado sem duplicar: motor de público (`audiencias.ts`, por `audiencia_id`), opt-out
(nunca contornado — quem manda mensagem continua sendo só Disparos), mensagens
salvas/etiquetas/agentes de IA, RBAC (mesmo gate `papel === "admin"` de todo "Ferramentas"),
Relatórios (`AbasRelatorio.tsx` ganhou aba "Marketing" em vez de tela paralela). Nova rota
`POST /api/audiencias` (antes inexistente — `salvarAudiencia` já existia desde a Fase A de
Disparos mas nunca tinha chamador; agora o passo "Público" do wizard de Campanhas pode salvar o
filtro montado como audiência reutilizável).

Automático vs. manual no funil, sem fingir integração que não existe: `new_lead` dispara ao
vincular paciente↔campanha (manual, ficha do paciente — Evolution/Baileys não recebe UTM/
`ctwa_clid`, achado já documentado na v14); `qualified_lead` dispara quando a Qualificação
Automática (Agentes de IA) classifica "Quente"; `appointment_booked` dispara quando a conversa
muda pra status "Agendado" — os 2 ganchos são só uma chamada isolada em try/catch em cima de
funcionalidade que já existe (`agentes-qualificacao.ts`, `conversas.ts`), sem infra nova.
`appointment_attended`/`treatment_closed` (com receita) só por registro manual no painel da
campanha — ponto de extensão natural pro ControleODONTO quando tiver credencial real. Agente de IA
também ganhou consciência de campanha: quando o paciente da conversa tem `campanha_id`, o prompt
final inclui uma linha de contexto ("Origem: campanha X, objetivo Y").

Sem tabela de métricas — tudo calculado ao vivo (`src/lib/campanha-metricas.ts`, mesmo padrão de
`relatorios.ts`): leads, respondidos (por mensagem enviada, não por status), qualificados,
agendamentos, comparecimentos, fechamentos, receita, CPL/CPA/CAC/ROAS — **as 4 métricas
financeiras somem da tela quando não há investimento registrado**, nunca "R$0,00"/"Infinity".
Funil visual (`CampanhaFunil.tsx`) com barra proporcional, mesma paleta de `BarChart.tsx`.

UI: nav item "Campanhas" (primeiro do grupo Ferramentas — é o estratégico, Disparo é o
operacional); `/campanhas` (abas de status + dashboard do período, reusando `FiltroPeriodo`);
`/campanhas/nova` (wizard de 8 passos: Informações básicas/Objetivo/Público/Canais/Disparos e
Agente de IA/Metas/Tracking/Revisão, com 7 templates prontos que só pré-preenchem); `/campanhas/
[id]` (dashboard + funil + disparos vinculados + registro manual de comparecimento/fechamento +
auditoria); `/campanhas/[id]/editar` (mesmo formulário, em abas livres em vez de wizard linear —
mesmo componente, mesmo truque do `AgenteForm.tsx`: presença de `campanha` decide o modo).

Testes: só as partes puras (mesmo critério do resto do projeto) —
`calcularMetricas`/`isStatusCampanhaValido`/catálogos de rótulo/`buscarTemplate`, 12 testes novos
(340 no total). `typecheck`/`lint`/`build` de produção limpos.

Migrações v18 e v19 aplicadas em produção pelo MCP do Supabase, confirmadas lendo o schema depois.
**Verificação fim a ponta contra o schema de produção**: campanha de teste criada → paciente de
teste vinculado → os 5 marcos do funil registrados (inclusive tentando duplicar `new_lead` de
propósito — confirmado que a unique key barra o duplicado, fica só 1 linha) → métricas conferidas
batendo (CPL/CPA/CAC/ROAS calculados certos a partir de investimento R$1.000/receita R$4.500) →
disparo real existente vinculado por FK e desvinculado de novo → tudo apagado ao final, banco
voltou ao estado de antes.

Documentação nova em `crm/docs/campanhas.md` (conceito, schema, automático vs. manual, o que ficou
de fora conscientemente). Commitado (`54745a8`) e deployado no Railway (sucesso, smoke test em
produção ok). Ainda não sincronizado no GitHub nesta sessão.

**Teste real de ponta a ponta, a pedido do Rafael (2026-09-16, mesmo dia)**: campanha
"Teste Campanhas — envio real" criada direto em produção (status `ativa`), vinculada ao paciente
"Rafael (teste Disparos)" já existente (mesmo número usado no teste de Disparos), gerando o marco
`new_lead`. Um disparo vinculado a ela ("Teste Campanhas — disparo de verificação") foi criado e
iniciado — o worker já rodando em produção pegou sozinho e mandou a mensagem de verdade pro
WhatsApp do Rafael (`evolution_message_id` confirmado, `{primeiro_nome}` resolvido certo pra
"Rafael"). Confirma que campanha→disparo→worker→WhatsApp funciona de ponta a ponta com envio real,
não só com dado sintético. **Rafael confirmou o recebimento da mensagem no WhatsApp** — diferente
do teste anterior de Disparos, que só tinha confirmação do sistema (Evolution aceitou o envio), este
fechou com confirmação visual de verdade. **Dados ficam no banco de propósito** — Rafael pediu
explicitamente pra deixar configurado; entram no mesmo apagão de dados de teste (Disparos +
Campanhas) antes da produção real com clientes (pendência em `agora.md`).

## Onde está (2026-09-16, Disparos — Fase B testada em produção; próximo: Fase 6)

**Fase B do módulo "Ferramentas → Disparos" completa e em produção**, fechando o que a Fase A abriu
(opt-out, mensagens salvas, motor de públicos — sem UI nem tabela de campanha ainda). Planejamento
formal (`EnterPlanMode`/`ExitPlanMode`, plano em
`C:\Users\rafaelviriato\.claude\plans\stateless-pondering-prism.md`), com 2 perguntas fechadas antes
de codar — as 2 recomendadas: sem agendamento no v1 (só "salvar rascunho" ou "criar e iniciar
agora") e sem janela de horário comercial no worker. Decisão completa em `_memoria/decisoes.md`.

Entregue: migração `v17` (`campanhas`, `campanha_destinatarios`, reaproveitando `integration_locks`
com `provider = 'disparos'`); `src/lib/campanhas.ts` (CRUD + regra pura testável);
`src/lib/disparos-worker.ts` (worker in-process, mesmo desenho do poll de buffer dos Agentes de IA —
`setTimeout` recursivo via `instrumentation.ts`, só em produção — porque GitHub Actions não serve
pro intervalo de 15-25s entre mensagens que o WhatsApp via Evolution exige pra não levar shadowban;
reconfere opt-out/telefone AO VIVO antes de cada envio, grava no Chat ao Vivo quando há conversa, só
paga o intervalo cheio quando manda mensagem de verdade); `src/lib/disparos-lock.ts`. Rotas
`api/disparos/*` e telas `/disparos` (lista), `/disparos/nova` (wizard de 3 passos: público →
mensagem → revisão) e `/disparos/[id]` (relatório com ações e auto-refresh). Item novo no
`SidebarNav`.

332 testes (4 novos)/typecheck/lint/build limpos. Migração aplicada em produção pelo MCP do
Supabase, confirmada lendo o schema. Deploy no Railway (`railway up`) confirmado `SUCCESS`, logs sem
erro nos dois workers, smoke test em produção ok.

Commitado e sincronizado no GitHub (`292defd`).

**Teste fim a ponta feito e confirmado pelo sistema** (2026-09-16, mesmo dia): paciente "Rafael
(teste Disparos)" criado direto no banco de produção com o número do próprio Rafael
(61981925241), campanha `enviando` com 1 destinatário — o worker já rodando em produção pegou
sozinho, mandou a mensagem (`{primeiro_nome}` resolvido certo), registrou no Chat ao Vivo e fechou
a campanha (`concluida`) sem nenhuma ação manual. `evolution_message_id` confirma que a Evolution
API aceitou o envio; confirmação visual do Rafael no celular ainda não veio. Dados de teste ficam
no banco por decisão do Rafael (ver `_memoria/decisoes.md`) — apagar antes da produção real com
clientes.

## Onde está (2026-09-16, Disparos — Fase A: fundamentos; próximo: Fase B)

**Fase A da evolução do módulo "Ferramentas → Disparos" completa e em produção**, a partir de um
briefing extenso do Rafael pedindo campanhas/reativação/follow-up de verdade, não um "disparo em
massa" genérico. Antes de codar, auditoria completa do repositório (a pedido dele) encontrou que
**o módulo não existia**: sem rota, tabela, nav item nem service de Disparos/Campanhas/Fluxos/
Listas/Mensagens salvas — o único parente era a automação fixa de reativação (`reativacao.ts`, 1
mensagem, 1x por conversa, sem UI). Opt-out também não existia em lugar nenhum do código, e "Funil"
no CRM é uma máquina de estado fixa da conversa, não um pipeline multi-etapa configurável como o
briefing original supunha.

Rafael sugeriu, de forma independente, que a segmentação (pacientes inativos, faltou à consulta
etc.) devia ser um motor reutilizável por vários módulos — decisão registrada em
`_memoria/decisoes.md`: o Motor de Públicos ("Audiências") nasce ANTES do wizard de Disparos, não
depois, junto com opt-out como fundação cross-módulo.

Plano formal (`EnterPlanMode`/`ExitPlanMode`, mesma prática das fases de Agentes de IA) fatiou o
trabalho em Fase A (fundamentos) e Fase B (Disparos v1 — wizard + worker). **Fase A entregue**:

- `pacientes.opt_out_em`/`opt_out_origem` (migração `v16`) — opt-out fica no próprio paciente, não
  numa tabela à parte (minimizar dados, LGPD).
- `src/lib/opt-out.ts`: detecção por palavra-chave (mesmo padrão de `detectarPedidoHumano`),
  cuidado explícito com falso positivo (palavra solta como "parar"/"sair" só conta como opt-out
  quando é a mensagem inteira; frase dentro de outra frase precisa ser inequívoca — "posso parar de
  usar o fio dental?" não dispara). Plugado no webhook antes do Agente de IA: funciona mesmo sem
  agente ativo, confirma o opt-out por WhatsApp, e a IA para de responder pra quem saiu.
- `src/lib/mensagens-salvas.ts` (tabela nova): biblioteca de templates + `resolverVariaveis` com
  fallback seguro — nunca "Olá undefined", limpa pontuação órfã quando o nome falta.
- `src/lib/audiencias.ts` (tabela nova): motor de públicos v1 — etiqueta (todas/qualquer), status
  da conversa, inatividade por dias sem mensagem; opt-out e telefone inválido sempre excluídos,
  nunca opcionais. Separa "encontrados/excluídos/elegíveis", como o print de referência pedia.
- 36 testes novos (324 no total), migração `v16` aplicada em produção pelo MCP do Supabase
  (confirmada lendo o schema depois), typecheck/lint/build limpos. Ainda não commitado nem
  sincronizado no GitHub nesta sessão.

Próximo passo: Fase B (wizard de criação, worker de envio in-process — não GitHub Actions, cuja
granularidade de minutos não serve pro intervalo de 15-25s entre mensagens —, relatório). Trilha
independente da Fase 6 (demo pro marido): não bloqueia nem depende dela.

## Onde está (2026-09-16, Integração ControleODONTO — Fase 0; próximo: obter credencial real, depois Fase 6)

**Fase 0 da integração com o ControleODONTO completa e em produção**: pesquisa técnica, adapter
isolado (`crm/src/lib/controle-odonto/`), painel (Ferramentas → ControleODONTO) e infraestrutura
de sincronização — sem nenhuma capability real ligada ainda. Pedido explícito do Rafael: camada de
integração profissional, nunca inventando contrato de API.

Pesquisa confirmou o que o brief já suspeitava: a área "Integrações - Webhooks/Autenticações
Webhooks" do manual oficial (GitBook) existe mas está vazia (título "(FAZER)", verificado direto).
O endpoint de agenda citado no brief (`GET /v6/Agendamento/Estabelecimento/{dataInicio}/{dataFim}`)
**não foi confirmado de forma independente** — entrou só como candidato, nunca chamado de verdade.
Pesquisa completa em `crm/docs/integrations/controle-odonto.md`.

Adapter com as 7 capabilities pedidas (`canReadAppointments`, `canCreateAppointments`,
`canUpdateAppointments`, `canCancelAppointments`, `canReadPatients`, `canCreatePatients`,
`canReceiveWebhooks`) — **todas `false`**, só viram `true` manualmente em código depois de validar
contra uma conta real (nunca por env var). Inclui cliente HTTP com retry/backoff/timeout, matching
de paciente (id externo → telefone → CPF → e-mail → revisão manual, reaproveitando
`normalizarTelefoneEntrada`), dedupe genérico (`external_ids`), lock distribuído
(`integration_locks`), polling incremental preparado (`sync.ts`) e reconciliação (`reconcile.ts`,
nunca apaga nada sozinha). Migração `v15` (4 tabelas novas) aplicada direto em produção pelo MCP
do Supabase. 59 testes novos (288 no total)/typecheck/lint/build limpos. Deploy no Railway
confirmado `SUCCESS`, smoke test em produção ok. Commitado (`265cf80`) e sincronizado no GitHub.

Decisões conscientes de escopo: sem workflow do GitHub Actions pro cron ainda (rodar de 5 em 5 min
sem nenhuma capability ativa gastaria minutos de Actions à toa — criar quando `canReadAppointments`
for confirmada) e sem botão "Reprocessar falhas" no painel (seria idêntico a "Sincronizar agora"
hoje, mesmo critério de nunca copiar funcionalidade sem lógica real por trás).

Próximo passo desta integração: conseguir credencial/documentação real do ControleODONTO (contato
com o suporte deles) e seguir a checklist de "Fase de Descoberta com Credencial" no próprio
`docs/integrations/controle-odonto.md`. Isso não bloqueia a Fase 6 (demo pro marido) — são trilhas
independentes.

## Onde está (2026-09-16, Agentes de IA — Pixel de Conversão; próximo: Fase 6)

**Pixel de Conversão (Facebook Ads + Google Ads) construído, migrado e em produção**, a pedido
explícito do Rafael — revertendo a parte do Pixel na decisão registrada horas antes ("só faz
sentido quando o tráfego pago começar", ver decisão 2026-09-16 substituída em
`_memoria/decisoes.md`). Critério fechado antes de codar (2 perguntas): os 3 eventos do funil de
uma vez (novo lead, lead quente, agendado — não só um) e nasce desligado, sem credencial real
(mesmo padrão da Qualificação).

Pesquisa (Facebook Conversions API + Google Ads, docs atuais) mudou o desenho: a Evolution API
(Baileys, WhatsApp não-oficial) não recebe `ctwa_clid`/UTMs/`gclid`/`fbclid` — só a API oficial da
Meta recebe isso. As colunas de atribuição existem (`pacientes.origem_lead`/`utm_*`/`gclid`/
`fbclid`), mas ficam `null` de verdade enquanto o CRM usar Evolution/Baileys — dito com clareza ao
Rafael, não construído fingindo funcionar. A rota clássica de conversão do Google Ads API
(`OfflineUserDataJobService`) está bloqueada pra conta nova desde abr/jun 2026 — implementação foi
direto pro caminho vigente, **Data Manager API**.

`src/lib/pixel-facebook.ts` (novo): Conversions API, hash SHA-256 via Web Crypto — não
`node:crypto`, mesmo motivo de `sessao.ts` (o arquivo entra na cadeia de import que o Next bundla
pro cliente via `chat.ts`/`ChatAoVivo.tsx`, e `node:crypto` quebra esse build; achado só na hora de
rodar `npm run build`, corrigido). `src/lib/pixel-google-ads.ts` (novo): OAuth2 (refresh token →
access token) + Data Manager API; Client ID/Secret do app ficam em env var
(`GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET`, infra da Noryos), o resto é por-agente.
`src/lib/agentes-pixel.ts` (novo): orquestra os dois com dedup atômico (`UPDATE ... WHERE coluna
IS NULL`) — nunca dispara o mesmo evento 2x pra mesma conversa. `conversas.ultimo_agente_id`
(coluna nova, nunca zera) resolve qual agente é dono da conversa pro evento "agendado", disparado
na troca manual de status, quando o agente que respondeu já pode ter parado de escutar.

Migração `v14` (9 colunas em `agentes_ia`, 4 em `conversas`, 7 em `pacientes`) aplicada em produção
pelo MCP do Supabase, confirmada lendo o schema — 3ª vez seguida sem SQL Editor manual. UI
(`AgenteForm.tsx`): aba "Pixel" — toggle mestre, os 3 cards de evento, campos do Meta e do Google.
229 testes (27 novos)/typecheck/lint/build de produção limpos. Deploy no Railway confirmado
`SUCCESS` via MCP, webhook em produção respondendo 200 depois do deploy. Ainda não commitado nem
sincronizado no GitHub nesta sessão. Próximo passo continua sendo a Fase 6 (demo pro marido) — não
sobra mais nenhuma fase técnica antes dela.

## Onde está (2026-09-16, Agentes de IA — Qualificação Automática de Leads; próximo: Fase 6)

**Qualificação Automática de Leads construída, migrada e em produção**, a pedido do Rafael —
revertendo, na mesma sessão em que perguntei, a decisão registrada horas antes de deixar essa aba
fora por falta de critério (print da RoiZap, ver decisão 2026-09-16 substituída em
`_memoria/decisoes.md`). Critério fechado antes de codar (2 perguntas): escala fixa
Quente/Morno/Frio (etiquetas nascem automaticamente por clínica, cores fixas) em vez de etiquetas
livres, reavaliada depois de cada resposta do agente em vez de só na 1ª mensagem.
`src/lib/agentes-qualificacao.ts` (novo): reaproveita o mesmo provider/modelo do agente pra
classificar (1 palavra, sem custo de infraestrutura extra); aplica só a etiqueta que bate,
removendo as outras duas — a etiqueta é sempre a temperatura ATUAL do lead, não um histórico
acumulado. Opt-in por agente (toggle novo na aba Qualificação do formulário,
`qualificacaoAutomatica`, nasce `false` — não muda nada no "Recepção Virtual" até alguém ligar).
Migração `v13` (coluna `agentes_ia.qualificacao_automatica`) aplicada em produção pelo MCP do
Supabase, confirmada lendo o schema depois. 202 testes (4 novos)/typecheck/lint/build limpos.
Deploy no Railway confirmado `SUCCESS`/Online. Ainda não commitado nem sincronizado no GitHub
nesta sessão. Próximo passo continua sendo a Fase 6 (demo pro marido) — não sobra mais nenhuma
fase técnica antes dela.

## Onde está (2026-09-16, Agentes de IA — prompt estruturado + Conhecimento; próximo: Fase 6)

**Prompt do Agente virou 3 abas (Configuração / Prompt do Agente / Conhecimento)**, a pedido do
Rafael (print do "Agente 01" da RoiZap). Perguntado quais das 4 abas novas do print (Conhecimento,
Qualificação, Ferramentas, Pixel) valiam construir de verdade agora — mesmo critério já usado no
Chat ao Vivo, sem copiar aba sem funcionalidade real por trás — Rafael escolheu só
**Conhecimento**. Modo Avançado (textarea único, `prompt_sistema`) preserva o "Recepção Virtual"
exatamente como estava; modo Simples estrutura Persona/Objetivo/Fluxo e Triagem/Guardrails
(prioridade máxima no prompt final, igual ao aviso do print)/Traços de Personalidade (Tom de Voz,
Usar Emojis). Conhecimento (`agentes_conhecimento`, tabela nova) guarda fatos curtos por agente que
entram no prompt automaticamente. Cabeçalho do agente ganhou os 4 cards do print (Mensagens,
Conversas, Tempo Médio, Conhecimentos, dado real) e o Ativar/Pausar. Migração `v12` rodada em
produção — **1ª vez aplicada direto pelo MCP do Supabase** (`apply_migration`), sem precisar do SQL
Editor manual (ver `ferramentas.md`). Deploy no Railway confirmado (`✓ Ready in 772ms`). 198
testes/typecheck/lint/build limpos. Validado ao vivo: página do "Recepção Virtual" intacta em modo
Avançado; agente de teste criado em modo Simples + 1 item de Conhecimento pela API, dado conferido
certo no Supabase, e apagado em seguida (banco voltou ao estado de antes). Ainda não
commitado/sincronizado no GitHub nesta sessão. Próximo passo volta a ser a Fase 6 (demo pro
marido) — não sobra mais nenhuma fase técnica antes dela.

## Onde está (2026-09-16, Agentes de IA — Fase 2B validada e desligada de novo; próximo: Fase 6)

**Fase 2B (Buffer de mensagens) completa, com um bug real achado e corrigido em produção,
validada de ponta a ponta com WhatsApp real, e desligada de novo por decisão consciente.**
Planejada formalmente (`EnterPlanMode`, mesma prática das Fases 1/2A). Migração `v11`
(`agentes_ia.buffer_mensagens`/`buffer_segundos`, `conversas.agente_buffer_desde`/`_ate`/
`_novo_paciente`), `src/lib/agentes-buffer.ts` novo (abre/estende a janela, poll que fecha janela
vencida e responde), `src/instrumentation.ts` novo (liga o poll só em produção). Bug real no 1º
teste ao vivo: a janela abria um instante depois da mensagem que a disparava, resposta nunca saía
sem erro no log — corrigido com 10s de folga na marca de abertura. Validado com 3 mensagens
seguidas → 1 resposta combinada só. Buffer ficou desligado no "Recepção Virtual" (nenhum paciente
real ainda, resposta rápida pesa mais que combinar rajada rara) — liga quando fizer sentido.
Detalhe completo em "Feito" abaixo. Próximo passo volta a ser a Fase 6 (demo pro marido) — não
sobra mais nenhuma fase técnica antes dela.

## Onde está (2026-09-15, menu colapsável + som de notificação; próximo: Fase 2B)

**2 ajustes de UI no CRM**, a pedido do Rafael (prints de referência da RoiZap: um menu
"Ferramentas" que abre/recolhe, e um controle de som de notificação que não chegou anexado —
perguntei o formato e ele escolheu liga/desliga simples). Menu da sidebar (`SidebarNav.tsx`) ganhou
ícone de raio + chevron que gira, aberto por padrão; Chat ao Vivo (`ChatAoVivo.tsx`) ganhou botão de
alto-falante no cabeçalho que toca um "ding" (Web Audio API, sem lib nova) só quando chega mensagem
**recebida** nova, preferência em `localStorage`. Validado (typecheck/lint/183 testes/build
limpos), commitado (`13378d5`) e deployado no Railway — **Rafael testou em produção e confirmou que
funcionou**. Decidiu seguir agora para **Agentes de IA — Fase 2B (Buffer de mensagens)**, em vez da
Fase 6 (demo pro marido).

## Onde está (2026-09-15, automação de reativação validada de ponta a ponta)

**Fase 5 (automação de reativação de paciente inativo) validada de ponta a ponta pela 1ª vez** — a
pedido do Rafael, checado o workflow do GitHub Actions (existia há dias, nunca confirmado rodando).
Achado real: já tinha disparado sozinho 1x (agendado) e falhou com 401 — o secret
`ODONTOMINAS_CRM_CRON_SECRET` do GitHub não batia byte a byte com o `CRON_SECRET` do Railway
(`compararSenhas` exige mesmo tamanho antes de comparar, então um espaço/quebra de linha a mais em
qualquer um dos dois já derruba). Corrigido gerando um segredo novo e sincronizando os dois lados:
`CRON_SECRET` atualizado no Railway direto (MCP, redeploy automático); Rafael colou o mesmo valor
no secret do GitHub (escrever secret de repositório é bloqueado pelo classificador de segurança,
sempre manual, mesmo com autorização no chat). Rafael re-rodou o job pela aba Actions; confirmado
por leitura via API (REST com `GITHUB_PERSONAL_ACCESS_TOKEN`, sem precisar de `gh` CLI) que passou
— pronto pro cron das 9h Brasília rodar sozinho a partir de amanhã.

## Onde está (2026-09-15, Agentes de IA validado + Pausar IA/Finalizar Atendimento + notificação)

**1º Agente de IA real criado e validado de ponta a ponta em produção**: "Recepção Virtual"
(Gemini), etiqueta-gatilho "Atendimento IA" criada, prompt detalhado e compliance-safe. Testado com
mensagem simulada pelo webhook: respondeu certo, reconheceu sozinha "pronta pra marcar horário"
como gatilho de transferência, e "Avisar Membro da Equipe" chegou de verdade no WhatsApp do Rafael.
Fase 1 e Fase 2A do CRM estão, agora sim, funcionais de ponta a ponta com uso real — não só
deployadas. No caminho, achado e corrigido um bug real: `gemini-2.5-flash-lite` foi descontinuado
pelo Google (404 "no longer available to new users"), trocado pelo alias `gemini-flash-lite-latest`
(commit `b699685`). CRM também ganhou, na mesma sessão: **"Pausar IA"/"Retomar IA"/"Finalizar
Atendimento"** no Chat ao Vivo (commit `63ac13f`, sem migração nova) e **notificação real do
navegador** — Notification API com permissão pedida por gesto do usuário, controle de 3 posições
arrastável (Desligadas/Todas/Só esfriando), adaptado do banner da RoiZap (commit `5551897`).
Detalhe completo em "Feito" abaixo. Próximo passo de sempre: Fase 2B (Buffer de mensagens) ou Fase
6 (demo pro marido) — nenhuma fase técnica falta mais pra demo.

## Onde está (2026-09-15, Agentes de IA — Fase 1 + Fase 2A em produção)

CRM: Fase 1 (schema, CRUD, 5 provedores, gatilho por etiqueta) e Fase 2A (horário de atendimento,
transferência pra humano real, "Avisar Membro da Equipe", pausar após concluir o fluxo, dividir em
mensagens curtas) **em produção de verdade** — migrações v9 e v10 rodadas, commits `394468e` e
`adf4ece`, deploys Railway `7fd66e45` e `3e803bb3`, ambos sucesso. Rafael achou a Fase 1 curta
demais comparado ao print de referência da RoiZap; pediu análise completa, aprovou escopo em 3
blocos (decisão em `_memoria/decisoes.md`). **Chave do Gemini configurada** (Railway + local,
redeploy confirmado sucesso) — a IA já funciona de ponta a ponta, falta só criar e ativar um
agente de verdade (nenhum existe no banco ainda). Fase 2B (Buffer de mensagens) planejada, ainda
não construída. Detalhe completo em "Feito" abaixo.

## Onde está (2026-09-15, Chat ao Vivo + Relatórios + Conexão/dark mode)

CRM: 4 commits nesta sessão, a pedido do Rafael (prints da RoiZap, ferramenta que ele usa em outro
negócio, como referência de layout — adaptado ao que o sistema realmente tem, sem copiar
funcionalidade que não existe aqui). Todos deployados no Railway e validados contra Supabase/
Evolution de produção antes de cada deploy.

- **Chat ao Vivo** (`1e6cbfb`, migração `v6_chat.sql`): a seção que o plano técnico previu de fora
  do V1 ("visibilidade + ação leve", sem thread nem envio) — agora é inbox de verdade. Lista +
  thread + resposta real pelo painel (`src/lib/chat.ts`, `enviarRespostaChat` espelha o padrão de
  `reativacao.ts`). Abas Todos/Não lidas/Concluídos (reaproveita status do funil)/Atribuídos/
  Arquivadas, prioridade, etiquetas livres, busca, "Nova conversa". De propósito sem Grupos/CSAT/
  Instâncias/Análise IA — não existem no sistema.
- **Relatórios** (mesmo commit): "Resumo Executivo" virou dashboard — período (hoje/7/15/30/90d),
  cards, 4 gráficos SVG, abas Visão Geral/Equipe/Leads. Equipe saiu do menu (virou aba); `/equipe`
  continua existindo.
- **Ajustes visuais** (`c2e102f`): Leads esfriando antes dos gráficos; sem linhas de grade.
- **Dark mode + barra superior + Conexão** (`7df49a3`, migração `v7_apelido_instancia.sql`): tema
  claro/escuro funcional em todo o painel via variável CSS do Tailwind v4 (não `dark:` por tela).
  Barra no topo: tema → notificações (não lidas + esfriando) → nome de quem logou. Conexão do
  WhatsApp mostra nome de perfil real (Evolution API) na sidebar e na página, ganhou visual mais
  rico e apelido interno editável (nunca mexe no perfil real). Chat ao Vivo: filtros viraram ícones
  com popover (eram `<select>`); divisor arrastável entre lista e conversa.
- **Contador de não lidas + Desconectar** (`3c48a5c`, migração `v8_contador_nao_lidas.sql`): badge
  com número de mensagens de verdade (era só booleano). Botão "Desconectar" no rodapé da Conexão
  (`DELETE /instance/logout`), com confirmação em modal — não testado ao vivo de propósito
  (derrubaria o WhatsApp de teste em uso).
- Validado: typecheck/lint/testes (130)/build limpos em cada commit; conferência contra produção
  (sessão mintada localmente, mesmo `SESSAO_SECRET` do `.env.local`) antes e depois de cada deploy.
  Rafael rodou as migrações v6/v7/v8 entre um commit e outro.
- Achado técnico: a máquina ficou com 0,2GB livres de RAM (7 processos `next dev` órfãos de
  sessões anteriores, mesmas portas 3000-3006) e um build travou por falta de memória — encerrados
  todos, build voltou a funcionar. Lição: `TaskStop` não mata sempre o processo filho no Windows,
  sempre confirmar pela porta.
- Enviado ao GitHub via `/syncar` na mesma sessão (ver commit de sync).

## Onde está (2026-09-15, V1 do painel — menu, login por atendente, Equipe, Conexão)

CRM: **pacote de melhorias na V1 do painel completo e em produção de verdade** — menu lateral em
toda tela logada, login individual por atendente (troca as 2 senhas compartilhadas), tela
**Equipe** (atendimento por secretária: quantidade, tempo médio de resposta) e tela **Conexão**
(status do WhatsApp + QR Code pra reconectar sem abrir Railway/Evolution). Migração
`2026-09-15_v4_equipe.sql` rodada, um bug real de permissão corrigido com
`2026-09-15_v5_grants_atendentes.sql` (ver "Feito"), `railway up` feito e **validado com login
real de produção** (`admin`/`admin-temp-2026` entra, Rafael confirmou visualmente). Próximo passo
de sempre: Fase 6 (demo pro marido).

## Onde está (2026-09-15, Fase 5)

CRM: **Fase 5 completa e em produção** — automação de reativação de paciente inativo (conversa
resolvida sem mensagem há mais de 30 dias recebe 1 WhatsApp de reativação, uma vez só por
conversa), disparada 1x/dia por um cron do GitHub Actions. Detalhe completo em "Feito" abaixo.
Próximo passo é a Fase 6 (demo pro marido, e se validar, pra Ariadna) — não sobra mais nenhuma
fase técnica antes da demo.

## Onde está (2026-09-15, Fase 4)

CRM: pendência da revisão técnica fechada (migração `aguardando_desde` rodada, `railway up` feito
e validado em produção) e **Fase 4 completa e em produção**: ficha de paciente
(`/pacientes/[id]`) + resumo executivo (`/resumo`, com alerta de leads esfriando). Detalhe
completo em "Feito" abaixo. Próximo passo é a Fase 5 (1 automação de destaque).

## Onde está (2026-09-15, revisão técnica)

Revisão técnica aprofundada das Fases 1-3 do CRM, a pedido do Rafael. 2 bugs reais corrigidos no
funil de atendimento, login endurecido (rate limit), suite de testes criada do zero (71 testes),
escopo do MCP do Supabase enxugado. Detalhe completo em "Feito" abaixo. **Nada disso está em
produção ainda** — falta rodar a migração nova no SQL Editor e fazer `railway up`.

## Onde está (2026-09-15, atualizado)

CRM: Fase 3 (painel de atendimento) completa e validada de ponta a ponta, em produção. Detalhe
completo em "Feito" abaixo. Painel agora exige login (remendo mínimo — 2 perfis, admin/atendente,
senha temporária). Próximo passo é a Fase 4 (ficha de paciente + resumo executivo).

## Onde está (2026-09-15)

CRM: Fase 2 (espelhamento) completa e validada de ponta a ponta. Detalhe completo em "Feito"
abaixo. Próximo passo era a Fase 3 (painel de atendimento) — ver bloco atualizado acima.

## Onde está (2026-09-12)

Pasta criada. Escopo e compliance mapeados. O site em `site/` deixou de ser scaffold técnico e
virou um redesign editorial completo, com uma revisão de direção de arte e uma seção nova,
"Protocolo Correct Full Arch" (ver "Feito" abaixo). **No ar em produção**: Cloudflare Pages,
https://odontominas.pages.dev/ — repositório `noryosinovacoes-os`, root `clientes/odontominas/site`,
build `npm run build` → `out`, deploy automático a cada push na `main` (conectado por Rafael no
dashboard, confirmado carregando certo, com a seção do Protocolo Correct visível). Domínio próprio
ainda não existe — segue pendência abaixo.

Reunião de Rafael com o marido da Ariadna aconteceu em 14/09: escopo do piloto mudou de "site+GMN
grátis, tráfego cobrado à parte" pra pacote completo de graça — site + CRM de captação + tráfego
pago (verba de mídia por conta da clínica) — pensado como prova de conceito replicável pros
contatos dele com outros dentistas (detalhe em `contexto.md`). **A "proposta" não vai ser um
documento**: Ariadna só avança em projeto que vê funcionando, então o plano combinado com o marido
é demonstrar o CRM rodando — a demonstração É a proposta. Por isso o CRM virou a atividade
principal do projeto agora; site (já no ar) e tráfego pago ficam em segundo plano até lá.

## Pendências

**Negócio**
- [ ] Ter o CRM num estado demonstrável e marcar a demonstração com o marido (e depois, se ele
  validar, com a Ariadna) — isso substitui "apresentar proposta formal" (2026-09-14).
- [ ] Definir prazo de entrega com ela (depende da demonstração acontecer primeiro).
- [ ] Definir o critério de "100%"/pronto pra replicar — o que precisa estar rodando antes de
  oferecer a mesma estrutura pros contatos do marido com outros dentistas (2026-09-14).

**CRM — atividade principal do projeto agora (2026-09-14)**
- [ ] Confirmar com a clínica se o incômodo real com o Controle Odonto é custo da assinatura ou
  falta de automação — decide se dá pra só simplificar módulos em vez de construir substituto
  completo (o CRM não mexe na camada clínica/prontuário/financeiro dele, só na de
  captação/relacionamento).
- [x] Fase 1a — Evolution API no ar na Railway (instância `odontominas-teste`, WHATSAPP-BAILEYS),
  conectada via QR no número de teste do Rafael (`state: open`), confirmado por chamada direta à
  API (2026-09-15). Chave e URL em `crm/.env.local` (fora do git).
- [x] Fase 1b — projeto Supabase novo criado (`odontominas-crm`, região Americas/São Paulo,
  RLS automático ligado em toda tabela nova, tabela não exposta por padrão). Chaves salvas e
  validadas em `crm/.env.local` (2026-09-15). **Fase 1 (infra) completa.**
- [x] Fase 2 — espelhamento: mensagem recebida/enviada grava em `conversas`/`mensagens`, sem tela
  ainda. Validada com WhatsApp real (2026-09-15) — ver "Feito".
- [x] Fase 3 — painel de atendimento (o "uau" da demo): lista de conversas, status
  (novo/respondido/aguardando/agendado/perdido), tempo até a 1ª resposta. Validada em produção
  (2026-09-15) — ver "Feito".
- [x] Aplicar em produção a revisão técnica de 2026-09-15: migração
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase e `railway up` feito
  (corrige o funil de atendimento e endurece o login) — ver "Feito".
- [x] Fase 4 — ficha de paciente + resumo executivo (dashboard simples). Completa e em produção
  (2026-09-15) — ver "Feito".
- [x] Fase 5 — automação de reativação de paciente inativo (escolhida em vez de lembrete de
  consulta — ver `_memoria/decisoes.md`). Completa e em produção (2026-09-15) — ver "Feito".
- [x] V1 do painel incrementada — menu lateral, login por atendente, Equipe, Conexão WhatsApp com
  QR (2026-09-15), migrações v4+v5 rodadas, `railway up` feito e validado com login real de
  produção — ver "Feito". Trocar usuário/senha das 3 contas de demo
  (`admin`/`recepcao1`/`recepcao2`, senha `<usuario>-temp-2026`) pelas secretárias reais antes da
  demo. RBAC fino por permissão (não só por tela) segue pra depois que o piloto validar.
- [x] Agentes de IA: criar e ativar o 1º agente de teste. "Recepção Virtual" criado e validado de
  ponta a ponta com envio real (resposta, transferência, aviso à equipe) (2026-09-15).
- [x] Agentes de IA — Fase 2B (Buffer de mensagens): completa, bug real corrigido, validada de
  ponta a ponta com WhatsApp real e desligada de novo por decisão consciente (2026-09-16).
- [x] Agentes de IA — Prompt estruturado (Simples/Avançado) + aba Conhecimento: construído,
  testado e em produção (2026-09-16) — ver "Feito". Ferramentas/Pixel do print da RoiZap ficaram de
  fora por decisão do Rafael, sem funcionalidade real por trás ainda (Pixel entrou de verdade horas
  depois — ver bullet abaixo; Ferramentas segue de fora).
- [x] Agentes de IA — Qualificação Automática de Leads: construída, testada e em produção
  (2026-09-16) — ver "Feito". Revertendo a decisão de horas antes; critério que faltava (escala
  fixa Quente/Morno/Frio) fechado com o Rafael antes de codar.
- [x] Agentes de IA — Pixel de Conversão (Facebook + Google Ads): construído, testado e em
  produção (2026-09-16) — ver "Feito". Revertendo a parte do Pixel na mesma decisão de horas
  antes. Desligado por padrão; falta credencial real (Pixel ID/token do Facebook, conta de Google
  Ads) pra ligar de vez.
- [ ] Criar o app OAuth do Google Ads no Google Cloud (`GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET`) —
  pré-requisito só do lado Google do Pixel de Conversão; o Facebook não precisa disso, só do Pixel
  ID/token do cliente (2026-09-16).
- [ ] Fase 6 — demo pro marido; se validar, demo pra Ariadna.
- [ ] Integração ControleODONTO — Fase 0 (adapter, painel, migration) em produção (2026-09-16, ver
  "Feito"). Falta: obter credencial/documentação real do ControleODONTO (contato com o suporte
  deles) antes de habilitar qualquer capability — checklist em
  `crm/docs/integrations/controle-odonto.md`. Não bloqueia a Fase 6.
- [ ] Decidir se apaga os 5 dados fictícios de demo (Camila, Rodrigo, Fernanda, Marcos, Beatriz —
  telefones 556199990001-5) antes da demo real, ou mantém como demonstração fixa (2026-09-15).
- [x] Disparos — Fase A e Fase B (wizard + worker de envio + relatório): construídas, testadas e
  em produção, teste fim a ponta feito com sucesso (2026-09-16) — ver "Feito". Falta apagar os
  dados de teste antes da produção real com clientes (decisão em `_memoria/decisoes.md`).
- [x] Campanhas — módulo estratégico (Ferramentas → Campanhas), separado de Disparos: schema
  (rename v18 + v19), CRUD, wizard, dashboard, funil, ganchos automáticos com Qualificação/Funil/
  Agente de IA, aba Marketing em Relatórios — construído, testado (typecheck/lint/build/340
  testes) e verificado fim a ponta contra produção (2026-09-16) — ver "Feito" e
  `crm/docs/campanhas.md`.
- [x] Fluxo de Conversa — Fase 0 (auditoria só-leitura): concluída (2026-09-17) — ver
  `crm/docs/fluxo-conversa-auditoria-fase0.md`.
- [x] Fluxo de Conversa — Fase 1 (arquitetura/schema): migration `v20` revisada (5 pontos pedidos
  pelo Rafael, 3 corrigidos) e **aplicada em produção** (2026-09-17), confirmada lendo o schema —
  ver `crm/docs/fluxo-conversa-arquitetura.md`.
- [x] Fluxo de Conversa — Fase 2a (núcleo do motor): construída, deployada e validada em produção
  (2026-09-17) — 1 bug real achado e corrigido (embed ambíguo do PostgREST); teste real de WhatsApp
  ("TESTE - Fluxo Odonto") confirmado de ponta a ponta pela Evolution. Ver "Onde está" no topo.
- [x] Fluxo de Conversa — Fase 2b/3 (editor visual): construída, deployada e validada em produção
  (2026-09-17) — `@xyflow/react` (única exceção à política de zero-dependência), 1 bug real achado
  e corrigido (polling do painel "Testar" preso por closure desatualizado); teste real de ponta a
  ponta feito pelo próprio editor (criar fluxo, arrastar bloco, conectar, testar) — mensagem
  confirmada chegando no WhatsApp. Ver "Onde está" no topo.
- [x] Fluxo de Conversa — paleta Ações CRM (5 blocos: etiqueta, funil, prioridade, atendente):
  construída (2026-09-17), sem migration, typecheck/lint/build limpos, 449 testes (19 novos).
  Commit local `c3d04e8`, ainda não sincronizado nem deployado. Ver "Onde está" no topo.
- [x] Fluxo de Conversa — paleta Humano + IA (4 dos 8 blocos: transferir humano, alerta interno,
  pausar automação, iniciar agente de IA): construída (2026-09-17), sem migration,
  typecheck/lint/build limpos, 464 testes (15 novos), 2 bugs reais achados e corrigidos (corrida do
  `liberarControle`, aviso falso "sem finalizar"). Commit local `0fad463`, ainda não sincronizado
  nem deployado. Ver "Onde está" no topo.
- [ ] Fluxo de Conversa — reconstrução do módulo "Ferramentas → Fluxo de Conversa" como motor de
  automação conversacional determinístico (infraestrutura crítica), fatiada em 6 fases com
  checkpoint do Rafael entre elas — decisão completa em `_memoria/decisoes.md` (2026-09-16). Fases
  0, 1, 2a e 2b/3 completas, deployadas e validadas com envio real (2026-09-17), mais as fatias de
  Ações CRM e Humano+IA da ampliação da paleta (2026-09-17, commitadas localmente, não deployadas).
  Odonto segue 100% bloqueado (ControleODONTO sem capability validada); Integração pausada (cofre
  de credenciais + mitigação de SSRF, fase separada). Falta apagar os 2 fluxos de teste "TESTE -
  Fluxo Odonto" (ambos arquivados, não apagados) e os dados vinculados antes da produção real com
  clientes — mesma pendência de Disparos/Campanhas, ver `agora.md`. Próximo passo: seguir ampliando
  a paleta (Integração) ou Fase 6 (demo), sem data definida ainda.

## Plano técnico do CRM (2026-09-14)

- **Código:** `clientes/odontominas/crm/` (Next.js 15 + TypeScript + Tailwind, UI kit reaproveitado
  por referência do `site/` — mesmo padrão de sempre, não é submodule nem dependência entre
  projetos).
- **Banco:** Supabase novo, dedicado a este CRM — dado de paciente é mais sensível (LGPD) e é de
  outra empresa, não mistura com o banco do Diagnóstico Digital. Toda tabela leva `clinica_id`
  (arquitetura "path B": modelo de dado pronto pra multi-clínica, mas cada clínica roda numa
  instância própria — não é plataforma multi-tenant compartilhada por ora).
  Tabelas do V1: `clinicas`, `pacientes`, `conversas`, `mensagens`, `eventos_funil` (log de
  mudança de status — alimenta o resumo executivo e o alerta de lead esfriando), `consultas`.
- **WhatsApp:** Evolution API (self-hosted, conecta via QR, não exige migrar o número oficial da
  clínica) — rota não-oficial consciente pro V1; migração pra API oficial da Meta fica pra quando
  virar operação com vários clientes pagando.
- **Hospedagem da Evolution API:** Railway (template oficial, deploy de um clique) — validado por
  pesquisa como escolha certa **pra esta fase** (custo real esperado ~US$5-20/mês, não
  necessariamente o piso de US$5; há relatos de instabilidade recente, tolerável em fase de
  teste/demo). Quando replicar pra várias clínicas pagando, reavaliar VPS (ex: Hostinger) +
  Coolify — custo fixo por servidor em vez de consumo por instância, mais barato em escala.
- **Reaproveitado do Diagnóstico Digital** (`projetos/Noryos-Inovacoes/site/src/lib/`, por
  referência, não por dependência): padrão de scoring determinístico e versionado
  (`diagnostico-scoring.ts`) adaptado pro funil de atendimento; disciplina de persistência
  (`diagnostico-store.ts` — Supabase como driver principal, sem fallback silencioso em produção,
  log de erro sem PII, migração sempre aditiva); `rate-limit.ts`/`turnstile.ts` se o CRM ganhar
  formulário público; UI kit (`ui/`, `system/`) pra acelerar a interface.
- **Fora do V1, de propósito:** camada clínica/prontuário (fica com o Controle Odonto), chat 2-way
  completo dentro do CRM (v1 é visibilidade + ação leve), tráfego pago (entra só depois do CRM
  validado).

**Confirmar com a Ariadna antes de publicar de verdade** (tudo já centralizado em
`site/src/lib/config.ts` / `site/src/content/`, nada solto no código):
- [ ] Número oficial do WhatsApp (`config.ts` → `whatsappNumber`, hoje vazio — CTA cai no e-mail
  como fallback).
- [ ] Endereço: validar Setor Norte, Quadra 5, Lote 17 (existe registro antigo com outro lote).
- [ ] E-mail odontominasdf@gmail.com segue monitorado?
- [ ] Nome + CRO do responsável técnico da pessoa jurídica (pode ou não ser a própria Ariadna).
- [ ] Redação exata do item "2011 — atuação em Implantodontia" e confirmação do Mestrado em
  Biologia Oral (2019) — os dois ficam fora do site até ela validar (`equipe.ts`).
- [ ] Confirmar Endodontia/Periodontia como tratamentos oferecidos (`tratamentos.ts`, hoje
  `confirmado: false`, não aparecem no site).
- [ ] Convênios aceitos e formas de pagamento — FAQ hoje redireciona pro WhatsApp em vez de
  inventar resposta.
- [ ] Foto real da Dra. Ariadna e da clínica (fachada, recepção, consultório) — o site usa um
  painel editorial no lugar, nunca uma foto de banco fingindo ser da OdontoMinas.
- [ ] Domínio próprio (hoje usa `.example` reservado só pra não quebrar o build).
- [ ] Instagram/Facebook oficiais (hoje vazios em `config.ts`).

## Feito

- 2026-09-16: **Disparos — Fase B (wizard + worker + relatório) completa e em produção.** Ver
  "Onde está" no topo desta seção pro detalhe.
- 2026-09-16: **Disparos — Fase A (fundamentos) completa e em produção.** Ver "Onde está" no topo
  desta seção pro detalhe.
- 2026-09-16: **Integração ControleODONTO — Fase 0 completa e em produção.** Ver "Onde está" no
  topo desta seção pro detalhe.
- 2026-09-11: pasta criada, escopo e checklist de compliance do CFO documentados em
  `contexto.md`.
- 2026-09-11: logo salva em `marca/logo/logo_site.png`, design-guide atualizado com a cor real
  (teal/turquesa, fundo transparente).
- 2026-09-11: material institucional (prêmio, história, valores) recebido por WhatsApp e
  destilado em `contexto.md`.
- 2026-09-11: scaffold técnico do site criado em `site/` — Next.js 15 + Tailwind v4, UI kit
  reaproveitado do site institucional da Noryos (retemado de escuro pra claro/teal), 4 páginas
  (Home, Sobre, Serviços, Contato) com placeholder explícito onde falta fato real, formulário de
  contato direto pro WhatsApp (sem banco), faixa de compliance (nome+CRO) no rodapé de toda
  página. Testado localmente: `npm run build`/`typecheck`/`lint` limpos, 4 rotas verificadas no
  navegador sem erro de console.
- 2026-09-11: rebuild completo do site a pedido do Rafael (brief de agência: UX, copy, SEO local,
  compliance, performance, Cloudflare). Resumo — detalhe completo pedido separadamente:
  - Dados reais encontrados por pesquisa pública (CNPJ, endereço, telefone, CRO da Ariadna,
    horário, avaliações) entraram em `config.ts`/`content/equipe.ts`, com o que não pôde ser
    confirmado (WhatsApp, RT da PJ, mestrado, convênios) explicitamente fora do HTML publicado —
    nunca mais `[PLACEHOLDER: ...]` visível na página.
  - Home, Sobre e Serviços reconstruídos em composição editorial (texto+imagem alternado,
    numeração, timeline) — saiu o padrão "hero + 3 cards + FAQ" e o visual "tech/SaaS" herdado do
    Diagnóstico Digital (tech-grid, glow, spotlight de mouse); entrou um único motion system
    (fade-up/fade/scale-in + stagger, `prefers-reduced-motion` respeitado).
  - Novo: páginas `/politica-de-privacidade` e `/termos-de-uso` (LGPD), Schema.org Dentist +
    Service + FAQPage, eventos de analytics por origem de clique (`whatsapp_hero`,
    `whatsapp_implantes`, `phone_click`, `maps_click`...) via um listener único (`AnalyticsBinder`).
  - Hospedagem trocada de `output: "standalone"` (padrão Hostinger do site institucional) pra
    `output: "export"` + `public/_headers` (Cloudflare Pages) — decisão do dia, ver `_contexto`.
  - Validado: `typecheck`, `lint` e `next build` limpos; export estático em `site/out/` conferido
    (sem placeholder visível, formatação pt-BR correta, favicon real aplicado). Não testado em
    navegador de verdade (sem ferramenta de screenshot neste ambiente) — só via HTML renderizado e
    smoke test HTTP no dev server.
- 2026-09-12 (reconstruído de sessão que fechou a janela sem salvar — ver nota em "Onde está"):
  revisão de direção de arte do site (paleta de texto mais azulada, degradê de assinatura de 3
  tons, tipografia unificada em Manrope, motion de entrada mais discreto, hover do botão primário
  escurecendo em vez de clarear) e seção nova "Protocolo Correct Full Arch": `Hero.tsx` extraído
  com o placeholder antigo trocado por um diagrama SVG comparativo interativo
  (`CorrectTransformation.tsx`, slider manual + loop automático que respeita
  `prefers-reduced-motion`), seção dedicada com benefícios/jornada/FAQ próprios
  (`CorrectProtocol.tsx`, substituindo o antigo bloco genérico "Destaque Implantes"), copy em
  `content/protocolo.ts` sob os mesmos limites de compliance do CFO (nunca equiparar a "All-on-4",
  nunca afirmar quantidade fixa de implantes, carga imediata ou tratamento no mesmo dia). Validado:
  `typecheck`/`lint`/`next build` limpos, commitado e sincronizado no GitHub.
- 2026-09-12: primeiro deploy de produção. Rafael conectou o repositório à Cloudflare Pages pelo
  dashboard (root `clientes/odontominas/site`, build `npm run build`, saída `out`, deploy
  automático a cada push na `main`). Site confirmado no ar em https://odontominas.pages.dev/, com
  a seção do Protocolo Correct carregando. Ainda no subdomínio gratuito — domínio próprio é
  pendência separada.
- 2026-09-14 (fonte: reunião presencial de Rafael com o marido da Ariadna, relatada no chat no
  mesmo dia): escopo do piloto mudou. Deixa de ser "site+GMN grátis, tráfego cobrado à parte" e
  vira pacote completo de graça — site + CRM de captação/relacionamento + tráfego pago (verba de
  mídia por conta da clínica, gestão sem custo) — pensado como prova de conceito replicável: o
  marido tem contatos com outros dentistas e pretende indicar a mesma estrutura depois que rodar
  100% na OdontoMinas. Ordem de execução definida: site + CRM primeiro, tráfego pago entra depois
  que captação/follow-up estiver validado. Ver escopo completo em `contexto.md`.
- 2026-09-14: plano técnico do CRM fechado (stack, banco, arquitetura, hospedagem da Evolution API,
  o que reaproveitar do Diagnóstico Digital, fases de construção até a demo) — ver "Plano técnico
  do CRM" acima. Rafael confirmou número de WhatsApp separado pra teste (não o da clínica) e
  Railway como hospedagem da Evolution API pra esta fase.
- 2026-09-15: **Fase 2 do CRM completa e validada de ponta a ponta.** Scaffold Next.js 15 +
  TypeScript + Tailwind em `crm/`; migração V1 (`clinicas`, `pacientes`, `conversas`, `mensagens`,
  `eventos_funil`, `consultas`, todas com `clinica_id`, RLS ligado, ver `crm/supabase/migrations/`);
  webhook `/api/webhook/evolution` recebe `messages.upsert`, acha-ou-cria paciente/conversa por
  telefone, avança status `novo→respondido` na 1ª resposta da clínica (logado em `eventos_funil`),
  idempotência por `evolution_message_id`.
  - Migração precisou de 2ª passada: o projeto Supabase não tinha default privileges no schema
    `public` — toda tabela nova nascia sem `GRANT` pra `service_role` (RLS bypass e privilégio de
    tabela são camadas diferentes no Postgres). Corrigido em `2026-09-15_v1_grants.sql`.
  - Deploy no Railway, mesmo projeto da Evolution API (`illustrious-perfection`), serviço
    `odontominas-crm`, domínio `odontominas-crm-production.up.railway.app`. **Sem auto-deploy do
    GitHub ainda** — deploy é manual via `railway up` (CLI), não dispara sozinho em push na `main`
    como o site.
  - Bug real achado e corrigido: o endpoint validava a `apikey` do webhook contra a chave global da
    Evolution API, mas ela ecoa o **token da instância** (UUID de 36 caracteres) nesse campo, não a
    chave global (88 caracteres) — todo webhook real tomava 401 em silêncio. Corrigido aceitando as
    duas (env nova `EVOLUTION_INSTANCE_TOKEN`).
  - Validado com mensagem real de um segundo número (self-chat mostrou disparo de webhook
    inconsistente via Baileys, não serve de teste confiável): paciente, conversa e mensagem
    gravados certos, status avançou pra `respondido`. Dado de teste limpo do Supabase depois.
  - MCP: Supabase (`supabase-crm-odontominas`, HTTP/OAuth) ficou em "Pending approval" mesmo após
    3 aprovações numa sessão interativa separada — causa não identificada. Contornado com um MCP
    local (`supabase-crm`) autenticado por token de acesso pessoal. Railway CLI instalada e logada
    (`railway login --browserless`), MCP oficial configurado (`railway mcp install`). Os dois MCPs
    novos só ficam disponíveis numa sessão futura desta máquina.
- 2026-09-15: **Fase 3 do CRM completa e validada de ponta a ponta, em produção.** Painel de
  atendimento em `crm/src/app/page.tsx`: lista de conversas (paciente/telefone), status em dropdown
  colorido e clicável (a "ação leve" do plano técnico — grava em `eventos_funil` com
  `motivo: "manual"`), filtro por status via link, tempo até 1ª resposta calculado a partir do
  primeiro `eventos_funil` que tira a conversa de `novo` (destaque vermelho acima de 30min ainda
  sem resposta — o "uau" da demo), auto-refresh de 20s pra mensagem nova aparecer sozinha numa
  demonstração ao vivo. Zero dependência nova, só Tailwind. Testado com uma conversa sintética real
  no Supabase (criada e apagada na sessão).
  - Ao entregar, identificado que o painel não tinha login nenhum — URL pública do Railway expunha
    telefone e conversa de paciente (LGPD). Rafael decidiu 2 perfis (`admin`, `atendente`) em vez
    dos 6 cargos sugeridos (Admin, Gestor, Gerente, Dentista, Assistente, Atendente) — ver
    `_memoria/decisoes.md` pro porquê — e um remendo mínimo de senha antes de RBAC completo.
  - Implementado: `src/middleware.ts` protege painel + API (webhook da Evolution segue público, é
    servidor-a-servidor); cookie assinado por HMAC via Web Crypto (`src/lib/sessao.ts`, sem
    dependência nova, edge-safe); `/login` + logout; `.env.example` com as 3 variáveis novas
    (`PAINEL_SENHA_ADMIN`, `PAINEL_SENHA_ATENDENTE`, `SESSAO_SECRET`).
  - Deploy no Railway (`railway up`, serviço `odontominas-crm`) — variáveis setadas via MCP depois
    de aprovação explícita do Rafael (o classificador de modo automático bloqueia escrita de
    segredo em serviço remoto por padrão). Validado em produção: login errado rejeita, login certo
    entra com o papel certo, painel exige sessão, webhook segue aberto, serviço irmão
    (`evolution-api`) intocado.
  - **Senhas de produção hoje são as temporárias de desenvolvimento**
    (`dev-admin-temp`/`dev-atendente-temp`) — decisão consciente do Rafael, "por enquanto". Trocar
    antes de expor o painel pra equipe real da clínica (pendência acima).
- 2026-09-15 (revisão técnica, a pedido do Rafael: "análise aprofundada, melhorias e testes em
  tudo que foi feito até aqui"): leitura completa do código das Fases 1-3 (schema, webhook,
  sessão/login, middleware, painel) e 2 bugs reais encontrados e corrigidos:
  - Métrica "tempo até 1ª resposta" contava qualquer saída de `novo` como resposta — marcar uma
    conversa `perdido` direto a partir de `novo` (sem nunca responder) aparecia como "respondeu em
    Xmin" no painel, em verde. Corrigido: só conta transição de verdade pra `respondido`
    (`status_novo = 'respondido'` em `eventos_funil`, não qualquer saída de `novo`).
  - Conversa já resolvida (`respondido`/`agendado`/`perdido`) não reabria quando o paciente
    escrevia de novo — sumia do radar do painel em vez de voltar a aparecer como `novo` (um
    paciente pedindo remarcação, ou um lead "perdido" que volta a escrever, ficava invisível).
    Corrigido: mensagem nova reabre o ciclo — automático no webhook, manual pelo dropdown de
    status — com coluna nova `aguardando_desde` marcando o início do ciclo de espera atual
    (`primeira_mensagem_em` continua intacto como registro do 1º contato de sempre, pra não perder
    esse dado). Lógica de transição extraída pra `src/lib/funil.ts`, pura e testável isolada do
    Supabase.
  - Migração nova: `crm/supabase/migrations/2026-09-15_v2_aguardando_desde.sql` — **ainda não
    rodada** no Supabase (pendência acima).
  - Login: rate limit (`src/lib/rate-limit-login.ts`, 5 tentativas erradas / 15min por IP, em
    memória) e comparação de senha em tempo constante (`src/lib/senha.ts`, `node:crypto`
    `timingSafeEqual`) — as senhas continuam as temporárias, isto só reduz o risco de força bruta
    enquanto isso.
  - Testes: Vitest instalado (não existia nenhum teste no projeto), 71 testes novos cobrindo
    normalização de telefone/mensagem do Baileys (`evolution-webhook.ts`), formatação
    (`tempo.ts`), validação de status (`status.ts`), a regra de transição do funil (`funil.ts`),
    assinatura HMAC da sessão — token adulterado, expirado, segredo trocado (`sessao.ts`), rate
    limit e comparação de senha, e `conversas.ts` (listagem + troca manual de status) com um fake
    de Supabase em memória cobrindo os dois bugs acima. `npm run test`, `typecheck`, `lint` e
    `next build` — todos limpos.
  - `.mcp.json`: escopo do MCP do Supabase enxugado — ver `_memoria/decisoes.md` pro porquê.
  - `npm audit`: 4 vulnerabilidades em ferramenta de build/dev (postcss, vitest mocker), não em
    código servido; correção exige Next.js v16 (major breaking) — registrado, não urgente.
  - **Nada disso está em produção ainda**: falta rodar a migração no SQL Editor e fazer
    `railway up`. Nada foi commitado nem enviado ao GitHub nesta sessão.
- 2026-09-15: pendência de produção da revisão técnica fechada — migração
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase, `railway up` feito e
  validado (webhook 200, login 200, painel redireciona 307 sem sessão).
- 2026-09-15: **Fase 4 completa e validada em produção.** Ficha de paciente
  (`crm/src/app/pacientes/[id]/page.tsx`): dados de contato, status atual do funil, jornada
  (histórico de transições de `eventos_funil`) e histórico de mensagens em bolhas de chat —
  buscada por `paciente_id` (relação 1:1 com conversa, telefone é único por clínica nas duas
  tabelas). Resumo executivo (`crm/src/app/resumo/page.tsx`): contagens por status, tempo médio
  até 1ª resposta (só conta conversas que de fato viraram `respondido`/`agendado`) e lista de leads
  esfriando (em aberto há mais de `LIMITE_ESPERA_MS`, 30min) — o alerta que `contexto.md` já
  previa que `eventos_funil`/`aguardando_desde` deveriam alimentar. Painel principal agora linka o
  contato pra ficha (`crm/src/lib/conversas.ts` passou a expor `paciente_id`) e navega pro resumo.
  - Lógica de agregação extraída pura em `calcularResumo` (`crm/src/lib/resumo.ts`), testável sem
    Supabase — mesmo padrão de `funil.ts`. 4 testes novos, 75 no total; `typecheck`, `lint` e
    `next build` limpos.
  - Tabela `consultas` (agendamentos) ficou de fora da Fase 4 de propósito: nada no código escreve
    nela ainda (nem o webhook, nem o painel) — mostrar uma seção sempre vazia na ficha não
    agregaria nada agora. Ela deve entrar quando a Fase 5 (lembrete de consulta) precisar.
  - Validado ao vivo: com aprovação do Rafael, semeado um paciente/conversa/mensagens sintéticos
    direto no Supabase de produção (via REST, service role key) pra ver a ficha renderizada de
    verdade — nome, telefone, as duas mensagens (recebida/enviada), jornada "Novo → Respondido", e
    o resumo calculando o tempo médio certo (5min). Dado apagado logo em seguida.
  - **Achado técnico**: nem o CLI local do Supabase (logado numa conta que só enxerga o projeto
    `noryos-inovacoes`, não o `odontominas-crm`) nem o MCP local `supabase-crm` (citado como
    "ligado" numa sessão anterior) apareceram disponíveis nesta sessão — hoje só o SQL Editor
    manual funciona pra escrever neste banco. Corrigido em `ferramentas.md` da raiz.
  - Commitado (`29d4187`) e deployado no Railway (`railway up`).
- 2026-09-15: **Fase 5 completa e em produção.** Automação de reativação de paciente inativo.
  Perguntei ao Rafael qual das duas automações da pendência construir — lembrete de consulta
  dependia de criar do zero um jeito de cadastrar consulta (`consultas` segue sem nenhuma escrita,
  nem webhook nem painel gravam nela); reativação reaproveita dado que já existe. Ele escolheu
  reativação (decisão completa em `_memoria/decisoes.md`).
  - `crm/src/lib/evolution-send.ts`: primeiro ponto do código que **envia** mensagem (contraparte
    do webhook, que só recebia) — `POST {EVOLUTION_API_URL}/message/sendText/{instance}`.
  - `crm/src/lib/reativacao.ts`: regra pura (`selecionarCandidatos`) — conversa resolvida
    (respondido/agendado/perdido) sem mensagem há mais de 30 dias (`LIMITE_INATIVIDADE_MS`) vira
    candidata; manda 1x só por conversa (`ultima_reativacao_em` é o trinco, sem cadência de
    repetição automática na V1) — mais orquestração (`executarReativacao`) que busca no Supabase,
    manda pela Evolution API e grava (`ultima_reativacao_em`, `ultima_mensagem_em` e a mensagem em
    si, pra aparecer na ficha do paciente igual qualquer outra). Mensagem de check-in simples, sem
    promessa de resultado nem superlativo (Resolução CFO-196/2019).
  - `crm/src/app/api/cron/reativacao/route.ts`: dispara a automação, protegida por `CRON_SECRET`
    comparado em tempo constante — mesmo padrão do webhook (servidor-a-servidor, sem sessão de
    painel; adicionada às rotas públicas do `middleware.ts`).
  - Migração `2026-09-15_v3_reativacao.sql`: coluna `ultima_reativacao_em` em `conversas`.
  - **Decisão técnica**: em vez de um serviço novo no Railway só pra cron (custo e infra extra), o
    disparo diário roda por `.github/workflows/odontominas-crm-reativacao.yml` (GitHub Actions,
    1x/dia às ~9h Brasília, chama a rota via `curl` autenticado) — reaproveita o GitHub que já
    estava conectado, sem nada pago a mais.
  - De bônus: `crm/.env.example` nunca tinha sido versionado — o `.env*` do `.gitignore` excluía
    ele por engano (não tem segredo nenhum, só nome de variável). Corrigido.
  - 12 testes novos (87 no total); `typecheck`, `lint` e `next build` limpos.
  - Validação sem risco: antes de tocar produção, li (sem escrever) a tabela `conversas` do
    Supabase de produção direto por REST — confirmei que está vazia, então nenhum paciente real
    corria risco de receber mensagem nesta sessão. O classificador de modo automático bloqueou uma
    tentativa minha de chamar a rota com o segredo real pra smoke test (dispararia a automação de
    verdade) — segui só com checagens que não executam envio, por decisão do próprio Rafael de não
    validar com envio real desta vez.
  - Deploy: `CRON_SECRET` setado no Railway via MCP e `railway up` rodado. Rafael aplicou a
    migração no SQL Editor do Supabase e criou o secret `ODONTOMINAS_CRM_CRON_SECRET` no GitHub
    Actions (os 2 passos que esta sessão não conseguia fazer sozinha: sem MCP do Supabase
    disponível, sem `gh` CLI instalado nesta máquina — ver `ferramentas.md`). Commitado (`c72a211`)
    e enviado ao GitHub.
- 2026-09-15: preparo pra Fase 6. Ao testar o login em produção, o painel voltou "não consegui
  conectar ao banco".
  - **Bug real encontrado e corrigido**: logs do Railway mostraram `PGRST303 "JWT issued at
    future"` — erro transiente real do Supabase (a mesma consulta, refeita na mão, funcionou
    normal em seguida). `src/lib/clinica.ts` guardava esse resultado em cache **pra sempre**,
    inclusive quando era erro — um soluço passageiro do Supabase travava o painel até o processo
    reiniciar sozinho. Corrigido: só cacheia sucesso, nunca falha. Reiniciei o serviço no Railway
    (MCP) pra limpar o estado travado na hora, e depois deployei a correção. Testado
    (typecheck/lint/test/build limpos).
  - A pedido do Rafael ("admin e atendente têm os mesmos menus, não faz sentido"): Resumo
    executivo virou exclusivo de admin. `resumo/page.tsx` redireciona pro painel se quem não é
    admin tentar acessar (gate de verdade, não só esconder o link); `page.tsx` só mostra o link
    "Resumo" pra admin. Painel principal segue igual pros 2 papéis — é onde o atendente trabalha.
    Decisão completa em `_memoria/decisoes.md`.
  - Com aprovação do Rafael, semeei 5 conversas fictícias direto no Supabase de produção (nomes e
    telefones claramente falsos, 556199990001-5) cobrindo os 5 status: Camila Duarte (novo),
    Rodrigo Alves (aguardando 52min, aparece em vermelho), Fernanda Lima (respondido em 8min),
    Marcos Teixeira (agendado, jornada respondido→agendado), Beatriz Nogueira (perdido, inativa há
    47 dias, `ultima_reativacao_em` já preenchida de propósito pra não disparar mensagem de
    verdade no cron de amanhã). Validado ao vivo por login real (cookie de sessão): admin vê
    Resumo e entra (200), atendente não vê o link e toma redirect (307) se tentar a URL, os 5
    nomes aparecem certos no painel.
  - 2 deploys nesta sessão (1 só com a correção do cache, 1 com o RBAC do Resumo).
- 2026-09-15: **V1 do painel incrementada** — a pedido do Rafael (a Ariadna "precisa ser impactada
  já na V1"). Nada disso ainda em produção: falta rodar a migração e fazer `railway up`.
  - Menu lateral em toda tela logada: `src/app/(painel)/layout.tsx` (rota movida pra dentro de um
    route group `(painel)` — `/`, `/pacientes/[id]`, `/resumo`, `/equipe`, `/conexao` continuam nas
    mesmas URLs). Nav (`SidebarNav.tsx`) esconde Equipe/Resumo/Conexão de quem não é admin, mas o
    gate de verdade continua sendo o redirect no servidor de cada página (mesmo padrão do Resumo
    desde a Fase 3) — confirmado que digitar a URL direto como atendente ainda redireciona.
  - **Login por atendente** substitui `PAINEL_SENHA_ADMIN`/`PAINEL_SENHA_ATENDENTE`: tabela nova
    `atendentes` (`clinica_id`, nome, usuário, `senha_hash` scrypt, papel, ativo — migração
    `2026-09-15_v4_equipe.sql`). `src/lib/senha.ts` ganhou `hashSenha`/`verificarSenha` (mantém
    `compararSenhas`, ainda usado pelo `CRON_SECRET`). Login roda `verificarSenha` mesmo quando o
    usuário não existe, contra um hash fixo (`HASH_DUMMY_TIMING`) — sem isso, "usuário não existe"
    respondia mais rápido que "senha errada" e vazava por tempo quais usuários são reais. Cookie de
    sessão (`src/lib/sessao.ts`) passa a carregar `atendenteId` + `nome`, não só o papel.
  - **Equipe** (`src/app/(painel)/equipe/page.tsx`, admin): `src/lib/equipe.ts` agrega, por
    atendente, atendimentos hoje (fuso de Brasília — `inicioDoDiaBrasilia` novo em `tempo.ts`),
    atendimentos no total, tempo médio até responder e última atividade. Cada troca manual de
    status (`src/app/api/conversas/[id]/status/route.ts`) agora grava `eventos_funil.atendente_id`
    com quem estava logado; transição automática do webhook continua sem dono (o sistema não sabe
    qual secretária digitou no WhatsApp).
  - **Conexão** (`src/app/(painel)/conexao/page.tsx`, admin): `src/lib/evolution-status.ts` consulta
    `connectionState`/`fetchInstances`/`connect` da Evolution API (mesma instância de
    `evolution-send.ts`) com timeout curto e degradação silenciosa em erro — status (bolinha
    verde/vermelha + número) e QR Code (`base64` da Evolution, direto num `<img>`) pra reconectar
    sem abrir Railway/Evolution. Confirmado ao vivo: instância realmente conectada, número real
    (61) 9925-6901.
  - Sidebar mostra sempre quem está logado (bolinha verde + nome do atendente) e o status da
    conexão do WhatsApp — os dois "bolinha verde" pedidos pelo Rafael, propositalmente separados
    (sessão ativa vs. WhatsApp conectado, são coisas diferentes).
  - Ficha de paciente (`src/lib/pacientes.ts`): jornada mostra quem atendeu cada troca
    (`eventos_funil.atendentes(nome)`, reaproveitando o extrator antes chamado
    `extrairNomePaciente` — renomeado pra `extrairNomeEmbutido` já que agora serve paciente e
    atendente).
  - Validação: 103 testes (16 novos: `senha`, `sessao`, `tempo`, `equipe`, `conversas`),
    `typecheck`/`lint`/`next build` limpos. Sem `chromium-cli` disponível nesta máquina pra
    screenshot, a verificação em navegador de verdade virou: dev server local apontando pro
    Supabase e Evolution API **de produção** (`.env.local`), sessões válidas mintadas com o mesmo
    `SESSAO_SECRET` (mesmo algoritmo HMAC de `sessao.ts`) pra navegar como admin e como atendente
    de verdade — confirmou menu, gate de admin (redirect real, não só link escondido), conexão
    WhatsApp genuinamente ao vivo, e a ficha de paciente com dado real (sem crashar). Sem a
    migração v4 aplicada, `buscarAtendentePorUsuario`/`listarAtendentes` retornam vazio com log
    claro (`PGRST205`, tabela ausente) em vez de derrubar a página — confirmado tentando logar
    antes de rodar a migração. Tokens de sessão e HTML de produção gerados pra este teste foram
    apagados ao final, nada disso ficou salvo no repositório.
  - Nada commitado nem enviado ao GitHub nesta sessão.
  - Commitado e enviado ao GitHub via `/syncar` (32 arquivos, commit `3f06feb`).
- 2026-09-15: **V1 do painel foi pra produção de verdade.** Rafael rodou a migração v4 no SQL
  Editor; ao testar, achei um bug real — mesmo problema da Fase 2 (este projeto Supabase não tem
  os default privileges configurados no schema `public`), a tabela nova `atendentes` nasceu sem
  `GRANT` pra `service_role`. Confirmado por leitura direta (`permission denied for table
  atendentes`). Corrigido com `2026-09-15_v5_grants_atendentes.sql` (mesmo padrão de
  `2026-09-15_v1_grants.sql`); Rafael rodou e a leitura confirmou as 3 contas certas.
  - `railway up` estava sendo bloqueado pelo classificador de modo automático ("Production
    Deploy") mesmo com autorização do Rafael no chat. A pedido dele: `Bash(railway up)` adicionado
    em `.claude/settings.local.json` (permissão local desta máquina) — registrado em
    `_contexto/ferramentas.md`.
  - Deploy feito (2 builds em paralelo, porque o primeiro pareceu travado sem log por minutos —
    não estava, só demorou a agendar builder; o segundo chegou no ar primeiro, mesmo código nos
    dois — sem risco, é o mesmo commit). Validado com login real de produção:
    `admin`/`admin-temp-2026` entra (`{"ok":true,"papel":"admin","nome":"Administração"}`), painel
    carrega com o menu novo. Rafael confirmou visualmente a tela pedindo usuário/senha e testou o
    login com sucesso.
  - Commitado e enviado ao GitHub via `/syncar` (a migração v5, commit `f61d583`).
- 2026-09-15: **Agentes de IA construído** (prints da RoiZap de referência, adaptado ao que o
  sistema tem — mesmo critério das seções anteriores). Entrou como planejado numa sessão de
  planejamento formal (`EnterPlanMode`), com 3 agentes de exploração mapeando schema/grants, o
  pipeline de webhook/envio e os padrões de UI/segredos antes de codar.
  - Migração `crm/supabase/migrations/2026-09-15_v9_agentes_ia.sql`: tabela `agentes_ia`
    (`clinica_id`, `ativo` nasce `false`, `etiqueta_gatilho_id`, `provider`/`modelo`,
    `prompt_sistema`, temperatura/max_tokens, histórico, pausa, transferência) + colunas novas
    `conversas.agente_ativo_id`/`agente_pausado_ate` e `mensagens.gerada_por_agente_id` + grant pro
    `service_role` na mesma migração (mesmo bug de sempre neste Supabase, sem default privileges).
    Rodada em produção, commitada (`394468e`) e deployada no Railway (`7fd66e45`, sucesso).
  - `src/lib/ia-provedores.ts` (novo): 5 provedores via `fetch` puro, sem SDK — Gemini e Claude com
    formato próprio, OpenAI/Groq/DeepSeek reaproveitando a mesma função "chat completions"
    OpenAI-compatível. `modelosDisponiveis()` só lista o que tem env var de chave setada; timeout
    de 15s em toda chamada.
  - `src/lib/agentes.ts` (novo): CRUD do agente; `decidirAtivarAgentePorEtiqueta`/`deveResponder`
    puras e testadas (mesmo padrão de `funil.ts`); `responderComoAgente` é a orquestração (ler →
    gerar → enviar → gravar), mesmo formato de `reativacao.ts`.
  - 3 pontos de integração, sem duplicar lógica existente: `etiquetas.ts`
    (`adicionarEtiquetaConversa`) ativa o agente quando a etiqueta-gatilho é aplicada; o webhook
    (`api/webhook/evolution/route.ts`) chama `responderComoAgente` depois de persistir a mensagem
    recebida, isolado em `try/catch` pra nunca derrubar o ack pra Evolution; `chat.ts`
    (`enviarRespostaChat`) pausa o agente quando um atendente responde manualmente pelo painel.
    Resposta gerada de forma síncrona dentro do webhook, sem fila/cron — decisão registrada em
    `_memoria/decisoes.md` (o CRM roda em container Node persistente no Railway, não serverless).
  - UI: `SidebarNav.tsx` ganhou grupo "Ferramentas"; telas `/agentes` (lista, com contagem real de
    mensagens por agente), `/agentes/novo` e `/agentes/[id]` (form com criação de etiqueta
    inline); todas admin-only, sem kit de UI novo (Tailwind cru, mesmo idioma de `conexao`/`equipe`).
  - Todo agente nasce Pausado e o prompt sugerido já embute as regras do CFO-196/2019 — decisão
    registrada em `_memoria/decisoes.md`.
  - Cortado do V1 de propósito: dividir resposta em várias bolhas do WhatsApp, leitura de
    áudio/imagem, botões interativos, detecção automática de intenção de transferência
    (`max_mensagens_resposta`/`mensagem_transferencia` existem no schema, sem comportamento ainda
    — mesmo espírito de `consultas` na Fase 4).
  - Validado: `typecheck`/`lint`/`test` (145, 9 novos)/`next build` limpos. Smoke test local
    (só leitura) contra Supabase/Evolution de produção, sessão mintada admin e atendente: páginas
    carregam, gate de admin redireciona de verdade, sidebar esconde certo pra atendente, tela não
    quebra sem nenhuma chave de IA configurada.
  - Commitado (`394468e`) e deployado no Railway (`7fd66e45`, sucesso) depois que o Rafael rodou a
    migração v9 no SQL Editor (sem acesso MCP nem CLI a este projeto Supabase nesta sessão — mesma
    limitação já documentada em `_contexto/ferramentas.md`). Falta configurar ao menos uma chave de
    IA pra responder de verdade.
- 2026-09-15: **Agentes de IA — Fase 2A** (horário de atendimento, transferência real, "Avisar
  Membro da Equipe", pausar após concluir fluxo, dividir em mensagens curtas). Rafael comparou a
  Fase 1 com o print completo da RoiZap de novo e achou curta demais; pediu análise seção por
  seção do que faz sentido numa clínica de instância única, e aprovou a recomendação em 3 blocos
  por valor/risco de negócio — decisão completa em `_memoria/decisoes.md`. Planejado formalmente
  (`EnterPlanMode`) de novo, dado o tamanho.
  - Migração `2026-09-15_v10_agentes_comportamento.sql`: 13 colunas novas em `agentes_ia` — mesma
    tabela já existente, grant já valia (é por tabela, não por coluna).
  - `src/lib/agentes-notificacoes.ts` (novo): `detectarPedidoHumano`/`detectarIntencaoCompra` por
    palavra-chave (não por IA — decisão consciente, fica determinístico e testável em vez de
    depender de parsing de marcador entre 5 provedores diferentes) + `notificarEquipe` (manda
    WhatsApp pros números configurados, template com `{motivo}`/`{nome}`/`{telefone}`/`{resumo}`).
  - `src/lib/agentes.ts`: `responderComoAgente` ganhou um 4º parâmetro (`isNovoPaciente`, o webhook
    já calculava) e passou a checar, em ordem: notificar lead novo → pedido de transferência (pula
    a IA inteira, manda a mensagem de transferência e libera `agente_ativo_id`) → horário de
    atendimento → gerar resposta (com notificação de fallback se falhar) → intenção de compra →
    truncar por tamanho máximo → dividir em blocos se configurado → pausar após concluir o fluxo se
    o status virou resolvido. Duas funções puras novas testadas: `dentroDoHorario`,
    `dividirMensagem`.
  - UI (`AgenteForm.tsx`): 2 seções novas (Transferência para Humano, Avisar Membro da Equipe) +
    campos novos nas seções existentes (Modelo de IA ganhou horário; Comportamento ganhou tamanho
    máximo, dividir em mensagens curtas, pausar após concluir).
  - Validado: `typecheck`/`lint`/`test` (176, 31 novos)/`next build` limpos; smoke test local (só
    leitura) confirmando as seções novas renderizando sem chave de IA nenhuma configurada.
  - Rafael rodou a migração v10 sozinho. Commitado (`adf4ece`) e deployado no Railway (`3e803bb3`,
    sucesso). Falta configurar chave de IA (mesma pendência da Fase 1).
  - Achado técnico: o loop de checagem de deploy que eu tinha deixado em segundo plano ficou preso
    porque usava `python3`, que não existe nesta máquina — trocado por `awk`. Registrado no diário
    pra próxima sessão não repetir.
- 2026-09-15: **1º Agente de IA criado e validado de ponta a ponta em produção.** Chave do Gemini
  já configurada na sessão anterior; faltava o agente existir de verdade no banco. Sem MCP/CLI de
  escrita neste projeto Supabase, criado via REST direto (service role key de `.env.local`, mesmo
  caminho já usado pra semear dado fictício na Fase 4/6) — etiqueta "Atendimento IA" (não existia
  etiqueta nenhuma ainda) e o agente "Recepção Virtual": Gemini, temperatura 0,4, transferência
  ligada, "avisar equipe" apontando pro número do Rafael, horário de atendimento pré-preenchido mas
  desligado de propósito (pra poder testar em qualquer hora). Prompt de sistema reescrito mais
  detalhado e profissional a pedido do Rafael (o rascunho inicial foi considerado raso) — puxa
  conteúdo real e já compliance-safe do site (`tratamentos.ts`/`faq.ts`: só os 4 tratamentos
  confirmados, nunca preço, nunca opinião clínica, regras da CFO-196/2019 explícitas).
  - **Bug real achado no meio do teste**: `gemini-2.5-flash-lite` (fixo no catálogo de
    `ia-provedores.ts`) passou a devolver 404 "no longer available to new users" — o Google
    descontinuou o modelo pra chaves novas. Trocado pelo alias `gemini-flash-lite-latest`
    (confirmado por `ListModels` da API que funciona com esta chave) — evita quebrar nesse mesmo
    jeito quando o próximo modelo pontual for aposentado. Corrigido no código e no agente já
    criado; 176→180 testes/typecheck/lint/build limpos. Commitado (`b699685`) e deployado no
    Railway (sucesso).
  - **Validado com envio real de ponta a ponta**: primeiro teste (ativar o agente sem aplicar a
    etiqueta na conversa) não respondeu — achado de que o agente só escuta a conversa onde a
    etiqueta-gatilho foi de fato aplicada, ativar o agente sozinho não basta. Aplicada a etiqueta
    numa conversa real (o próprio número de teste do Rafael) e mandada mensagem de verdade pelo
    WhatsApp: a IA respondeu certo. Simulado depois, direto pelo webhook de produção (payload
    Baileys real, mesma rota que a Evolution usa), "Quero marcar uma consulta" — a IA reconheceu
    sozinha (pelo prompt, não por palavra-chave) que "pronta pra marcar horário" é gatilho de
    passar pra humano, respondeu em 2 blocos, e a notificação "avisar equipe" (intenção de
    agendar) chegou de verdade no WhatsApp do Rafael. Fase 1 e Fase 2A do CRM estão, agora sim,
    funcionais de ponta a ponta com uso real — não só deployadas.
- 2026-09-15: **"Pausar IA" / "Retomar IA" / "Finalizar Atendimento" no Chat ao Vivo** (a pedido do
  Rafael, print da RoiZap com esses 2 botões ao lado do status da conversa como referência).
  - `src/lib/agentes.ts`: `pausarAgenteManual` desliga o agente da conversa na hora
    (`agente_ativo_id = null`) — diferente da pausa temporária automática já existente
    (`pausarAgenteSeConfigurado`), que só entra quando um atendente responde na mão e expira
    sozinha. `retomarAgente`/`decidirAgenteElegivel` (pura, testada) reconectam pelo agente ativo
    cuja etiqueta-gatilho bate com alguma etiqueta que a conversa já tem — sem precisar tirar e
    recolocar a etiqueta pra reativar.
  - `src/lib/chat.ts`: `finalizarAtendimento` fecha o status (só força "respondido" se ainda não
    estiver num status resolvido — não regride "agendado"/"perdido" de volta) e desliga a IA, num
    clique só. `ConversaChat` ganhou `agenteAtivoId` pro Chat ao Vivo saber se mostra "Pausar" ou
    "Retomar".
  - **Sem migração nova** — tudo reaproveita `agente_ativo_id`/`agente_pausado_ate`, colunas que já
    existiam desde a v9. 2 rotas novas (`/api/chat/conversas/[id]/agente`,
    `.../[id]/finalizar`). 183 testes (7 novos), typecheck/lint/build limpos. Commitado (`63ac13f`)
    e deployado no Railway (sucesso).
- 2026-09-15: **Notificação real do navegador** (referência: banner "Ative as notificações pra não
  perder mensagens" da RoiZap, print mandado pelo Rafael). Antes de construir, perguntei 2 coisas
  que mudavam a implementação inteira — Rafael confirmou as duas: (1) é pra ser notificação de
  verdade do sistema operacional (Notification API), não só o sino do painel (que só conta com a
  aba aberta e em foco); (2) o controle de arrastar é de 3 posições, não um liga/desliga comum —
  esquerda desliga tudo, centro (padrão) liga tudo, direita desliga só "mensagem recebida" e
  mantém "lead esfriando" (as 2 categorias que a notificação já distinguia).
  - `src/lib/notificacoes-preferencia.ts` (novo, com testes): preferência em `localStorage` (é por
    navegador/pessoa, não por clínica — nunca no Supabase). `deveNotificar(tipo, pref)` pura.
  - `src/components/Notificacoes.tsx`: adaptado ao que o painel tem (sem sidebar sobrando como a
    RoiZap pro banner) — o aviso e o slider entraram dentro do próprio dropdown do sino, no topo,
    antes da lista. Slider de 3 posições arrastável via Pointer Events (sem lib nova), com clique
    direto também funcionando. Permissão do navegador só é pedida por gesto real do usuário
    (clique/arraste) — nunca sozinho ao carregar a página. Notificação nova detectada comparando
    contra o que já foi visto entre um poll e outro (20s), com `tag` pra nunca duplicar a mesma;
    clicar na notificação foca a aba e navega pro Chat ao Vivo.
  - 183 testes (3 novos), typecheck/lint/build limpos. Commitado (`5551897`) e deployado no
    Railway (sucesso). Limite conhecido e aceito: só funciona com o navegador aberto (mesmo em
    segundo plano) — navegador fechado de vez não notifica, exigiria service worker + servidor de
    push, infra desproporcional ao tamanho da operação hoje.
- 2026-09-15: **Fase 5 (automação de reativação) validada de ponta a ponta pela 1ª vez.** Bug real
  achado ao checar o workflow do GitHub Actions a pedido do Rafael: já tinha disparado sozinho 1x
  (agendado, 9h Brasília) e falhado com 401 — `ODONTOMINAS_CRM_CRON_SECRET` (GitHub) não batia byte
  a byte com `CRON_SECRET` (Railway), provável espaço/quebra de linha a mais colado num dos dois
  lados. Corrigido: segredo novo gerado e sincronizado nos dois lugares (Railway via MCP, redeploy
  automático; GitHub colado manualmente pelo Rafael — escrita de secret de repositório é bloqueada
  pelo classificador de segurança por design, mesmo com autorização explícita no chat). Rafael
  re-rodou o job pela aba Actions; confirmado por leitura via API que passou (`run_attempt: 2`,
  sucesso). De bônus, confirmado que leitura de workflows/runs/jobs/logs do GitHub Actions funciona
  direto por REST com o `GITHUB_PERSONAL_ACCESS_TOKEN`, sem precisar de `gh` CLI — só disparo manual
  e escrita de secret continuam fora do alcance (ver `ferramentas.md`).
- 2026-09-16: **Agentes de IA — Fase 2B (Buffer de mensagens) completa, validada de ponta a ponta e
  desligada de novo.** Planejada formalmente (`EnterPlanMode`, dado o tamanho — mesma prática das
  Fases 1/2A). Arquitetura aprovada em `_memoria/decisoes.md` (2026-09-15): debounce por coluna +
  poll dentro do próprio processo Next. Duas perguntas resolvidas antes de codar: buffer opt-in por
  agente (desligado por padrão, o Recepção Virtual continua respondendo na hora até alguém ligar) e
  poll só em produção (`NODE_ENV === "production"`), nunca em `npm run dev`.
  - Migração `2026-09-15_v11_agentes_buffer.sql`: `agentes_ia.buffer_mensagens`/`buffer_segundos`
    (toggle + segundos, mesmo padrão de todo campo da Fase 2A) e `conversas.agente_buffer_desde`/
    `agente_buffer_ate`/`agente_buffer_novo_paciente`.
  - `src/lib/agentes-buffer.ts` (novo): `processarMensagemRecebida` (chamada pelo webhook no lugar
    de `responderComoAgente` direto — sem buffer ligado no agente, responde na hora igual sempre;
    com buffer, só abre/estende a janela), `processarBuffersVencidos` (o poll — fecha a janela
    ANTES de ler as mensagens, pra uma mensagem que chegar durante o processamento abrir uma janela
    nova em vez de ficar perdida; chama `responderComoAgente` DIRETO, nunca `processarMensagemRecebida`
    de volta, senão reabriria o buffer em loop sem nunca responder), `juntarMensagensBuffer` (pura,
    testada). `responderComoAgente` não mudou nada — já era genérica sobre "uma string do que o
    paciente disse", o texto combinado da rajada entra nela igual a uma mensagem única.
  - `src/instrumentation.ts` (novo): liga o poll (`iniciarPollBuffer`) quando o processo Next sobe —
    único jeito padrão do Next.js de rodar código uma vez no boot, sem custom server.
  - Validado: typecheck/lint/188 testes (5 novos)/build limpos. Commitado (`07ded19`), Rafael rodou
    a migração v11 no SQL Editor, deployado no Railway (`6525a599`, sucesso).
  - **Bug real achado no 1º teste ao vivo pelo WhatsApp**: mandei mensagem de teste, o buffer abriu
    e fechou certo (colunas confirmavam), mas nenhuma resposta saiu — e nenhum erro apareceu no log.
    Causa: `agente_buffer_desde` gravava o relógio no instante em que `abrirOuEstenderBuffer` rodava
    — sempre um pouco DEPOIS do `created_at` da própria mensagem que abriu a janela (ela já tinha
    sido inserida por outra query, no webhook, momentos antes). A busca do poll
    (`created_at >= agente_buffer_desde`) nunca encontrava a mensagem; `juntarMensagensBuffer`
    recebia lista vazia; o código tratava "nada pra responder" como caso normal — silencioso, sem
    log de erro nenhum (por isso não apareceu como falha, só como silêncio).
  - Corrigido: `MARGEM_ABERTURA_MS` (10s) gravada pra trás na abertura da janela, garantindo que a
    mensagem que disparou a rajada sempre entra na busca. 188 testes/typecheck/lint/build limpos.
    Commitado (`ec3d768`) e deployado (`b2dc46d7`, sucesso).
  - **Validado de ponta a ponta com WhatsApp real**: 3 mensagens seguidas em ~3s ("Oie", "Oie",
    "Ola") → 1 resposta só da IA (2 bolhas curtas — "dividir em mensagens curtas" normal, não 3
    respostas separadas).
  - **Decisão**: Rafael pediu ajuda pra decidir se deixava ligado. Recomendei desligar — nenhum
    paciente real usa o número ainda, o buffer só ajuda com rajada de mensagens (pra mensagem
    única, o caso mais comum, só acrescenta ~10-15s de espera sem ganho), e o próximo marco é a
    demo pro marido, onde resposta rápida pesa mais. Buffer desligado de novo
    (`buffer_mensagens: false`, `buffer_segundos: 10` fica salvo pra quando quiser religar).
    Decisão completa em `_memoria/decisoes.md`.
  - Achado técnico: sessão de admin mintada localmente (mesmo script de sempre) foi **rejeitada
    pela produção** (401) — `SESSAO_SECRET` de `crm/.env.local` provavelmente diverge do Railway
    (mesmo tipo de problema já visto com o `CRON_SECRET` da Fase 5). Contornado lendo/escrevendo
    direto no Supabase via REST com `SUPABASE_SERVICE_ROLE_KEY` — mesmo caminho já documentado em
    `ferramentas.md`. Sincronizar os dois `SESSAO_SECRET` fica como pendência menor, não bloqueou o
    teste desta vez.
  - Achado técnico: guiei o Rafael passo a passo (interativo, no VS Code) pra autorizar o MCP
    oficial do Supabase (`supabase-crm-odontominas`, já configurado em `.mcp.json` da raiz) via
    OAuth — funcionou (`/mcp` numa sessão interativa nova). A autorização não apareceu nesta sessão
    em andamento (conexão de MCP carrega só no início da sessão) — deve valer a partir de uma
    sessão nova. `ferramentas.md` atualizado.
- 2026-09-15: **menu "Ferramentas" abre/recolhe + som de notificação no Chat ao Vivo.** A pedido do
  Rafael, 2 prints de referência da RoiZap (o menu com ícone de raio + chevron, e um controle de som
  que não veio anexado — perguntei o formato via 3 opções, ele escolheu liga/desliga simples).
  - `src/components/SidebarNav.tsx`: grupo "Ferramentas" ganhou ícone de raio, label e chevron que
    gira (aberto = pra cima, fechado = pra baixo); clique alterna; aberto por padrão, sem mudar o
    comportamento de antes. No nav horizontal do mobile (sem esse cabeçalho) os itens continuam
    sempre visíveis — só o desktop tem o recolher.
  - `src/components/chat/ChatAoVivo.tsx`: botão de alto-falante no cabeçalho ao lado de "Nova
    conversa". Toca um "ding" de dois tons via Web Audio API (oscilador + gain, `AudioContext`, sem
    lib nova, sem arquivo de áudio) só quando `atualizarListaAgora` (polling da lista a cada 8s)
    detecta uma conversa com `ultimaMensagemDirecao === "recebida"` mais nova que a que já estava —
    nunca no envio do próprio atendente, nunca na carga inicial da página. Preferência liga/desliga
    em `localStorage` (por navegador/pessoa, mesmo padrão do `notificacoes-preferencia.ts` do sino
    do topo), ligado por padrão.
  - Validado: typecheck/lint/183 testes/`next build` limpos. Sem `chromium-cli` nesta máquina pra
    clicar/ouvir de verdade (limitação já conhecida) — smoke test via sessão de admin mintada
    localmente (mesmo `SESSAO_SECRET`) conferindo o HTML renderizado dos dois recursos.
  - Commitado (`13378d5`) e deployado no Railway (`railway up`, sucesso, smoke HTTP 200). **Rafael
    testou em produção e confirmou que funcionou.**
  - Escolheu seguir agora para a Fase 2B (Buffer de mensagens) em vez da Fase 6 (demo pro marido).
- 2026-09-16: **Agentes de IA — prompt estruturado (Simples/Avançado) + aba Conhecimento**, a
  pedido do Rafael (print do "Agente 01" da RoiZap). Perguntado quais das 4 abas novas do print
  (Conhecimento, Qualificação, Ferramentas, Pixel) valiam construir de verdade agora — mesmo
  critério já usado no Chat ao Vivo, sem copiar aba sem funcionalidade real por trás — Rafael
  escolheu só **Conhecimento**.
  - `AgenteForm.tsx` virou 3 abas (Configuração / Prompt do Agente / Conhecimento). Modo Avançado
    preserva o textarea único de sempre (`prompt_sistema`) — o "Recepção Virtual" em produção
    continua exatamente como estava. Modo Simples estrutura Persona, Objetivo, Fluxo e Triagem,
    Guardrails (`src/lib/agentes.ts`, `montarPromptSistema` — guardrails entram primeiro no prompt
    final, prioridade máxima, igual ao aviso do print) e Traços de Personalidade (Tom de Voz, Usar
    Emojis).
  - `src/lib/agentes-conhecimento.ts` (novo, mesmo padrão de `etiquetas.ts`): CRUD dos itens de
    Conhecimento (título + conteúdo), tabela nova `agentes_conhecimento`. Entram no prompt final
    automaticamente, nos dois modos, pra reduzir a IA inventando informação. `duplicarAgente`
    também passa a copiar os itens de conhecimento do agente original.
  - Cabeçalho de `/agentes/[id]` ganhou os 4 cards do print (Mensagens, Conversas, Tempo Médio,
    Conhecimentos — `buscarEstatisticasAgente`, dado real, não decorativo) e o Ativar/Pausar subiu
    pro topo (`AgenteStatusHeader.tsx`, novo).
  - Migração `2026-09-16_v12_agentes_prompt_conhecimento.sql`. **1ª vez que uma migração de schema
    foi aplicada direto pelo MCP do Supabase** (`apply_migration`), sem precisar do SQL Editor
    manual do Rafael — confirma que o MCP recém-autorizado (ver Fase 2B acima) cobre schema
    também, não só dado. `ferramentas.md` atualizado.
  - Validado: typecheck/lint/198 testes (7 novos: `montarPromptSistema`,
    `calcularTempoMedioRespostaMs`)/build limpos. Deploy no Railway confirmado (`railway up`,
    `✓ Ready in 772ms`, status `SUCCESS` via MCP). Testado ao vivo em produção: página do "Recepção
    Virtual" renderiza certo com a nova UI e o agente segue em modo Avançado intacto; criado agente
    de teste em modo Simples com 1 item de Conhecimento pela API, dado conferido certo direto no
    Supabase, e apagado em seguida — banco voltou ao estado de antes (1 agente, 0 conhecimento).
  - Ainda não commitado nem enviado ao GitHub nesta sessão.
- 2026-09-16: **Qualificação Automática de Leads construída e em produção**, a pedido do Rafael —
  revertendo a decisão de horas antes de deixar essa aba fora dos Agentes de IA por falta de
  critério (print da RoiZap). Antes de codar, 2 perguntas resolvidas com o Rafael: escala fixa
  Quente/Morno/Frio (não etiquetas livres por clínica) e reavaliar depois de cada resposta do
  agente (não só na 1ª mensagem) — as 2 recomendadas.
  - `src/lib/agentes-qualificacao.ts` (novo): `classificarQualificacao` reaproveita o mesmo
    provider/modelo já configurado no agente (via `gerarResposta` de `ia-provedores.ts`, prompt
    pedindo 1 palavra só, temperatura 0) — sem infraestrutura nova, só mais uma chamada de IA na
    mesma rodada que já gera a resposta. `parseClassificacao` pura e testada.
    `aplicarQualificacaoAutomatica` garante as 3 etiquetas na clínica (cria a que faltar, cor fixa
    por classificação; reaproveita se já existir uma com o mesmo nome — `etiquetas.ts` ganhou
    `buscarOuCriarEtiqueta`) e aplica só a que bate, removendo as outras duas da conversa — a
    etiqueta mostra sempre a temperatura ATUAL, nunca o histórico de por onde o lead já passou.
  - `src/lib/agentes.ts`: `responderComoAgente` chama a classificação depois de enviar a resposta,
    isolada em try/catch (nunca derruba o envio, que já aconteceu antes) — opt-in por agente
    (`qualificacaoAutomatica`, nasce `false`, não muda nada no Recepção Virtual até alguém ligar).
  - UI (`AgenteForm.tsx`): aba nova "Qualificação" — o toggle do print + as 3 etiquetas explicadas
    quando ligado.
  - Migração `2026-09-16_v13_agentes_qualificacao.sql` (1 coluna em `agentes_ia`, tabela já com
    grant desde a v9). Aplicada direto pelo MCP do Supabase (`apply_migration`), confirmada lendo o
    schema depois — 2ª vez seguida sem precisar do SQL Editor manual do Rafael.
  - Validado: typecheck/lint/202 testes (4 novos: `parseClassificacao`)/build limpos. Deploy no
    Railway (`railway up`) confirmado `SUCCESS` via MCP e `/login` respondendo 200 em produção. Sem
    clique real numa tela (sem `chromium-cli` nesta máquina, limitação já conhecida) — a aba segue
    o mesmo padrão já validado da aba Conhecimento.
  - Ainda não commitado nem enviado ao GitHub nesta sessão.
- 2026-09-17: **Fase 3 do motor de Fluxo de Conversa — evolução arquitetural pra motor central de
  automação** (decisão em `_memoria/decisoes.md`). Decisão confirmada antes de codar: não criar um
  2º motor — o Fluxo de Conversa evolui pra aceitar gatilho temporal e interno, não só webhook.
  - **Implementado**: nó genérico `capturar_resposta` (texto/número, min/max, regex, tentativas,
    timeout — mesma máquina de estados de `menu`); infra de pesquisas (`pesquisas` +
    `pesquisa_respostas`, NPS/satisfação/avaliação Google compartilham schema, nunca a mesma
    semântica) com nós `criar_pesquisa`/`persistir_resposta_pesquisa`; eventos internos
    (`emitirEventoAutomacao`, `fluxo-eventos-internos.ts`) e scanner temporal genérico
    (`executarScannerTemporal`, `fluxo-scanner-temporal.ts`, aniversário como 1ª regra);
    `pacientes.data_nascimento`; observabilidade (`automacao_eventos`); branding dinâmico
    (`buscarClinicaAtual`, `{clinica_nome}` no `resolverVariaveis`) removendo os hardcodes de
    "OdontoMinas" restantes; editor visual completo pros 3 nós novos (paleta, canvas, propriedades,
    conexão, validação, salvar/reabrir).
  - Idempotência 100% reaproveitada do índice único já existente
    (`fluxo_execucoes_gatilho_dedupe_idx`) — nenhuma tabela nova só pra isso. Migrations
    `v21_pacientes_data_nascimento`, `v22_pesquisas`, `v23_automacao_eventos` aplicadas uma a uma
    via MCP do Supabase, cada uma validada por leitura de schema depois.
  - **3 bugs reais achados e corrigidos durante a validação em produção** (não durante o
    desenvolvimento — só apareceram testando de verdade):
    1. `pesquisas.updated_at` nunca era atualizado ao marcar respondida (`persistir_resposta_pesquisa`
       esquecia o campo no UPDATE).
    2. A guarda "recusa se `dono_conversa='humano'`" (certa pro gatilho por mensagem, protege
       atendimento humano em andamento) bloqueava TODO gatilho temporal/interno, porque "humano" é
       só o estado de repouso da imensa maioria das conversas, não sinal de atendimento ativo — sem
       o fix, aniversário/evento interno nunca alcançariam paciente real nenhum. Corrigido com
       `conversaEraNova=true` nesses dois caminhos (mesma exceção que `nova_conversa` já usa).
    3. `/api/cron/fluxo-temporal` faltava na allowlist do `middleware.ts` — o middleware barrava a
       rota (401) antes dela sequer rodar, mesmo com a autenticação por `CRON_SECRET` correta.
    4. (achado colateral, corrigido a pedido) `transferirExecucaoAtivaParaHumano` (função pré-Fase 3)
       mudava `estado`/`motivo_finalizacao`/`finalizado_em` mas esquecia `updated_at`.
  - Validado: 544 testes/typecheck/lint/build limpos. 3 deploys no Railway durante a validação (1
    inicial + 2 correções), todos `SUCCESS`, workers (`agentes-buffer`/`disparos-worker`/
    `fluxo-worker`) subindo limpos em todos. Commit final no `main`: `f26340b`.
  - Testado ao vivo em produção via API real (login como admin, mesmas rotas que o editor usa) +
    banco: fluxo criado → rascunho salvo (validação de forma/grafo real, sem erro/aviso) → lido de
    volta idêntico → publicado → executado via `/testar`. Evento interno (`atendimento_concluido`)
    e scanner temporal (aniversário) testados com paciente de teste: 1ª emissão inicia execução, 2ª
    emissão idêntica detecta idempotência (dedupe key), confirmado no banco (1 execução só, nunca
    2). Round-trip completo de `capturar_resposta` com resposta chegando por WhatsApp de verdade
    **não fechou** — limitação de infraestrutura de teste descoberta na validação: o único número
    de teste disponível (`61981925241`) é o mesmo número logado como instância do CRM, então
    qualquer mensagem dele sai sempre como `fromMe=true` ("a clínica falando"), nunca como resposta
    de paciente — precisa de um 2º número/aparelho pra fechar esse teste especificamente. Evidência
    parcial preservada (mensagem enviada, execução em `waiting_input`, pesquisa criada) — ver seção
    abaixo.
  - `atendimento_concluido` continua sem origem real no CRM (nem `respondido` nem `agendado`
    significam isso) — só testável pela rota `/api/automacao/eventos/testar`, protegida por sessão
    de admin + `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=true` setada só durante a validação e desligada
    (`false`) logo depois.
  - Execução de demo `a98ee509` (Fase 6, ver auditoria anterior): mudou de estado durante esta
    sessão (`waiting_input` → `transferred`, `motivo_finalizacao=resposta_manual_chat`) — **não foi
    causado por nenhuma migration/código da Fase 3**, foi o próprio Rafael respondendo manualmente
    pelo Chat ao Vivo do painel (confirmado por ele). Variáveis e histórico de passos continuam
    intactos.
  - Artefatos de teste preservados de propósito (não apagar sem autorização explícita — servem de
    prova prática pra apresentação): ver `EVIDÊNCIAS DA FASE 3` abaixo. Todos os fluxos de teste com
    gatilho real (`atendimento_concluido`, `aniversario`) ficaram `pausado` — nenhum dispara sozinho.
  - Commitado e enviado ao GitHub (`main`, commit final `f26340b`). Deploy em produção confirmado.
  - **Pendências reais**: (1) fechar o round-trip completo de `capturar_resposta` com resposta de
    WhatsApp de verdade quando houver um 2º número de teste disponível; (2) decidir quando apagar
    os artefatos `[TESTE FASE 3]` (aguardando autorização explícita do Rafael, pós-apresentação);
    (3) Fase 4 (NPS: classificação detrator/neutro/promotor, dashboard) ainda não iniciada de
    propósito.

  ### EVIDÊNCIAS DA FASE 3

  Preservadas em produção até autorização explícita do Rafael pra apagar (pós-apresentação). Todos
  os fluxos abaixo têm `[TESTE FASE 3]` no nome e `uso: demonstracao_fase3` na descrição/metadata.

  | teste | fluxo_id | execução | pesquisa_id | paciente de teste | dedupe key | resultado |
  |---|---|---|---|---|---|---|
  | Captura + Pesquisa (sem resposta) | `fc61b397-9c44-4ebf-8c29-6d0658ee203d` | `42b4a109-e8da-4393-b9bc-aa3603848e23` (cancelada na limpeza de conversa) | `cd9226ef-2251-4346-b8a4-890e90b9957b` (status `enviada`, nunca respondida — prova "pesquisa sem resposta continua existindo") | Camila Duarte (fixture) | — | pesquisa criada, sem resposta |
  | Round-trip WhatsApp — Captura + Pesquisa | `c95d85a7-8b08-4e7d-8a7d-4f343ffa82dd` | `9867cb23-a61a-49dd-8a93-fe52c2fbc299` (em `waiting_input`, nó `captura`) | `605e8497-aa8a-40be-9fc7-780d5a3ac853` (status `enviada`) | Rafael (teste Disparos) | — | mensagem enviada de verdade por WhatsApp; resposta não fechou (limitação de nº de teste, ver acima) |
  | Evento interno — atendimento_concluido | `8d763b38-23f0-4406-a646-924204b3dd8e` (pausado) | `2d737690-0ed6-4b5a-9a6b-94fafe949e2c` (completed) | — | Camila Duarte (fixture) | `atendimento_concluido:64295231-de94-4b92-8816-6f0d794cce07:fase3-prod-001` | 1ª emissão: `execucao_iniciada`; 2ª emissão idêntica: `idempotencia_existente` (`automacao_eventos` linhas `ce3d677d…`/`019dd02a…`) |
  | Scanner temporal — aniversário | `9fcb1331-ec5f-40d7-ae69-94c7b6f36329` (pausado) | `a1ae79dd-dd90-4c46-b765-1367672dd847` (completed) | — | Camila Duarte (fixture, `data_nascimento` de teste já removida depois) | `aniversario:64295231-de94-4b92-8816-6f0d794cce07:2026` | 1ª rodada: `execucao_iniciada`; 2ª rodada (mesma referência anual): `idempotencia_existente` (`automacao_eventos` linha `38e1949b…`) |

  Commit dos fixes achados na validação: `57d62ff` (updated_at pesquisas), `94308ec` (guarda
  conversa_com_humano), `161cb73` (allowlist middleware), `f26340b` (updated_at transferência pra
  humano). Deploy final: Railway, deployment `b36cb174-06c0-47b9-9d73-063fa380be02`, status
  `SUCCESS`. Flag `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=false` confirmada desde o fim da validação.
- 2026-09-18: **Fase 5 do Fluxo de Conversa — Reputação/Google Reviews implementada e validada em
  produção**, a pedido explícito do Rafael. Ele trouxe um prompt de especificação bem detalhado;
  antes de codar, revisei contra o código real (não assumido) e voltei com 2 correções que mudaram
  o desenho: `pesquisas.tipo='avaliacao_google'` e o nó `criar_pesquisa` já existiam desde a v22
  (Fase 3) — menos trabalho novo do que o prompt supunha — e a mensagem enviada **não** ganhou tela
  de template própria: ela é o texto do nó "mensagem" do Fluxo que o admin desenha, mesmo padrão do
  NPS. Uma tela de Configurações com campo de mensagem próprio duplicaria a fonte de verdade.
  - **Implementado**: `reputacao_config` (1 linha por clínica — ativo, URL do Google, tracking de
    clique, delay pra automação futura, guardado sem efeito ainda) + 3 colunas em `pesquisas`
    (`tracking_token`, `tracking_token_expira_em`, `clicado_em`) + `status` ganhou
    `clicada`/`falhou` (migration `v24`). Novo tipo de gatilho interno
    `solicitacao_avaliacao_google` em `fluxo-gatilhos.ts` (a Fluxo builder UI só deixava escolher
    os 3 gatilhos de mensagem — abri a opção no seletor). Ação manual ("⭐ Solicitar avaliação
    Google" na ficha do paciente) só emite o evento interno via `emitirEventoAutomacao` — quem
    manda a mensagem é o Fluxo publicado e ativo com esse gatilho, exatamente como NPS já funciona;
    template pronto ("Solicitação de Avaliação Google") em Fluxos → Novo, pra não obrigar montar do
    zero. `criar_pesquisa` (`fluxo-execucoes.ts`) passou a gerar o token e gravar a URL rastreável
    (ou a direta do Google, se tracking desligado) na variável do nó, em vez do `pesquisa_id` cru
    que nps/satisfacao continuam recebendo.
  - Tracking: token opaco de 256 bits, válido 90 dias, endpoint público `GET /api/r/review/[token]`
    (`middleware.ts` ganhou essa rota na allowlist) sempre redireciona pra URL lida do banco no
    momento do clique — nunca de query string, sem open redirect possível. Dashboard em
    `/reputacao` (enviadas/clicadas/taxa de clique — exclui falha do denominador/falhas + listagem
    com filtro de período/status), nunca mostra "avaliações recebidas" (sem integração real não dá
    pra provar publicação, mesmo princípio de "Google Reviews não é NPS" já decidido na Fase 3).
  - **Bug achado rodando `next build` (não só os testes)**: o token usava `node:crypto`, mas esse
    arquivo é importado por `fluxo-execucoes.ts`, que `chat.ts` também importa — e `chat.ts` é
    alcançado a partir de `ChatAoVivo.tsx` (Client Component), então um import `node:` nesse
    caminho quebra o bundle do webpack pro cliente (`UnhandledSchemeError`). Corrigido trocando pra
    Web Crypto (`crypto.getRandomValues`/`randomUUID`), que funciona nos dois lados.
  - **Achado na implementação, não na validação**: o serviço `odontominas-crm` no Railway nunca
    esteve conectado ao GitHub — `git push` sozinho não deploya nada (confirma o que
    `ferramentas.md` já registrava; só reforçado por ter ido direto pro `git push` primeiro e visto
    que não disparou build nenhum — o deploy de verdade foi `railway up`).
  - Validado: 610 testes (16 novos)/typecheck/lint/`next build` limpos.
  - **Teste real de ponta a ponta em produção, sem depender do Rafael** (pedido explícito dele, ver
    `_memoria/decisoes.md`): deploy via `railway up`; script rodando as MESMAS funções que a UI
    usa (nunca SQL cru simulando a UI) ativou o módulo, criou/publicou o Fluxo `[TESTE FASE 5]` a
    partir do template, e disparou a ação manual pro mesmo paciente de teste da Fase 3/4
    ("Rafael (teste Disparos)", `5561981925241`). Mensagem chegou de verdade no WhatsApp dele com o
    link rastreável (texto gravado em `mensagens`, conferido). Cliquei o link de verdade (HTTP real
    contra produção, não localhost): `302` pro Google Maps (URL de teste, não a real da clínica —
    ver pendência abaixo). Banco confirmou `status='clicada'`/`clicado_em` gravado, painel bateu 1
    enviada/1 clicada/taxa 100%.
  - **Falso alarme investigado e descartado**: uma leitura do painel deu zero solicitações por um
    instante durante o teste — era corrida no PRÓPRIO SCRIPT de teste (consultou antes do worker
    assíncrono terminar de processar o nó de mensagem, não synchronous como o nó `criar_pesquisa`),
    não bug no código. Isolei a mesma chamada (`buscarPainelReputacao`) em outro script alguns
    segundos depois e bateu certo (`total:1, enviadas:1, clicadas:1, taxaClique:1`).
  - Ao final do teste, **desliguei o módulo (`reputacao_config.ativo=false`) e pausei o Fluxo
    `[TESTE FASE 5]`** — nada dispara sozinho, nenhum paciente real pode receber o link de teste,
    até o Rafael colocar a URL real de avaliação da OdontoMinas e ativar pela tela `/reputacao`.
  - Commitado (`74a3fe0`) e enviado ao GitHub (`main`). Deploy em produção confirmado (`railway up`,
    deployment `e8637c10-b7b6-473c-8a48-463afa52d13d`, status `SUCCESS`).
  - **Pendência real**: colocar a URL real de avaliação Google da OdontoMinas e ativar o módulo
    quando o Rafael decidir; decidir quando apagar o Fluxo/pesquisa `[TESTE FASE 5]` (mesmo critério
    das evidências da Fase 3/4 — só com autorização explícita).

  ### EVIDÊNCIAS DA FASE 5

  Preservadas em produção até autorização explícita do Rafael pra apagar. Módulo desativado e Fluxo
  pausado — nada dispara sozinho.

  | teste | fluxo_id | execução | pesquisa_id | paciente de teste | resultado |
  |---|---|---|---|---|---|
  | Ação manual → WhatsApp real → clique real → redirect real | `9593cf0f-ae92-4c27-8c6e-04dd7ada3581` (pausado) | `237384f7-0373-47e0-9c4c-45524aa4fc60` (completed) | `fa85af7d-1c49-4a11-b13e-437db80751db` (status `clicada`) | Rafael (teste Disparos) | mensagem enviada por WhatsApp real, link clicado de verdade (302 confirmado contra produção), painel bateu 1/1/100% |

  Evento em `automacao_eventos`: `fa5a4a96-0a88-45d8-b836-9e3c2c4c1138` (`solicitacao_avaliacao_google` → `execucao_iniciada`).
