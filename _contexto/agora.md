<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia). Site
no ar (Cloudflare Pages). CRM em produção: Fases 1-5, V1 do painel, Chat ao Vivo, Relatórios,
Agentes de IA (prompt estruturado, Conhecimento, Qualificação, Pixel), Fase 0 do ControleODONTO,
Disparos completo (Fase A + Fase B), Campanhas (módulo estratégico separado de Disparos, 2026-09-16)
e Fluxo de Conversa — motor de automação determinístico novo, Fases 0/1/2a/2b/3 completas e em
produção, mais 2 fatias novas da paleta (2026-09-17): **Ações CRM** (5 blocos — etiqueta, funil,
prioridade, atendente) e **Humano + IA** (4 blocos — transferir humano, alerta interno, pausar
automação, iniciar agente de IA), commitadas localmente (`c3d04e8`, `0fad463`), sem migration,
typecheck/lint/build/testes limpos, **nada ainda sincronizado com o GitHub nem deployado**. Odonto
segue 100% bloqueado (ControleODONTO sem capability validada); Integração pausada por decisão do
Rafael (precisa de cofre de credenciais novo + mitigação de SSRF). Histórico completo em
`clientes/odontominas/andamento.md`. Disparos, Campanhas e Fluxo de Conversa (Fases 0-2b/3) já
testados fim a ponta com sucesso em produção — as 2 fatias novas ainda não. **Próximo passo: seguir
ampliando a paleta (próxima categoria concreta é Integração, com desenho próprio) ou Fase 6 (demo
pro marido) — nenhuma das duas tem data definida ainda. O teste robusto ponta a ponta (navegador +
WhatsApp reais) fica reservado pro fim de todas as fases da paleta.**
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
- Fase 1 do CRM Twenty pausada até o CRM da OdontoMinas rodar ou o 1º cliente pagante do nicho
  fechar (2026-09-14).

## Quente agora

- Cliente-piloto #1 (OdontoMinas): CRM em produção, Disparos, Campanhas e Fluxo de Conversa (Fases
  0 a 2b/3, incluindo o editor visual) testados com sucesso; Fase 6 (demo) é a frente aberta agora.
  Painel tem 5 conversas fictícias — falta decidir se apaga.
- Fluxo de Conversa (CRM OdontoMinas): motor de automação determinístico. Fases 0/1/2a/2b/3
  completas e em produção; mais 2 fatias novas da paleta commitadas localmente e ainda não
  sincronizadas — Ações CRM (5 blocos) e Humano + IA (4 blocos), sem migration,
  typecheck/lint/build/testes limpos. Odonto segue bloqueado (sem capability do ControleODONTO);
  Integração pausada (cofre de credenciais + mitigação de SSRF, fase separada). Migration em
  produção e envio real de WhatsApp continuam exigindo aprovação explícita a cada fase, nunca
  automáticas.
- CNAE/MEI: não trava mais o piloto, segue pendente antes de cobrar o próximo odonto.
- Kaptar: liberado só pra busca/mapeamento de nicho; resto pausado até Twenty ativo (2026-09-14).
