# Validação visual da Central de Alertas — 2026-09-19

Validação feita no Chrome conectado ao CRM em produção, usando somente registros `[TESTE]`.

## Resultado

- Login real com a conta temporária autorizada por Rafael: passou.
- Central de Alertas: cards, ordenação, sino e contador: passaram.
- Filtros: categoria e severidade passaram. A busca por `[TESTE UI]` expôs um erro real no escape do PostgREST; a correção em `src/lib/alertas-consulta.ts` remove os colchetes antes do `ilike`, ganhou teste unitário e foi publicada via `railway up`.
- Assumir alerta e histórico: passaram visualmente; o histórico registrou a transição para assumido.
- Chat ao Vivo: Assumir passou. Transferência de Atendente A para B passou; a conversa saiu da fila do primeiro atendente.
- A conta criada para este teste foi `qa_ui_alertas_1789788178439`. Rafael autorizou seu uso para a validação; ao final ela foi desativada, teve a senha removida e as sessões foram revogadas.

## Ainda não marcado como concluído

Resolver pela tela, links de conversa/Kanban, Configurações → Canais, RBAC visual de alertas técnicos e responsividade estreita precisam de uma passada final. Portanto, a Central de Alertas permanece em validação, sem ser marcada como concluída.

## Verificação técnica

Typecheck, lint, 908 testes e build passaram antes do deploy.
