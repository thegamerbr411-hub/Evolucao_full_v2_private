# Beta Feedback Smoke Test Plan

## Overview
Smoke test manual controlado para validar o fluxo Beta Feedback com Firebase Storage e Firestore em ambiente controlado.

## Prerequisites
- Firebase project configurado
- Firebase rules aplicadas (versão do repo)
- Feature flags ativadas em ambiente controlado:
  - EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_ENTRY=1
  - EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER=1
  - EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD=1
  - EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT=1

## Test Cases

### 1. Entry Test
- [ ] Acessar tela Beta Feedback
- [ ] Verificar que tela é exibida corretamente
- [ ] Verificar campos obrigatórios (tipo, severidade, título, descrição)
- [ ] Verificar campos opcionais (tela, steps, expected, actual)
- [ ] Verificar botão de validação

### 2. Media Picker Test
- [ ] Clicar em adicionar anexo
- [ ] Selecionar imagem (JPEG/PNG)
- [ ] Verificar que imagem é exibida na lista
- [ ] Selecionar vídeo (MP4)
- [ ] Verificar que vídeo é exibido na lista
- [ ] Tentar adicionar arquivo não suportado (PDF)
- [ ] Verificar erro de tipo não suportado
- [ ] Tentar adicionar arquivo muito grande (>20MB imagem)
- [ ] Verificar erro de tamanho
- [ ] Remover anexo
- [ ] Verificar que anexo foi removido

### 3. Upload Test
- [ ] Adicionar anexo válido
- [ ] Clicar em fazer upload
- [ ] Verificar progresso de upload
- [ ] Verificar que upload conclui com sucesso
- [ ] Verificar que anexo tem downloadUrl
- [ ] Verificar que anexo tem storagePath
- [ ] Tentar upload sem anexos
- [ ] Verificar erro de sem anexos

### 4. Submit Test
- [ ] Preencher campos obrigatórios
- [ ] Adicionar anexos (opcional)
- [ ] Clicar em validar feedback
- [ ] Verificar que validação passa
- [ ] Clicar em enviar feedback
- [ ] Verificar que submit conclui com sucesso
- [ ] Verificar feedbackId retornado
- [ ] Verificar que form foi resetado
- [ ] Tentar submit sem validação
- [ ] Verificar erro de validação

### 5. Firestore Test
- [ ] Verificar que documento foi criado em betaFeedback
- [ ] Verificar que userId está correto
- [ ] Verificar que type está correto
- [ ] Verificar que severity está correto
- [ ] Verificar que title está correto
- [ ] Verificar que description está correto
- [ ] Verificar que attachments está correto
- [ ] Verificar que status é 'open'
- [ ] Verificar que createdAt está preenchido

### 6. Storage Test
- [ ] Verificar que arquivo foi criado em beta-feedback/{userId}/{feedbackId}/
- [ ] Verificar que arquivo pode ser baixado via downloadUrl
- [ ] Verificar que arquivo tem metadata correto
- [ ] Verificar que arquivo pode ser deletado

### 7. Rules Test
- [ ] Tentar ler feedback de outro usuário
- [ ] Verificar erro de permissão
- [ ] Tentar atualizar feedback de outro usuário
- [ ] Verificar erro de permissão
- [ ] Tentar deletar feedback de outro usuário
- [ ] Verificar erro de permissão
- [ ] Tentar listar todos os feedbacks (sem admin)
- [ ] Verificar erro de permissão

## Expected Results
- Todos os testes devem passar
- Não deve haver erros de permissão para próprio usuário
- Deve haver erros de permissão para outros usuários
- Deve haver erros de permissão para list sem admin

## Rollback Criteria
- Se qualquer teste crítico falhar
- Se houver erro de permissão inesperado
- Se houver data corruption
- Se houver performance issue

## Notes
- Testes devem ser executados em ambiente controlado
- Não executar em produção sem autorização
- Documentar resultados
- Reportar issues encontrados
