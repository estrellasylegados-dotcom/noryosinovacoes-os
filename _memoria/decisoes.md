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
