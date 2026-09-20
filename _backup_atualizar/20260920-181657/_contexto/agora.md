<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Meta: 40–60 linhas, só estado atual; histórico vive no diário, no andamento.md do projeto e em decisoes.md. -->
# Agora · onde paramos

## Atualizacao final (2026-09-20)
- Distribuicao Automatica V1 foi validada funcional e visualmente em producao: round-robin real, idempotencia, preservacao de SLA, transferencia, RBAC e regressao do webhook Evolution.
- Configuracao deixada desativada ao encerrar; evidencias `[TESTE]` preservadas. Sem alteracao de codigo, migration, push ou deploy nesta validacao.

## Estado atual (2026-09-20)
- Cliente-piloto #1: OdontoMinas (`clientes/odontominas/`, Ariadna Pires). Site no ar (Cloudflare Pages). CRM em produção no Railway (`odontominas-crm`) + Supabase. **Deploy = `railway up`**; `git push` não publica.
- Em produção: painel, Chat ao Vivo, Relatórios, Agentes de IA, Disparos, Campanhas, Fluxo de Conversa, Identidade/RBAC, Equipe, Notas, Horário, SLA, Canais, Kanban comercial e Central de Alertas.
- Migration `v36` das Automações Comerciais por Kanban aplicada e validada em produção sem perda de dados.
- Localmente implementado e validado por gates: **Noryos Ops V1**, central interna de operações da plataforma. Migration `v37` aplicada e validada em produção; ainda não publicado no Railway nem validado visualmente logado.
- **Distribuição Automática V1** validada funcional e visualmente em produção, com round-robin real, idempotência, preservação de SLA, transferência, RBAC e regressão do webhook Evolution. Migration `v38` aplicada e validada; configuração final desativada.
- “Noryos Odonto”: Fases 3–5 aprovadas. Aniversário e dashboard executivo só com sinal do Rafael. ControleODONTO segue bloqueado por falta de credencial.

## Onde paramos
- **Automações por Kanban:** motor aprovado em teste isolado e E2E real controlado. O fluxo `[TESTE AUTOMAÇÃO KANBAN]` foi criado, publicado, executou o caminho esperado e enviou exatamente uma mensagem ao número autorizado `5561981925241`.
- O fluxo ficou pausado e a execução foi interrompida manualmente ao final. Evidências e histórico devem ser preservados.
- A liberação operacional está **reprovada por enquanto**: `AUTOMACOES_KANBAN_ENABLED` continua `false` no Railway, duas correções de UX estão apenas locais e a experiência em 768 px precisa de ajuste.
- Correções locais: erro de ativação agora é mostrado ao usuário; histórico traduz motivos técnicos e esconde o UUID nos detalhes técnicos.
- Evidências completas: `clientes/odontominas/crm/docs/AUTOMACOES-KANBAN-VALIDACAO-E2E-2026-09-20.md`. Roteiro: `clientes/odontominas/crm/scripts/e2e-automacoes-kanban-prod.ts`.
- **Noryos Ops V1:** implementado localmente com telas `/ops/*`, RBAC `ops.*`, APIs de incidentes e migration aditiva `v37`. Migration aplicada/validada no Supabase; falta publicar no Railway e validar logado.
- **Distribuição Automática V1:** validação final em produção aprovada; evidências `[TESTE]` preservadas e configuração permanece desativada.

## Pendências realmente abertas
1. Automações por Kanban: ajustar a interface em 768 px, publicar as correções locais, ligar `AUTOMACOES_KANBAN_ENABLED` no Railway e repetir a validação final antes de liberar.
2. Noryos Ops: publicar no Railway e validar visualmente logado como Noryos Admin/Suporte; a migration `v37` já está aplicada no Supabase.
3. Distribuição Automática: validação final em produção aprovada; configuração permanece desativada e evidências `[TESTE]` preservadas.
4. Alertas: concluir a validação visual autenticada restante e só então marcar a Central de Alertas como concluída.
5. Rafael validar o Kanban logado, campo de resposta do Chat e menu recolhível; decidir se Supervisora pode mover cards.
6. Configurar o horário real da OdontoMinas em `/configuracoes/horario`; hoje o SLA operacional fica inerte sem essa configuração.
7. RBAC: reset de senha real, contas da clínica, E2E por perfil, rotação da chave do Resend e troca/desativação das senhas fracas de teste.
8. Reputação/Google: informar a URL real de avaliação e ativar quando decidido.
9. Integrações: ControleODONTO aguarda credencial; Pixel Google Ads aguarda OAuth; Twenty CRM permanece pausado.

## Próximo passo
Escolher a próxima liberação: finalizar Automações por Kanban (responsividade, publicar, ativar flag e repetir E2E controlado) ou publicar Noryos Ops (deploy e validação visual logada). Não iniciar envio real adicional sem autorização.

## Riscos importantes
- Migration em produção e envio real de WhatsApp exigem autorização específica do Rafael.
- O histórico oficial de migrations do Supabase ainda aponta `v35_alertas_operacionais`; a `v36` já estava estruturalmente aplicada, e `v37`/`v38` foram aplicadas manualmente em ordem pelo SQL Editor. Não reaplicar sem reconciliar o histórico.
- As migrations `v37` e `v38` são aditivas e foram validadas no banco sem perda de dados.
- O único envio da validação de Kanban foi para o número autorizado `5561981925241`; o fluxo está pausado.
- Segredos nunca entram no repositório ou nos registros de contexto.
- Alertas e outras telas ainda contêm dados de teste/demo preservados para evidência.

## Dados [TESTE] que precisam ser preservados
- Automação Kanban: fluxo `ba51dbe3-93c1-4ead-aa8c-0ef3b823407b`, versão `6e510b69-ac9a-4e56-81c3-2f6ec7ae80e7`, execução `91d2734a-a95c-41c8-93f0-94a0d1c8482a`, evento `29802eb2-aa0e-4474-9c97-f4e9f9ce84f6`, oportunidade `530a25a7-6f88-4b93-bc70-dfc1bbf66089`, paciente `63cd3fa3-624c-46f5-a58c-3a0ad94292b8` e conversa `0ee7964f-d8b3-421b-a4d2-1a8083058b97`.
- Alertas: todos os alertas e históricos `[TESTE UI …]`, incluindo os cenários sem responsável e SLA.
- Canais, atendentes, conversas, Kanban, Fluxos das Fases 2a–5, pesquisas e demais evidências `[TESTE]` já registradas no andamento do projeto e em decisões.
