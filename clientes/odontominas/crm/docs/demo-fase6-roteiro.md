# Fase 6 — Demo pro marido: roteiro, dados e checklist

Preparado em 2026-09-17. Usa o CRM real, em produção — nada aqui é maquete. Escopo: mostrar o que já
está estável (visão geral, Chat ao Vivo, Funil, Disparos, Campanhas, Fluxo de Conversa com Ações CRM
e Humano+IA, Agentes de IA). ControleODONTO e Integração seguem fora, documentados como fases
separadas (`crm/docs/integrations/controle-odonto.md`, `_memoria/decisoes.md` 2026-09-17).

## 1. Cenário do paciente (fio condutor da demo)

Dois personagens, propositalmente diferentes, pra cobrir "lead novo chegando agora" e "funil já em
andamento há dias":

- **Personagem ao vivo — "novo paciente chegando agora":** o fluxo "DEMO - Atendimento
  Odontológico" é disparado ao vivo, na hora, mandando mensagem de verdade pro número de teste já
  usado neste projeto. É o momento "uau" da demo: WhatsApp real recebendo e respondendo em tempo
  real na frente do marido.
- **Personagens já no funil — pano de fundo real, não inventado:** os 5 pacientes fictícios que já
  existem em produção, um em cada etapa do funil:
  - Camila Duarte — **novo** (chegou, ainda não foi respondida)
  - Rodrigo Alves — **aguardando** (respondida, esperando retorno do paciente)
  - Fernanda Lima — **respondido** (atendimento em andamento)
  - Marcos Teixeira — **agendado** (conversão — é o que a demo quer que aconteça ao vivo também)
  - Beatriz Nogueira — **perdido** (não avançou)

  Isso já existe no banco, não precisa criar nada — é o que dá densidade ao Funil e ao Chat ao Vivo
  sem precisar inventar uma dúzia de conversas na hora.

## 2. O fluxo da demo: "DEMO - Atendimento Odontológico"

Já construído e publicado em produção (`fluxos.id = 34aa24c0-e500-4629-9fb3-2b80e40ab87b`, versão 1,
gatilho **manual** — nunca inicia sozinho por mensagem real de um paciente de verdade, só quando
alguém aperta "Testar" ou "Iniciar" no editor). 29 nós, cobrindo 8 dos 9 blocos novos das paletas
Ações CRM e Humano + IA:

```
Início → Mensagem de boas-vindas → Menu principal
  1. Quero agendar uma avaliação
  2. Quero saber sobre tratamentos
  3. Já sou paciente
  4. Falar com a recepção
```

**Caminho 1 — Agendamento** (o mais rico: passa por 5 blocos novos)
Mensagem → Menu de especialidade (Implantes/Ortodontia/Estética/Clínica geral) → **Adicionar
etiqueta** correspondente → **Mover no funil** (status "agendado") → **Marcar prioridade** ("alta")
→ **Atribuir atendente** (Recepção 1) → Mensagem de confirmação → **Transferir p/ humano**.

**Caminho 2 — Tratamentos**
Mensagem informativa (sem diagnóstico, sem promessa — compliance CFO) → Menu de tratamento →
**Adicionar etiqueta** → **Iniciar agente de IA** ("Recepção Virtual", o mesmo já ativo em
produção).

**Caminho 3 — Já sou paciente**
Menu (reagendamento / dúvida / falar com recepção) → mensagem explicando que a agenda ainda não é
integrada (ControleODONTO pendente, nunca finge que funciona) → **Transferir p/ humano**.

**Caminho 4 — Falar com a recepção**
**Criar alerta interno** (WhatsApp pra equipe) → **Pausar automação** → mensagem → **Transferir p/
humano**. (Ordem tecnicamente correta: `transferir_humano` é terminal, por isso alerta e pausa vêm
antes, não depois.)

Único bloco novo não usado: "remover etiqueta" — não tinha um momento natural neste roteiro.

## 3. Roteiro da demo (10–15 minutos)

| # | Minuto | O que mostrar | Onde |
|---|---|---|---|
| 1 | 0:00–1:00 | Visão geral: "isso aqui é o CRM que já está rodando pra vocês, não é protótipo" | Painel `/resumo` |
| 2 | 1:00–2:30 | Chat ao Vivo com os 5 fictícios — mostra status, prioridade, etiqueta, atendente já no ar | `/chat` |
| 3 | 2:30–4:00 | Funil de Vendas — as 5 etapas povoadas, Marcos Teixeira como conversão | `/resumo` ou funil dedicado |
| 4 | 4:00–5:30 | Campanhas + Disparos — mostra a campanha e os disparos já testados, prova que o envio em massa funciona sem precisar disparar de novo | `/campanhas`, `/disparos` |
| 5 | 5:30–7:30 | Abrir o editor do Fluxo de Conversa, mostrar "DEMO - Atendimento Odontológico" no canvas — os blocos, a paleta com Ações CRM/Humano/IA visíveis | `/fluxos/[id]/editar` |
| 6 | 7:30–11:00 | **Ao vivo:** mandar mensagem de verdade pro número de teste, deixar o marido ver a resposta chegando no celular, escolher "1" (agendamento) — mostrar em tempo real: etiqueta aplicada, funil mudando pra "agendado", prioridade, atendente atribuído, transferência pro humano | WhatsApp real + painel |
| 7 | 11:00–12:30 | Voltar no Chat ao Vivo/Funil e mostrar a conversa que acabou de rodar já refletida — "isso que vocês viram acontecer agora já está registrado ali" | `/chat`, funil |
| 8 | 12:30–14:00 | Agentes de IA — mostrar "Recepção Virtual" configurado, explicar quando ele entra (caminho 2) vs. quando é o fluxo determinístico que decide (os outros 3 caminhos) | `/agentes` |
| 9 | 14:00–15:00 | Fechamento: o ganho operacional — "isso substitui a recepcionista respondendo toda mensagem igual, sem perder o controle de quem já foi atendido" | fala, sem tela |

## 4. Exemplos odontológicos usados (compliance CFO-196/2019 respeitado)

- Nenhuma promessa de resultado, nenhum "somos os melhores", nenhum depoimento de paciente.
- "Tratamentos" nunca vira diagnóstico — a mensagem do Caminho 2 diz isso explicitamente.
- Especialidades usadas (Implantes/Ortodontia/Estética/Clínica geral) batem com o que já está no site
  e no `contexto.md` da clínica.

## 5. Checklist antes da apresentação

- [ ] Confirmar que o serviço `odontominas-crm` está Online no Railway (`railway status`)
- [ ] Confirmar que a instância Evolution/WhatsApp está conectada
- [ ] Ter o celular com o número de teste (5561981925241) em mãos — é ele que recebe/responde ao vivo
- [ ] Ter login do painel admin em mãos (as senhas de demo — pendência já registrada em `agora.md`:
      trocar pelas senhas reais antes de um cliente de verdade ver isso, não bloqueia esta demo)
- [ ] Confirmar que nenhum disparo/lote está com status "rodando" ou "agendado" (evita qualquer
      envio concorrente durante a demo)
- [ ] Confirmar que "DEMO - Atendimento Odontológico" está com `status = publicada` e gatilho
      `manual` (nunca dispara sozinho)
- [ ] Ter em mente: os 3 fluxos/campanha "TESTE ..." antigos continuam no sistema, arquivados —
      se aparecerem na lista, é esperado, é o histórico de validação (não precisa esconder)
- [ ] Decidir, antes de começar, qual caminho do menu vai ser escolhido ao vivo (recomendo "1" —
      agendamento, o mais rico)

## 6. O que este documento não cobre (fora de escopo, por decisão)

- ControleODONTO (Fase 0 completa, sem credencial real ainda)
- Integração (Webhook/Chamada API/Callback) — pausada, precisa de cofre de credenciais + mitigação
  de SSRF (`_memoria/decisoes.md` 2026-09-17)
- Limpeza de dados de teste — decidido explicitamente que não acontece nesta fase
- Bateria robusta de testes (carga, regressão, restart) — reservada pro fim de todas as fases da
  paleta
