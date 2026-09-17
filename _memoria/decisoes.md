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
- **2026-09-15** (Rafael) [odontominas]: escopo de features do MCP do Supabase
  (`supabase-crm-odontominas`, `.mcp.json`) reduzido de
  `docs,account,database,debugging,development,functions,branching` pra
  `docs,database,debugging,development`. Por quê: `account`/`branching` já ficavam desligados na
  prática pelo `project_ref` na URL (escopa a ferramenta só a este projeto), e `functions` não se
  aplica — o CRM roda no Railway, não em Edge Functions do Supabase; menos ferramenta exposta pra
  qualquer sessão futura neste repo, sem perder nada que já era usado de verdade. `read_only=true`
  ficou de fora de propósito (bloquearia rodar a migração pendente por MCP) — fica pra decidir
  quando o MCP for reautorizado.
- **2026-09-15** (Rafael) [odontominas]: a automação de destaque da Fase 5 do CRM é reativação de
  paciente inativo, não lembrete de consulta (as 2 opções previstas no plano técnico). Por quê:
  lembrete de consulta dependia de construir do zero um jeito de cadastrar consulta — a tabela
  `consultas` existe desde a Fase 1 mas nada no código escreve nela ainda, nem webhook nem painel —
  ou seja, carregava escopo extra antes da automação em si. Reativação reaproveita dado que já
  existe (`conversas`/`mensagens`/`eventos_funil`, o mesmo cálculo de "esfriando" que já alimenta o
  `/resumo`), sem depender de nada novo no banco.
- **2026-09-15** (Rafael) [odontominas]: Resumo executivo (números do funil) vira exclusivo do
  perfil admin no painel do CRM — atendente não vê o link nem acessa a URL direto. Por quê: Rafael
  testou os 2 logins e achou que admin e atendente terem os mesmos menus "não faz sentido". Resto
  do painel (lista de conversas, mudar status, ficha de paciente) segue igual pros 2 — é onde o
  atendente trabalha o dia a dia; RBAC completo por permissão ainda fica pra depois que o piloto
  validar (decisão de 2026-09-15 anterior, sobre os 2 perfis).
- **2026-09-15** (Rafael) [odontominas]: painel do CRM troca as 2 senhas compartilhadas
  (`PAINEL_SENHA_ADMIN`/`PAINEL_SENHA_ATENDENTE`) por 1 conta por atendente (tabela `atendentes`,
  senha com hash scrypt — migração `2026-09-15_v4_equipe.sql`, `Substitui: 2026-09-15` a decisão de
  "remendo mínimo de senha compartilhada" sobre os 2 perfis, que seguem valendo como papel de cada
  conta). Por quê: Rafael pediu pra saber atendimento por secretária (quantidade, tempo de
  resposta) na tela nova Equipe — sem identidade individual não dá pra atribuir quem atendeu o quê;
  a troca também resolve, de brinde, a pendência antiga de tirar as senhas temporárias de
  desenvolvimento de produção antes de expor o painel pra equipe real.
- **2026-09-15** (Rafael) [odontominas]: Chat ao Vivo construído agora, indo além do escopo do V1
  ("visibilidade + ação leve", sem thread nem envio pelo painel) — inbox real (lista + thread +
  resposta), inspirado na ferramenta RoiZap que o Rafael usa em outro negócio. De propósito, sem
  Grupos (o webhook já filtra mensagem de grupo, não existe esse dado aqui), CSAT (não existe
  pesquisa de satisfação no sistema), "Instâncias" (1 clínica = 1 WhatsApp, não agrega nada) nem
  "Análise IA" (não existe essa funcionalidade). "Concluído" reaproveita os status já resolvidos do
  funil (`respondido`/`agendado`/`perdido`) em vez de um campo novo, pra não ter dois conceitos de
  "resolvido" divergindo. Contador de mensagens não lidas é a contagem de verdade por conversa
  (incrementada pelo webhook), não só um booleano "tem não lida" — o Rafael pediu explicitamente
  depois de ver a diferença num print da RoiZap.
- **2026-09-15** (Rafael) [odontominas]: "Resumo Executivo" virou "Relatórios" — dashboard com
  filtro de período, cards e gráficos, no estilo do "Painel Principal" da RoiZap. A tela Equipe
  (antes item próprio no menu) virou uma aba dentro de Relatórios; a página `/equipe` continua
  existindo, só saiu do menu lateral. Por quê: o Rafael pediu explicitamente pra reorganizar nesse
  formato, comparando com a ferramenta de referência.
- **2026-09-15** (Rafael) [odontominas]: dark mode funcional em todo o painel do CRM, construído
  sobrescrevendo em `globals.css` as variáveis CSS que o Tailwind v4 já gera pra cada cor usada no
  app, em vez de espalhar a classe `dark:` em cada uma das ~20 telas. Por quê: era o jeito de menor
  risco/esforço de cobrir o painel inteiro de uma vez (confirmado o nome exato de cada variável no
  CSS compilado antes de escrever, não foi suposição) — e o Rafael confirmou que queria "funcional
  em tudo", não só o ícone do botão.
- **2026-09-15** (Rafael) [odontominas]: a Conexão do WhatsApp ganhou um apelido interno editável
  (`clinicas.apelido_instancia`) e um botão "Desconectar" de verdade (chama a Evolution API,
  `DELETE /instance/logout`), ambos comparando com o rodapé de ações da RoiZap. Por quê: o "editar
  nome" é só rótulo local pro CRM — o Rafael confirmou explicitamente que não queria mexer no
  perfil real do WhatsApp. "Desconectar" foi pedido depois de eu ter deixado de fora por padrão
  (ação real, derruba a sessão até escanear QR novo) — mantido com confirmação em modal antes de
  executar, e sem os outros ícones da RoiZap (anunciar, agendar, excluir) que não têm
  funcionalidade real por trás neste sistema.
- **2026-09-15** (Rafael) [odontominas]: Agentes de IA (CRM) respondem o paciente de forma
  **síncrona, dentro do próprio webhook** da Evolution API, em vez de fila/cron como a reativação
  de paciente inativo. Por quê: o CRM roda num container Node persistente no Railway, não uma
  função serverless com timeout curto — uma chamada de LLM de poucos segundos dentro do handler é
  segura ali; fila/worker novo só se justificaria se o deploy fosse serverless. Gatilho de
  ativação reaproveita o sistema de etiquetas já existente (uma etiqueta por agente), em vez de
  criar um catálogo de tag novo. Provedores de IA (Gemini, Groq, GPT, Claude, DeepSeek) via `fetch`
  puro sem SDK novo, chave de API por variável de ambiente no Railway — sem armazenamento
  criptografado por clínica no Supabase, porque a arquitetura de hoje ("path B") já é uma instância
  por clínica, sem precedente de segredo por-tenant no código; revisar se isso virar multi-clínica
  de verdade.
- **2026-09-15** (Rafael) [odontominas]: todo Agente de IA novo nasce Pausado (`ativo=false`) e o
  prompt sugerido já embute as regras da Resolução CFO-196/2019 (sem promessa de resultado, sem
  superlativo). Por quê: é a primeira peça do CRM que gera texto solto pra um paciente real sem
  revisão humana antes de sair — a segurança fica garantida pelo estado inicial do sistema, não por
  um aviso que dependeria de alguém lembrar de configurar.
- **2026-09-15** (Rafael) [odontominas]: escopo da Fase 2 dos Agentes de IA (o resto do print da
  RoiZap que a Fase 1 tinha deixado de fora) dividido em 3 blocos, não construído tudo de uma vez.
  Fase 2A (horário de atendimento, transferência pra humano real, "Avisar Membro da Equipe", itens
  rápidos): construída na hora. Fase 2B (Buffer de mensagens): logo em seguida, isolada por ser a
  única mudança de arquitetura de verdade do grupo. Fase 2C (transcrição de áudio, leitura de
  imagem/documento, mensagens interativas, "digitando...", follow-up automático, e a IA agir
  sozinha no CRM): decide depois que o piloto rodar com paciente de verdade. Por quê: o critério
  não foi dificuldade técnica, foi valor de negócio — o que dá confiança pra ligar o agente de vez
  é a rede de segurança (avisar a equipe + ceder pra humano quando a IA não sabe), não
  funcionalidade extra; a peça mais arriscada (IA mexendo sozinha no CRM) fica pro fim de propósito,
  só depois de tudo o resto validado com uso real.
- **2026-09-15** (Rafael) [odontominas]: modelo de IA do Google no catálogo (`ia-provedores.ts`)
  passou a usar o alias `gemini-flash-lite-latest` em vez de um id de modelo fixo
  (`gemini-2.5-flash-lite`). Por quê: o Google descontinuou esse modelo pra chaves novas sem aviso
  (404 "no longer available to new users") bem no meio do 1º teste real do agente — um id fixo
  quebra em produção sempre que o provedor aposentar aquele modelo pontual; o alias se atualiza
  sozinho e evita repetir esse mesmo incidente.
- **2026-09-15** (Rafael) [odontominas]: "Pausar IA"/"Retomar IA" no Chat ao Vivo desligam e
  reconectam o agente de vez (`agente_ativo_id`), não uma pausa temporizada nova. Por quê: já existe
  uma pausa automática (`pausarAgenteSeConfigurado`, dispara quando um atendente responde na mão e
  expira sozinha); o pedido do Rafael era controle manual e imediato ("um humano assume"), que pede
  um desligamento de verdade, não mais uma janela de tempo pra gerenciar. "Retomar" reconecta pelo
  agente cuja etiqueta-gatilho já está na conversa, em vez de exigir tirar e recolocar a etiqueta —
  não precisou de coluna nova no banco.
- **2026-09-15** (Rafael) [odontominas]: notificação de mensagem no CRM passou a ter 2 caminhos —
  Notification API do navegador (som que só o Rafael confirmou explicitamente na sessão) além do
  sino do painel (que já existia, só conta com a aba em foco), com controle de 3 posições
  (Desligadas/Todas/Só esfriando) em vez de um liga/desliga comum. Por quê: referência era um
  banner da RoiZap ("ative notificações pra não perder mensagem") que resolve um problema real que
  o sino sozinho não resolve; as 3 posições aproveitam as 2 categorias que a notificação já
  distinguia (mensagem não lida vs. lead esfriando) em vez de inventar uma terceira coisa. Preferência
  fica em localStorage (é por navegador/pessoa, nunca no Supabase).
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: Fase 2B (Buffer de mensagens)
  validada de ponta a ponta em produção, mas fica **desligada** no agente "Recepção Virtual" por
  enquanto — o toggle já existe, é só ligar quando quiser. Por quê: nenhum paciente real usa o
  número ainda; o buffer só ajuda quando chegam várias mensagens seguidas, e pra mensagem única (o
  caso mais comum hoje) só acrescenta ~10-15s de espera sem ganho nenhum; o próximo marco é a demo
  pro marido, onde resposta rápida pesa mais que combinar uma rajada rara. Liga quando o atendimento
  for pro ar com paciente de verdade, ou de propósito pra mostrar a funcionalidade na demo.
- **2026-09-16** (Rafael) [odontominas]: das 4 abas novas do print da RoiZap (Conhecimento,
  Qualificação, Ferramentas, Pixel), só **Conhecimento** entrou de verdade nos Agentes de IA agora.
  Por quê: mesmo critério já usado no Chat ao Vivo — nunca copiar aba de referência sem
  funcionalidade real por trás. Qualificação não tinha um fluxo de perguntas definido pra construir;
  Ferramentas esbarraria em `consultas`, tabela que ainda ninguém escreve (nem webhook nem painel);
  Pixel só faz sentido quando o tráfego pago começar, o que ainda não aconteceu neste projeto.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas] — Substitui: 2026-09-16: da decisão
  de deixar Qualificação/Ferramentas/Pixel fora dos Agentes de IA por falta de critério,
  **Qualificação Automática de Leads entrou de verdade** (Ferramentas e Pixel continuam de fora,
  motivo original inalterado). Critério fechado antes de codar, 2 perguntas: escala fixa
  Quente/Morno/Frio (etiquetas nascem automaticamente por clínica, cor fixa por classificação) em
  vez de deixar a IA escolher entre etiquetas livres; reavaliada depois de cada resposta do agente,
  em vez de só na 1ª mensagem do lead. Por quê: o "fluxo de perguntas" que faltava na decisão
  anterior valia pra um questionário de qualificação — classificar a temperatura do lead pelo
  histórico da conversa não depende disso, e fecha a lacuna que tinha deixado a aba de fora.
- **2026-09-16** (Rafael) [odontominas] — Substitui: 2026-09-16: da mesma decisão de deixar
  Qualificação/Ferramentas/Pixel fora dos Agentes de IA, **Pixel de Conversão (Facebook Ads +
  Google Ads) entrou de verdade** (Ferramentas continua de fora, motivo original inalterado).
  Rafael pediu explicitamente pra pesquisar e implementar os dois; critério fechado antes de
  codar: os 3 eventos do funil de uma vez (novo lead, lead quente, agendado), nunca repetindo por
  conversa, e desligado por padrão (mesmo padrão da Qualificação — sem credencial real ainda). Por
  quê: "só faz sentido quando o tráfego pago começar" deixava de valer no momento em que o Rafael
  decidiu construir a infraestrutura agora, pronta pra ligar quando o tráfego pago começar — mesmo
  raciocínio que já valeu pra reverter a Qualificação horas antes.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: integração com o ControleODONTO
  (sistema de gestão da clínica) construída com todas as 7 capabilities (leitura/escrita de
  agenda, leitura/criação de paciente, receber webhook) desligadas por padrão, e só viram `true`
  manualmente em `capabilities.ts` depois de validação real contra uma conta — nunca por env var.
  Também decidido não criar ainda o workflow do GitHub Actions pro polling (rodaria de 5 em 5 min
  sem nenhuma capability ativa) e não criar o botão "Reprocessar falhas" no painel (seria idêntico
  a "Sincronizar agora" hoje). Por quê: pesquisa própria não confirmou nenhum contrato de API do
  ControleODONTO (autenticação, endpoint, payload) — a área pública de Webhooks está marcada
  "(FAZER)", vazia, e o endpoint de agenda citado no brief original não foi confirmado de forma
  independente. Rafael pediu explicitamente pra nunca inventar contrato e preferir integração
  parcialmente habilitada e correta a uma aparentemente completa baseada em suposição. Detalhe
  completo (pesquisa, checklist) em `clientes/odontominas/crm/docs/integrations/controle-odonto.md`.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: a evolução do módulo "Disparos" do
  CRM constrói o Motor de Públicos (segmentação reutilizável — etiqueta, status, inatividade,
  opt-out) ANTES do wizard de Disparos, não depois, e opt-out nasce como fundação cross-módulo, não
  como detalhe interno de Disparos. Por quê: auditoria do repositório mostrou que Disparos,
  opt-out, Fluxos e biblioteca de mensagens não existiam no código (só a automação fixa de
  reativação) — construir a segmentação 1x dentro de Disparos e extrair depois arriscaria a mesma
  regra divergir entre Disparos, Automações e Funil no futuro. Fase A (opt-out, mensagens salvas,
  motor de públicos v1) já em produção; Fase B (wizard + worker de envio) segue depois.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: Disparos v1 (Fase B) nasce **sem
  agendamento** (campanha só tem "salvar rascunho" ou "criar e iniciar agora" — escolher uma
  data/hora futura fica pra uma Fase C se fizer falta) e **sem janela de horário comercial** no
  worker de envio (ele manda a qualquer hora do dia enquanto a campanha estiver "enviando"; a hora
  de iniciar é responsabilidade de quem opera, não do sistema). Por quê: as 2 perguntas fechadas
  antes de codar, mesmo critério das fases anteriores — os dois recursos adicionam schema e caminho
  de teste sem um caso de uso concreto ainda pedindo por eles; mais simples de construir e validar
  primeiro, reabrir depois é barato.
- **2026-09-16** (Rafael) [odontominas]: os dados do teste fim a ponta de Disparos (paciente "Rafael
  (teste Disparos)", a conversa e a campanha, criados direto no banco de produção pra validar o
  worker com o número do próprio Rafael) **ficam no banco por enquanto**, em vez de apagados logo
  depois do teste. Por quê: evita recriar tudo de novo se precisar testar outra campanha antes da
  Fase 6. Rafael pediu explicitamente pra apagar **todo** dado de teste (não só este) antes de o
  sistema ir pra produção de verdade com clientes reais — pendência registrada em `agora.md`.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: **"Ferramentas → Campanhas"
  construído como módulo estratégico novo**, separado de Disparos — plano formal
  (`EnterPlanMode`/`ExitPlanMode`) a partir de um briefing extenso do Rafael. Auditoria encontrou
  que a tela "Campanhas" não existia (nav só tinha Agentes/Disparos/ControleODONTO) e que a tabela
  `campanhas` da Fase B de Disparos (v17) era, na prática, um Disparo (lote de envio) — exatamente
  a confusão que o briefing pedia pra resolver. Decisão: **renomear** `campanhas`/
  `campanha_destinatarios` → `disparos`/`disparo_destinatarios` (migração v18, rename puro, sem
  perda de dado) pra liberar o nome `campanhas` pro conceito estratégico novo (migração v19:
  `campanhas`, `campanha_canais`, `campanha_eventos`, mais `disparos.campanha_id` e
  `pacientes.campanha_id/utm_term/landing_page`). Uma campanha agrupa disparos por FK
  (`disparos.campanha_id`), nunca reimplementa envio/segmentação/opt-out — reusa
  `audiencias.ts` por `audiencia_id` e Disparos como estão. Por quê: "Campanha ≠ Disparo" era o
  ponto central do briefing; manter os dois com o mesmo nome no banco pra sempre seria a mesma
  ambiguidade que motivou o pedido. Sem tabela de métricas (tudo calculado ao vivo, mesmo padrão de
  `relatorios.ts`); sem chamada real a Meta/Google Ads (investimento é campo manual, mesmo critério
  já usado pra adiar o Pixel até existir tráfego pago real); `appointment_attended`/
  `treatment_closed` só por registro manual (ControleODONTO ainda sem credencial). Detalhe completo
  em `clientes/odontominas/crm/docs/campanhas.md`.
- **2026-09-16** (Rafael, recomendação de Claude) [odontominas]: reconstrução do módulo "Ferramentas
  → Fluxo de Conversa" do CRM vira motor de automação conversacional determinístico, tratado como
  infraestrutura crítica, fatiado em 6 fases com checkpoint do Rafael entre elas — Fase 0 (auditoria
  só-leitura do módulo atual: tabelas, rotas, editor, execução, riscos de loop/duplicidade/corrida),
  Fase 1 (arquitetura/schema/migrations, propostas antes de aplicar), Fase 2 (engine assíncrona +
  worker, fora do request HTTP), Fase 3 (paleta de blocos + editor visual), Fase 4 (testes
  unit/integração/e2e/carga/regressão), Fase 5 (teste real controlado no WhatsApp). Dois pontos do
  escopo original — aplicar migration em produção e enviar mensagem real de teste — nunca rodam
  sozinhos dentro de um fluxo automático, mesmo com todas as validações do próprio fluxo passando:
  exigem confirmação explícita do Rafael a cada vez. Fase 0 começa numa sessão nova, não na que
  gerou esta decisão. Por quê: o pedido original (prompt único cobrindo auditoria + arquitetura +
  engine + editor + testes + envio real de WhatsApp) é do tamanho de um programa de várias semanas,
  não de uma tarefa — rodar tudo de uma vez, ainda mais numa sessão perto do limite de contexto,
  arrisca fazer com pressa exatamente o módulo que precisa ser determinístico, auditável e seguro;
  fatiar com checkpoint evita isso e cria pontos de decisão antes de qualquer ação irreversível
  (schema de produção, envio real).
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: Fase 0 (auditoria só-leitura) do
  Fluxo de Conversa concluída — confirmado que o módulo não existe em nenhuma camada do sistema
  hoje (mesmo achado da auditoria de Campanhas). Relatório completo em
  `crm/docs/fluxo-conversa-auditoria-fase0.md`; visão completa que o Rafael colou no chat preservada
  em `crm/docs/fluxo-conversa-visao.md`. Antes de entrar na Fase 1, 3 perguntas em aberto foram
  fechadas:
  - **`reativacao.ts`**: migra pro motor novo no futuro (é estruturalmente um fluxo de 1 nó — gatilho
    por inatividade, condição de opt-out, 1 mensagem, guarda 1x — e é um dos templates que o próprio
    Rafael pediu), mas só depois do motor validado pelo teste isolado da Fase 5; nunca por
    substituição silenciosa do cron do GitHub Actions que já roda em produção. O schema da Fase 1
    trata "gatilho por inatividade" como cidadão de primeira classe por causa disso.
  - **Os 5 riscos já existentes** achados na auditoria: riscos 1/2/3 (buffer de agentes sem lock
    distribuído, `reativacao.ts` sem lock e sem checar opt-out, corrida de criação de
    paciente/conversa no webhook sem tratar `23505`) são bugs isolados no código atual, sem
    dependência da arquitetura nova — viram patch(es) à parte, com aprovação antes de qualquer
    deploy, sem esperar a reconstrução (risco 2 é falha de LGPD prática rodando em produção agora).
    Riscos 4/5 (recovery de lock só por TTL, sem watchdog) só importam de verdade com esperas longas
    — ficam dentro do desenho da Fase 1.
  - **Nomenclatura das tabelas**: português, seguindo a convenção de domínio já usada
    (`campanhas`/`disparos`/`agentes_ia`), não o `flow_*` em inglês da visão original (que era
    conceitual). 4 tabelas em vez das 9 sugeridas: `fluxos` (o fluxo), `fluxo_versoes` (grafo
    nós+arestas+config como jsonb numa coluna `definicao` — cada versão é um snapshot imutável,
    resolve sozinho "editar fluxo ativo não mexe em execução em andamento"), `fluxo_execucoes` (1
    linha por execução) e `fluxo_execucao_eventos` (log passo a passo + idempotência por unique
    key). Por quê: mais enxuto, mesmo espírito de "sem tabela de métricas, tudo calculado ao vivo"
    já validado em Campanhas, e jsonb versionado evita duplicar linhas de nó/aresta a cada nova
    versão publicada.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: Fase 1 (arquitetura/schema) do
  Fluxo de Conversa entregue **como proposta** — migration `v20` escrita em
  `crm/supabase/migrations/2026-09-17_v20_fluxo_conversa_schema.sql`, **não aplicada** em produção;
  documento completo em `crm/docs/fluxo-conversa-arquitetura.md`. Desenho revisado por uma segunda
  passada de arquitetura (agente Plan) antes de fechar. Pontos que fecham decisão de schema (além
  das 4 tabelas já decididas em 2026-09-17 acima):
  - `conversas` ganha `dono_conversa text check (in humano/agente_ia/fluxo)` +
    `fluxo_execucao_ativa_id` — resolve a arbitragem entre Fluxo de Conversa, Agente de IA e Humano,
    hoje implícita (`agente_ativo_id is null` = humano) e ambígua assim que existe um 3º candidato.
    Backfill reproduz a regra atual byte a byte; zero mudança de comportamento pra quem não usa
    Fluxo de Conversa. `fluxos.pode_interromper_agente_ia` (default `false`) decide se um gatilho de
    fluxo pode assumir uma conversa que já está com a IA.
  - `fluxos.gatilho_tipo/gatilho_config` ficam denormalizados da versão publicada (não só dentro do
    jsonb de `fluxo_versoes.definicao`) porque o webhook precisa achar "qual fluxo ativo tem este
    gatilho" em toda mensagem recebida — hot path, não pode custar abrir jsonb de N fluxos por
    mensagem.
  - Worker clona `disparos-worker.ts`/`disparos-lock.ts` (`integration_locks`, `provider =
    'fluxo_conversa'`, `resource = 'engine'` fixo por clínica — não por execução, porque só existe 1
    processo Node vivo hoje). Lock só durante o processamento ativo de 1 passo, nunca durante a
    espera em si — resolve o problema de recovery pós-restart pra esperas longas (dias) sem precisar
    de TTL longo.
  - Idempotência de passo: `unique(execucao_id, sequencia)` em `fluxo_execucao_eventos`
    (`sequencia` = `fluxo_execucoes.passos_executados` pós-incremento, reivindicado atomicamente por
    `UPDATE ... RETURNING`) — corrigindo uma chave proposta inicialmente,
    `(execucao_id, no_id, tentativa)`, que tinha um bug real: um loop controlado revisita o mesmo nó
    mais de uma vez legitimamente, então `no_id` não pode fazer parte da chave de deduplicação de
    passo.
  - Por quê registrar isto como decisão (não só documentação técnica): schema de produção é uma das
    duas ações que a decisão de 2026-09-16 exige aprovação explícita a cada vez — este registro é a
    proposta que fica pendente de aprovação, não a aplicação em si (`apply_migration` não foi
    chamado). Fase 2 (engine/worker) só começa depois da aprovação e da migration `v20` aplicada.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: antes de aplicar a `v20`, Rafael
  pediu revisão específica de 5 pontos (created_at/updated_at, índices pro worker, FKs/ON DELETE
  preservando histórico, suporte a execução de teste, recovery sem repetir passo concluído). 3
  acharam problema real, corrigido na própria migration antes de aplicar — não é mudança de
  arquitetura, é correção de schema:
  - `fluxo_versoes.fluxo_id`, `fluxo_execucoes.fluxo_id` e `fluxo_execucoes.versao_id` estavam `on
    delete cascade` — excluir um fluxo apagaria em cascata todo o histórico de versões e execuções.
    Trocado para `on delete restrict` (nenhum fluxo é excluído de verdade pelo app, só arquivado,
    mas o schema não deveria depender disso pra proteger histórico de paciente real).
  - Faltavam índices em `fluxo_execucoes.conversa_id` (plano — o parcial existente só cobre execução
    ativa, não histórico), `fluxo_id` e `versao_id` (métricas por fluxo + performance da checagem de
    FK). Adicionados.
  - O mecanismo de recovery pós-restart (evento gravado `em_andamento` antes do efeito colateral, só
    `concluido` depois) só existia em prosa no documento de arquitetura — `fluxo_execucao_eventos`
    não tinha coluna nenhuma pra sustentar isso. Adicionado `status`
    (`em_andamento/concluido/falhou`) + `updated_at` + índice parcial de recovery.
  - Migration `v20` aplicada em produção via MCP do Supabase depois dessas correções, confirmada
    lendo o schema (4 tabelas criadas, RLS ligado, backfill de `conversas.dono_conversa` batendo: 7
    `humano`/1 `agente_ia`). Nenhum deploy no Railway necessário — só schema, nenhum código de
    aplicação toca essas tabelas ainda. Fase 1 completa; Fase 2 (engine/worker) é o próximo
    checkpoint.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: Fase 2a (núcleo do motor de Fluxo
  de Conversa, sem editor visual) construída e testada localmente — planejamento formal
  (`EnterPlanMode`/`ExitPlanMode`) com uma 2ª revisão de arquitetura (agente Plan) que achou 2 bugs
  reais antes de codar: (1) uma query de claim unificada nunca reivindicaria um menu sem timeout
  (`aguardando_ate=null`, e `NULL <= now()` é falsy em SQL) — corrigido com 2 formas de claim
  distintas (poller por tempo, webhook por id); (2) o estado `running` (claim reivindicado) não
  tinha caminho de recovery se o processo morresse entre a `UPDATE` de claim e o `INSERT` do
  evento — corrigido com uma 2ª varredura de recovery, direto em `fluxo_execucoes`, além da já
  planejada sobre `fluxo_execucao_eventos`. 3 decisões técnicas fechadas durante a implementação,
  não previstas no desenho original:
  - **Sem `zod`**: a visão original assumia validação de schema via `zod`, mas este projeto nunca
    usou biblioteca de validação (sempre hand-rolled, ex. `isStatusValido`) — introduzir uma
    dependência nova só pra esta feature quebraria o padrão do resto do código. `fluxo-tipos.ts`
    valida a forma de `definicao` manualmente.
  - **Sem CTE/RPC pro claim atômico**: a proposta original (revisão de arquitetura) recomendava
    fundir claim+insert de evento numa CTE de banco. Este projeto nunca usou função/procedure de
    Postgres (só a query builder do Supabase) — introduzir isso quebraria o mesmo padrão. Optado por
    `UPDATE` condicional otimista (`WHERE id=$1 AND estado=<valor lido antes>`, serializado pelo
    lock de linha do Postgres) + a 2ª varredura de recovery acima como defesa em profundidade pra
    janela residual — mesmo nível de correção prática, sem introduzir mecanismo novo no projeto.
  - **`conversaEraNova`**: achado só na hora de integrar o webhook — `conversas.dono_conversa` nasce
    `'humano'` por padrão (inclusive numa conversa QUE ACABOU DE SER CRIADA), e a regra "recusa
    iniciar fluxo se humano" bloquearia pra sempre os gatilhos `nova_conversa`/`primeira_mensagem`.
    Corrigido com uma exceção explícita: a recusa só vale quando a conversa já existia antes desta
    mensagem (não pode haver atendimento humano "ativo" numa conversa que não existia um instante
    atrás).
  - Achado adicional na revisão: faltava um 6º sítio de escrita de `agente_ativo_id` no mapeamento
    original — `src/lib/chat.ts:enviarRespostaChat` (resposta manual pelo Chat ao Vivo). Corrigido:
    se um atendente responde manualmente enquanto `dono_conversa='fluxo'`, a execução ativa vira
    `transferred` — sem isso, uma `espera` de dias continuaria mandando mensagem automática por cima
    do atendimento humano.
  - `typecheck`/`lint`/`build` de produção limpos; 381 testes (65 novos, todos na lógica pura —
    `fluxo-tipos`/`fluxo-validador`/`fluxo-motor`/`fluxo-gatilhos` — mesmo critério de não testar
    diretamente a camada de I/O já usado em `disparos-worker.ts`/`agentes.ts`).
  - **Nada disso está em produção ainda** — sem deploy no Railway, sem fluxo de teste criado. Deploy
    + validação manual (fixture → worker sozinho → webhook real) é o próximo passo, com aprovação
    separada antes de qualquer mensagem real de WhatsApp.
- **2026-09-17** (Rafael) [odontominas]: avançar direto pra Fase 2b/3 (editor visual) do Fluxo de
  Conversa em vez da Fase 6 (demo pro marido). Por quê: uma demo com "criar fluxo → arrastar blocos
  → conectar → publicar → receber mensagem real" é muito mais forte do que mostrar só backend
  funcionando — o motor (Fase 2a) já estava validado. Prioridades definidas, nesta ordem: editor
  visual estável, blocos odontológicos, conexões e validação, versionamento, modo teste, publicação
  segura, execução real usando o motor já validado. Critério de sucesso explícito: criar um fluxo
  simples no editor, publicar em modo teste, receber a mensagem no número de teste já conhecido do
  projeto. Fora de escopo por enquanto, exceto se bloquear tecnicamente: limpeza de dados de teste,
  troca de senhas de demo, rename `.ratosos`/`.noryosinovacoes`. Sequência: 2b/3 → teste real ponta
  a ponta → Fase 6 (demo) → limpeza/hardening final.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: `@xyflow/react` aprovado como
  dependência nova pro canvas do editor de Fluxo de Conversa — única exceção à política de
  zero-dependência do projeto (que já tinha recusado `zod` e CTE/RPC de banco por esse mesmo
  critério). Por quê: não existe equivalente hand-rolled razoável pra zoom/pan/minimap/seleção
  múltipla profissionais — construir isso à mão seria meses de trabalho reinventando algo já
  resolvido, e o próprio doc de arquitetura da Fase 1 (`crm/docs/fluxo-conversa-arquitetura.md`) já
  antecipava "React Flow ou similar" pra este momento. O motor (`fluxo-motor.ts`/`fluxo-tipos.ts`)
  não muda: arestas do xyflow são sempre derivadas dos 6 tipos de `NoFluxo` existentes, nunca uma
  fonte de verdade paralela.
- **2026-09-17** (Rafael): `.ratosos` rebatizado pra `.noryosinovacoes` de vez (Rafael já tinha
  renomeado o arquivo manualmente; a decisão foi se as referências do kit deveriam seguir esse nome
  ou reverter). Por quê: alinhar o marcador de versão do kit ao nome que o próprio sistema já usa
  (`OS_noryosinovacoes_OS`), em vez do nome genérico antigo. Atualizadas as 3 referências ativas
  (`AGENTS.md`, `sistema/scripts/conferir-kit.sh`, `.claude/skills/setup/SKILL.md`);
  `sistema/changelog/` ficou intocado de propósito — é o gabarito genérico do kit, sobrescrito a
  cada atualização futura, e o próprio `COMO-ATUALIZAR.md` já instrui o agente a adaptar aos nomes
  locais em vez de assumir `.ratosos` fixo. Commit `2fff7ed`.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: ampliar a paleta do editor do
  Fluxo de Conversa começando pela categoria Ações CRM (adicionar/remover etiqueta, mover no funil,
  marcar prioridade, atribuir atendente), não por Odonto. Por quê: auditoria de
  `src/lib/controle-odonto/capabilities.ts` confirmou que as 7 capabilities do ControleODONTO estão
  100% em `false` — nenhuma validada contra API real, sem meio-termo possível — enquanto Ações
  CRM/Humano/IA (as outras 3 categorias da visão original em `crm/docs/fluxo-conversa-visao.md`) só
  dependem de tabelas que o CRM já usa em produção. Construída sem migration. Commit `c3d04e8`.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: 2ª fatia da ampliação da paleta —
  Humano + IA, só com 4 dos 8 blocos da visão original (transferir p/ humano, criar alerta interno,
  pausar automação, iniciar agente de IA). Por quê: "Enviar contexto pra agente"/"Retomar fluxo após
  IA"/"Encerrar IA" pressupõem um protocolo de handoff `agentes.ts` ↔ motor do fluxo que não existe —
  enquanto um nó do fluxo executa, `dono_conversa` já é `'fluxo'` (invariante de
  `iniciarExecucaoFluxo`), não há "IA ativa durante um passo" pra encerrar ou retomar. Rafael
  confirmou o corte; os 3 blocos de fora ficam documentados como fase separada (protocolo de
  retorno IA→motor, contexto, idempotência, concorrência). 2 bugs reais achados e corrigidos antes
  de qualquer deploy: `liberarControle` genérico stompearia a entrega pro agente logo após
  `iniciar_agente_ia` (corrigido em `fluxo-execucoes.ts`); aviso falso "sem finalizar alcançável" em
  fluxo terminando por `transferir_humano`/`iniciar_agente_ia` (corrigido em `fluxo-validador.ts`
  com o helper `ehNoTerminal`). Sem migration. Commit `0fad463`.
- **2026-09-17** (Rafael, recomendação de Claude) [odontominas]: categoria Integração (Webhook/
  Chamada API/Consultar sistema/Aguardar callback) pausada, não entra nesta rodada de ampliação da
  paleta. Por quê: diferente de Ações CRM e Humano+IA (que só religaram coisa que já existia com
  segurança), Integração precisa de um cofre de credenciais novo (schema/migration — não existe hoje
  nenhum genérico pra integrações de terceiros) e abre risco real de SSRF (o servidor passaria a
  chamar URLs configuradas dentro de um fluxo). Fica documentada como próxima fase específica, a
  desenhar com calma.
- **2026-09-17** (Rafael) [odontominas]: posicionamento de produto pra frente de captação/
  relacionamento do CRM OdontoMinas, batizada **"Noryos Odonto"**: *"controla tudo que acontece
  antes do paciente chegar à cadeira e tudo que acontece depois que ele sai"*. Nunca vira
  prontuário odontológico, agenda clínica completa, ERP financeiro, odontograma, prescrição,
  TCLE, exames ou controle de estoque — isso continua com o ControleODONTO ou o sistema de gestão
  da própria clínica. Por quê: Rafael quer impressionar a cliente-piloto (layout e funcionalidade)
  pra fechar o case, sem transformar o produto num sistema clínico que concorreria com o que a
  clínica já usa e paga.
- **2026-09-17** (Rafael) [odontominas]: dentro da frente "Noryos Odonto", priorizar agora 4
  funcionalidades — NPS/satisfação, avaliação Google automatizada, aniversário automatizado e
  dashboard executivo. Por quê: de 10 funcionalidades candidatas levantadas em pesquisa de mercado
  (Clinicorp/iClinic/Simples Dental/Feegow no Brasil; Weave/NexHealth/Podium/RevenueWell fora),
  essas 4 reaproveitam a automação que já existe (motor do Fluxo de Conversa, `resumo.ts`) e têm o
  melhor retorno imediato pra demo/fechamento. Indicação, catálogo no WhatsApp, gamificação de
  atendente, multi-unidade, proposta digital de tratamento e marca por clínica ficam de roadmap,
  não descartadas.
