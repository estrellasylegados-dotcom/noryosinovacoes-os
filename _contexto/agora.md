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
demonstração ao vivo pro marido, não um documento formal. Fase 3 do CRM (painel de atendimento)
completa e validada de ponta a ponta, em produção (2026-09-15): lista de conversas, status, tempo
até 1ª resposta com destaque de atraso, painel agora protegido por login (remendo mínimo — 2
perfis, admin/atendente, sem permissão diferenciada ainda). Compliance jurídico: risco de
exclusividade Mirante/Sicoob aceito conscientemente. Revisão técnica em 2026-09-15: 2 bugs reais
corrigidos no funil de atendimento, login com rate limit, 71 testes automatizados novos (detalhe
em `clientes/odontominas/andamento.md`) — código pronto, falta aplicar em produção.

## Pendências

- Aplicar em produção os ajustes da revisão técnica de 2026-09-15: rodar a migração
  `2026-09-15_v2_aguardando_desde.sql` no SQL Editor do Supabase e fazer `railway up` (corrige o
  funil de atendimento e endurece o login) — nada disso está em produção ainda.
- Trocar as senhas temporárias do painel do CRM (`dev-admin-temp`/`dev-atendente-temp`, hoje em
  produção no Railway por decisão consciente do Rafael) antes de expor o painel pra equipe real da
  clínica; RBAC completo por perfil (permissão diferenciada) fica pra depois que o piloto validar
  (2026-09-15).
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

- Cliente-piloto #1 (OdontoMinas): site no ar, painel de atendimento (Fase 3) validado em produção;
  Fase 4 (ficha de paciente + resumo executivo) é o próximo passo — demonstrar funcionando é a
  "proposta" pro marido/Ariadna.
- CNAE/MEI: não trava mais o piloto, mas segue pendente antes de cobrar o próximo odonto.
- Kaptar (ver `ferramentas.md`): liberado só pra busca/mapeamento de nicho, baixo volume; resto
  pausado até Twenty ativo (2026-09-14).
