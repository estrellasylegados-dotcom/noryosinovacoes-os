<!-- contexto do projeto: escopo, combinados, contato. Material bruto (transcrição, print, PDF) é destilado aqui com data e caminho da fonte. -->
# Contexto · OdontoMinas

## Quem é

- **Cliente:** OdontoMinas — clínica de implantes e ortodontia.
- **Dona:** Ariadna Pires.
- **Contato de acesso:** o marido dela, colega de trabalho do Rafael — é por ele que a proposta
  passa antes de chegar na Ariadna.
- **Como chegou:** 1 dos 3 clientes-piloto mapeados via rede pessoal do Rafael (decisão
  2026-09-11), junto com uma clínica de estética e um psicólogo.

## Escopo combinado

- **Entrega de graça (cortesia em troca de case/indicação):** site institucional + Google Meu
  Negócio.
- **Cobrado à parte, desde o primeiro mês, se ela quiser:** tráfego pago (Google/Meta Ads).
- Execução em sequência com os outros 2 pilotos — não em paralelo (decisão 2026-09-11).

## Prazo

Em aberto (2026-09-11). Próximo passo antes de qualquer proposta formal: Rafael alinha com o
marido da Ariadna (colega de trabalho dele) o que vai ser oferecido, antes de apresentar pra ela.

## Stack do site

Reaproveitar por referência o UI kit do site institucional da Noryos (Next.js 15 + React 19 +
TypeScript + Tailwind v4 + deploy Hostinger/GitHub Actions) — não copiar o repo inteiro, não
trazer conteúdo específico da Noryos (Diagnóstico Digital, NoryosOS) nem o Supabase (é específico
do Diagnóstico). Formulário de contato pode ir direto pra WhatsApp/e-mail, sem precisar de banco.

## Compliance obrigatório antes de produzir qualquer peça (site, GMN, ads)

Odontologia é profissão regulamentada — Resolução CFO-196/2019 (Código de Ética Odontológica,
não revogada pela CFO-271/2025):

- **Antes/depois:** permitido, mas exige TCLE (termo de consentimento) assinado pelo paciente +
  identificação do cirurgião-dentista responsável em cada peça.
- **Depoimento de paciente:** proibido, sem exceção.
- **Proibido:** promessa de resultado/cura, superlativo ("o melhor", "número 1"), comparação com
  outros profissionais, "especialista" sem RQE registrado no CFO, influenciador não-dentista
  divulgando a clínica.
- **Obrigatório em toda peça:** nome do profissional responsável + CRO.

## Identidade visual

Marca própria — ver `marca/design-guide.md`. Logo já existe (Ariadna mandou o arquivo); cores
predominantes verde-petróleo escuro e branco, especialidade "Implantes e Ortodontia" no
subtítulo da marca.

## Material institucional recebido

Fonte: WhatsApp, Rafael Viriato, colado na conversa em 11/09/2026 (dois textos que a própria
clínica já usa em material institucional/redes — não é conteúdo final do site, é matéria-prima
pra usar quando a proposta e o tom de voz forem fechados com a Ariadna).

- **Prêmio Top Empresarial**, categoria Clínica Odontológica — segundo o texto, recebido desde
  2014, todo ano.
- **Tempo de atuação:** "há mais de 18 anos" (texto de "Quem Somos").
- **Localização:** Brazlândia-DF (ainda sem endereço completo).
- **Valores declarados pela clínica:** ética, transparência, excelência, confiança, inovação,
  humanização, compromisso. Missão declarada: cuidar de sorrisos, bem-estar e autoestima.
- **Atenção compliance (Resolução CFO-196/2019) antes de usar este texto no site:** o original
  usa "referência em saúde bucal" e "profissionais especializados" — termos que podem soar
  superlativo ou "especialista" sem RQE registrado no CFO; revisar a redação antes de publicar,
  não copiar literalmente.
- **Contradição encontrada:** o texto institucional diz "há mais de 18 anos", mas o CNPJ (ver
  abaixo) abriu em 2013 — na data deste registro (11/09/2026) são ~13 anos, não 18. O site não usa
  mais "18 anos": calcula os anos de atuação a partir de 2013 (`getAnosDeAtuacao()` em
  `site/src/lib/config.ts`), pra nunca mais ficar desatualizado nem incorreto.

## Dados reais encontrados (pesquisa pública, colada por Rafael no chat em 11/09/2026)

Fonte: brief detalhado que Rafael colou no chat, com pesquisa pública sobre a clínica e a Dra.
Ariadna (CNPJ, endereço, CRO, formação). Não é confirmação direta da Ariadna — é o que está
publicamente disponível hoje. Tudo abaixo já está centralizado em `site/src/lib/config.ts` e
`site/src/content/equipe.ts`; nunca hardcodar de novo em componente.

- **Razão social:** Odontominas Serviços Odontológicos Ltda. — **CNPJ:** 18.268.981/0001-18
  (aberto em 2013 — usado como `anoFundacao`).
- **Endereço encontrado:** Setor Norte, Quadra 5, Lote 17, Brazlândia — Brasília/DF, CEP
  72705-050. **Atenção:** existem registros antigos na internet com outro lote — não está
  validado com a Ariadna, precisa confirmar antes deste site ir ao ar de verdade.
- **Telefone fixo público:** (61) 3479-3574. **WhatsApp oficial:** ainda não confirmado (segue
  `TODO_CLIENTE` em `config.ts` — nenhum número foi inventado).
- **E-mail encontrado:** odontominasdf@gmail.com — confirmar se segue monitorado.
- **Horário encontrado:** seg-sex 8h-18h, sáb 8h-12h, dom fechado.
- **Reputação pública:** ~4,9/5 no Google, mais de 80 avaliações.
- **Dra. Ariadna Pires da Fonseca** — Cirurgiã-Dentista, CRO-DF 7868. Graduação em Odontologia
  pela Universidade de Uberaba (2001-2006, confirmado e publicado). Há registro público de 2011
  sobre implante imediato em região estética e de defesa de Mestrado em Biologia Oral em 2019
  (impressão 3D/análise dimensional) — **nenhum dos dois foi publicado no site**: ficam marcados
  `confirmado: false` em `site/src/content/equipe.ts` até a Ariadna validar diretamente a redação
  (o mestrado especificamente como `TODO_CLIENTE_CONFIRMAR`, por pedido explícito do Rafael).
  Nunca chamá-la de "especialista em implantodontia" sem RQE registrado no CFO — o site usa
  "atuação em".
- **Responsável técnico da pessoa jurídica** (pra rodapé/compliance) ainda não confirmado — pode
  ou não ser a própria Ariadna, não presumir. Fica vazio em `config.ts` até confirmação; o rodapé
  só renderiza a faixa quando o dado existir de verdade.

## Rebuild do site (11/09/2026)

A pedido do Rafael, o scaffold técnico virou um site editorial completo — arquitetura de dados
centralizada, copy própria (sem clichê, sem placeholder visível), SEO local (Schema.org Dentist +
Service + FAQPage), motion system consolidado num só (removido o sistema morto herdado do site
institucional/Diagnóstico Digital), e build trocado de `standalone` (Hostinger) pra `export`
(Cloudflare Pages, decisão de hospedagem do mesmo dia). Detalhe completo em `andamento.md`.
