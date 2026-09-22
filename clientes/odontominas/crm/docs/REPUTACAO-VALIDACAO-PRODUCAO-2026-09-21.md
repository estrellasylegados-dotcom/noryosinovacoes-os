# Reputação — validação final em produção

**Data:** 2026-09-21 (BRT; registros de execução em 2026-09-22 UTC)
**Ambiente:** produção · OdontoMinas CRM
**Resultado:** **APROVADO — 100% dos critérios deste roteiro**

## Escopo validado

- Migração V39 aplicada: configuração, atendimentos, agendamentos e recuperação de experiências.
- Interface `/reputacao`: indicadores, histórico, recuperação, configurações, permissões e link do Perfil da Empresa no Google.
- Fluxos de pesquisa de experiência e convite de avaliação Google.
- Registro de resposta, classificação, alerta de experiência insatisfatória e caso de recuperação.
- Idempotência do evento de atendimento concluído e agendamento em horário comercial.

## Evidência controlada de produção

O único contato usado foi o número de teste autorizado, final **5241**. Todas as mensagens do roteiro receberam o prefixo `[TESTE]`.

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Pesquisa de experiência | Aprovado | Mensagem enviada e registrada; pesquisa `bfdb9ff8-bdf6-431a-b2cc-21d6527e0129` ficou `respondida`. |
| Classificação | Aprovado | Resposta `Poderia melhorar: demorou muito.` classificada como `poderia_melhorar`. |
| Recuperação | Aprovado | Caso `79b8c3a9-3821-4335-883f-9fdf6e845601` percorreu `aberto` → `em_tratativa` → `resolvido`, motivo `tempo_espera`. |
| Alerta | Aprovado | Alerta automático `experiencia_insatisfatoria` criado na categoria REPUTACAO. |
| Convite Google | Aprovado | Pesquisa Google `8b0ded19-4450-4d58-869d-ff8c7a06d981` ficou `enviada`; execução `b0c3c36f-e609-4b77-9e13-08ba02a6a21e` terminou `completed`. |
| Confirmação do provedor | Aprovado | Convite Google registrado com ID Evolution `3EB08451D02D98EB68850E10F822D5324B3F43EE`. |
| Deduplicação | Aprovado | Repetição do evento de atendimento não inicia uma nova execução (`idempotencia_existente`). |
| Segurança após o teste | Aprovado | Fluxos de teste pausados, agendas de teste canceladas e configuração original restaurada. |

## Verificações automatizadas finais

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado |
| `npm test` | Aprovado — 82 arquivos, 966 testes |
| `npm run build` | Aprovado — compilação otimizada Next.js concluída |

## Conclusão

O módulo de Reputação está publicado e validado em produção para o escopo implementado. Foram enviados exatamente três comunicados `[TESTE]` ao contato autorizado: pesquisa de experiência, retorno de recuperação e convite de avaliação Google. Não foram enviados disparos para pacientes reais e não ficou automação de teste ativa.
