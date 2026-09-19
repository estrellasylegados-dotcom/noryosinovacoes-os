<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Meta: 40–60 linhas, só estado atual; histórico vive no diário, no andamento.md do projeto e em decisoes.md. Versão longa anterior (2026-09-18) preservada em _memoria/arquivo/2026/agora-2026-09-18-antes-da-faxina.md. -->
# Agora · onde paramos

## Estado atual (2026-09-19)
- Cliente-piloto #1: OdontoMinas (`clientes/odontominas/`, Ariadna Pires). Site no ar (Cloudflare Pages). CRM em produção no Railway
  (`odontominas-crm`) + Supabase. **Deploy = `railway up`** (o `git push` não publica). Detalhe: `clientes/odontominas/andamento.md`.
- Em produção: painel, Chat ao Vivo, Relatórios, Agentes de IA, Disparos, Campanhas, Fluxo de Conversa (motor, NPS, avaliação Google),
  Identidade/RBAC (6 perfis), Equipe, Notas, Horário, SLA, Canais + caixa compartilhada, Kanban comercial, **Central de Alertas**.
- "Noryos Odonto": Fases 3–5 aprovadas. Próximo (aniversário como produto final, dashboard executivo) **só com sinal do Rafael**.
  Odonto bloqueado (sem credencial ControleODONTO); Integração pausada. Noryos Ops, White-label e distribuição automática: não iniciados.

## Onde paramos
- **Central de Alertas** (2026-09-18/19): em produção, verificador de 1 min rodando. **Decisão fechada:** `alertas.tecnicos` é permissão de
  plataforma (só Noryos Admin/Suporte); a clínica recebe alerta operacional amigável. **SLA real validado** com evidência (atenção → alerta
  único → mesmo alerta crítico → resolvido ao responder). **UI autenticada: NÃO validada ainda** → status ainda não é "CONCLUÍDA".
- Roteiro pronto: `crm/scripts/e2e-alertas-sessao.mjs` (login real, senha oculta) + alertas `[TESTE UI]` criados para a validação.

## Validado (com evidência)
- Canais + caixa compartilhada 100% (E2E real + UI). Identidade/RBAC: convite real, Admin/Suporte de teste logando. Kanban: backend + E2E no banco.
- Alertas: 908 testes, build/lint/typecheck; produção: sem responsável, Kanban, canal, SLA completo, nova ocorrência; workers sem erro.

## Pendências realmente abertas
1. **Rafael — UI de alertas logado** (roteiro acima, perfis dona/gerente/atendente/suporte/admin) → só então marcar CONCLUÍDA.
2. **Rafael — Kanban logado** (arrastar, perdido, filtros, celular), campo de resposta do Chat no rodapé, menu recolhível; decidir se a
   Supervisora move cards. Depois commitar `SidebarShell.tsx` se ainda estiver fora do git.
3. **Horário real da OdontoMinas** em `/configuracoes/horario` (vazio de propósito): é o que faz o SLA valer de verdade (hoje inerte).
4. RBAC E2E: reset de senha real, contas de clínica (Dona/Gerente/Supervisora/Atendente com e-mails reais), rodar `e2e-rbac-sessao.mjs`
   por perfil, **rotacionar a chave do Resend** (apareceu no chat). Trocar/desativar as senhas de teste fracas (`[TESTE] Atendente A/B`)
   e as 3 senhas de demo antes de produção real.
5. Reputação/Google: colocar a URL real de avaliação em `/reputacao` e ligar (desativada de propósito).
6. Site/negócio: confirmar com a Ariadna WhatsApp oficial, responsável técnico, convênios, fotos, domínio; abrir CNPJ próprio da Noryos
   (CNAE/MEI não cobre tráfego pago, trava cobrar o próximo odonto); 2º piloto (estética): confirmar a categoria profissional.
7. Integrações: ControleODONTO precisa de credencial real; Pixel Google Ads precisa de app OAuth; ligar projeto site/CRM via
   `/novo-projeto link`; Fase 1 CRM Twenty pausada até o CRM rodar ou o 1º pagante fechar.
8. Dívidas técnicas conhecidas: ~60 telas antigas no shim `isAdminEquivalente` (migrar pra permissão granular); tela visual de permissões;
   "Sessões ativas"; erro de envio mais específico no Chat; `search_path` fixo nas funções Postgres novas; buscar mensagens em lote
   no verificador se a passada (hoje 8–30 s) piorar.

## Próximo passo
Rafael roda o roteiro de UI de alertas → `/atualizar` marca "CENTRAL DE ALERTAS OPERACIONAIS — CONCLUÍDA". Depois, esperar o sinal dele
(aniversário/dashboard, Noryos Ops ou outra frente). Nada novo é iniciado sem sinal.

## Riscos importantes
- Migration em produção e envio real de WhatsApp exigem aprovação a cada fase (regra do Rafael).
- Segredos nunca no chat; o agente não forja sessão nem cookie.
- Compliance: risco de exclusividade Mirante/Sicoob aceito conscientemente. Kaptar liberado só pra busca de nicho.
- Alertas abertos hoje vêm de dados de teste/demo: a Dona vê a central "cheia" até a limpeza pós-apresentação.

## Dados [TESTE] que precisam ser preservados (não apagar até depois da apresentação)
- Alertas: todos, inclusive resolvidos, o histórico, `alertas_config`/regras e os 9 `[TESTE UI …]`; pacientes/conversas
  `[TESTE ALERTA SEM RESPONSÁVEL]` (`00c9ea9d…`) e `[TESTE ALERTA SLA]` (`77481b6a…`), com mensagens.
- Canais `[TESTE] WhatsApp Recepção/Comercial`; atendentes `[TESTE]` A/B/Supervisora/Noryos Admin; conversa do número `5561981925241`
  (responsável `[TESTE] Atendente B`, evidência do E2E de Canais) e as ~48 conversas `5500000000xxx`.
- Kanban `[TESTE KANBAN]` (pacientes, conversas, oportunidades, histórico, tag, `crm/scripts/e2e-kanban.ts`); `[TESTE SLA]` (`a9074a4a…`).
- Fluxos `[TESTE …]` (Fases 2a–5) e execuções/eventos/pesquisas ligados; paciente "Rafael (teste Disparos)", campanha "Teste Campanhas —
  envio real"; par duplicado do bug de telefone (`4e7ecb38…`/`4bb228db…`, evidência antes/depois). Lista longa em `_memoria/decisoes.md` e no arquivo.
