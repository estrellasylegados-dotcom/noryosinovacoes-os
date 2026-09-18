<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia). Site
no ar (Cloudflare Pages). CRM em produção: Fases 1-5, V1 do painel, Chat ao Vivo, Relatórios,
Agentes de IA (prompt estruturado, Conhecimento, Qualificação, Pixel), Fase 0 do ControleODONTO,
Disparos completo (Fase A + Fase B), Campanhas (módulo estratégico separado de Disparos, 2026-09-16)
e Fluxo de Conversa — motor de automação determinístico, Fases 0/1/2a/2b/3/4 completas, mais Ações
CRM e Humano+IA, em produção desde 2026-09-17. **"Noryos Odonto" — Fase 4 (NPS completo:
classificação detrator/neutro/promotor + dashboard) concluída, testada em produção e aprovada pelo
Rafael (2026-09-17)**: nova aba "Pesquisas" em `/resumo`. Na validação, achado e corrigido um bug
real — WhatsApp/Baileys às vezes entrega celular BR sem o 9º dígito no JID, causando paciente/
conversa duplicados; corrigido com `src/lib/telefone.ts` (função central de equivalência BR, sem
migration) — round-trip completo de `capturar_resposta` fechado de verdade por WhatsApp real (o
número de teste não era mais o mesmo da instância conectada). Evidência de antes/depois do bug
preservada em produção. **Fase 5 (avaliação Google) concluída, testada em produção de ponta a
ponta sem depender do Rafael, e aprovada (2026-09-18)**: nova tela `/reputacao`, ação manual na
ficha do paciente, tracking de clique com redirect próprio. Módulo desativado e Fluxo de teste
pausado até o Rafael colocar a URL real de avaliação da OdontoMinas. Próximo passo: aniversário
como "produto final" e dashboard executivo unificado — **aguardando sinal do Rafael pra avançar**,
não iniciado. Odonto segue bloqueado (sem capability do ControleODONTO); Integração pausada (cofre de
credenciais + SSRF, fase separada). **Nova frente iniciada 2026-09-18**: reconstrução do
CRM por fases (RBAC/Atendimento/Kanban/Noryos Ops, pedida pelo Rafael) — Equipe (RBAC), Notas
Internas, Horário de Atendimento e SLA Operacional (fundação, ainda sem automação) concluídos,
testados e em produção (2 deploys reais no Railway, não só commit). **Mesmo dia, fatia maior:
IDENTIDADE / LOGIN / RBAC — FUNDAÇÃO CONCLUÍDA** — 6 perfis (`noryos_admin`, `noryos_suporte`,
`dona`, `gerente`, `supervisora`, `atendente`), sessão revogável em tempo real, convites e reset de
senha por e-mail (token hash, uso único), RBAC granular de verdade em Equipe/Chat ao
Vivo/SLA/Horário/Notas Internas, `auditoria_eventos`, privilege escalation e proteção da última
Dona ativa. As ~60 telas mais antigas (Agentes, Campanhas, Disparos, Fluxos etc.) seguem por um
shim de compatibilidade (`isAdminEquivalente`) — **dívida técnica registrada, não solução
permanente**. Deploy real no Railway (`SUCCESS`) e smoke test em produção ok; migração das 3 contas
reais feita (`admin`→`dona`, atendentes→`atendente`), nenhuma virou `noryos_admin` sozinha. Detalhe
completo em `clientes/odontominas/andamento.md` e `crm/docs/RBAC.md`. Kanban visual e Noryos Ops
(painel cross-clínica) seguem não iniciados — Rafael pediu validar primeiro e-mail real (convite +
reset) e os 6 perfis antes de avançar pra módulo grande novo. Fase 6 (demo pro marido): fluxo "DEMO - Atendimento
Odontológico" publicado; a execução de teste pendente foi encerrada pelo próprio Rafael assumindo
manualmente pelo Chat ao Vivo (não pela resposta real de WhatsApp que o teste esperava). Histórico
completo em `clientes/odontominas/andamento.md`. Compliance: risco de exclusividade Mirante/Sicoob
aceito conscientemente.

## Pendências

- Trocar as 3 senhas de demo do painel do CRM pelas secretárias reais antes da demo (2026-09-15).
- Antes de publicar o site de verdade, confirmar com a Ariadna: WhatsApp oficial, responsável
  técnico da PJ, formação/mestrado, convênios, fotos reais, domínio próprio (2026-09-11).
- CNAE/MEI da esposa não cobre tráfego pago — não trava o piloto #1 (grátis), trava cobrar o
  próximo odonto. Abrir CNPJ próprio da Noryos antes de fechar esse cliente (2026-09-14).
- Confirmar se a responsável da clínica de estética (2º piloto) é médica/biomédica/esteticista —
  muda a resolução aplicável (2026-09-11).
- Mapear processos recorrentes (`/mapear`) quando a operação tiver rotina definida (2026-09-11).
- Pixel de Conversão (Google Ads): criar app OAuth no Google Cloud antes de ligar de verdade;
  Facebook só precisa do Pixel ID/token do cliente (2026-09-16).
- Integração ControleODONTO: obter credencial/documentação real antes de habilitar qualquer
  capability (2026-09-16, checklist em
  `clientes/odontominas/crm/docs/integrations/controle-odonto.md`).
- Apagar todos os dados de teste (Disparos e Campanhas: paciente "Rafael (teste Disparos)",
  conversa, o disparo de verificação, a campanha "Teste Campanhas — envio real" e os eventos dela;
  Fluxo de Conversa: os 2 fluxos "TESTE - Fluxo Odonto" — Fase 2a e 2b/3, já arquivados — e as
  execuções vinculadas; Fase 3: os 4 fluxos `[TESTE FASE 3]`, as 2 pesquisas de teste e as
  execuções/eventos de idempotência ligados a elas; Fase 4: o paciente e a conversa criados por
  engano pelo bug de telefone sem 9º dígito — `4e7ecb38-1d63-4ad8-90f5-b6ae12208b9f`/
  `4bb228db-e7f5-4464-8b53-e1b1d43e31bc` — preservados como evidência antes/depois da correção;
  Fase 5: o fluxo `[TESTE FASE 5]` (`9593cf0f…`), a pesquisa/execução/evento de avaliação Google
  ligados a ele; SLA Operacional: a conversa `[TESTE SLA]` (`a9074a4a…`), suas mensagens, a nota
  interna e o evento de violação ligados a ela) antes da produção real com clientes — pedido explícito do Rafael de deixar tudo
  configurado/preservado por enquanto, até depois da apresentação (2026-09-16/17/18, ver
  andamento.md e decisoes.md).
- Ligar o projeto site/CRM institucional via `/novo-projeto link` (2026-09-10).
- Ativar Reputação/Google Reviews de verdade: colocar a URL real de avaliação da OdontoMinas em
  `/reputacao` e ligar o módulo (hoje desativado de propósito, só com a URL de teste salva) —
  decisão do Rafael, sem prazo (2026-09-18).
- Configurar o horário real de atendimento da OdontoMinas em `/configuracoes/horario` (hoje
  vazio de propósito) — é o que destrava o SLA Operacional de fato (hoje ativo mas inerte,
  `not_configured`, por falta desse dado) (2026-09-18).
- Próximo passo da frente "Noryos Odonto" (aniversário como produto final, dashboard executivo
  unificado) — infraestrutura pronta desde a Fase 3, mas Rafael pediu explicitamente pra não
  avançar sem o sinal dele (2026-09-17).
- Fase 1 do CRM Twenty pausada até o CRM da OdontoMinas rodar ou o 1º cliente pagante do nicho
  fechar (2026-09-14).
- Identidade/RBAC (2026-09-18): configurar `RESEND_API_KEY` e `APP_URL` em produção (Railway) —
  sem isso convite e reset de senha criam o token mas o e-mail não sai de verdade; testar os dois
  fluxos com e-mail real depois de configurar; criar contas `[TESTE]` dos 6 perfis (Dona, Gerente,
  Supervisora, Atendente, Noryos Admin, Noryos Suporte) e validar E2E de cada uma; construir a tela
  visual de permissões por checkboxes (hoje só a API existe, `PATCH /api/equipe/[id]/permissoes`);
  implementar "Sessões Ativas" por dispositivo (hoje só dá pra encerrar tudo de uma vez); migrar as
  ~60 telas que ainda usam o shim `isAdminEquivalente` pra permissão granular; revisar o modelo de
  `membership` quando existir de verdade uma 2ª clínica com usuário compartilhado.

## Quente agora

- Cliente-piloto #1 (OdontoMinas): CRM em produção, Disparos, Campanhas e Fluxo de Conversa (Fases
  0 a 4, incluindo o editor visual, o motor central de automação e o NPS) testados com sucesso;
  Fase 6 (demo) segue aberta. Painel tem 5 conversas fictícias — falta decidir se apaga.
- Fluxo de Conversa (CRM OdontoMinas): motor central de automação em produção desde 2026-09-17 —
  capturar_resposta, pesquisas + NPS classificado, evento interno, scanner temporal, branding
  dinâmico. Odonto bloqueado; Integração pausada. Migration em produção e envio real de WhatsApp
  continuam exigindo aprovação explícita a cada fase, nunca automáticas.
- "Noryos Odonto": Fase 3 (infraestrutura), Fase 4 (NPS completo) e Fase 5 (avaliação Google)
  concluídas e aprovadas — próximo passo (aniversário-produto-final/dashboard unificado) aguarda
  sinal do Rafael. Princípio de escopo: "controla tudo antes da cadeira e depois que o paciente
  sai"; nunca vira prontuário/agenda/financeiro (isso é ControleODONTO).
- Bug real de normalização de telefone BR (celular sem 9º dígito no JID do WhatsApp) corrigido e
  validado em produção com WhatsApp real (2026-09-17/18) — função central em
  `clientes/odontominas/crm/src/lib/telefone.ts`.
- CNAE/MEI: não trava mais o piloto, segue pendente antes de cobrar o próximo odonto.
- Kaptar: liberado só pra busca/mapeamento de nicho; resto pausado até Twenty ativo (2026-09-14).
- Reconstrução do CRM por fases (RBAC/Atendimento/Kanban/Noryos Ops): Equipe, Notas Internas,
  Horário de Atendimento e SLA Operacional prontos e em produção (2026-09-18). **Identidade/Login/
  RBAC — fundação concluída no mesmo dia** (6 perfis, sessão revogável, convites/reset por e-mail,
  RBAC granular em Equipe/Chat/SLA/Horário/Notas, shim temporário nas telas antigas). Próximo passo
  recomendado: validar e-mail real (convite + reset) e os 6 perfis ponta a ponta antes de avançar
  pra Kanban ou Noryos Ops — aguarda sinal do Rafael.
