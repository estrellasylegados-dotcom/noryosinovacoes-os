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
demonstração ao vivo pro marido, não um documento formal. Fases 1-5 do CRM (painel, ficha,
resumo, reativação automática) + V1 do painel (menu, login por atendente, Equipe, Conexão) em
produção. **CRM ganhou Chat ao Vivo, Relatórios e dark mode em produção de verdade (2026-09-15)**
(a pedido do Rafael, inspirado na RoiZap): inbox real com envio pelo painel, contador de mensagens
não lidas, dashboard de relatórios com gráficos, tema claro/escuro em todo o painel, Conexão do
WhatsApp com apelido interno e desconectar — detalhe completo em
`clientes/odontominas/andamento.md`. **Agentes de IA construídos na mesma data**: sidebar com
"Ferramentas" > "Agentes de IA", 5 provedores (Gemini/Groq grátis, GPT/Claude/DeepSeek pagos),
resposta automática de verdade pelo WhatsApp quando uma etiqueta-gatilho é aplicada — pronto e
validado localmente, mas **ainda não commitado, não deployado, e a migração `v9` não foi rodada**.
Próximo passo: rodar a migração + configurar 1 chave de IA, depois Fase 6 (demo pro marido).
Compliance jurídico: risco de exclusividade Mirante/Sicoob aceito conscientemente.

## Pendências

- Rodar a migração `2026-09-15_v9_agentes_ia.sql` do CRM da OdontoMinas no SQL Editor do Supabase
  e configurar pelo menos 1 chave de IA (`GOOGLE_API_KEY` é grátis) antes do Agentes de IA
  funcionar de verdade (2026-09-15).
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

- Cliente-piloto #1 (OdontoMinas): site no ar, CRM com Chat ao Vivo + Relatórios + dark mode +
  Conexão redesenhada, tudo validado em produção de verdade. Fase 6 (demo pro marido) é o próximo
  passo. Painel tem 5 conversas fictícias semeadas pra demonstração — falta decidir se apaga ou
  mantém.
- CNAE/MEI: não trava mais o piloto, mas segue pendente antes de cobrar o próximo odonto.
- Kaptar (ver `ferramentas.md`): liberado só pra busca/mapeamento de nicho, baixo volume; resto
  pausado até Twenty ativo (2026-09-14).
