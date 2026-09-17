# Fluxo de Conversa — visão completa do Rafael (fonte)

Fonte: colado por Rafael Viriato diretamente no chat, 2026-09-17, em resposta à pergunta de qual
frente do CRM continuar. É a especificação completa do que ele quer pro módulo "Ferramentas → Fluxo
de Conversa" — motor de automação conversacional determinístico, tratado como infraestrutura
crítica. Reproduzido na íntegra, sem edição, pra não perder nada entre sessões (a reconstrução foi
fatiada em 6 fases com checkpoint do Rafael entre elas — ver `_memoria/decisoes.md` 2026-09-16 —
e esta visão serve de insumo principalmente pras Fases 1 (arquitetura), 3 (paleta de blocos/editor)
e os templates odontológicos).

**Como usar este documento:** é matéria-prima, não plano aprovado. Cada fase (0 a 5) só avança com
checkpoint explícito do Rafael. Nada aqui autoriza pular etapa, aplicar migration ou mandar mensagem
real sem aprovação a cada vez — isso está explícito na decisão registrada e reforçado pelo próprio
texto abaixo.

---

## Papel que o agente deve assumir

Arquiteto de software sênior; engenheiro de automações conversacionais; especialista em
Next.js/TypeScript; especialista em PostgreSQL/Supabase; especialista em filas e processamento
assíncrono; especialista em sistemas de CRM; especialista em WhatsApp; especialista em UX/UI;
especialista em clínicas odontológicas; especialista em QA e testes automatizados; especialista em
segurança e LGPD; especialista em confiabilidade e idempotência; especialista em fluxos
determinísticos. Tratar o módulo como infraestrutura crítica.

## Contexto do CRM (o que já existe, segundo o Rafael)

Next.js; Railway; Supabase/PostgreSQL; Evolution API; WhatsApp conectado; contatos; conversas;
mensagens; Chat ao Vivo; Disparos; Campanhas; Funil de Vendas; Automações; Agentes de IA;
transferência para humano; opt-out; reativação; cron; relatórios; RBAC; variáveis de ambiente; logs;
integrações futuras com ControleODONTO; tracking/Meta/Google em evolução. **Não quebrar módulos
existentes.**

Antes de programar: (1) auditoria do módulo atual, (2) mapear tabelas, (3) mapear rotas, (4) mapear
componentes, (5) mapear editor visual, (6) mapear execução do fluxo, (7) mapear integrações com
Evolution API, (8) identificar gargalos, (9) risco de loops, (10) risco de duplicidade, (11) risco
de corrida, (12) funcionalidades incompletas. **Isto é a Fase 0, em andamento nesta sessão.**

## Conceito central

**Fluxo de Conversa = automação determinística.** **Agente de IA = automação dinâmica.** Não
misturar os conceitos. Fluxo de Conversa é pra previsibilidade, regras claras, menus, decisões,
espera, coleta de dados, confirmação, roteamento, follow-up, agendamento, transferência, chamadas
externas, mensagens sequenciais.

## Objetivo — Flow Builder odontológico profissional

Exemplos de fluxo que precisa suportar:

- Novo paciente → menu inicial → especialidade → unidade → período → encaminhar para atendente.
- Consulta marcada → lembrete → confirmar → reagendar → cancelar.
- Paciente faltou → recuperação → tentar novo horário → humano.
- Orçamento parado → follow-up → interesse → agendamento.
- Paciente inativo → reativação.
- Pós-procedimento → acompanhamento → identificar desconforto → transferir humano se necessário.

## Princípio de segurança — o sistema nunca pode

Disparar fluxo duplicado; responder duas vezes à mesma entrada; entrar em loop infinito; mandar
mensagem depois de opt-out; mandar mensagens após transferência humana; continuar fluxo cancelado;
continuar fluxo depois de erro fatal; perder contexto após restart da Railway; executar dois nós
simultaneamente para a mesma sessão sem controle.

## Arquitetura do motor (conceitual — não aplicar sem Fase 1)

Não executar fluxo inteiro dentro de uma request HTTP. Criar engine assíncrona. Modelo sugerido
conceitualmente (adaptar ao schema existente, nomes não são finais):
`flow_definitions`, `flow_versions`, `flow_nodes`, `flow_edges`, `flow_executions`,
`flow_execution_steps`, `flow_sessions`, `flow_events`, `flow_variables`.

## Versionamento de fluxo

Fluxo publicado tem versão. Editar fluxo ativo nunca altera execuções em andamento — cria versão
nova. Exemplo: "Atendimento Inicial" v1 publicada, v2 rascunho, v3 futura; execuções existentes
continuam na versão original.

## Status do fluxo

`draft`, `published`, `paused`, `archived`. Nunca executar `draft`.

## Status da execução

`queued`, `running`, `waiting_input`, `waiting_time`, `completed`, `cancelled`, `failed`,
`transferred`.

## Editor visual

Flow Builder visual extremamente estável: drag and drop, zoom, pan, minimap, snap, seleção múltipla,
copiar/colar, duplicar nó, deletar nó, desfazer, refazer, auto-save, validação, preview, publicar,
versão, histórico.

## Paleta de blocos

**Básicos:** Início, Mensagem, Imagem, Áudio, Vídeo, Documento, Espera, Finalizar.

**Entrada do paciente:** Menu numérico, Botões, Resposta de texto, Perguntar nome/telefone/e-mail/
data/horário.

**Condições:** Se/Senão, Comparar variável, Possui etiqueta, Está em etapa do funil, Horário de
atendimento, Paciente novo/existente, Possui consulta futura, Possui conversa ativa, Opt-out,
Resposta contém palavra, Resposta igual, Tempo sem resposta.

**Ações CRM:** Adicionar/remover etiqueta, Mover no funil, Criar tarefa, Atualizar contato/conversa,
Marcar prioridade, Atribuir atendente.

**Odonto** (dependentes de ControleODONTO — usar capabilities; se integração não estiver ativa, não
fingir que agenda está disponível): Escolher especialidade/unidade/profissional, Consultar agenda,
Selecionar horário, Solicitar/confirmar agendamento, Solicitar reagendamento/cancelamento, Paciente
faltou, Retorno pendente.

**IA:** Iniciar agente de IA, Enviar contexto para agente, Retomar fluxo após IA, Encerrar IA.

**Humano:** Transferir para humano, Atribuir setor/atendente, Criar alerta interno, Pausar
automação.

**Integração:** Webhook, Chamada API, Consultar sistema, Aguardar callback.

## Gatilhos

Nova conversa; palavra-chave; primeira mensagem; lead novo; etapa do funil; campanha; disparo;
etiqueta adicionada; consulta criada/cancelada/faltou; X horas antes da consulta; X dias depois;
inatividade; manual; API interna; webhook. **Cada gatilho precisa de deduplicação.**

## Sessão do fluxo (campos esperados)

`flow_id`, `flow_version`, `conversation_id`, `contact_id`, `current_node_id`, `state`, `variables`,
`started_at`, `updated_at`, `waiting_until`, `last_event_id`.

## Variáveis

`{nome}`, `{primeiro_nome}`, `{telefone}`, `{email}`, `{especialidade}`, `{unidade}`,
`{profissional}`, `{data_consulta}`, `{hora_consulta}` e customizadas. Nunca enviar `undefined`/
`null`/`[object Object]` — sempre fallback (mesmo princípio já usado em `resolverVariaveis` de
Disparos).

## Input do paciente

Nó que espera entrada: (1) pausa execução, (2) marca `waiting_input`, (3) espera próxima mensagem,
(4) correlaciona mensagem à execução certa, (5) valida resposta, (6) decide próximo nó, (7)
continua.

## Timeout de input

Configurável por nó (ex.: "se não responder em 2h" → caminho `timeout`).

## Menus

Aceitar `1`, `01`, `"agendar"`, `"quero agendar"` se configurado, mantendo comportamento
determinístico.

## Validação de entrada

Nós de input suportam telefone/e-mail/data/hora/número/texto/opção; se inválido, mensagem de erro
configurável (ex.: "Não consegui identificar. Digite 1, 2 ou 3.").

## Nó de espera

Segundos/minutos/horas/dias, ou até data/hora específica. **Nunca `sleep` no processo** — persistir
`waiting_until`.

## Horário de atendimento

Bloco com caminhos "dentro do horário"/"fora do horário", reutilizando a configuração da clínica.

## Transferência humana

Ao transferir: execução muda pra `transferred`, automação para, conversa fica com humano, não envia
mais mensagens do fluxo, registra motivo, notifica equipe se configurado. Retomar depois do
atendimento humano é opcional e precisa ser explícito.

## IA dentro do fluxo

Bloco "Agente de IA": recebe contexto, assume a conversa, devolve resultado estruturado
(`agendamento` / `dúvida resolvida` / `transferência` / `sem resposta`). **A IA nunca cria fluxo
escondido.**

## Loops

Permitir loops controlados com máximo de iterações configurável (default pequeno, ex.
`max_iterations=3`); exceder = erro controlado. Engine detecta ciclos sem espera/input; não permite
publicar fluxo com `A → B → A` sem condição/espera válida.

## Publicação — validações obrigatórias antes de publicar

Existe início; início único; todos os caminhos conectados; nós inválidos/órfãos; variáveis
desconhecidas; loops perigosos; nós sem configuração; nós de integração sem capability; condições
sem fallback; finalizações. Validador visual mostra Erros e Avisos (ex.: "Este bloco não possui
saída." / "Este caminho não termina.").

## Modo teste / sandbox

"Testar fluxo" sem publicar, com contato de teste (nunca população real). Execuções de teste
marcadas `is_test=true`, eventos separados dos reais.

## Log visual da execução e debug

Timeline por sessão (Início → Mensagem enviada → Resposta recebida → Condição avaliada → Caminho
escolhido → Fim) com timestamps. Admin vê `node_id`, input, output, duration, erro sanitizado —
nunca secrets.

## Webhook / Chamada API (nós de integração)

Timeout, retry, auth segura, secret nunca inserido direto pelo usuário no nó (usar credenciais
pré-cadastradas), resposta sanitizada, paths success/error. Retry em 429/500/502/503/504/timeout;
nunca retry automático em 400/401/403.

## Idempotência e concorrência

Toda execução usa chaves idempotentes (`flow_execution_id`, `step_id`, `event_id`) — webhook
duplicado nunca executa o nó 2x. Uma conversa não pode ter duas instâncias do mesmo fluxo
concorrentes sem regra explícita — lock por `conversation_id + flow_id`. Se há conversa humana
ativa, não iniciar fluxo automaticamente.

## Opt-out, instância WhatsApp e recovery

Opt-out cancela execuções pendentes e nunca envia mensagem nova. Fluxo só usa instâncias saudáveis;
se a instância cair, pausa execuções sem gerar cascata de erros. Depois de um restart da Railway, a
engine recupera waits e inputs pendentes, continua a fila, e não repete passos já concluídos.

## Templates odontológicos a construir

Atendimento inicial (menu 1-5: agendar avaliação/tratamentos/valores/endereço/atendente);
Agendamento (especialidade → unidade → período → preferência → humano ou agenda); Confirmação de
consulta (confirmar/reagendar/cancelar); Paciente faltou (reagendar/humano); Recuperação de
orçamento (follow-up de interesse); Reativação (paciente inativo); Pós-atendimento (com desconforto
→ transferir humano, **nunca** orientação clínica automatizada).

## Segurança clínica

Fluxo nunca diagnostica, prescreve, orienta urgência ou interpreta sintoma complexo. Dor forte,
sangramento, trauma, reação ou urgência → sempre transferir humano.

## Permissões, auditoria, duplicar, exportar/importar, pastas e tags, busca

Admin: criar/editar/publicar/arquivar/testar. Atendente: visualizar/executar manualmente se
autorizado. Auditoria registra quem criou/editou/publicou/pausou/arquivou. Duplicar fluxo sempre
nasce como `draft`. Exportar/importar em JSON, validando schema, nunca importando secret. Pastas e
tags (ex.: Atendimento, Implantes, Ortodontia, Reativação, Pós-atendimento). Busca por nome/tag/
descrição.

## Métricas e funil de execução

Execuções, concluídas, abandonadas, falhas, transferidas, tempo médio, taxa de conclusão, nós com
maior abandono. Funil: iniciaram → avançaram → concluíram → converteram.

## Integrações com o que já existe

Campanha pode iniciar fluxo (registrar `campaign_id`). Disparo pode encaminhar contato pra fluxo
(nunca duplicar envio). Fluxo pode mover etapa do funil, adicionar etiqueta, marcar qualificação.
Blocos do ControleODONTO usam capabilities — se a API ainda não estiver confirmada, bloco aparece
"Indisponível — integração não configurada."

## Banco

Auditoria antes de qualquer mudança. Toda mudança de schema vira migration versionada. Nunca alterar
produção manualmente.

## Testes exigidos

**Unitários:** criação, validação, condição, menu, variável, espera, timeout, loop, transferência,
opt-out, retry, webhook, concorrência, idempotência.
**Integração:** Evolution API, Supabase, worker, input do WhatsApp, resposta, retomada.
**End-to-end:** atendimento simples; menu inválido; timeout; humano; restart; resposta duplicada;
instância offline; opt-out; cancelamento; fluxo publicado e editado durante execução em andamento.
**Carga:** 50/100/500 execuções simultâneas sem travar o CRM.
**Regressão:** garantir que nada quebra em chat, agentes, disparos, campanhas, funil, cron,
Evolution, Supabase.
**Build:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — tudo precisa passar.

## Teste final real (só depois de tudo validado, com aprovação explícita a cada etapa)

Criar um fluxo isolado de teste, nome "TESTE - Fluxo Odonto", gatilho manual, nunca fluxo de
produção: Início → Mensagem ("Teste de fluxo OdontoMinas concluído com sucesso.") → Finalizar. Usar
só o número de teste já conhecido no projeto. Antes de enviar, validar: instância conectada, número
correto, opt-out inexistente, `is_test=true`, nenhuma outra campanha vinculada, nenhum loop, nenhuma
fila antiga. **Não enviar mensagem real sem validar tudo antes; não enviar pra nenhum outro contato;
não reutilizar campanhas reais; não deixar o fluxo de teste ativo — desativar/arquivar depois.**
Validação final: execução criada, mensagem enfileirada, Evolution respondeu sucesso, mensagem
registrada no banco, mensagem chegou ao WhatsApp do número de teste, execução terminou `completed`.
Log do teste: Flow ID, Execution ID, Contact ID, Message ID, Status, Started At, Sent At, Delivered
At (se disponível), Finished At — sem expor secrets.

## Documentação a atualizar ao longo do processo

`_contexto/agora.md`, `_contexto/ferramentas.md`, `_memoria/decisoes.md`, `_memoria/diario/`,
`clientes/odontominas/andamento.md` — seguindo o padrão já em uso no projeto.

## Entrega final esperada (relatório, ao fim de todas as fases)

Auditoria do módulo antigo; problemas encontrados; arquitetura nova; tabelas; migrations; engine;
worker; blocos; gatilhos; versão; idempotência; concorrência; recovery; IA; humano; funil;
campanhas; disparos; ControleODONTO; segurança; testes; build; fluxo de teste criado; resultado do
envio real; logs do teste; pendências; próximos passos.

## Regra final do Rafael

"Esse módulo deve ser tratado como um motor de automação conversacional de produção. Não basta
'funcionar'. Ele precisa ser: determinístico, resiliente, idempotente, versionado, auditável,
testável, recuperável, seguro, observável." Ordem obrigatória: **1. audite; 2. desenhe; 3. proponha;
4. implemente; 5. teste; 6. reteste; 7. execute testes de regressão; 8. só então faça o teste real no
WhatsApp.** Nunca pedir de novo dado que já existe no projeto. Usar o número de teste já conhecido
só na etapa final, e só depois de todas as validações.
