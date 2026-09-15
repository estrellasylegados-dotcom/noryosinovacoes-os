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
- **2026-09-11** (Rafael): segue com a Noryos assumindo que não há restrição explícita de atividade
  externa remunerada no vínculo com a Mirante Tecnologia (empresa que o emprega como terceirizado
  alocado no Sicoob Confederação), com base em colegas de trabalho que já têm empresa própria sem
  problema aparente. Confidencialidade sobre qualquer informação, sistema ou processo do
  Sicoob/Mirante segue como linha inegociável, independente disso. Por quê: checar formalmente o
  contrato/código de conduta teria custo de tempo desproporcional ao risco percebido; risco
  residual (cláusula de exclusividade escrita não lida) é conscientemente aceito.
- **2026-09-11** (Rafael) [odontominas]: construir o scaffold técnico do site da OdontoMinas
  agora, antes da proposta ser apresentada à Ariadna, usando `[PLACEHOLDER: ...]` explícito em
  todo conteúdo que depende de fato real ainda não confirmado (nome+CRO do responsável técnico,
  endereço, serviços exatos, tom de voz, hex da cor) — nunca inventado. Por quê: acelera a entrega
  quando a proposta fechar, sem travar o trabalho técnico numa decisão de negócio que só o Rafael
  resolve, e sem violar a Resolução CFO-196/2019 fabricando informação sobre uma clínica real.
- **2026-09-11** (Rafael) [odontominas]: hospedagem do site trocada pra Cloudflare Pages, com
  build de export estático (`output: "export"`), no lugar do padrão Hostinger/Node herdado do
  site institucional. Por quê: o site da OdontoMinas não tem nenhuma rota de servidor (sem API,
  sem banco — contato só via link de WhatsApp), então hospedagem estática é suficiente e mais
  simples; o site institucional (que tem API + Supabase + Resend) continua na Hostinger, pipeline
  intocado.
- **2026-09-14** (Rafael): pausa o setup de qualquer CRM (Twenty incluído) até o piloto #1
  (OdontoMinas) fechar comercialmente; os 3 pilotos seguem rastreados pelo `andamento.md` de cada
  pasta. Por quê: volume atual (3 leads-piloto, 0 cliente pago) não justifica o esforço de
  configuração; os gargalos reais de agora são jurídico (MEI da esposa) e comercial (alinhar com o
  marido da Ariadna), não ferramenta. Quando o piloto #1 fechar, liga Fase 1 do Twenty junto com os
  módulos de captação ativa do Kaptar — mesmo gatilho: deal flow real.
- **2026-09-14** (Rafael): Kaptar liberado só pra aba "Buscar" (mapeamento de nicho, baixo volume)
  por ora; Campanha, Automação e WhatsApp (S-zap) ficam pausados até três condições: contador
  confirmar que o MEI da esposa comporta os serviços, workspace do Twenty existir, e o piloto #1
  fechado servir de prova social. Por quê: sem case fechado nem CRM de destino, outbound frio
  converte mal e arrisca fechar cliente antes de poder faturar direito.
- **2026-09-14** (Rafael) [odontominas]: escopo do piloto #1 muda de "site+GMN grátis, tráfego
  cobrado à parte" pra pacote completo de graça — site + CRM de captação + tráfego pago (verba de
  mídia por conta da clínica, gestão sem custo). Por quê: reunião de Rafael com o marido da Ariadna
  redefiniu o piloto como prova de conceito replicável — ele tem contatos com outros dentistas e
  pretende indicar a mesma estrutura depois que rodar 100% na OdontoMinas; Ariadna só avança em
  projeto que vê funcionando, então a "proposta" formal vira uma demonstração ao vivo do CRM, não
  um documento.
- **2026-09-14** (Rafael) [odontominas]: CRM vira a atividade principal do projeto, com escopo e
  arquitetura definidos — camada de captação/relacionamento (atendimento, controle de clientes,
  resumo executivo, conversar com cliente, acompanhar tráfego pago), sem mexer na camada
  clínica/prontuário/financeiro do Controle Odonto; banco (Supabase, projeto próprio) com
  `clinica_id` em tudo mas deploy isolado por clínica (não plataforma multi-tenant); WhatsApp via
  Evolution API (self-hosted, não-oficial) hospedada na Railway nesta fase. Por quê: reconstruir a
  camada clínica é risco legal alto (LGPD, retenção de prontuário) e fora da competência da Noryos;
  solo/part-time não sustenta SaaS multi-tenant nem infra cara agora; Railway dá velocidade até a
  demo, migração pra VPS+Coolify fica pra quando replicar em várias clínicas pagando. Reaproveita
  por referência o scoring e a disciplina de persistência do Diagnóstico Digital (não o Kaptar,
  terceiro fechado sem API — checado e descartado).
- **2026-09-15** (Rafael) [odontominas]: deploy do CRM (Fase 2) direto no Railway, no mesmo
  projeto da Evolution API, em vez de um túnel temporário (cloudflared) só pra validar o webhook.
  Por quê: Rafael quis evitar solução descartável e já deixar a Fase 2 validada numa arquitetura
  próxima da definitiva, já que o Railway vai seguir hospedando o CRM nas próximas fases mesmo
  assim.
- **2026-09-15** (Rafael): integração de MCP (Supabase CRM e Railway) feita via login de CLI +
  token de acesso pessoal (escopo local, fora do git) em vez do fluxo OAuth HTTP padrão. Por quê:
  o servidor MCP HTTP do Supabase (`supabase-crm-odontominas`, `.mcp.json`) travou em "Pending
  approval" mesmo depois de 3 aprovações numa sessão interativa separada, sem causa identificada;
  o caminho por CLI (`railway login --browserless`, token pessoal do Supabase) funcionou de
  primeira e não depende de aprovação assíncrona.
- **2026-09-15** (Rafael) [odontominas]: o painel do CRM ganha 2 perfis de acesso (`admin`,
  `atendente`), não os 6 cargos sugeridos inicialmente (Admin, Gestor, Gerente, Dentista,
  Assistente, Atendente); e ganha um remendo mínimo de senha compartilhada por perfil, sem
  permissão diferenciada entre eles ainda — RBAC completo (Supabase Auth, tabela de usuário,
  permissão por rota) fica pra depois que o piloto validar. Por quê: só a Ariadna e o marido
  aparecem confirmados na operação da OdontoMinas hoje — Gestor/Gerente/Dentista/Assistente seriam
  hierarquia especulativa sem equipe real pra ocupar; o painel também não tem, ainda, nenhuma ação
  que precise ser diferenciada por cargo (as duas roles fazem a mesma coisa). Fechar a exposição
  pública de dado de paciente (LGPD) era mais urgente do que construir permissão fina, e um sistema
  de login completo atrasaria as Fases 4-6 rumo à demo pro marido/Ariadna.
