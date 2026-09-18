# ControleODONTO como provider de identidade — desenho futuro

Não implementado. Este documento existe pra a arquitetura de identidade/RBAC (ver `docs/RBAC.md`)
não precisar ser reconstruída quando o ControleODONTO virar fonte de identidade — hoje não há
credencial nem documentação de API confirmada (ver `docs/integrations/controle-odonto.md`, que trata
da integração de agenda/paciente, uma coisa separada desta).

## 1. Arquitetura que já existe pra suportar isto

```
usuário Noryos (atendentes)
  ↑ 1:N
identidade externa (identidades_externas) — schema pronto, tabela vazia
  provider, provider_subject, provider_tenant_id, external_email, metadata, last_sync_at
```

`identidades_externas` (migration `2026-09-18_v28_identidade_rbac.sql`) já existe em produção, sem
nenhuma capability ligada. Ver seção 2 do `RBAC.md` pro porquê de cada tabela existir ou não existir
ainda.

## 2. Identidade local

`atendentes` continua sendo o registro de identidade Noryos — nome, usuário (login), e-mail,
perfil, status, `clinica_id`. Nunca é substituído por um provider externo; é vinculado a ele.

## 3. Memberships

Não existe tabela `memberships` hoje (ver `RBAC.md` seção 6) — `atendentes.clinica_id` cobre o caso
de 1 clínica por conta. Quando o ControleODONTO trouxer usuário multi-clínica de verdade, essa
tabela nasce nesse momento, não antes.

## 4. External identity e account linking

- **Chave nunca é e-mail** — e-mail muda. A chave é `(provider, provider_subject)`, único na tabela
  (constraint já criada). `provider_subject` é o ID estável que o ControleODONTO usa internamente.
- **Linking nunca é automático por e-mail batendo.** Um usuário Noryos existente (`Maria`,
  `maria@...`) só ganha uma `identidade_externa` através de um processo explícito e auditado (ainda
  a desenhar quando a integração real existir) — nunca "encontrei o e-mail, é a mesma pessoa".
- Se o mesmo `provider_subject` chegar de novo (sync repetido, re-provisionamento), não duplica —
  é upsert por `(provider, provider_subject)`.
- `identidade_externa` sem `membership`/conta Noryos correspondente não abre sessão nenhuma — login
  via provider externo sempre passa por uma conta `atendentes` real.

## 5. Ownership dos dados

Provider externo pode ser fonte de verdade pra: nome, e-mail, status profissional, vínculo
organizacional. **Noryos continua fonte de verdade pra**: perfil Noryos, permissões, acesso,
automações, canais, configurações internas. Nenhum sync externo promove alguém a `dona` ou
`noryos_admin` sozinho — isso é sempre uma ação humana dentro do Noryos (`podeAtribuirPerfil`, ver
`RBAC.md` seção 5).

## 6. Provider abstraction

Depois de autenticado, o resto da aplicação trabalha só com `userId` (`atendenteId`), `clinicaId` e
`permissoes` resolvidas (`SessaoAtual` em `src/lib/sessao-servidor.ts`) — nunca sabe se o login foi
local ou via provider externo. Isso já é verdade hoje (a sessão não carrega "como a pessoa entrou"),
então plugar um segundo provider não pede mudar nenhum consumidor de `getSessaoAtual()`.

## 7. Caminhos possíveis (nenhum implementado)

**Caso A — OIDC**: ControleODONTO → Authorization Code + PKCE → callback Noryos → validar
issuer/audience/nonce → `subject` → grava/atualiza `identidades_externas` → resolve `atendentes` →
sessão Noryos normal (`criarTokenSessao`).

**Caso B — API proprietária / webhook**: ControleODONTO → webhook de provisionamento → cria
`atendentes` (status `pending_approval`) + `identidades_externas` → login continua local (senha
Noryos) até a Dona/Noryos Admin aprovar.

**Caso C — sync periódico**: ControleODONTO → sincroniza usuários → Noryos cria memberships
`pending_approval` (quando `memberships` existir) → aprovação manual, nunca automática.

Nenhum destes tem endpoint implementado. `CONTROLE_ODONTO_ENABLED`/capabilities seguem o mesmo padrão
de `docs/integrations/controle-odonto.md`: nasce desligado, só liga depois de credencial real
confirmada.

## 8. Segurança

Mesmas regras do resto do sistema (ver `RBAC.md` seções 5-9): backend decide permissão, nunca o
provider; token de qualquer fluxo de account linking segue o mesmo padrão de convite/reset (só hash
persiste, uso único, expiração curta); desativação de conta revoga sessão (`sessao_versao`) e
preserva histórico, nunca apaga.

## 9. Informações a solicitar ao ControleODONTO antes de qualquer implementação real

- Documentação da API (autenticação, endpoints, versionamento).
- Ambiente de sandbox/homologação.
- Endpoint de usuários (lista, detalhe, status).
- Endpoint de clínicas/estabelecimentos.
- ID estável de usuário (`provider_subject`) — nunca e-mail como chave.
- ID estável de clínica.
- Webhooks disponíveis (criação/edição/desligamento de usuário).
- Suporte a OAuth/OIDC (Authorization Code + PKCE, discovery document).
- Scopes disponíveis.
- Suporte a refresh token.
- Fluxo de logout/revogação do lado do ControleODONTO.
- Como desativar um usuário (e se isso é refletido de volta pro Noryos).
- Rate limits da API.
