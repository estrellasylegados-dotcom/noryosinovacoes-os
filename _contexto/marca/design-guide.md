<!-- quem alimenta: o /setup semeia; o /atualizar acrescenta quando a identidade muda. Lido antes de qualquer peça que sai pra fora (gatilho de ação). -->
# Guia de Design

> Você pode editar esse arquivo a qualquer momento.
> Toda skill que cria peça visual (carrossel, proposta, slide, página) lê este arquivo antes de começar.

---

## Cores

Dark-first — a marca não tem versão clara ainda. Profundidade vem de planos de superfície + luz
localizada + hairlines, não de trocar preto por azul-escuro.

- **Fundo principal:** `#0B0D10` (quase preto)
- **Cor de destaque / CTA:** `#2DD4FF` (ciano) — cor tecnológica principal. Verde `#43E6A6` pra
  status/confirmação/automação, uso moderado.
- **Texto principal:** `#F5F7FA`
- **Fundo alternativo / cards:** `#12171D` (card) · `#0E141B` (seções alternadas) · `#1A232D`
  (chips, elementos elevados)
- **Cor proibida:** gradiente indigo→roxo, blob de gradiente, glassmorphism com glow neon,
  azul-SaaS genérico, neon em excesso, arco-íris no texto

---

## Tipografia

Par deliberado 2+1, nunca a mesma fonte pra tudo.

- **Títulos e destaques:** Manrope (peso 600-800) — geométrica-humanista, presença premium
- **Corpo, subtítulos e botões:** Inter — leitura neutra
- **Rótulos, números de interface:** Geist Mono (400-500) — chrome, scores, numeração de etapas
- **Peso do título:** 600 padrão; 700-800 reservado pra display muito grande

---

## Estilo geral

"Existe um sistema inteligente funcionando por trás dessa empresa." Tecnológica, organizada,
estratégica, sofisticada, confiável — percebida por organização, interfaces, movimento com
propósito, dados e fluxos. Nunca por futurismo decorativo, neon ou partícula. Motion todo em
CSS/SVG (sem lib de animação), easing sem bounce nem overshoot.

---

## Elementos-chave

- Bordas: 1px, hairline `rgba(167,176,186,0.12)`; mais forte (`0.22-0.24`) em hover/foco
- Border-radius dos cards: 12-18px; pill só em chips/tags/badges/seletores, nunca em botão de ação
- Botões: radius pequeno (8px), não são pills
- Sombras: elevação discreta em camadas (leve realce interno + sombra difusa) — sem glow

---

## O que NUNCA fazer

- Gradiente indigo/roxo, blob de gradiente, glassmorphism com glow neon
- Fileira de 3+ cards idênticos como estrutura principal (preferir composição assimétrica)
- Partícula aleatória, estrelas, chuva de código/Matrix, esfera ou cubo 3D genérico
- Vídeo de fundo, canvas pesado, WebGL só por estética
- Usar a mesma fonte pra título, corpo e UI
- Buzzword: "revolucionamos seu negócio", "soluções 360", "agência completa", "somos apaixonados
  pelo que fazemos"
- Depoimento, cliente, logo, número ou selo inventado — a Noryos ainda não tem clientes reais nem
  cases; mock sempre rotulado como ilustrativo

---

## Logo

- **Arquivo:** `_contexto/marca/noryos-logo.png` — assinatura horizontal (símbolo + wordmark
  "Noryos / INOVAÇÕES" em branco, fundo transparente)
- **Versão pra fundo escuro:** é a única versão — a marca é dark-first, não existe variante pra
  fundo claro ainda
- **Ícone/símbolo:** `_contexto/marca/noryos-icon.png` — só a fita "N", fundo transparente
  (favicon, redes sociais)
- **Onde usar:** header, footer, CTA final, materiais em fundo escuro
- **Tamanho sugerido:** 160-180px de largura (170px é o usado no site)
- Usar exatamente como fornecido: não recortar, recolorir, re-exportar nem regenerar

---

## Perfil do autor

*(não preenchido — sem uso de carrossel "estilo tweet" ainda)*

---

## Observações adicionais

O detalhe técnico completo (tokens CSS, motion system, espaçamento) vive no design-guide do projeto
original, em `projetos/Noryos-Inovacoes/identidade/design-guide.md` — fica acessível assim que o
projeto for ligado via `/novo-projeto link`.
