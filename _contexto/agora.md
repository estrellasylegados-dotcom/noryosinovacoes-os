<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia).
Site no ar em produção (Cloudflare Pages, https://odontominas.pages.dev/, deploy automático a cada
push na `main`). Reunião de Rafael com o marido da Ariadna em 14/09 mudou o escopo: pacote completo
de graça (site + CRM de captação + tráfego pago, verba de mídia por conta da clínica) — prova de
conceito pra depois oferecer aos contatos do marido com outros dentistas (detalhe em
`clientes/odontominas/contexto.md`). **Foco atual do projeto: construir o CRM até funcionar de
verdade** — Ariadna só avança em projeto que vê rodando, então a "proposta" vai ser uma
demonstração ao vivo pro marido, não um documento formal. CRM em produção de verdade: Fases 1-5
(painel, ficha, resumo, reativação), V1 do painel (login por atendente, Equipe, Conexão), Chat ao
Vivo + Relatórios + dark mode. **Agentes de IA Fase 1+2A validados de ponta a ponta com o 1º agente
real (2026-09-15)**: "Recepção Virtual" (Gemini) respondeu, transferiu pra humano e avisou a equipe
de verdade num teste ao vivo — ver `clientes/odontominas/andamento.md`. CRM também ganhou
"Pausar IA"/"Retomar IA"/"Finalizar Atendimento" no Chat ao Vivo e notificação real do navegador
(não só o sino do painel). **Automação de reativação de paciente inativo (Fase 5) também validada
de ponta a ponta pela 1ª vez** — achado e corrigido um bug real (secret do GitHub Actions
desalinhado do Railway). CRM também ganhou 2 ajustes de UI a pedido do Rafael (prints da RoiZap de
referência): menu "Ferramentas" da sidebar abre/recolhe, e som de notificação (liga/desliga) pra
mensagem nova no Chat ao Vivo — deployados e confirmados funcionando em produção pelo próprio
Rafael. **Agentes de IA — Fase 2B (Buffer de mensagens) completa e validada de ponta a ponta em
produção (2026-09-16)**: 3 mensagens seguidas no WhatsApp viraram 1 resposta só, combinada. No
caminho, achado e corrigido um bug real (a janela do buffer abria um instante depois da mensagem
que a disparava — resposta nunca saía, sem erro no log). Por decisão consciente (nenhum paciente
real ainda, resposta rápida pesa mais que combinar rajada rara), o buffer ficou **desligado** no
"Recepção Virtual" — liga quando tiver uso real ou quiser mostrar na demo. **Próximo passo volta a
ser a Fase 6 (demo pro marido)** — não sobra mais nenhuma fase técnica antes dela.
Compliance jurídico: risco de exclusividade Mirante/Sicoob aceito conscientemente.

## Pendências

- Trocar usuário/senha das 3 contas de demo do painel do CRM
  (`admin`/`recepcao1`/`recepcao2`, senha `<usuario>-temp-2026`) pelas secretárias reais antes da
  demo (2026-09-15).
- Antes de publicar o site de verdade, confirmar com a Ariadna: WhatsApp oficial, responsável
  técnico da PJ, formação 2011/Mestrado 2019, Endodontia/Periodontia, convênios, fotos reais,
  domínio próprio (2026-09-11).
- CNAE/MEI da esposa não cobre tráfego pago/publicidade (confirmado, Anexo XI CGSN 140/2018) — não
  trava cobrar o piloto #1 (é grátis), mas trava cobrar o próximo cliente odonto pagante. Caminho
  recomendado: abrir CNPJ próprio da Noryos (ME, Simples Nacional, em nome da esposa), via Contajá
  (abertura grátis 24h, a partir de R$137/mês) ou Contabilidade.com; confirmar CNAE de
  desenvolvimento web + publicidade e simular Fator R (Anexo III x V) antes de fechar (2026-09-14).
- Confirmar se a responsável técnica da clínica de estética (2º piloto) é médica, biomédica ou
  esteticista — muda se aplica a Resolução CFM 2.336/2023 ou vigilância sanitária (2026-09-11).
- Mapear processos recorrentes (`/mapear`) quando a operação tiver rotina definida — rodou vazio em
  2026-09-11, empresa ainda em estruturação.
- Ligar o projeto existente do site/CRM via `/novo-projeto link`, sem mover o código nem quebrar o
  deploy da Hostinger (2026-09-10).
- Fase 1 do CRM Twenty (comercial interno da Noryos, não confundir com o CRM da OdontoMinas)
  **pausada até o CRM da OdontoMinas estar rodando ou o 1º cliente pagante do nicho fechar**
  (2026-09-14, substitui o critério de 2026-09-10/14 — "piloto #1 fechar comercialmente" não se
  aplica mais porque o piloto é gratuito).

## Quente agora

- Cliente-piloto #1 (OdontoMinas): site + CRM completo em produção, Agentes de IA validados com
  agente real rodando (Fase 1+2A), automação de reativação (Fase 5) e buffer de mensagens (Fase
  2B) validados de ponta a ponta — buffer desligado por decisão consciente até ter uso real. Fase
  6 (demo pro marido) é o próximo passo — não falta mais nenhuma fase técnica. Painel tem 5
  conversas fictícias semeadas pra demonstração — falta decidir se apaga ou mantém.
- CNAE/MEI: não trava mais o piloto, mas segue pendente antes de cobrar o próximo odonto.
- Kaptar (ver `ferramentas.md`): liberado só pra busca/mapeamento de nicho, baixo volume; resto
  pausado até Twenty ativo (2026-09-14).
