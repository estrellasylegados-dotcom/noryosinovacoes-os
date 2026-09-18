# Identidade, login e RBAC granular

Fundação implantada em 2026-09-18 (ver `_memoria/decisoes.md` na raiz do sistema). Este documento
descreve o modelo atual — perfis, permissões, escopo, regras de elevação — pra quem for estender o
RBAC ou plugar um provider externo (ver `CONTROLE-ODONTO-IDENTITY-INTEGRATION.md`).

## 1. Os quatro conceitos, separados

- **Identidade** — `atendentes`: quem é a pessoa (nome, usuário, e-mail).
- **Autenticação** — `atendentes.senha_hash` (scrypt) + `src/lib/sessao.ts` (cookie assinado,
  revogável por `sessao_versao`). Local hoje; abstração pronta pra provider externo amanhã.
- **Membership** — hoje é `atendentes.clinica_id` direto (1 conta = 1 clínica). Não existe tabela
  `memberships` porque não existe nenhum usuário real multi-clínica ainda — ver seção 6.
- **Autorização** — `src/lib/permissoes.ts` (catálogo + defaults por perfil) e
  `src/lib/autorizacao.ts` (`can`/`requirePermission`, o ponto único de decisão).

## 2. Perfis

| perfil | escopo | resumo |
|---|---|---|
| `noryos_admin` | plataforma | todas as permissões, inclusive `platform.*` |
| `noryos_suporte` | plataforma | suporte técnico; nunca ganha `usuarios.criar/editar/gerenciar_permissoes` por padrão |
| `dona` | clínica | controle completo da própria clínica; nunca `platform.*`/`suporte.*` |
| `gerente` | clínica | operacional gerencial; sem gerenciar permissões nem config técnica |
| `supervisora` | clínica | foco em operação/equipe; sem usuários nem config |
| `atendente` | clínica | acesso mínimo operacional |

Conta de plataforma (`noryos_admin`/`noryos_suporte`) tem `clinica_id = null` — não é "admin de uma
clínica", é identidade da Noryos (seção 6/7 do pedido original que abriu esta fase).

## 3. Permissões

Catálogo completo em `src/lib/permissoes.ts` (`PERMISSOES`), agrupado por área: `usuarios.*`,
`conversas.*`, `pacientes.*`/`kanban.*`, `sla.*`, `relatorios.*`, `automacoes.*`, `canais.*`,
`configuracoes.*`, `suporte.*`, `platform.*`. Defaults por perfil em `PERFIS_PADRAO` no mesmo
arquivo — comentado ponto a ponto com a razão de cada inclusão/exclusão.

**Perfil não é a fonte final de verdade.** Se `atendentes.permissoes_customizadas` não for `null`,
ele substitui o default por inteiro (`resolverPermissoes`) — é o que dá à Dona/Noryos Admin o poder
de customizar por pessoa (tela em `/equipe`, endpoint `PATCH /api/equipe/[id]/permissoes`). Lista
vazia (`[]`) zera as permissões de propósito — só `null` volta pro default do perfil.

## 4. Autorização central

Nunca checar `perfil === "x"` numa rota nova. Usar:

```ts
const auth = await requirePermission("sla.configurar");
if ("erro" in auth) return auth.erro;
const { sessao } = auth;
```

`can(sessao, permissao)` pra checagem sem 401/403 automático (ex.: dentro de um Server Component
decidindo o que renderizar). `getSessaoAtual()` (`src/lib/sessao-servidor.ts`) sempre lê o banco —
perfil, status e permissões nunca vêm só do cookie, pra bloqueio/mudança de permissão surtir efeito
imediato sem esperar o token expirar (ver seção 8).

### Compatibilidade deliberada: `isAdminEquivalente`

Dezenas de telas que já existiam antes desta fase (Agentes, Campanhas, Disparos, Fluxos, Conexão,
Reputação, ControleODONTO, Resumo) usavam `papel === "admin"` como gate único. Aplicar o catálogo
granular em todas elas não era o escopo desta fase (que mirou Chat ao Vivo/SLA/Horário/Notas
Internas/Equipe). `isAdminEquivalente(sessao)` (`src/lib/autorizacao.ts`) = `perfil === "dona" ||
perfil === "noryos_admin"` preserva 100% do comportamento anterior sem regressão. Migrar essas telas
pra permissões granulares (`automacoes.*`, `canais.*`, `configuracoes.integracoes`) é trabalho de uma
fase seguinte — a lista de arquivos que ainda usa o atalho está em qualquer grep por
`isAdminEquivalente`.

## 5. Regra de elevação (privilege escalation)

`podeAtribuirPerfil(atorPerfil, perfilAlvo)` em `permissoes.ts`:

- `noryos_admin` atribui qualquer perfil, inclusive outro `noryos_admin`/`noryos_suporte`.
- `dona` atribui só `gerente`/`supervisora`/`atendente` — nunca `dona` nem perfil de plataforma.
- os demais perfis não atribuem nenhum.

Aplicado nos dois sentidos em `PATCH /api/equipe/[id]` (o ator precisa poder atribuir o perfil de
destino **e** já poder atribuir o perfil atual do alvo) e em `POST /api/equipe` na criação. Ninguém
edita a própria conta por essas rotas (bloqueia auto-promoção). Última Dona ativa de uma clínica não
pode ser rebaixada/desativada (`seriaUltimaDonaAtiva` em `atendentes.ts`) — mesmo espírito do guard
antigo de "último admin".

## 6. Por que não existe `memberships` ainda

O pedido original desenhava `usuario → membership → clínica`. Não implementamos a tabela agora:
hoje é 1 clínica por deploy (arquitetura "path B", ver `_contexto/infra.md`) e nenhum usuário real
participa de duas clínicas. `atendentes.clinica_id` (nullable, pra contas de plataforma) já cobre o
caso real. Nada aqui trava o futuro: quando existir uma 2ª clínica com usuário compartilhado,
`memberships` entra como tabela nova (usuario_id, clinica_id, perfil, status, aprovado_por, ...) sem
precisar reconstruir identidade, autenticação nem o catálogo de permissões.

## 7. Status e ciclo de vida

`atendentes.status`: `invited → active` (aceitou convite) ou `→ blocked`/`→ disabled` (ação
administrativa) `→ active` de novo (reativação). `ativo` (boolean legado) é sempre derivado de
`status` (`ativo = status === "active"`) — mantido em sincronia pra não quebrar código antigo que
ainda filtra por ele.

Convite (`src/lib/convites.ts`): token de 32 bytes, só o hash SHA-256 persiste, validade 24h, uso
único. Reset de senha (`src/lib/reset-senha.ts`): mesmo desenho, validade 30min. Os dois invalidam
qualquer outro token pendente da mesma conta ao serem usados.

## 8. Sessão revogável

Cookie carrega só `atendenteId:sessaoVersao:expiraEm` assinado (`src/lib/sessao.ts`, Edge-safe).
`sessao_versao` (coluna em `atendentes`) é o mecanismo de revogação: bloquear, desativar, resetar
senha ou trocar senha via `/equipe` incrementa a versão — todo token emitido antes passa a divergir e
é rejeitado em `getSessaoAtual()`. Não existe sessão por dispositivo (isso pediria uma tabela de
sessões por token, fora do escopo desta fase) — dá pra "encerrar tudo de uma vez", não "encerrar só o
Chrome".

## 9. Auditoria

`auditoria_eventos` (append-only): `USER_INVITED`, `INVITE_ACCEPTED`, `USER_UPDATED`,
`USER_DISABLED`, `USER_REACTIVATED`, `MEMBERSHIP_BLOCKED`, `ROLE_CHANGED`, `PERMISSIONS_CHANGED`,
`PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `SUPORTE_RESETAR_SENHA`. Nunca grava senha
nem token puro. `registrarEvento` (`src/lib/auditoria.ts`) nunca derruba o fluxo principal por falha
de escrita — loga e segue.

## 10. Pendências conhecidas desta fase

- Migrar `isAdminEquivalente` pra permissões granulares nas telas que ainda usam o atalho (seção 4).
- Tela de permissões (checkboxes por grupo, seção 39 do pedido) — hoje só a API
  (`PATCH /api/equipe/[id]/permissoes`) existe; a UI de customização por pessoa ainda não.
- "Sessões Ativas" por dispositivo (Minha Conta) — hoje só existe revogação global (seção 8).
- Envio de e-mail depende de `RESEND_API_KEY`/`RESEND_FROM`/`APP_URL` configuradas no Railway — sem
  isso, convite/reset criam o token normalmente mas o e-mail não sai (log de aviso, nunca erro fatal).
- `noryos_admin`/`noryos_suporte` reais ainda não existem em produção — as 3 contas atuais
  (`admin`→`dona`, `recepcao1`/`recepcao2`→`atendente`) são as únicas migradas até aqui.
