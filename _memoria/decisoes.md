<!-- quem alimenta: o /atualizar acrescenta no fim; robô nunca escreve aqui (propõe por recado). Lido quando perguntam "por quê" ou antes de mudar algo já decidido. -->
# Decisões

Uma entrada por decisão, sempre acrescentada no fim, nunca reescrita. É o arquivo mais barato do
sistema e o que mais evita retrabalho: daqui a três meses, quando alguém (inclusive você) perguntar
"por que a gente faz assim?", a resposta está aqui.

O que entra: escolheu um caminho e descartou outro, mudou de ideia, fechou um preço, definiu uma
regra de trabalho. O que não entra: tarefa feita (isso é o diário).

**Formato de cada entrada:**

```
- **AAAA-MM-DD** (quem decidiu: o nome da pessoa, ou a origem se foi um robô) [projeto, se for de projeto]: a decisão em uma frase. Por quê: o motivo em outra. Substitui: AAAA-MM-DD (só quando muda uma decisão anterior; a antiga fica onde está)
```

---

<!-- as decisões entram abaixo, a mais nova por último -->

- **2026-09-10** (Rafael): perfil do sistema é agência, com traço de projeto próprio. Por quê:
  a Noryos vai atender clientes externos de PME com processo de entrega (sites, ads, SEO,
  conteúdo), mas também mantém projetos internos da própria empresa (site institucional, CRM) —
  daí a pasta `projetos/` além de `clientes/`, `propostas/` e `briefings/`.
- **2026-09-10** (Rafael): o projeto anterior do site + CRM (outro kit, "MazyOS", em
  `noryosinovacoes\noryosinovacoes_OS\projetos\Noryos-Inovacoes\`) não é migrado nem copiado pra
  cá — fica ligado depois via `/novo-projeto link`. Por quê: é um site em produção com deploy
  automático pra Hostinger a partir do GitHub; mover o código arriscaria quebrar o pipeline.
- **2026-09-10** (Rafael): GitHub e Supabase conectados por MCP local (escopados a este projeto);
  Supabase em modo somente-leitura. Por quê: nenhum `gh` CLI estava instalado na máquina, e o
  banco do Supabase é de produção com leads reais — leitura evita escrita ou exclusão acidental.
- **2026-09-10** (Rafael): Twenty CRM não ganhou conector MCP nesta rodada, fica marcado "não
  ligada" em `ferramentas.md`. Por quê: não existe conector pronto no catálogo do kit pra ele; o
  CRM segue em configuração manual (Fase 1).
- **2026-09-11** (Rafael): o repositório do RatosOS (`noryosinovacoes-os`) fica separado do
  repositório do site institucional (`noryosinovacoes`). Por quê: evitar misturar o histórico de
  configuração do sistema com o pipeline de deploy de produção do site na Hostinger.
- **2026-09-11** (Rafael): estrutura jurídica provisória da Noryos vai usar o MEI da esposa (já
  existente, hoje usado pra revenda Shopee/Mercado Livre), incluindo CNAEs secundários de serviço.
  Por quê: Rafael é CLT e evita expor seu CPF; é caminho mais rápido que abrir CNPJ novo agora. É
  temporário: migra pra CNPJ próprio ou ME quando o faturamento somado (revenda + Noryos) se
  aproximar do teto do MEI.
- **2026-09-11** (Rafael): a esposa entra formalmente na operação como sócia de fato — assume
  comercial e jurídico (vendas, atendimento, fechamento; já tem experiência em marketing digital e
  vendas), Rafael assume a entrega técnica fora do horário comercial (é CLT na Sicoob Confederação;
  sobram 3-4h por noite + fim de semana livre). Faturamento entra em caixa único da família, sem
  divisão formal entre os dois. Por quê: aproveita a disponibilidade dela em horário comercial (ele
  não tem) e a competência complementar dos dois.
- **2026-09-11** (Rafael): oferta core fechada em 3 serviços — site institucional (R$1.800–3.000 +
  manutenção opcional R$80–120/mês), Google Meu Negócio (R$450–650) e tráfego pago (R$800–1.200/mês
  por plataforma, fee fixo, contrato mínimo de 3 meses); o NoryosInovaçõesOS (produtizar a estrutura
  do RatosOS pra vender a clientes) fica pra uma segunda fase. Por quê: são as três ofertas com
  maturidade e prova (o próprio site da Noryos) suficiente pra vender agora; preço ancorado em
  mercado de PME brasileiro, evitando percentual de mídia e contrato curto demais.
- **2026-09-11** (Rafael): os 3 primeiros clientes (via rede pessoal — clínica odontológica de um
  amigo próximo, clínica de estética da esposa de outro amigo, estrutura online pro primo
  psicólogo) serão atendidos de graça pra site/Google Meu Negócio em troca de case e indicação;
  tráfego pago, se algum quiser, é cobrado desde o primeiro mês, mesmo que simbólico; execução em
  sequência — odontologia, depois estética, depois psicologia — não em paralelo. Por quê: reduz o
  atrito do primeiro "sim" sem travar preço de serviço recorrente; a sequência permite construir um
  processo de entrega reaproveitável e aplicar aprendizado de um cliente no próximo.
- **2026-09-11** (Rafael): o nicho de odontologia não será declarado oficialmente ainda, mesmo com o
  primeiro cliente-piloto sendo uma clínica odontológica. Por quê: um cliente não valida nicho; a
  decisão de nichar só será tomada depois de 2-3 clientes do setor fechados e evidência de que a
  indicação entre colegas de profissão puxa novos clientes sozinha.
- **2026-09-11** (Rafael): antes de rodar qualquer campanha paga ou peça de marketing pros clientes
  de odontologia, estética ou psicologia, checar a resolução de publicidade do conselho de classe
  correspondente (CFO, CFP, e o que for aplicável em estética). Por quê: são profissões
  regulamentadas com restrição a promessa de resultado, antes/depois e depoimento sem autorização —
  ignorar isso pode gerar problema ético pro cliente, não só pra Noryos.
