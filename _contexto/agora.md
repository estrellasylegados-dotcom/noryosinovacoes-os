<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia). Site
no ar (Cloudflare Pages). CRM em produção: Fases 1-5, V1 do painel, Chat ao Vivo, Relatórios,
Agentes de IA (prompt estruturado, Conhecimento, Qualificação, Pixel), Fase 0 do ControleODONTO,
Disparos completo (Fase A + Fase B), Campanhas (módulo estratégico separado de Disparos, 2026-09-16)
e Fluxo de Conversa — motor de automação determinístico, Fases 0/1/2a/2b/3 completas, mais Ações
CRM e Humano+IA — as duas ampliações **já deployadas em produção** (2026-09-17, 1º deploy real
delas). Odonto segue bloqueado (sem capability do ControleODONTO); Integração pausada (cofre de
credenciais + SSRF, fase separada). **Fase 6 (demo pro marido) em andamento**: fluxo "DEMO -
Atendimento Odontológico" publicado, teste real pontual disparado e **pausado esperando o Rafael
responder "1" no WhatsApp de teste**. Nova frente aberta, batizada **"Noryos Odonto"** (NPS,
avaliação Google, aniversário, dashboard executivo) — auditoria técnica feita, **aguardando o
Rafael confirmar se reaproveita o motor do Fluxo de Conversa** antes de codar. Histórico completo
em `clientes/odontominas/andamento.md`.
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
  Fluxo de Conversa: os 2 fluxos "TESTE - Fluxo Odonto" — o da Fase 2a e o novo da Fase 2b/3, ambos
  já arquivados — e as execuções vinculadas) antes da produção real com clientes — pedido explícito
  do Rafael de deixar tudo configurado por enquanto (2026-09-16/17, ver andamento.md e decisoes.md).
- Ligar o projeto site/CRM institucional via `/novo-projeto link` (2026-09-10).
- Teste real da Fase 6 pausado: responder "1" no WhatsApp de teste (5561981925241) pra concluir a
  validação do fluxo da demo (2026-09-17).
- Decidir se a frente "Noryos Odonto" (NPS/avaliação Google/aniversário/dashboard) reaproveita o
  motor do Fluxo de Conversa (recomendado) ou vira automação separada — auditoria pronta,
  aguardando confirmação do Rafael (2026-09-17).
- Aniversário automatizado depende de `pacientes.data_nascimento`, que não existe em lugar nenhum
  do sistema hoje — falta decidir de onde esse dado vem (2026-09-17).
- Fase 1 do CRM Twenty pausada até o CRM da OdontoMinas rodar ou o 1º cliente pagante do nicho
  fechar (2026-09-14).

## Quente agora

- Cliente-piloto #1 (OdontoMinas): CRM em produção, Disparos, Campanhas e Fluxo de Conversa (Fases
  0 a 2b/3, incluindo o editor visual) testados com sucesso; Fase 6 (demo) é a frente aberta agora.
  Painel tem 5 conversas fictícias — falta decidir se apaga.
- Fluxo de Conversa (CRM OdontoMinas): Ações CRM + Humano+IA deployadas em produção (2026-09-17).
  Odonto bloqueado; Integração pausada. Migration em produção e envio real de WhatsApp continuam
  exigindo aprovação explícita a cada fase, nunca automáticas.
- "Noryos Odonto": frente nova pra impressionar a cliente-piloto — NPS, avaliação Google,
  aniversário, dashboard executivo. Princípio de escopo do Rafael: "controla tudo antes da cadeira
  e depois que o paciente sai"; nunca vira prontuário/agenda/financeiro (isso é ControleODONTO).
- CNAE/MEI: não trava mais o piloto, segue pendente antes de cobrar o próximo odonto.
- Kaptar: liberado só pra busca/mapeamento de nicho; resto pausado até Twenty ativo (2026-09-14).
