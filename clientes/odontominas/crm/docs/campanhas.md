# Campanhas — módulo estratégico de marketing e conversão

Data: 2026-09-16. Ver plano formal em `_memoria/decisoes.md` (entrada 2026-09-16, "Campanhas —
módulo estratégico") e histórico completo em `andamento.md` do projeto OdontoMinas.

## Conceito

Cinco coisas que este CRM trata como conceitos separados, cada uma com seu dono:

| Conceito | O que é | Onde vive |
|---|---|---|
| **Campanha** | Iniciativa estratégica — objetivo, público, canais, metas, receita | `src/lib/campanhas.ts` |
| **Disparo** | Execução operacional de mensagem em massa (WhatsApp) | `src/lib/disparos.ts` |
| **Funil** | Máquina de estado da conversa (novo→respondido→agendado/perdido) | `src/lib/funil.ts`, `src/lib/status.ts` |
| **Agente de IA** | Atendimento/qualificação/continuidade da conversa | `src/lib/agentes.ts` |
| **ControleODONTO** | Fonte futura de agenda/tratamento real | `src/lib/controle-odonto/` |

**Uma campanha agrupa disparos, nunca os substitui.** `disparos.campanha_id` é a relação (1
campanha → N disparos); o motor de envio, o worker, o opt-out e o motor de público continuam
100% em `disparos.ts`/`disparos-worker.ts`/`audiencias.ts` — Campanhas não duplica nada disso.

### Por que existia uma tabela `campanhas` antes desta entrega

A Fase B de Disparos (v17, mesma data) criou uma tabela `campanhas`/`campanha_destinatarios` que
era, na prática, o que este documento chama de **Disparo** — um lote de envio, sem objetivo,
público estratégico, canal ou receita. A migração v18 renomeou essas tabelas pra
`disparos`/`disparo_destinatarios` (rename puro, sem perda de dado) pra liberar o nome `campanhas`
pro conceito novo, estratégico, criado na v19. Nenhuma funcionalidade de Disparos mudou — só o
nome das tabelas e dos símbolos em código (`Campanha`→`Disparo`, `criarCampanha`→`criarDisparo`
etc.) e o caminho da API (`/api/disparos/campanhas`→`/api/disparos/lotes`).

## Schema

- **`campanhas`** — a campanha em si. `objetivo`/`tipo`/`especialidade` são texto livre (sem
  `CHECK`) pra permitir opção nova sem migração; os catálogos sugeridos (com rótulo em PT-BR)
  vivem em código (`OBJETIVOS_CAMPANHA`/`TIPOS_CAMPANHA`/`CANAIS_CAMPANHA` em `campanhas.ts`).
  `status` é um `CHECK` fechado com 6 valores (`rascunho/agendada/ativa/pausada/concluida/
  cancelada`) — nomes em português, mesmo padrão do resto do schema; mapeiam 1:1 pros
  `draft/scheduled/active/paused/completed/cancelled` do briefing original. `metas` é `jsonb`
  livre (`{leads?, respostas?, agendamentos?, comparecimentos?, fechamentos?, receita?, cpl?,
  cpa?, roas?}`, nenhuma obrigatória). Trilha de auditoria: `criado_por/atualizado_por/
  iniciado_por/pausado_por/encerrado_por/cancelado_por` (+ `_em` correspondente), todos `uuid`
  nullable pra `atendentes`, no mesmo formato do `criado_por` que Disparos/Audiências já usavam.
- **`campanha_canais`** — 1 linha por canal selecionado (`whatsapp`, `meta_ads`, `google_ads`,
  `site`, `organico`, `indicacao`, `ligacao`, `email`, `outro`).
- **`campanha_eventos`** — log dos 5 marcos do funil: `new_lead`, `qualified_lead`,
  `appointment_booked`, `appointment_attended`, `treatment_closed`. Unique key
  `(campanha_id, paciente_id, tipo)` é a idempotência — inserir de novo o mesmo marco pro mesmo
  paciente é um no-op (`on conflict do nothing`), nunca duplica. **Não é 1 evento por mensagem
  trocada** — isso já dá pra contar direto em `mensagens`, ver "Como as métricas são calculadas".
  `valor` só existe em `treatment_closed`, preenchido manualmente (nunca inventado).
- **`disparos.campanha_id`** — FK opcional; um disparo pode nascer avulso (fluxo de sempre) ou
  vinculado a uma campanha (novo, via `/disparos/nova?campanhaId=...`).
- **`pacientes.campanha_id` / `.utm_term` / `.landing_page`** — completa a atribuição que a v14
  (Pixel) já tinha começado (`origem_lead`, `utm_source/medium/campaign/content`, `gclid`,
  `fbclid`). `campanha_id` é o vínculo manual (ver abaixo) — os outros campos de UTM/landing page
  ficam prontos pro schema, mas sem canal de preenchimento automático ainda.

**Sem tabela de métricas.** Todo número do dashboard (`src/lib/campanha-metricas.ts`) é calculado
na hora, cruzando `pacientes`/`mensagens`/`campanha_eventos`/`campanhas.investimento_real` — mesmo
padrão que `src/lib/relatorios.ts` já usa pro resto do painel. Evita uma 2ª fonte de verdade que
precisaria de invalidação.

## Por que a atribuição automática não existe (e o que existe no lugar)

A Evolution API (Baileys, WhatsApp não-oficial) **não recebe** `ctwa_clid`, UTM, `gclid` nem
`fbclid` na mensagem de entrada — isso só existe na API oficial da Meta (achado já documentado na
migração v14, Pixel de Conversão). O site institucional também não passa querystring de tracking
pro link do WhatsApp hoje. Por isso, `pacientes.campanha_id` nasce **sempre de uma escolha manual**:

- na ficha do paciente (`/pacientes/[id]`, componente `PacienteCampanhaOrigem.tsx`), ou
- no futuro, se o ControleODONTO ou uma API oficial da Meta passarem a existir de verdade.

`vincularCampanhaPaciente` (`src/lib/pacientes.ts`) é o único ponto de entrada — ele também
dispara o marco `new_lead` (idempotente) na 1ª vez que a campanha é definida.

## O que é automático vs. manual no funil da campanha

| Marco | Como acontece | Onde no código |
|---|---|---|
| `new_lead` | Automático, no momento em que alguém vincula o paciente à campanha | `pacientes.ts` → `vincularCampanhaPaciente` |
| `qualified_lead` | Automático, quando a Qualificação Automática de Leads (Agentes de IA) classifica "Quente" e o paciente tem `campanha_id` | `agentes-qualificacao.ts` → `aplicarQualificacaoAutomatica` |
| `appointment_booked` | Automático, quando um atendente muda o status da conversa pra "Agendado" e o paciente tem `campanha_id` | `conversas.ts` → `atualizarStatus` |
| `appointment_attended` | **Manual**, painel da campanha | `CampanhaEventoManual.tsx` → `POST /api/campanhas/[id]/eventos` |
| `treatment_closed` | **Manual**, exige `valor` | idem — nunca inventa receita |

Os dois marcos manuais são o ponto de extensão natural pro ControleODONTO: quando ele tiver
credencial real (`docs/integrations/controle-odonto.md`), a sincronização de agenda pode chamar
`registrarEventoCampanha(clinicaId, campanhaId, "appointment_attended" | "treatment_closed", ...)`
com a mesma assinatura — nada nesta entrega pressupõe ou simula esse dado antes de existir de
verdade.

## Como as métricas são calculadas (`src/lib/campanha-metricas.ts`)

- **Leads** = contagem de `pacientes.campanha_id = X`.
- **Respondidos** = conversas desses pacientes com pelo menos 1 mensagem `direcao = 'enviada'`
  (não depende do status da conversa — mede "a clínica respondeu de verdade").
- **Qualificados / Agendamentos / Compareceram / Fecharam** = contagem de `campanha_eventos` por
  `tipo`. **Receita** = soma de `valor` em `treatment_closed`.
- **CPL** = investimento / leads · **CPA** = investimento / agendamentos · **CAC** = investimento /
  fechamentos · **ROAS** = receita / investimento. Todas ficam `null` (escondidas na tela, nunca
  "R$0,00" nem "Infinity") quando `investimento_real` não está preenchido — item 16 do briefing,
  literal.
- **Funil visual** (`CampanhaFunil.tsx`) mostra Leads → Respondidos → Qualificados → Agendados →
  Compareceram → Fecharam. O briefing original também listava "Conversas" como etapa própria —
  omitida de propósito porque esta arquitetura garante 1 conversa por paciente (telefone único por
  clínica, decisão "path B"), então seria uma barra idêntica a "Leads" repetida, não um número novo.

## RBAC e LGPD

- Nav item "Campanhas" é `adminOnly`, mesmo padrão de Disparos/Agentes de IA/ControleODONTO (grupo
  "Ferramentas" inteiro é admin-only hoje). Toda rota de API em `/api/campanhas/*` também exige
  `papel === "admin"`.
- **Campanhas não manda mensagem.** Quem manda é sempre Disparos, que já exclui opt-out e telefone
  inválido incondicionalmente (`resolverAudiencia`/`resolverPublico`, testado). Uma campanha nunca
  abre uma brecha nova de compliance — ela só referencia audiências e disparos que já respeitam a
  regra.
- Nenhum dado novo de PII: `utm_term`/`landing_page`/`campanha_id` não são sensíveis além do que já
  existia (`utm_source` etc., v14).

## O que foi conscientemente deixado de fora desta entrega

- **Período "personalizado"** no dashboard — só os 5 períodos que já existem em
  `FiltroPeriodo`/`relatorios.ts` (hoje/7d/15d/30d/90d).
- **Chamada real a Meta Ads/Google Ads** pra puxar investimento ou conversão automaticamente.
  Investimento é sempre digitado à mão (`investimentoPlanejado`/`investimentoReal`). O Pixel de
  conversão por agente (`agentes-pixel.ts`, já em produção desde a v14) não foi alterado pra
  carregar `campanha_id`/UTM no payload — seria enriquecer uma chamada de API real sem nenhum
  tráfego pago ativo pra observar o efeito hoje, o mesmo critério que já adiou o Pixel em si até
  existir tráfego de verdade (decisão 2026-09-16). Fica documentado aqui como próximo passo natural
  quando a conta de anúncio da clínica estiver configurada.
- **Tabela/CRUD de templates.** Os 7 templates (`campanha-templates.ts`) são uma constante em
  código — só pré-preenchem o formulário, nunca disparam nada.
- **Exclusão definitiva.** Só uma campanha em `rascunho` pode ser apagada
  (`DELETE /api/campanhas/[id]`); o resto vira `cancelada` — "arquivar em vez de apagar"
  (`AGENTS.md` da raiz).
- **Motor de público novo.** Campanhas reusa `src/lib/audiencias.ts` por `audiencia_id` —
  inclusive uma rota nova, `POST /api/audiencias` (antes inexistente: `salvarAudiencia` já existia
  desde a Fase A de Disparos mas nunca tinha um chamador), permite salvar o filtro montado no
  passo "Público" do wizard como audiência reutilizável.

## Onde cada coisa fica no código

- `src/lib/campanhas.ts` — tipos, catálogos, CRUD, transições de status.
- `src/lib/campanha-eventos.ts` — registro idempotente dos 5 marcos.
- `src/lib/campanha-metricas.ts` — `calcularMetricas` (pura, testada), `calcularPainelCampanha`,
  `calcularPainelGeral` (resumo do topo de `/campanhas`), `montarRelatorioMarketing` (aba
  Marketing de Relatórios).
- `src/lib/campanha-templates.ts` — catálogo estático dos 7 templates.
- `src/components/campanhas/` — `CampanhaForm.tsx` (wizard de criação de 8 passos / abas de
  edição, mesmo componente), `CampanhaAcoes.tsx`, `CampanhaFunil.tsx`, `CampanhaEventoManual.tsx`,
  `PacienteCampanhaOrigem.tsx`, `RelatorioMarketing.tsx`.
- `src/app/(painel)/campanhas/` — lista + dashboard, criação, detalhe, edição.
- `src/app/api/campanhas/` — CRUD, transições (`agendar/iniciar/pausar/retomar/encerrar/
  cancelar`), `duplicar`, `eventos` (registro manual).
- `src/app/api/pacientes/[id]/campanha` — vínculo manual paciente↔campanha.
- `src/app/api/audiencias` — salvar audiência reutilizável (novo chamador de `salvarAudiencia`).

## Testes

Só as partes puras/determinísticas são testadas (mesmo critério do resto do projeto — nada de
mock de Supabase pra CRUD simples): `calcularMetricas` (campanha-metricas.test.ts, 5 casos,
inclusive "sem investimento esconde métrica financeira" e "nunca divide por zero"),
`isStatusCampanhaValido`/rótulos de catálogo (campanhas.test.ts), `buscarTemplate`
(campanha-templates.test.ts). Verificação fim a ponta contra o schema de produção (criar
campanha → vincular paciente → registrar os 5 marcos, inclusive testando a idempotência via
inserção duplicada → conferir métricas → limpar) documentada em `andamento.md`.
