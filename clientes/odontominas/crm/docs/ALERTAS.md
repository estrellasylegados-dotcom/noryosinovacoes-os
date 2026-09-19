# Central de Alertas Operacionais

Alerta **não é log** e **não é notificação descartável**: é uma condição que exige ação humana, com
dono, prioridade, deduplicação, ciclo de vida e histórico. Migration: `v35_alertas_operacionais`.

## Arquitetura (um motor só)

```
EVENTO (resposta humana, conversa assumida, oportunidade movida, mensagem falhou)  ─┐
                                                                                    ├─► Condicao ─► aplicarCondicao / liberarAlerta ─► alertas
VERIFICADOR TEMPORAL (1 min, sob lock: SLA, sem dono, etapa parada, canal, fluxo) ──┘
```

- `alertas-tipos.ts` — puro: tipos, severidade, transições, visibilidade, chaves de dedupe, destinos.
- `alertas.ts` — único lugar que grava: criar/escalar/deduplicar, encerrar, ações humanas, histórico, auditoria.
- `alertas-detectores.ts` — estado atual → condições (decisões puras testadas; I/O só com filtro por estado/data).
- `alertas-verificador.ts` + `alertas-worker.ts` — **um** verificador (não um worker por tipo), lock `integration_locks`
  provider `alertas`, iniciado em `instrumentation.ts` como os demais workers.
- `alertas-consulta.ts` — lista/busca/resumo; contexto em 1 consulta por tipo de entidade (sem N+1).
- `alertas-config.ts` — configuração mínima. `alertas-http.ts` — cola das rotas.
- Rota `POST /api/cron/alertas` (segredo `x-cron-secret`): uma verificação sob demanda, mesmo lock do worker.

## O que foi reaproveitado (e o que NÃO foi criado)

| Existente | Uso |
|---|---|
| `sla.ts` | `statusSlaDoCiclo` extraído do cálculo existente (único cálculo; Chat, resumo e alertas passam por ele). `sla_config.alerta_percentual` é a faixa de atenção — nada duplicado. |
| `oportunidades.estagio_entrou_em` | relógio da oportunidade parada (reinicia a cada movimento). |
| `verificarSaudeCanal` / `canais.status` | canal ao vivo no provedor, com carência. |
| `fluxo_execucoes.estado` (`failed`, `queued/running/waiting_*`) | falha e travamento por estado real, sem heurística. |
| `enviarComRetry` (fluxo) | alerta só após esgotar tentativas. |
| `auditoria_eventos` | `ALERTA_ASSUMIDO/RESOLVIDO/IGNORADO`, `ALERTAS_CONFIG_ALTERADA`. |
| `PERMISSOES`/`PERFIS_PADRAO` | quem vê cada tipo = permissão que já existe (`canais.visualizar`, `kanban.visualizar`…). |
| padrão worker + `integration_locks` | mesmo desenho de `fluxo-worker`/`disparos-worker` (`fluxo-lock` ganhou parâmetro `provider`). |
| horário de atendimento | minutos úteis também para "sem responsável" e "etapa parada". |

Não existe barramento de eventos genérico no projeto (`emitirEventoAutomacao` é a ponte para Fluxos), então
**não foi criado um**: os "eventos" de alerta são chamadas diretas de 4 pontos (chat, atribuição, kanban, fluxo).

## Modelo

`alertas` (id, clinica_id **nullable**, tipo, categoria, natureza, severidade, status, titulo, descricao,
tipo_entidade, entidade_id, responsavel_id, chave_deduplicacao, **chave_ativa**, dados, timestamps de
detecção/visualização/assumido/resolvido/ignorado + quem + `resolvido_por_evento`), `alerta_historico`,
`alertas_config`, `alertas_kanban_regras`.

- Status: `aberto → assumido → resolvido`, `aberto → resolvido`, `aberto|assumido → ignorado`. UI em português.
- Severidade: `informativo`, `atencao`, `critico` (ícone + texto, nunca só cor).
- Categorias (texto livre no banco): SLA, CONVERSA, KANBAN, CANAL, MENSAGEM, FLUXO, INTEGRACAO, SISTEMA.
- `natureza`: `operacional` × `tecnico` (base do Noryos Ops). `clinica_id` nulo = alerta de plataforma (futuro).

## Deduplicação e nova ocorrência

`chave_ativa` = chave de dedupe enquanto a **condição existir**; `NULL` = liberada. Índice único
`(coalesce(clinica_id, 0), chave_ativa)` — `NULL` não conflita, então: 2 processos criando juntos = 1 linha (o 2º
recebe 23505 → "deduplicado"); condição resolvida que volta = **alerta novo**. Resolver/ignorar à mão **não**
libera a chave (senão a condição viva reabriria em 1 min); quem libera é o verificador quando a condição acaba.
Piora de severidade **reabre** um alerta ignorado/resolvido à mão (não esconder o crítico).

Chaves: SLA `sla:conversa:ciclo(msg)`; sem responsável `sem_resp:conversa:ciclo`; Kanban
`kanban_parada:oportunidade:etapa:regra`; canal `canal:id`; fluxo `fluxo_falhou|fluxo_preso:execucao`;
mensagem `msg_falha:fluxo:execucao:passo`; disparo `disparo_falhas:id`.

## Tipos

| Tipo | Quando | Resolve |
|---|---|---|
| `sla_limite` | SLA ativo, ciclo aberto na faixa de atenção (atenção) ou estourado (**mesmo alerta** vira crítico). Responsável = dono da conversa; sem dono = equipe. SLA pausado (fora do expediente) suspende, não resolve. | resposta humana (evento) / ciclo fecha |
| `conversa_sem_responsavel` | novo/aguardando, sem dono, dono_conversa humano, mais que X min úteis (config, padrão 10). Não alerta se Fluxo/IA está no controle. Suprimido quando o SLA já está **estourado** (mesmo problema). | assumir/transferir (evento) / verificador |
| `oportunidade_parada` | tempo por etapa (config; inicial: Novo 30 min, Follow-up 3 dias). Não repete se a conversa já tem alerta de SLA. Teto 100 por regra. | mover de etapa (evento) |
| `canal_desconectado` | canal ativo `disconnected`/`error` ao vivo por mais que a carência (padrão 2 min). `unknown` ≠ queda. | canal volta / é pausado |
| `mensagem_falha_definitiva` | envio do Fluxo falhou após retentativas e a causa **não** é canal fora (esse tem alerta próprio). Só por evento. | pessoa |
| `disparo_falhas` | disparo concluído com falhas do próprio envio (exclui erros de canal), janela 7 dias. | pessoa |
| `fluxo_falhou` | `fluxo_execucoes.estado='failed'` (7 dias, máx. 20, sem teste, sem `opt_out` nem `recovery_apos_restart`). | pessoa |
| `fluxo_preso` (**técnico**) | `queued/running` sem atualizar, ou `waiting_*` vencido, há > 15 min. | motor retoma |

**Fadiga**: não viram alerta — 1ª falha transitória de envio; falha de envio manual no Chat (a pessoa vê o erro na
hora); `recovery_apos_restart` (a cada deploy); canal com `unknown`; SLA pausado; `opt_out`. Vão para log.

## Permissões e visibilidade (backend)

Novas: `alertas.visualizar|assumir|resolver|ignorar|configurar` e `alertas.tecnicos` (ver/operar técnicos — a 6ª
permissão, necessária para separar técnico de operacional).

| Perfil | Vê | Age |
|---|---|---|
| atendente | SLA/sem dono/Kanban **próprios + fila sem dono** | assumir, resolver |
| supervisora | equipe (`conversas.visualizar_todas`) + canal | assumir, resolver |
| gerente | equipe + canal | + ignorar |
| dona | tudo operacional da clínica | + configurar |
| noryos_suporte | canal + **técnicos** | assumir, resolver (não ignora) |
| noryos_admin | tudo | tudo |

Visibilidade é filtrada no SQL (`montarFiltroVisibilidade`) e checada de novo em cada ação
(`avaliarAcaoHumana`): alerta invisível ou de outra clínica → **404** (não vaza existência); sem permissão → 403;
transição inválida → 409 (compare-and-set: 2 pessoas assumindo, 1 vence).

## API

`GET /api/alertas` (situacao, severidade, categoria, responsavel, de, ate, busca, pagina) · `GET /api/alertas/resumo`
· `GET /api/alertas/:id` (+histórico) · `POST /api/alertas/:id/{assumir|resolver|ignorar}` · `GET|PUT /api/alertas/config`
· `POST /api/cron/alertas`.

## Interface

Menu **Alertas** (com contador) · sino de alertas no cabeçalho (só abertos críticos+atenção; sem toast, sem
notificação do navegador) · `/alertas` (críticos → atenção → outros; filtros; busca por paciente/telefone/título;
histórico) · `/configuracoes/alertas`. Links diretos: `/chat?conversa=`, `/kanban?card=`, `/configuracoes/canais?canal=`.

## Desempenho

Verificador 1/min. Consultas por estado/data com índices parciais (`alertas_condicao_viva_idx`,
`alertas_abertos_idx`, `oportunidades_board_idx`). Ordem por severidade é feita em JS (fila ativa pequena; texto
ordenaria "atencao" < "critico"). **Limite conhecido**: SLA/sem-dono fazem 2 consultas de mensagens por conversa
candidata (novo/aguardando); ver "Riscos" no relatório final.

## Futuro Noryos Ops

`natureza='tecnico'` + `clinica_id` nulo (plataforma) + `tipo`/`categoria` livres: Ops pode consumir `alertas`
cross-clínica (`categoria in CANAL, FLUXO, INTEGRACAO, SISTEMA`), `alertas_config.ultima_verificacao_*` (batimento do
verificador por clínica) e `canal_desconectado`, sem novo motor. Novos tipos = 1 linha em `TIPOS_ALERTA` + 1 detector.
