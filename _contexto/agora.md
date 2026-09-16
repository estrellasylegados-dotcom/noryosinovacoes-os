<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia).
Site no ar em produção (Cloudflare Pages, https://odontominas.pages.dev/, deploy automático a cada
push na `main`). Escopo do piloto (reunião com o marido em 14/09): pacote completo de graça (site +
CRM de captação + tráfego pago, verba de mídia por conta da clínica) — prova de conceito pra depois
oferecer aos contatos dele com outros dentistas (detalhe em `clientes/odontominas/contexto.md`).
**Foco atual: construir o CRM até funcionar de verdade** — Ariadna só avança em projeto que vê
rodando, então a "proposta" vai ser uma demonstração ao vivo pro marido, não um documento formal.
CRM em produção de verdade: Fases 1-5 (painel, ficha, resumo, reativação), V1 do painel (login por
atendente, Equipe, Conexão), Chat ao Vivo + Relatórios + dark mode, Agentes de IA (Fase 1+2A
validada com o agente real "Recepção Virtual"; Fase 2B/buffer de mensagens validada e desligada por
decisão consciente). **Agentes de IA ganharam prompt estruturado (Simples/Avançado) + aba
Conhecimento e, na mesma data, Qualificação Automática de Leads (2026-09-16)** — escala
Quente/Morno/Frio aplicada como etiqueta, reavaliada a cada resposta do agente, desligada por
padrão. Ferramentas/Pixel do print da RoiZap continuam de fora, mesmo motivo de antes (detalhe em
`clientes/odontominas/andamento.md`). MCP do Supabase confirmado aplicando schema direto em
produção 2x seguidas (v12 e v13), sem SQL Editor manual — ver `ferramentas.md`. **Próximo passo:
Fase 6 (demo pro marido)** — não sobra mais nenhuma fase técnica antes dela.
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
  agente real rodando (Fase 1+2A), automação de reativação (Fase 5), buffer de mensagens (Fase 2B,
  desligado por decisão), prompt estruturado + aba Conhecimento e Qualificação Automática de Leads
  (2026-09-16, desligada por padrão) — tudo testado em produção. Fase 6 (demo pro marido) é o
  próximo passo — não falta mais nenhuma fase técnica.
  Painel tem 5 conversas fictícias semeadas pra demonstração — falta decidir se apaga ou mantém.
- CNAE/MEI: não trava mais o piloto, mas segue pendente antes de cobrar o próximo odonto.
- Kaptar (ver `ferramentas.md`): liberado só pra busca/mapeamento de nicho, baixo volume; resto
  pausado até Twenty ativo (2026-09-14).
