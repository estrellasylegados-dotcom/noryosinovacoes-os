# Automações comerciais orientadas ao Kanban

Data da implementação: 2026-09-20

## Arquitetura

A mudança estende o motor de Fluxos existente. `oportunidade_historico` produz um evento transacional em `automacao_eventos`; o `fluxo-worker` existente consome esse evento, cria uma `fluxo_execucao` vinculada à oportunidade e continua usando os mesmos nós, esperas, condições, `waiting_input`, canais e histórico técnico.

Não foram criados outro worker, outra tabela de execução, outro agendador ou outro sistema de condições.

## Comportamento entregue

- Gatilhos por entrada, saída e permanência em etapa, além de Convertido e Perdido.
- Contexto por oportunidade, com paciente, conversa, canal, responsável, pipeline e etapa revalidados no banco antes de cada efeito.
- Cancelamento por saída da etapa, encerramento da oportunidade, resposta do paciente e intervenção humana.
- Políticas de reentrada: por entrada, uma vez por oportunidade e sempre.
- Dedupe protegido por índice e criação atômica no PostgreSQL.
- Claim com token e `FOR UPDATE SKIP LOCKED`, impedindo dois workers no mesmo passo.
- Registro da intenção antes de contato externo. Timeout e resposta 5xx viram entrega incerta e não são repetidos cegamente.
- Canal resolvido pela conversa; quando não existe conversa, reutiliza a regra central de criação pelo canal principal da clínica.
- Horário comercial reutiliza a configuração de horário da clínica.
- Cadeia de origem e limite de profundidade bloqueiam ciclos entre automações que movem oportunidades.
- Falhas definitivas alimentam a Central de Alertas com chave idempotente.
- Histórico operacional aparece no detalhe da oportunidade; diagnóstico técnico aparece no editor para quem possui `automacoes.visualizar_execucoes`.
- Novas automações nascem pausadas. Pausar permite escolher se execuções já iniciadas continuam ou são interrompidas.
- Publicação é atômica e versões publicadas ficam imutáveis.
- Validação de servidor confere referências da clínica sem enviar mensagem.
- Templates: Follow-up de orçamento, Lead sem responsável e Acompanhamento de qualificado.

## RBAC

Foram adicionadas as permissões `automacoes.ativar`, `automacoes.pausar` e `automacoes.visualizar_execucoes`. As rotas e a interface usam permissões granulares. O perfil Dona recebe o conjunto completo por padrão; os demais perfis dependem do catálogo ou de permissões personalizadas.

## Migração v36

Arquivo: `supabase/migrations/2026-09-19_v36_fluxos_comerciais.sql`.

A migração é aditiva. Ela acrescenta contexto e claim às execuções, acrescenta estado de entrega à tabela de eventos existente, cria índices, gatilhos e RPCs backend-only. Não há limpeza, replay nem backfill. Linhas antigas de eventos ficam fora da outbox porque `entrega_estado` permanece nulo.

Riscos avaliados:

- A troca do índice de conversa preserva a mesma unicidade para execuções antigas porque `ocupa_conversa` nasce como `true`.
- O novo `CHECK` aceita execuções legadas com conversa e sem oportunidade.
- Os índices são construídos durante a transação e podem bloquear escrita por um período curto. Aplicar em janela de baixo tráfego e medir duração.
- A reversão operacional é desligar `AUTOMACOES_KANBAN_ENABLED` e pausar fluxos comerciais. Não remover colunas ou histórico em produção.

## Ordem segura de produção

1. Inspecionar a versão e as colunas atuais no Supabase.
2. Aplicar a v36 em janela de baixo tráfego.
3. Confirmar funções, gatilhos, índices e privilégios.
4. Implantar a aplicação com `AUTOMACOES_KANBAN_ENABLED=false`.
5. Fazer smoke de Login, Kanban, Chat, Fluxos, Alertas e canais.
6. Criar a automação e os dados `[TESTE AUTOMAÇÃO KANBAN]`, todos pausados/controlados.
7. Habilitar a flag, ativar somente o fluxo TESTE e executar o roteiro controlado.
8. Preservar fluxo, oportunidade, conversa, execução, eventos, mensagem e alertas do teste.
9. Pausar o fluxo TESTE ao final, sem apagar evidências.

## Validação local

- `npm run typecheck`: passou.
- `npm run lint`: passou sem avisos.
- `npm test`: 75 arquivos e 931 testes passaram.
- `npm run build`: passou; 45 páginas estáticas geradas e rotas compiladas.
- Testes PostgreSQL isolados: 11 cenários com a migração real, cobrindo outbox transacional, rollback, dedupe, claim concorrente, cancelamento, resposta, `waiting_input`, versão fixa e isolamento por clínica.

## Pendente de autorização de produção

- Aplicar a migração v36.
- Fazer push e deploy.
- Validar visualmente no ambiente implantado.
- Executar o teste real controlado, inclusive o único envio de WhatsApp para o paciente TESTE.
