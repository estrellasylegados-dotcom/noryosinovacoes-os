<!-- quem alimenta: o /atualizar acrescenta quando uma automação liga, desliga ou muda. Lido quando a sessão precisa saber o que roda sozinho, e antes de criar automação nova (pra não duplicar). -->
# Automações

> O que roda sozinho, sem gente na frente: cron, worker, rotina agendada. Diferente de
> `ferramentas.md` (o que o agente consegue alcançar) — aqui é o que **já está ligado e disparando
> por conta própria**. Rotina que não está nesta tabela não deveria estar rodando.

| rotina | o que faz | onde roda | quando | origem que assina | como saber se quebrou |
|---|---|---|---|---|---|
| Reativação de paciente inativo (CRM OdontoMinas) | Conversa resolvida (respondido/agendado/perdido) sem mensagem há mais de 30 dias recebe 1 WhatsApp de reativação (check-in simples, sem promessa nem superlativo); manda 1x só por conversa | GitHub Actions (`.github/workflows/odontominas-crm-reativacao.yml`, repo `noryosinovacoes-os`) chama `POST /api/cron/reativacao` do serviço `odontominas-crm` no Railway | 1x/dia, `0 12 * * *` UTC (~9h Brasília) | não escreve neste sistema (RatosOS) — é automação de produto do CRM, não um robô do kit | aba **Actions** do repo no GitHub (o `curl --fail` falha o job se a rota não responder 2xx); ou log do serviço no Railway |
