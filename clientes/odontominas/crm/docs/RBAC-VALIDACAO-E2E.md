# Validação E2E · Identidade / Login / RBAC — preparação (2026-09-18)

Levantamento feito lendo o código real (catálogo `src/lib/permissoes.ts`, gates das rotas em
`src/app/api/**`, `src/middleware.ts`, `src/lib/sessao-servidor.ts`). Nada foi executado contra
produção com sessão logada — isto é o roteiro e os achados **de código**; cada achado abaixo precisa
ser confirmado no E2E real antes de virar correção.

Legenda: **P** permitido · **N** negado (403) · **S** legado/shim (`isAdminEquivalente` = Dona ou
Noryos Admin) · **—** não implementado (permissão existe no catálogo, nenhuma rota/tela a usa).

## 1. Matriz dos 6 perfis (defaults; customização por pessoa pode mudar)

| Área (gate real) | Noryos Admin | Noryos Suporte | Dona | Gerente | Supervisora | Atendente |
|---|---|---|---|---|---|---|
| Ver tela Equipe (`usuarios.visualizar`) | P | P | P | P | N | N |
| Criar/convidar usuário (`usuarios.criar`) | P (qualquer perfil) | N | P (só gerente/supervisora/atendente) | N | N | N |
| Editar perfil/status (`usuarios.editar`) | P | N | P | N | N | N |
| Permissões por pessoa (`usuarios.gerenciar_permissoes`) | P | N | P | N | N | N |
| Definir senha de outra conta (`usuarios.resetar_acesso`) | P | **P** | P | N | N | N |
| Chat: responder (`conversas.assumir`) | P | N | P | P | P | P |
| Chat: transferir/editar conversa (`conversas.transferir`) | P | N | P | P | P | P |
| Chat: finalizar (`conversas.finalizar`) | P | N | P | P | N | N |
| Notas internas — criar (`conversas.notas_internas`) | P | N | P | P | P | P |
| SLA: ver config (`sla.visualizar`) | P | N | P | P | **N** | P |
| SLA: configurar (`sla.configurar`) | P | N | P | N | N | N |
| Horário de atendimento (`configuracoes.horario`) | P | N | P | N | N | N |
| Agentes/Campanhas/Disparos/Fluxos/Conexão/Reputação/ControleODONTO/Relatórios | S (P) | S (N) | S (P) | S (N) | S (N) | S (N) |
| Kanban (`kanban.*`), Canais (`canais.*` além do menu), `relatorios.exportar`, `automacoes.criar/editar/excluir` | — | — | — | — | — | — |
| Funções de plataforma (`platform.*`, `suporte.*`) | — | — | — | — | — | — |
| `conversas.visualizar_todas/proprias`, `sla.visualizar_equipe`, `usuarios.aprovar/desativar/reativar` | — | — | — | — | — | — |

Notas: Noryos Admin tem `TODAS_PERMISSOES`. Suporte só tem `usuarios.visualizar`,
`usuarios.resetar_acesso` e as 5 `suporte.*/platform.suporte` (essas 5 não são usadas em nenhuma
rota). Supervisora não tem `sla.visualizar`, só `sla.visualizar_equipe` (que nada consulta): a tela
`/configuracoes/sla` redireciona ela.

## 2. Rotas para o E2E autenticado

Sem sessão: **toda** rota fora da lista pública devolve 401 pelo middleware (assinatura do cookie).
Já confirmado em produção: `/api/equipe`, `/api/chat/conversas`, `/api/notificacoes` → 401.

### Com gate de permissão no servidor

| Método · Rota | Permissão | Passam | 403 esperado | Shim |
|---|---|---|---|---|
| POST /api/equipe | usuarios.criar + `podeAtribuirPerfil` | Dona (3 perfis), NA (todos) | Suporte/Gerente/Superv./Atend.; Dona→dona/noryos_* | não |
| PATCH /api/equipe/[id] | usuarios.editar + elevação nos 2 sentidos + não-própria-conta + última Dona | Dona, NA | demais; própria conta; perfil superior | não |
| PATCH /api/equipe/[id]/permissoes | usuarios.gerenciar_permissoes + não-própria-conta | Dona, NA | demais | não |
| PATCH /api/equipe/[id]/senha | usuarios.resetar_acesso | Dona, NA, **Suporte** | Gerente/Superv./Atend. | não |
| POST /api/equipe/[id]/convite | usuarios.criar + rate limit 5/15min por usuário | Dona, NA | demais | não |
| POST /api/chat/conversas/[id]/mensagens | conversas.assumir | todos exceto Suporte | Suporte | não |
| PATCH /api/chat/conversas/[id] | conversas.transferir | todos exceto Suporte | Suporte | não |
| POST /api/chat/conversas/[id]/finalizar | conversas.finalizar | Dona, Gerente, NA | Superv., Atend., Suporte | não |
| POST /api/chat/conversas/[id]/notas | conversas.notas_internas | todos exceto Suporte | Suporte | não |
| GET /api/clinica/sla | sla.visualizar | Dona, Gerente, Atend., NA | Superv., Suporte | não |
| PUT /api/clinica/sla | sla.configurar | Dona, NA | demais | não |
| GET, PUT /api/clinica/horario | configuracoes.horario | Dona, NA | demais | não |

### Sem gate de perfil no servidor (só "tem cookie assinado") — testar o que acontece

`GET/POST /api/chat/conversas` (POST envia WhatsApp real), `GET /api/chat/conversas/[id]/mensagens`,
`GET /api/chat/conversas/[id]/notas`, `GET /api/chat/conversas/[id]/sla`, `GET /api/chat/sla/resumo`,
`PATCH /api/chat/conversas/[id]/agente`, `POST/DELETE /api/chat/conversas/[id]/etiquetas`,
`GET/POST /api/chat/etiquetas`, `GET /api/notificacoes`, `PATCH /api/conversas/[id]/status` (lê a
sessão mas não devolve 401 se ela for nula), `PATCH /api/pacientes/[id]/data-nascimento` e
`POST /api/reputacao/solicitar` (esses dois validam sessão, sem perfil).

### Shim `isAdminEquivalente` (Dona + Noryos Admin passam; os outros 4 → 403)

41 arquivos de rota: `agentes/**` (5), `audiencias`, `automacao/eventos/testar`, `campanhas/**` (10),
`conexao/apelido`, `conexao/desconectar`, `disparos/**` (9), `fluxos/**` (9),
`integrations/controle-odonto/{logs,sync,test}`, `pacientes/[id]/campanha`, `reputacao/config`.
Mais ~24 páginas. Teste por amostragem: 1 GET e 1 escrita por grupo, com Gerente e Suporte.

### Públicas (sem sessão, gate próprio)

`/api/login`, `/api/convite/[token]`, `/api/auth/forgot-password`, `/api/auth/reset-password`,
`/api/r/review/[token]`, webhook Evolution e crons (segredo próprio). `/api/logout` só middleware.

## 3. Achados de código (a confirmar no E2E; nenhum foi alterado)

Ordem por gravidade.

1. **Sessão revogada não perde acesso nas rotas de chat sem gate.** O middleware só confere a
   assinatura/validade do cookie, não `sessao_versao` nem `status`. As rotas listadas na seção
   "sem gate" não chamam `getSessaoAtual()`. Um usuário bloqueado/desativado/com senha resetada e
   com cookie ainda válido (12h) continua lendo conversas e mensagens e **enviando WhatsApp**
   (`POST /api/chat/conversas`) até o cookie expirar. Contradiz o critério "próximo request perde
   acesso imediatamente".
2. **Finalizar sem `conversas.finalizar`.** `PATCH /api/conversas/[id]/status` aceita
   `respondido/agendado/perdido` (os `STATUS_RESOLVIDOS`) de qualquer sessão, então Atendente e
   Supervisora finalizam conversa por aqui mesmo com `POST .../finalizar` devolvendo 403.
3. **Suporte redefine a senha da Dona.** `PATCH /api/equipe/[id]/senha` só checa
   `usuarios.resetar_acesso` (Suporte tem) e não aplica `podeAtribuirPerfil` nem exclui contas de
   perfil superior. Suporte pode trocar a senha da Dona e assumir a conta (a sessão da Dona é
   revogada, e o Suporte entra com a senha nova). Contradiz "Suporte não ganha poderes da Dona".
4. **Convite reativa conta bloqueada.** `aceitarConvite` faz `status:"active"` sem checar o status
   atual. Se a conta foi bloqueada/desativada depois do convite e o token ainda vale (24h), quem
   tem o link volta a ativá-la. Também não há "claim" atômico do token (janela de corrida
   pequena entre o `select` e o `update`).
5. **Permissões por pessoa sem checagem de elevação.** `PATCH .../permissoes` aceita qualquer valor
   do catálogo (inclusive `platform.*`/`suporte.*`, e para outra Dona). Hoje não há rota que use
   `platform.*`, então o impacto é baixo, mas o dado fica gravado.
6. **`PATCH /api/equipe/[id]` sem elevação quando só muda `status`.** O check de perfil só roda se
   `body.perfil` vier. Com `usuarios.editar` customizado, um Gerente poderia bloquear uma Dona
   (o guard de "última Dona" só protege quando ela é a única).
7. **Permissões de leitura não aplicadas.** `conversas.visualizar_todas/proprias` e
   `sla.visualizar_equipe` não são checadas em lugar nenhum: Atendente lista todas as conversas.
8. **Menu × página.** O menu usa permissão granular (`relatorios.visualizar`, `canais.visualizar`,
   `automacoes.visualizar`), as páginas usam o shim. Gerente e Supervisora veem "Relatórios" e
   caem num redirect. Só UX, mas confunde a validação de "menu oculto".
9. **Login de conta de plataforma com `clinica_id` nulo.** `/api/login` busca por
   `clinica_id = CLINICA` (`buscarAtendentePorUsuario`). Uma conta `noryos_admin`/`noryos_suporte`
   com `clinica_id` nulo não consegue logar. Convidada pela UI ela recebe o `clinica_id` da clínica
   do deploy (`sessao.clinicaId ?? getClinicaId()`), então funciona, mas não é "sem clínica".
10. **Rate limit em memória.** `rate-limit-login.ts`: 5 tentativas / 15 min por chave, `Map` do
    processo (zera a cada deploy, não compartilha entre instâncias). A chave de IP usa o primeiro
    valor de `x-forwarded-for`, que o cliente pode forjar. Forgot/reset/convite contam **toda**
    chamada, não só falha (5 pedidos de "esqueci a senha" por IP a cada 15 min).
11. **E-mail.** Sem `RESEND_API_KEY` o envio só loga aviso e devolve `emailEnviado:false` (o token
    é criado). Sem `APP_URL` o link sairia relativo (hoje `APP_URL` existe). `RESEND_FROM`
    opcional: fallback `Noryos <onboarding@resend.dev>`, que só entrega para o e-mail do dono da
    conta Resend. Template é HTML simples sem marca, e `nome` entra sem escape.
12. **Auditoria.** Eventos emitidos: `USER_INVITED`, `INVITE_ACCEPTED`, `ROLE_CHANGED`,
    `PERMISSIONS_CHANGED`, `USER_DISABLED`, `MEMBERSHIP_BLOCKED`, `USER_REACTIVATED`,
    `USER_UPDATED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`,
    `SUPORTE_RESETAR_SENHA`. **Não há evento próprio** para "sessão revogada", nem para "convite
    reenviado", nem para tentativa negada (403). Confirmar no banco que nenhum `detalhes` guarda
    token ou senha (`ROLE_CHANGED` grava o `body` inteiro do PATCH em `detalhes`).

## 4. Bootstrap da conta [TESTE] Dona (bloqueio circular)

Quem pode criar cada perfil pelo fluxo oficial:

- **Dona** cria gerente, supervisora, atendente. Nunca dona nem perfil de plataforma.
- **Noryos Admin** cria qualquer perfil. Hoje **não existe nenhum Noryos Admin** no banco (a
  migração das 3 contas deixou `admin`→`dona`).
- Logo `[TESTE] Dona`, `[TESTE] Noryos Admin` e `[TESTE] Noryos Suporte` **não podem ser criados
  pelo fluxo oficial**: falta um Noryos Admin para convidá-los, e o primeiro Noryos Admin não tem
  quem o convide. Já Gerente, Supervisora e Atendente saem da conta real `admin` (Dona) sem
  workaround.

Proposta mais segura, sem senha em SQL nem no chat:

1. Script local de uso único (fora do app, não vira rota) que roda com as credenciais do
   Supabase já configuradas na máquina, chama as próprias funções do projeto
   (`criarAtendenteConvidado` + `criarConvite` + `enviarEmailConvite`) e cria **só o primeiro**
   `[TESTE] Noryos Admin` como `invited`, com `clinica_id` da clínica (senão o login não o acha,
   achado 9). O token bruto vai só por e-mail; o banco guarda o hash. Você define a senha no link.
2. Com esse Noryos Admin ativo, criar pela UI/API oficial: `[TESTE] Noryos Suporte`, `[TESTE] Dona`,
   e os demais.
3. Alternativa sem script: você usa a conta `admin` real só para convidar os 3 perfis de clínica,
   e o Noryos Admin fica para o passo 1. Não recomendo logar com a `admin` real para mais do que
   isso.

Não implementei nada disso; o script precisa da sua aprovação antes de existir.

## 5. Plano do teste real (quando as variáveis e e-mails estiverem prontos)

0. Confirmar `RESEND_API_KEY` (só existência) e `RESEND_FROM`; redeploy; smoke; ver nos logs
   `resend_nao_configurado` sumir.
1. Bootstrap do Noryos Admin (seção 4) → e-mail real → link → senha → login.
2. Convite: Noryos Admin cria `[TESTE] Dona`, `[TESTE] Noryos Suporte`; Dona cria Gerente
   (`[TESTE] Gerente Convite`), Supervisora, Atendente. Para cada um: e-mail chega, link HTTPS de
   produção, token único (segundo uso falha), aceita, `status=active`, login, perfil certo.
3. Token expirado: forçar `expires_at` no passado de um convite **de teste** e tentar usar.
4. Reset: esqueci-senha com e-mail real (genérico) e inexistente (mesma resposta), link, nova
   senha, sessão antiga cai, senha antiga falha, token reutilizado falha, e-mail de confirmação.
5. Matriz de rotas (seção 2) com cada perfil: permitido → 2xx, proibido → 403, sem cookie → 401,
   inclusive as rotas "sem gate" e o shim (amostra).
6. Escalada: Atendente edita a própria permissão; Gerente vira Dona; Dona cria Noryos Admin;
   Suporte atribui perfil e troca senha da Dona (achado 3); escopo errado.
7. Última Dona: com uma Dona ativa de teste isolada, desativar/rebaixar → `ultima_dona`. Nunca na
   Dona real.
8. Sessão: logar Gerente de teste, Dona bloqueia, repetir chamadas nas rotas com e sem gate
   (achado 1), reativar, exigir novo login.
9. Auditoria: consultar `auditoria_eventos` de cada passo, sem senha/token.
10. Rate limit com o mínimo de chamadas (o limite é 5), de preferência em `forgot-password` e
    reenvio de convite, para não bloquear seu IP no login.
11. Regressão em produção (chat, SLA, horário, notas, NPS, reviews, fluxos, agentes, disparos,
    reativação, workers) por smoke e logs, sem enviar mensagem real sem sua aprovação.
