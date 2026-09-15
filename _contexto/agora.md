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
resumo, reativação automática) em produção. **V1 do painel incrementada em 2026-09-15** (a pedido
do Rafael, "a Ariadna precisa ser impactada já na V1"): menu lateral, login individual por
atendente (troca as 2 senhas compartilhadas), tela Equipe (atendimento por secretária) e tela
Conexão (status do WhatsApp + QR pra reconectar) — testado ao vivo contra Supabase/Evolution API
de produção, mas ainda não em produção de verdade (falta rodar a migração, ver pendência). Próximo
passo depois disso: Fase 6 (demo pro marido). Compliance jurídico: risco de exclusividade
Mirante/Sicoob aceito conscientemente.

## Pendências

- Rodar `2026-09-15_v4_equipe.sql` (SQL Editor do Supabase) e `railway up` no CRM da OdontoMinas —
  troca as 2 senhas compartilhadas do painel por 1 conta por atendente; semeia 3 contas de demo
  (`admin`/`recepcao1`/`recepcao2`, senha `<usuario>-temp-2026`) a renomear pelas secretárias reais
  antes da demo. Substitui a pendência antiga "trocar as senhas temporárias" (2026-09-15).
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

- Cliente-piloto #1 (OdontoMinas): site no ar, CRM até a Fase 5 validado em produção + V1 do
  painel incrementada (menu, login por atendente, Equipe, Conexão) testada ao vivo mas travada até
  rodar a migração v4 (pendência acima). Fase 6 (demo pro marido) é o próximo passo depois disso.
  Painel tem 5 conversas fictícias semeadas pra demonstração — falta decidir se apaga ou mantém.
- CNAE/MEI: não trava mais o piloto, mas segue pendente antes de cobrar o próximo odonto.
- Kaptar (ver `ferramentas.md`): liberado só pra busca/mapeamento de nicho, baixo volume; resto
  pausado até Twenty ativo (2026-09-14).
