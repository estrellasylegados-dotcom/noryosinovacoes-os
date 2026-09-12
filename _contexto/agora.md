<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

## Onde paramos

1º cliente-piloto em execução: `clientes/odontominas/` (Ariadna Pires, implantes e ortodontia)
com escopo, compliance e marca já documentados. O site deixou de ser scaffold e virou um redesign
editorial completo (`clientes/odontominas/site/`) — copy própria, SEO local, arquitetura de dados
centralizada, com dados públicos reais já incorporados (CNPJ, endereço, telefone, CRO da Ariadna,
horário, avaliação do Google). Hospedagem decidida pra Cloudflare Pages (export estático, ver
decisões 2026-09-11); conta Cloudflare já criada, mas o deploy de fato ainda não foi feito — falta
fechar a lista de TODO_CLIENTE (ver `clientes/odontominas/andamento.md`). Próximo passo de negócio
segue o mesmo: Rafael alinhar com o marido dela (colega de trabalho) antes de apresentar a proposta
formal — prazo ainda não combinado. Compliance jurídico avançou bastante (ver decisões
2026-09-11): risco de exclusividade Mirante/Sicoob aceito conscientemente; falta confirmar com o
contador se o MEI da esposa realmente comporta os serviços da Noryos.

## Pendências

- **Crítica:** confirmar com o contador se site/tráfego pago/publicidade cabem no MEI da esposa —
  pesquisa aponta que não constam no Anexo XI (CGSN 140/2018); se não couber, decidir caminho (ME
  própria?) antes de cobrar qualquer coisa do 1º cliente que pagar tráfego pago (2026-09-11).
- Alinhar com o marido da Ariadna o que vai ser oferecido, antes de apresentar a proposta pra ela
  (2026-09-11).
- Depois que a proposta for aprovada, confirmar com a Ariadna o que a pesquisa pública não resolveu
  (endereço/telefone/horário/CRO já vieram de fonte pública, ver `clientes/odontominas/contexto.md`):
  número oficial do WhatsApp, responsável técnico da pessoa jurídica, redação do item de
  formação de 2011 e do Mestrado de 2019, Endodontia/Periodontia, convênios e formas de pagamento,
  fotos reais, domínio próprio (2026-09-11).
- Confirmar se a responsável técnica da clínica de estética (2º piloto) é médica, biomédica ou
  esteticista — muda se aplica a Resolução CFM 2.336/2023 ou vigilância sanitária (2026-09-11).
- Definir prazo realista de entrega da OdontoMinas, depois de alinhar com o marido da Ariadna
  (2026-09-11).
- Mapear processos recorrentes (`/mapear`) quando a operação tiver rotina definida — rodou vazio em
  2026-09-11, empresa ainda em estruturação.
- Ligar o projeto existente do site/CRM via `/novo-projeto link`, sem mover o código nem quebrar o
  deploy da Hostinger (2026-09-10).
- Fase 1 do CRM Twenty: criar o workspace (`noryos.twenty.com`) e rodar o import piloto do Kaptar +
  teste de pipeline ponta a ponta (2026-09-10).

## Quente agora

- Cliente-piloto #1 (OdontoMinas) com projeto aberto e scaffold do site já construído; sequência
  continua estética → psicologia depois (decisão 2026-09-11).
- Verificação do CNAE/MEI com o contador é o bloqueio mais crítico do momento — trava cobrar
  qualquer coisa, inclusive tráfego pago.
