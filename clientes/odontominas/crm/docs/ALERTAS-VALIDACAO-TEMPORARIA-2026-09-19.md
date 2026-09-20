# Central de Alertas — validação autenticada temporária

Executada por Codex entre 2026-09-18 e 2026-09-19 (America/Sao_Paulo).

## Autorização e escopo

Rafael autorizou explicitamente no chat em 2026-09-18: “crie uma conta temporaria que consiga fazer todos esses testes e resolva tudo. ao final desative essa conta de deixe documentado que eu autorizei pra tai testes.”

Foi criada uma única conta de teste por provisionamento administrativo no banco, com senha aleatória forte gerada apenas em memória. O login aconteceu pela rota real `/api/login`, sem fabricar cookie/sessão, sem usar a senha de contas existentes e sem enviar convites por e-mail. A conta percorreu os seis perfis padrão, sem permissões customizadas, revogando sessões entre perfis. Nenhuma permissão do produto foi ampliada.

- Usuário: `qa_alertas_1789786637716`.
- ID: `f4c76331-fba5-40fa-9eac-60da47515f81`.
- Estado final confirmado: `disabled`, `ativo=false`, `senha_hash=null`, perfil `atendente`, versão de sessão incrementada.
- Auditoria no banco: `TEST_ACCOUNT_AUTHORIZED`, `ROLE_CHANGED`, `USER_DISABLED`, além dos eventos das ações de alertas.

## Resultado

| Perfil | Verificações do roteiro aprovadas | Resultado |
|---|---:|---|
| Dona | 32 | Passou |
| Gerente | 32 | Passou |
| Supervisora | 32 | Passou |
| Atendente | 32 | Passou |
| Noryos Admin | 31 | Passou |
| Noryos Suporte | 31 | Passou após corrigir a fixture do teste |

190 verificações do roteiro na matriz final. Incluem login, perfil efetivo, API de resumo/contador, ordenação, filtros, detalhe/histórico, URLs de contexto, configuração inválida recusada, autorização por perfil e ações reais de assumir/resolver com repetição retornando 409. Categorias sem registros conferem formato/filtro, não uma ocorrência positiva daquela categoria.

Verificações adicionais: ignorar permitido para Dona/Gerente/Admin com histórico; recusado para Supervisora/Atendente/Suporte; conta final desativada; seis cookies anteriores recusados com 401 e novo login recusado. Na repetição do Suporte, uma nova sessão e novo login também foram recusados após a segunda desativação.

### Correção do roteiro, não do produto

A primeira rodada tentou usar uma fixture de SLA para Suporte, que não possui `conversas.visualizar_proprias`. A resposta 404 foi correta. O roteiro foi corrigido para usar um alerta técnico separado na ação assumir/resolver. Reutilizou-se a mesma conta, com nova senha aleatória em memória, e repetiu-se apenas Suporte. Tudo passou. O relatório original com a falha de expectativa foi preservado; a repetição tem relatório separado.

## Dados preservados

Foram criados 21 alertas exclusivos `[TESTE TEMP CODEX ALERTAS]`, com IDs nos relatórios. Os ainda abertos foram encerrados ao final com motivo `fim_teste_temporario`; os já resolvidos/ignorados mantiveram o resultado das ações reais. Nenhum alerta original `[TESTE UI]`, paciente, conversa, oportunidade, configuração de SLA ou canal foi alterado pelo roteiro. Nenhum WhatsApp foi enviado, nenhuma migration ou implantação foi realizada.

## Limite da evidência

**A UI visual ainda NÃO foi validada e a Central NÃO está CONCLUÍDA.** Os testes acima são HTTP autenticados: não comprovam clique no sino/dropdown, navegação real dos cards, abertura do contexto na tela, hidratação dos componentes nem layout no celular. A inspeção do código não substitui essa validação.

O controle de navegador retornou inventário vazio; tanto `iab` quanto `chrome` retornaram indisponível. Rafael pediu a instalação; a busca de plugins não ofereceu integração instalável nesta sessão. Orientado a instalar/conectar pela opção Configurações → Uso do computador e mencionar o navegador no chat. Instalação não executada nem presumida.

## Evidências e retomada

- `scripts/e2e-alertas-temporario.mjs`: execução e desativação em `finally`, incluindo modo de recuperação restrito à conta temporária.
- `docs/alertas-e2e-temporario-2026-09-18.json`: rodada original, sem senha/cookie.
- `docs/alertas-e2e-temporario-2026-09-18-suporte.json`: repetição corrigida do Suporte e desativação final.

Próximo passo: conectar um navegador e validar visualmente os itens pendentes com login real. A conta permanece desativada enquanto isso. Os 908 testes/build/lint/typecheck anteriores são evidência da sessão do Claude, não foram reexecutados nesta rodada; nenhum código de produção foi modificado.
