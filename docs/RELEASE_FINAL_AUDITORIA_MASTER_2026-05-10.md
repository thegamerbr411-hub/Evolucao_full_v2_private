# T-Evo - Auditoria Final de Release (10/05/2026)

## Objetivo

Conduzir auditoria de release final + base oficial beta para 10 pessoas com foco em runtime real, UX, estabilidade, rastreabilidade e operação.

## Escopo desta rodada

- Hardening de OAuth Google (app + alinhamento de configuração).
- Hardening de controle de acesso (bloquear, desbloquear, revogar sessão).
- Evolução da exportação beta para pacote multi-arquivo.
- Evolução da área premium de Perfil para exportações de análise.
- Documentação operacional e limpeza guiada.

## Estado por fase

### Fase 1 - Documentação real do projeto

Status: PARCIALMENTE CONCLUÍDO

- Guia de release/beta atualizado: docs/GUIA_RELEASE_BETA.txt.
- Checklist de auditoria manual criado: docs/AUDITORIA_VISUAL_CHECKLIST_FINAL.txt.
- Este documento consolida estado real de release.

Pendente:

- Consolidar mapa 100% de telas com evidência runtime por rodada (5 ciclos completos).

### Fase 2 - Exportação beta completa

Status: CONCLUÍDO (nível de código)

- Perfil exporta:
  - Análise beta
  - Relatório beta
  - Timeline
  - Diagnóstico
  - Melhorias
  - Pacote de suporte
- Pacote inclui múltiplos artefatos JSON/TXT para análise posterior.

Arquivos gerados no pacote:

- metadata.json
- account.json
- timeline.json
- nutrition.json
- workout.json
- social.json
- observability.json
- testing-context.json
- summary.txt

### Fase 3 - Timeline real de uso

Status: CONCLUÍDO (nível de código)

- Timeline inclui eventos observability + treino + nutrição + histórico + coach + social.
- Estrutura pronta para detectar abandono, gargalo e erro.

### Fase 4 - Perfil premium

Status: CONCLUÍDO (nível de UI/código)

- Área beta/diagnóstico com exportações completas.
- Coerência de sessão/login/versão exibida.
- Fluxos de conta e sessão disponíveis no Perfil.

### Fase 5 - Auditoria visual total

Status: PENDENTE (execução humana completa)

- Requer device visível e navegação manual contínua.
- Checklist preparado para 5 rodadas.

### Fase 6 - Coach

Status: PENDENTE (execução humana completa)

- Requer validação de teclado, scroll, persistência e estados de erro em runtime real.

### Fase 7 e 8 - OCR/Nutrição

Status: PENDENTE (execução humana completa)

- Requer teste com imagens reais (lata preta e pote vermelho).
- Requer validação de parsing e consumo parcial/total com evidência.

### Fase 9 - Login/Reset/Auth

Status: PARCIALMENTE CONCLUÍDO

- Fluxos já instrumentados e com correções de controle de acesso.
- Falta bateria manual completa em runtime para fechamento final.

### Fase 10 - Google Login real

Status: PARCIALMENTE CONCLUÍDO

Concluído:

- App atualizado para usar redirect nativo Android no formato com.googleusercontent.apps.[prefixo-do-client-id]:/oauthredirect.
- Unificação JS/TS do serviço de auth para evitar divergência de runtime.

Confirmado em console:

- Firebase possui SHA-1 e SHA-256 configurados para app Android com.tipolt.evolucaofullv2.

Pendente:

- Revalidação manual no device após patch com evidência de sucesso de consentimento e retorno ao app.

### Fase 11 - Bloqueio de conta

Status: CONCLUÍDO (nível de código)

- Backend com bloqueio, desbloqueio, revogação de sessão e enforcement.
- Admin com controles de acesso.

### Fase 12 - Social/XP/Desafios

Status: PENDENTE (execução humana completa)

### Fase 13 - Treino completo

Status: PENDENTE (execução humana completa)

### Fase 14 - Admin

Status: PARCIALMENTE CONCLUÍDO

- Recursos principais de conta/controle e export presentes.
- Falta rodada manual completa ponta a ponta.

### Fase 15 - Repetir tudo (5 rodadas)

Status: PENDENTE

### Fase 16 - Limpeza do repositório

Status: PARCIALMENTE CONCLUÍDO

- Inventário de artefatos pesados realizado.
- Script de limpeza segura com dry-run criado.

### Fase 17 - Resumo final

Status: EM ANDAMENTO

- Documento de status e riscos atualizado nesta rodada.

## Riscos abertos

1. OAuth pode ainda falhar se houver client/scheme divergente em ambiente específico de build/device.
2. Falta validação manual de 5 rodadas completas com evidência em todas as abas.
3. Existe volume alto de artefatos antigos que aumenta ruído operacional.

## Critério GO/NO-GO atual

- GO para desenvolvimento interno e correção contínua: SIM.
- GO para beta fechado de 10 pessoas: CONDICIONAL.
- GO para release final público: NÃO.

Condição mínima para GO beta 10:

1. 5 rodadas manuais completas com checklist.
2. Google login validado no device sem invalid_request.
3. OCR validado com imagens reais e exportação conferida.
4. Social/Treino/Coach/Admin validados sem regressão crítica.
