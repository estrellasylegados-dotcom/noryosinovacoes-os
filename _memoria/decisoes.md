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
