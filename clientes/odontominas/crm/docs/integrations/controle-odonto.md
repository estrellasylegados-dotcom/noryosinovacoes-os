# Integração ControleODONTO

Camada de sincronização entre o CRM OdontoMinas e o ControleODONTO (sistema de gestão da própria
clínica — agenda, prontuário, financeiro). O CRM nunca substitui essa camada: ele só sincroniza o
que precisa pra funil, atendimento e automações (ver decisão 2026-09-14 em `_memoria/decisoes.md`
da raiz do sistema).

Código em `src/lib/controle-odonto/`. Última pesquisa/validação desta página: **2026-09-16**.

## 1. Pesquisa técnica (Fase 0)

Separado por nível de confiança, igual ao pedido original. **Nunca tratar "relatado por terceiro"
ou "citado no brief" como contrato de API.**

### Confirmado oficialmente

- O site oficial (`controleodonto.com.br`) anuncia possuir uma **API aberta**, "pra conectar a
  ferramentas que você já usa" — texto de marketing, sem detalhe técnico.
- Existe um manual oficial em GitBook: `controleodonto.gitbook.io/guia`, com 4 seções de topo
  (Administrador, Dentista, Recepção, Financeiro).
- Dentro de Administrador, existe a trilha `5.1 Serviços Adicionais → 5.1.5 Integrações -
  Webhooks → 5.1.5.1 Integrações - Autenticações Webhooks`. **Verificado diretamente nesta
  pesquisa (2026-09-16): as duas páginas existem no índice, mas o título de ambas está
  literalmente prefixado `(FAZER)` e o conteúdo é só o título — nenhuma delas tem uma frase sequer
  de documentação.** Ou seja: a documentação pública de webhook/autenticação existe como
  estrutura, mas está vazia.
- Fora dessa trilha, o índice completo do manual (`llms.txt`) não lista nenhuma página de "API
  REST", "endpoints", "autenticação de API", "Swagger/OpenAPI" ou versão (v6). A documentação
  pública cobre só o uso funcional do sistema pela equipe da clínica, não o contrato de API.

### Confirmado por evidência pública

- **Nenhuma, de forma independente por esta pesquisa.** O brief original desta tarefa citava
  `GET /v6/Agendamento/Estabelecimento/{dataInicio}/{dataFim}` como "endpoint publicamente
  documentado/confirmado por evidência externa". Esta pesquisa (busca por texto exato, GitHub,
  Postman, cache) **não conseguiu localizar essa evidência de forma independente** — o endpoint
  não aparece indexado em nenhum lugar acessível a esta pesquisa. Ele fica registrado no código
  (`appointments.ts`, `ENDPOINT_AGENDAMENTO_POR_ESTABELECIMENTO_CANDIDATO`) só como **candidato**,
  explicitamente marcado como não confirmado de forma independente — nunca chamado de verdade
  enquanto a capability de leitura não estiver confirmada contra uma conta real.
- Também não foi localizada nenhuma URL base (`api.aplicativo.net` responde 404; não há
  subdomínio de API público conhecido), nem qualquer evidência de formato de autenticação.

### Relatado por integração de terceiros

- **Cloudia** (`cloudia.com.br/integracao/controle-odonto`) anuncia comercialmente uma integração
  que consulta horários disponíveis, cria agendamentos, envia lembretes de consulta e dispara
  pesquisa de satisfação, com "agenda sincronizada automaticamente" e implementação "em até 30
  dias". Página de marketing, **zero detalhe técnico** (sem endpoint, payload, autenticação). Serve
  só como indício de que capacidades de leitura *e escrita* existem pra parceiros/integradores
  certificados — não como contrato utilizável.
- Não foram encontradas outras integrações de terceiro com detalhe técnico adicional (n8n/Make/
  Zapier não têm nó nativo documentado publicamente para ControleODONTO).

### Não confirmado (nada disto foi assumido no código)

- URL base da API real.
- Mecanismo de autenticação (API Key, Bearer, Basic, OAuth, 2FA por app — o site menciona 2FA por
  Google Authenticator pro *login humano* do painel, o que não é o mesmo que autenticação de API).
- Qualquer endpoint de paciente, criação, atualização, cancelamento de agendamento.
- Payloads de requisição/resposta, parâmetros obrigatórios, formato de data.
- Rate limits.
- Formato de webhook (mesmo a área existindo na doc, está vazia).
- Códigos de erro específicos do provedor.
- O endpoint de agenda citado no brief original (ver acima).

Há relatos públicos (fora desta pesquisa, mencionados no brief original) de instabilidade recente
em endpoints da API — não verificados de forma independente aqui, mas tratados como plausíveis:
o conector inteiro foi desenhado com timeout, retry, backoff e circuit breaker por causa disso,
não seria diferente mesmo que a instabilidade não fosse real.

## 2. Arquitetura

```
src/lib/controle-odonto/
  config.ts          configuração (env vars), nunca credencial hardcoded
  types.ts           tipos compartilhados, decoupled do payload real
  errors.ts          códigos de erro + classes internas de controle de fluxo
  capabilities.ts    liga/desliga cada capacidade — só manual, nunca automático
  auth.ts            abstração de autenticação (mecanismo real ainda não existe)
  client.ts          HTTP GET com timeout, retry, backoff e jitter
  mapper.ts          mapeamento de status externo → interno (hoje vazio)
  appointments.ts    getAppointments / createAppointment / cancelAppointment / rescheduleAppointment
  patients.ts        matching de paciente (id externo → telefone → CPF → e-mail → needs_review)
  professionals.ts   placeholder (sem endpoint dedicado confirmado)
  establishments.ts  resolve o id do estabelecimento a partir de config
  external-ids.ts    mapeamento genérico id-local ↔ id-externo (tabela `external_ids`)
  lock.ts            lock distribuído (tabela `integration_locks`)
  sync-state.ts      checkpoint + saúde da integração (tabela `integration_sync_state`)
  sync-log.ts        auditoria de cada tentativa (tabela `integration_sync_log`)
  sync.ts            orquestração: janela incremental, lock, idempotência
  reconcile.ts        comparação local × remoto (diagnóstico, nunca apaga nada sozinho)
```

Escolha de local: `src/lib/controle-odonto/` (subpasta de `src/lib/`, mesmo padrão de organização
do resto do CRM — não `src/integrations/`), porque este projeto não tem outra pasta de topo além
de `lib`/`app`/`components` e introduzir uma nova só pra esta integração quebraria a convenção
existente sem ganho real.

`provider` é texto livre no banco (`controle_odonto` por padrão) de propósito: a mesma estrutura
(`external_ids`, `integration_sync_log`, `integration_sync_state`, `integration_locks`) deve servir
outro ERP odontológico (ex. Clinicorp) no futuro, sem migration nova — só uma nova pasta em
`src/lib/<provider>/`.

## 3. Capabilities

| capability | hoje | por quê |
|---|---|---|
| `canReadAppointments` | `false` | endpoint candidato existe (não confirmado de forma independente), mas autenticação nenhuma foi validada |
| `canCreateAppointments` | `false` | nenhum endpoint de escrita confirmado publicamente |
| `canUpdateAppointments` | `false` | idem |
| `canCancelAppointments` | `false` | idem |
| `canReadPatients` | `false` | nenhum endpoint confirmado |
| `canCreatePatients` | `false` | nenhum endpoint confirmado |
| `canReceiveWebhooks` | `false` | área de documentação pública marcada "(FAZER)", vazia |

Cada capability só vira `true` manualmente em `src/lib/controle-odonto/capabilities.ts`, depois de
alguém confirmar contra uma conta real (ver checklist abaixo). Nunca liga sozinha por env var.

## 4. Variáveis de ambiente

Ver `.env.example`. Nenhuma credencial de autenticação está listada ainda — o mecanismo não está
confirmado, então não existe uma variável tipo `CONTROLE_ODONTO_API_KEY` até isso ser validado
(criar junto com a implementação real de `auth.ts` nesse momento).

```
CONTROLE_ODONTO_ENABLED=false
CONTROLE_ODONTO_BASE_URL=
CONTROLE_ODONTO_ESTABELECIMENTO_ID=
CONTROLE_ODONTO_SYNC_ENABLED=false
CONTROLE_ODONTO_SYNC_INTERVAL_MINUTES=5
CONTROLE_ODONTO_SYNC_MARGEM_HORAS=24
CONTROLE_ODONTO_SYNC_HORIZONTE_DIAS=30
```

## 5. Como configurar (quando houver credencial)

1. Preencher `CONTROLE_ODONTO_BASE_URL` e `CONTROLE_ODONTO_ESTABELECIMENTO_ID` no Railway.
2. Seguir a checklist da seção 8 (Fase de Descoberta com Credencial) **antes** de tocar
   `capabilities.ts`.
3. Só depois de validar auth + endpoint de verdade contra a conta real, implementar o provider
   real em `auth.ts` (ex. `ApiKeyAuthProvider`) e ligar a(s) capability(ies) confirmada(s).
4. `CONTROLE_ODONTO_ENABLED=true` liga a integração; `CONTROLE_ODONTO_SYNC_ENABLED=true` liga o
   polling automático (cron). Nenhum dos dois, sozinho, faz uma chamada de escrita.

## 6. Como testar a conexão

Painel → Ferramentas → ControleODONTO → "Testar conexão" (admin), ou:

```
POST /api/integrations/controle-odonto/test
```

Nunca cria paciente/agendamento real — é sempre leitura, e só chega a chamar a API de verdade se
`canReadAppointments` estiver confirmada.

## 7. Como rodar o primeiro sync

Painel → Ferramentas → ControleODONTO → "Sincronizar agora" (admin), ou:

```
POST /api/integrations/controle-odonto/sync
```

Serializado por lock (`integration_locks`) — dois disparos ao mesmo tempo (botão + cron) nunca
rodam juntos, o segundo recebe `status: "ocupado"`. Enquanto `canReadAppointments` for `false`,
responde `status: "aguardando_credencial"` sem tentar nenhuma chamada.

O cron (`POST /api/cron/controle-odonto-sync`, autenticado por `CRON_SECRET` — mesmo segredo já
usado pelo cron de reativação) existe e está pronto, mas **não tem um agendamento do GitHub
Actions criado ainda** — decisão consciente desta entrega: criar um workflow que roda a cada 5
minutos indefinidamente, antes de a integração ter qualquer capability real, gastaria minutos de
Actions à toa. Criar `.github/workflows/odontominas-crm-controle-odonto-sync.yml` (mesmo padrão de
`odontominas-crm-reativacao.yml`) quando `canReadAppointments` for confirmada.

## 8. Como ver os logs

Painel → Ferramentas → ControleODONTO → "Ver logs", ou `GET /api/integrations/controle-odonto/logs`
(filtros `status`, `direction`, `resource` via query string). Nunca grava senha, token, header de
autorização ou payload clínico completo — só o necessário pra diagnosticar (ver `sync-log.ts`).

## 9. Checklist

- [ ] credencial obtida
- [ ] conexão validada (auth real confirmada — qual mecanismo é, de fato)
- [ ] estabelecimento identificado
- [ ] leitura de agenda validada (endpoint + payload de resposta real, não o candidato)
- [ ] mapeamento de status validado (`mapper.ts` preenchido com valores reais)
- [ ] polling funcionando (workflow do GitHub Actions criado)
- [ ] idempotência validada com dado real
- [ ] logs funcionando
- [ ] escrita confirmada oficialmente (endpoint + payload + resposta)
- [ ] criação de agenda testada (sandbox/homologação, nunca direto em produção)
- [ ] cancelamento testado
- [ ] webhook confirmado ou descartado
- [ ] produção liberada

## 10. Riscos conhecidos

- Nenhuma capability real hoje — todo valor de negócio desta entrega é a arquitetura pronta, não
  sincronização acontecendo de verdade.
- O endpoint de agenda citado no brief original não foi confirmado de forma independente por esta
  pesquisa (ver seção 1) — pode estar certo, desatualizado, ou nem existir mais.
- Relatos de instabilidade da API do provedor não foram verificados de forma independente, mas o
  conector já foi desenhado assumindo que são reais (retry/backoff/circuit breaker).
- Prefixo `provider` livre (sem `check` no banco) significa que um erro de digitação no código
  (ex. `"controle_odont"`) não seria pego pelo banco — mitigado por ser uma constante única
  (`PROVIDER`) reaproveitada em todos os arquivos, nunca digitada solta.

## 11. Próximos passos

1. Obter credencial de teste/homologação com o ControleODONTO (ou com o suporte deles, pedindo a
   documentação real de API/Webhooks que a área pública ainda não publicou).
2. Seguir a checklist da seção 9 com a credencial em mãos.
3. Preencher `mapper.ts` com os valores reais de status assim que a API responder de verdade.
4. Ajustar `appointments.ts` (endpoint, formato de data, formato de resposta) com o contrato real.
5. Só então avaliar habilitar `canReadAppointments`, criar o workflow de polling, e seguir pra
   escrita (criação/cancelamento) com a mesma disciplina de "não inventar contrato".
