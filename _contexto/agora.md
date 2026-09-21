<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Meta: 40–60 linhas, só estado atual; histórico vive no diário, no andamento.md do projeto e em decisoes.md. -->
# Agora · onde paramos

## Atualizacao final (2026-09-21)
- Auditoria pré-ControleODONTO concluída: gates locais do CRM passaram (typecheck, lint, build e 958 testes) e a produção foi validada logada como `[TESTE] Noryos Admin`.
- Horário oficial salvo em produção: segunda a sexta, 08:00–18:00; sábado, 08:00–12:00; domingo fechado; timezone America/Sao_Paulo. Os indicadores agora usam hora útil.
- Três correções locais de qualidade foram preparadas, mas não receberam push ou deploy: duração de alerta legível, identificação numérica não exibida como paciente e textos corretos sobre o papel do horário.

## Estado atual (2026-09-21)
- Cliente-piloto #1: OdontoMinas (`clientes/odontominas/`, Ariadna Pires). Site no ar (Cloudflare Pages). CRM em produção no Railway (`odontominas-crm`) + Supabase. **Deploy = `railway up`**; `git push` não publica.
- Em produção: painel, Chat ao Vivo, Relatórios, Agentes de IA, Disparos, Campanhas, Fluxo de Conversa, Identidade/RBAC, Equipe, Notas, Horário, SLA, Canais, Kanban comercial e Central de Alertas.
- Migration `v36` das Automações Comerciais por Kanban aplicada e validada em produção sem perda de dados.
- Localmente implementado e validado por gates: **Noryos Ops V1**, central interna de operações da plataforma. Migration `v37` aplicada e validada em produção; ainda não publicado no Railway nem validado visualmente logado.
- **Distribuição Automática V1** validada funcional e visualmente em produção, com round-robin real, idempotência, preservação de SLA, transferência, RBAC e regressão do webhook Evolution. Migration `v38` aplicada e validada; configuração final desativada.
- “Noryos Odonto”: Fases 3–5 aprovadas. Aniversário e dashboard executivo só com sinal do Rafael. ControleODONTO mantém a Fase 0 pronta, com capabilities desligadas até receber credencial de homologação e contrato oficial.

## Onde paramos
**Atualizado em:** 2026-09-21

- CRM operacional com expediente ativo em produção; a fila indica 18 SLAs estourados para triagem manual.
- ControleODONTO está tecnicamente preparado na Fase 0, mas a integração real ainda não começou por falta de acesso e contrato do fornecedor.

## Pendências realmente abertas
1. Automações por Kanban: ajustar a interface em 768 px, publicar as correções locais, ligar `AUTOMACOES_KANBAN_ENABLED` no Railway e repetir a validação final antes de liberar.
2. Noryos Ops: publicar no Railway e validar visualmente logado como Noryos Admin/Suporte; a migration `v37` já está aplicada no Supabase.
3. Distribuição Automática: validação final em produção aprovada; configuração permanece desativada e evidências `[TESTE]` preservadas.
4. Alertas: concluir a validação visual autenticada restante e só então marcar a Central de Alertas como concluída.
5. Rafael validar o Kanban logado, campo de resposta do Chat e menu recolhível; decidir se Supervisora pode mover cards.
6. Triar os 18 SLAs estourados que apareceram após ativar o horário operacional; não assumir, responder ou encerrar conversas reais sem autorização específica.
7. RBAC: reset de senha real, contas da clínica, E2E por perfil, rotação da chave do Resend e troca/desativação das senhas fracas de teste.
8. Reputação/Google: informar a URL real de avaliação e ativar quando decidido.
9. Integrações: ControleODONTO aguarda credencial de homologação e documentação oficial de autenticação, endpoints, payloads/status e webhook; Pixel Google Ads aguarda OAuth; Twenty CRM permanece pausado.
10. Publicar somente a revisão visual final do CRM da OdontoMinas (paleta, centralização da logo e proteção contra Dark Reader) e validar visualmente logado após autorização; a base do redesign já está em produção.

## Próximo passo
Obter a credencial de homologação e a documentação oficial do ControleODONTO; Rafael configura o segredo diretamente no Railway e, então, executar apenas o teste de conexão/leitura. Em paralelo, escolher a próxima liberação local. Não iniciar envio real adicional sem autorização.

## Riscos importantes
- Migration em produção e envio real de WhatsApp exigem autorização específica do Rafael.
- O histórico oficial de migrations do Supabase ainda aponta `v35_alertas_operacionais`; a `v36` já estava estruturalmente aplicada, e `v37`/`v38` foram aplicadas manualmente em ordem pelo SQL Editor. Não reaplicar sem reconciliar o histórico.
- As migrations `v37` e `v38` são aditivas e foram validadas no banco sem perda de dados.
- O único envio da validação de Kanban foi para o número autorizado `5561981925241`; o fluxo está pausado.
- Segredos nunca entram no repositório ou nos registros de contexto.
- Integração real com ControleODONTO não deve inferir contrato nem habilitar capabilities sem validação explícita.
- Alertas e outras telas ainda contêm dados de teste/demo preservados para evidência.

## Dados [TESTE] que precisam ser preservados
- Automação Kanban: fluxo `ba51dbe3-93c1-4ead-aa8c-0ef3b823407b`, versão `6e510b69-ac9a-4e56-81c3-2f6ec7ae80e7`, execução `91d2734a-a95c-41c8-93f0-94a0d1c8482a`, evento `29802eb2-aa0e-4474-9c97-f4e9f9ce84f6`, oportunidade `530a25a7-6f88-4b93-bc70-dfc1bbf66089`, paciente `63cd3fa3-624c-46f5-a58c-3a0ad94292b8` e conversa `0ee7964f-d8b3-421b-a4d2-1a8083058b97`.
- Alertas: todos os alertas e históricos `[TESTE UI …]`, incluindo os cenários sem responsável e SLA.
- Canais, atendentes, conversas, Kanban, Fluxos das Fases 2a–5, pesquisas e demais evidências `[TESTE]` já registradas no andamento do projeto e em decisões.

## Quente agora
- Revisão visual final do CRM da OdontoMinas validada localmente e aguardando publicação autorizada; a base do redesign já está em produção.

## Pendências
- não

