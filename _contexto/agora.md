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
preservada em produção. Próximo passo: avaliação Google, aniversário como "produto final" e
dashboard executivo unificado — **aguardando sinal do Rafael pra avançar**, não iniciado.
Odonto segue bloqueado (sem capability do ControleODONTO); Integração pausada (cofre de
credenciais + SSRF, fase separada). Fase 6 (demo pro marido): fluxo "DEMO - Atendimento
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
  `4bb228db-e7f5-4464-8b53-e1b1d43e31bc` — preservados como evidência antes/depois da correção)
  antes da produção real com clientes — pedido explícito do Rafael de deixar tudo configurado/
  preservado por enquanto, a Fase 3 e a evidência da Fase 4 especificamente até depois da
  apresentação (2026-09-16/17/18, ver andamento.md e decisoes.md).
- Ligar o projeto site/CRM institucional via `/novo-projeto link` (2026-09-10).
- Próximo passo da frente "Noryos Odonto" (avaliação Google, aniversário como produto final,
  dashboard executivo unificado) — infraestrutura pronta desde a Fase 3/4, mas Rafael pediu
  explicitamente pra não avançar sem o sinal dele (2026-09-17).
- Fase 1 do CRM Twenty pausada até o CRM da OdontoMinas rodar ou o 1º cliente pagante do nicho
  fechar (2026-09-14).

## Quente agora

- Cliente-piloto #1 (OdontoMinas): CRM em produção, Disparos, Campanhas e Fluxo de Conversa (Fases
  0 a 4, incluindo o editor visual, o motor central de automação e o NPS) testados com sucesso;
  Fase 6 (demo) segue aberta. Painel tem 5 conversas fictícias — falta decidir se apaga.
- Fluxo de Conversa (CRM OdontoMinas): motor central de automação em produção desde 2026-09-17 —
  capturar_resposta, pesquisas + NPS classificado, evento interno, scanner temporal, branding
  dinâmico. Odonto bloqueado; Integração pausada. Migration em produção e envio real de WhatsApp
  continuam exigindo aprovação explícita a cada fase, nunca automáticas.
- "Noryos Odonto": Fase 3 (infraestrutura) e Fase 4 (NPS completo) concluídas e aprovadas —
  próximo passo (avaliação Google/aniversário-produto-final/dashboard unificado) aguarda sinal do
  Rafael. Princípio de escopo: "controla tudo antes da cadeira e depois que o paciente sai"; nunca
  vira prontuário/agenda/financeiro (isso é ControleODONTO).
- Bug real de normalização de telefone BR (celular sem 9º dígito no JID do WhatsApp) corrigido e
  validado em produção com WhatsApp real (2026-09-17/18) — função central em
  `clientes/odontominas/crm/src/lib/telefone.ts`.
- CNAE/MEI: não trava mais o piloto, segue pendente antes de cobrar o próximo odonto.
- Kaptar: liberado só pra busca/mapeamento de nicho; resto pausado até Twenty ativo (2026-09-14).
