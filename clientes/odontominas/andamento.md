# Andamento · OdontoMinas

## Onde está (2026-09-11)

Pasta criada. Escopo e compliance mapeados. Scaffold técnico do site construído em `site/`
(Next.js + Tailwind, retemado pra marca da OdontoMinas), testado e funcionando localmente — com
placeholder explícito em todo conteúdo que ainda depende de fato real. Próximo passo continua
sendo Rafael conversar com o marido da Ariadna (colega de trabalho dele) pra alinhar a oferta
antes de apresentar a proposta formal pra ela — prazo ainda não combinado.

## Pendências

- [ ] Alinhar com o marido da Ariadna o que vai ser oferecido, antes de falar com ela.
- [ ] Apresentar a proposta pra Ariadna (site + GMN de graça, tráfego pago à parte).
- [ ] Foto da fachada (só preview no chat até agora) — pedir o arquivo se for útil pra GMN.
- [ ] Definir prazo de entrega com ela.
- [ ] Confirmar com a Ariadna, antes de publicar: nome completo + CRO do(s) responsável(is)
  técnico(s), endereço completo, telefone/WhatsApp, horário de funcionamento, tipos exatos de
  implante/ortodontia oferecidos, convênios aceitos, tom de voz e tipografia do site, hex exato
  da cor da marca (amostrar a conta-gotas). Tudo isso está como `[PLACEHOLDER: ...]` no scaffold
  técnico — ver `site/src/lib/config.ts`.

## Feito

- 2026-09-11: pasta criada, escopo e checklist de compliance do CFO documentados em
  `contexto.md`.
- 2026-09-11: logo salva em `marca/logo/logo_site.png`, design-guide atualizado com a cor real
  (teal/turquesa, fundo transparente).
- 2026-09-11: material institucional (prêmio, história, valores) recebido por WhatsApp e
  destilado em `contexto.md`.
- 2026-09-11: scaffold técnico do site criado em `site/` — Next.js 15 + Tailwind v4, UI kit
  reaproveitado do site institucional da Noryos (retemado de escuro pra claro/teal), 4 páginas
  (Home, Sobre, Serviços, Contato) com placeholder explícito onde falta fato real, formulário de
  contato direto pro WhatsApp (sem banco), faixa de compliance (nome+CRO) no rodapé de toda
  página. Testado localmente: `npm run build`/`typecheck`/`lint` limpos, 4 rotas verificadas no
  navegador sem erro de console. Falta: preencher os placeholders quando a proposta fechar com a
  Ariadna.
