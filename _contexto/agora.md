<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia). Site
no ar (Cloudflare Pages). CRM em produção: Fases 1-5, V1 do painel, Chat ao Vivo, Relatórios,
Agentes de IA (prompt estruturado, Conhecimento, Qualificação, Pixel), Fase 0 do ControleODONTO,
Disparos completo (Fase A + Fase B), Campanhas (módulo estratégico separado de Disparos, 2026-09-16)
e Fluxo de Conversa — motor de automação determinístico, Fases 0/1/2a/2b/3 completas, mais Ações
CRM e Humano+IA, em produção desde 2026-09-17. **"Noryos Odonto" — Fase 3 (motor central de
automação) concluída, testada em produção e aprovada pelo Rafael (2026-09-17)**: o Fluxo de
Conversa passou a aceitar gatilho temporal (scanner de aniversário) e evento interno, além do
webhook — capturar_resposta, pesquisas (NPS/satisfação/avaliação Google), `pacientes.
data_nascimento` e branding dinâmico, tudo com idempotência real e testado com paciente de teste.
Artefatos de teste ficam preservados em produção pra demonstração, aguardando autorização do
Rafael pra apagar depois. Próximo passo: **Fase 4 (NPS completo — classificação detrator/neutro/
promotor, dashboard)**, ainda não iniciada. Odonto segue bloqueado (sem capability do
ControleODONTO); Integração pausada (cofre de credenciais + SSRF, fase separada). Fase 6 (demo pro
marido): fluxo "DEMO - Atendimento Odontológico" publicado; a execução de teste pendente foi
encerrada pelo próprio Rafael assumindo manualmente pelo Chat ao Vivo (não pela resposta real de
WhatsApp que o teste esperava). Histórico completo em `clientes/odontominas/andamento.md`.
Compliance: risco de exclusividade Mirante/Sicoob aceito conscientemente.

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
  execuções/eventos de idempotência ligados a elas) antes da produção real com clientes — pedido
  explícito do Rafael de deixar tudo configurado/preservado por enquanto, a Fase 3 especificamente
  até depois da apresentação (2026-09-16/17, ver andamento.md e decisoes.md).
- Ligar o projeto site/CRM institucional via `/novo-projeto link` (2026-09-10).
- Fechar o round-trip completo de `capturar_resposta` (Fluxo de Conversa) com resposta chegando por
  WhatsApp de verdade — precisa de um 2º número/aparelho de teste, porque o único disponível hoje
  (`61981925241`) é o mesmo logado como instância WhatsApp da clínica e nunca gera uma mensagem
  classificada como resposta de paciente (2026-09-17).
- Fase 4 do Fluxo de Conversa ("Noryos Odonto"): NPS completo (classificação detrator/neutro/
  promotor), depois avaliação Google, aniversário como produto final e dashboard executivo —
  infraestrutura da Fase 3 pronta, ainda não iniciada (2026-09-17).
- Fase 1 do CRM Twenty pausada até o CRM da OdontoMinas rodar ou o 1º cliente pagante do nicho
  fechar (2026-09-14).

## Quente agora

- Cliente-piloto #1 (OdontoMinas): CRM em produção, Disparos, Campanhas e Fluxo de Conversa (Fases
  0 a 3, incluindo o editor visual e o motor central de automação) testados com sucesso; Fase 6
  (demo) segue aberta. Painel tem 5 conversas fictícias — falta decidir se apaga.
- Fluxo de Conversa (CRM OdontoMinas): motor central de automação (Fase 3) em produção desde
  2026-09-17 — capturar_resposta, pesquisas, evento interno, scanner temporal, branding dinâmico.
  Odonto bloqueado; Integração pausada. Migration em produção e envio real de WhatsApp continuam
  exigindo aprovação explícita a cada fase, nunca automáticas.
- "Noryos Odonto": Fase 3 (infraestrutura) concluída e aprovada; Fase 4 (NPS completo) é o próximo
  passo. Princípio de escopo do Rafael: "controla tudo antes da cadeira e depois que o paciente
  sai"; nunca vira prontuário/agenda/financeiro (isso é ControleODONTO).
- CNAE/MEI: não trava mais o piloto, segue pendente antes de cobrar o próximo odonto.
- Kaptar: liberado só pra busca/mapeamento de nicho; resto pausado até Twenty ativo (2026-09-14).
