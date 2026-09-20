# VALIDAÇÃO — AUTOMAÇÕES COMERCIAIS POR KANBAN

Data: 2026-09-20  
Ambiente: produção, com dados `[TESTE]`  
Status: **REPROVADO PARA LIBERAÇÃO OPERACIONAL; motor aprovado**

O motor funcionou de ponta a ponta no cenário controlado. A liberação continua bloqueada porque `AUTOMACOES_KANBAN_ENABLED` permanece desligada no Railway e as correções de UX encontradas nesta rodada ainda não foram implantadas.

## 1. Testes executados

- Interface autenticada: login, lista, criação por template, edição, gatilho Kanban, pipeline, etapa, esperas, condição, publicação, ativação, pausa e histórico.
- E2E real: entrada em Follow-up, outbox, criação da execução, espera, condição, envio autorizado, segunda espera e interrupção ao pausar.
- PostgreSQL isolado com a migration v36 real: 11 cenários.
- Regressão completa: 75 arquivos e 931 testes.
- Typecheck, lint e build de produção.
- Responsividade em desktop e viewport de 768 px.

## 2. Resultados

O fluxo `[TESTE AUTOMAÇÃO KANBAN]` foi criado pela UI, publicado como v1 e preservado pausado. O E2E criou uma única execução, respeitou a espera, avaliou a condição e enviou uma única mensagem ao número de teste autorizado.

## 3. UI

Criação e editor são compreensíveis e usam português operacional. Templates explicam pré-requisitos. Problemas encontrados: falha de ativação era silenciosa; histórico mostrava UUID e código interno como texto principal; em 768 px o editor exige muita rolagem e a tabela usa rolagem horizontal.

## 4. Gatilho Kanban

Passou. Movimento para Follow-up criou o evento `29802eb2-aa0e-4474-9c97-f4e9f9ce84f6` e a execução `91d2734a-a95c-41c8-93f0-94a0d1c8482a`.

## 5. Deduplicação

Passou. A chave `kanban:530a25a7-6f88-4b93-bc70-dfc1bbf66089:94831765-bdee-4a06-834d-4a27c2044a1c` possui uma execução. O teste PostgreSQL também confirmou dedupe atômico.

## 6. Espera

Passou. A execução entrou em `waiting_time`; não houve envio antes de `aguardando_ate`. O worker retomou depois do prazo.

## 7. Revalidação

Passou nos testes PostgreSQL: mudança de etapa cancela antes do efeito externo. A guarda também é executada imediatamente antes do envio.

## 8. Resposta do paciente

Passou nos testes PostgreSQL, incluindo resposta persistida e `waiting_input`. O gatilho cancela follow-up comercial quando configurado para parar ao responder.

## 9. Agendado

Passou nos testes PostgreSQL: sair de Follow-up encerra a sequência com `etapa_alterada` e preserva eventos.

## 10. Convertido

Passou nos testes PostgreSQL: oportunidade encerrada cancela execuções incompatíveis.

## 11. Perdido

Passou nos testes PostgreSQL e na regressão do Kanban: cancela execução, preserva motivo estruturado e não interfere na criação futura de outra oportunidade.

## 12. Loops

Passou nos testes PostgreSQL: cadeia de origem e limite de profundidade impedem recursão sem controle.

## 13. Canal

Passou no E2E. A mensagem saiu pelo canal da conversa `a20d94ac-8765-43e0-8abb-868c624e0b67`; provider confirmou `3EB0FC9B48A7648BA867C3401C371A33A2DF617A`. Nenhum fallback global foi usado.

## 14. Horário

O motor reutiliza a configuração existente da clínica. A OdontoMinas continua sem horário configurado; portanto, conforme a própria UI informa, não há restrição de expediente para aplicar neste ambiente.

## 15. RBAC

Backend usa permissões granulares. Dona possui criar, editar, ativar, pausar e visualizar execuções. Gerente, Supervisora e Atendente não recebem automações por padrão; chamadas diretas são negadas pelas rotas. Permissões customizadas continuam possíveis.

## 16. Multiclínica

Passou nos testes PostgreSQL e de permissões: referências são validadas por `clinica_id`; outra clínica recebe resultado equivalente a não encontrado.

## 17. Concorrência

Passou: claim com token e `FOR UPDATE SKIP LOCKED`; dois workers não obtêm o mesmo passo.

## 18. Retentativas

Passou nos testes: entrega incerta não é repetida cegamente; efeitos comerciais usam marca idempotente; falha transitória volta para pendente com atraso e limite de tentativas.

## 19. Alertas

Passou nos testes de regressão. Falha definitiva usa chave idempotente e mensagem operacional; detalhes técnicos ficam restritos ao escopo técnico.

## 20. Histórico

Produção registrou início, espera, condição, envio, nova espera e interrupção. A UI exibiu a execução como interrompida. Foi corrigida localmente para traduzir motivos e recolher o UUID em “Detalhes técnicos”.

## 21. Responsividade

Desktop passou. Em 768 px não houve quebra de JavaScript, mas o editor fica apertado, exige rolagem vertical extensa e a lista depende de rolagem horizontal. Recomenda-se uma rodada específica de UX responsiva antes de uso frequente em tablet.

## 22. Bugs encontrados

1. Ativação recusada pela flag não mostrava erro ao usuário.
2. Histórico mostrava UUID e `interrompida_manualmente` como linguagem principal.
3. Experiência apertada em 768 px; documentada, ainda sem correção estrutural.

## 23. Correções feitas

- `FluxoAcoes.tsx`: valida resposta HTTP e mostra erro operacional, inclusive flag desligada.
- `FluxoHistoricoExecucoes.tsx`: traduz motivos e move UUID para detalhe técnico recolhível.
- Nenhuma refatoração ampla.

## 24. Regressão

Login, RBAC, Equipe, Chat, Canais, Kanban, SLA, Alertas, fluxos antigos, Agentes IA, Disparos, Reativação, NPS, Reviews e workers ficaram cobertos pela suíte completa: 931 testes aprovados.

## 25. Gates

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npx vitest run`: 75 arquivos, 931 testes, passou.
- `npm run build`: passou, 45 páginas geradas.

## 26. Evidências preservadas

- Fluxo: `ba51dbe3-93c1-4ead-aa8c-0ef3b823407b`.
- Versão: `6e510b69-ac9a-4e56-81c3-2f6ec7ae80e7`.
- Oportunidade: `530a25a7-6f88-4b93-bc70-dfc1bbf66089`.
- Paciente autorizado: `63cd3fa3-624c-46f5-a58c-3a0ad94292b8`.
- Conversa: `0ee7964f-d8b3-421b-a4d2-1a8083058b97`.
- Execução: `91d2734a-a95c-41c8-93f0-94a0d1c8482a`.
- Evento de entrada: `29802eb2-aa0e-4474-9c97-f4e9f9ce84f6`.
- Mensagem confirmada pelo provider: `3EB0FC9B48A7648BA867C3401C371A33A2DF617A`.
- Fluxo ficou pausado; nada foi apagado.

## 27. Pendências

1. Implantar as duas correções locais.
2. Habilitar `AUTOMACOES_KANBAN_ENABLED=true` no Railway somente para a liberação planejada.
3. Repetir pela UI o clique em Ativar e confirmar o texto de erro/caminho feliz após deploy.
4. Fazer ajuste específico de layout para tablet/largura reduzida.
5. Manter o fluxo e todos os registros `[TESTE]` preservados.
