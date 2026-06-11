# Beta Feedback Phase 4 — Upload Real Preflight

**Data:** 2026-06-11
**Status:** PREFLIGHT (planejamento, não implementado)
**Fase:** 4 - Upload Real com Firebase Storage

---

## Status Atual

- **Fase 2:** MERGED (modelos, permissões, validações, docs Firebase draft)
- **Fase 3:** MERGED (tela beta local, skeleton admin, plano Fase 4)
- **Main:** f771fb9 (contém Fases 2 e 3)
- **QA Flags:** SAFE/FALSE
- **Upload Real:** NÃO IMPLEMENTADO
- **Admin:** SEPARADO / NÃO EXPOSTO
- **UI:** CRIADA MAS NÃO WIRED PUBLICAMENTE

---

## Objetivo da Fase 4

Implementar upload real de imagem/vídeo para Beta Feedback usando Firebase Storage, com:
- Seleção de mídia via expo-image-picker
- Validação de arquivo antes do upload
- Upload para Firebase Storage
- Preview de anexos
- Remoção de anexos antes do envio
- Integração com Firestore para salvar feedback
- Feature flag para desabilitar upload por padrão

---

## O que NÃO será feito sem autorização

- Implementar upload real sem prévia
- Aplicar Firebase rules reais em produção
- Preencher allowlist admin real
- Expor Admin para Beta
- Ativar rota pública para Beta Feedback
- Ativar auto-merge
- Deletar branches sem autorização

---

## Dependências Encontradas

### Firebase
- **Status:** JÁ CONFIGURADO
- **Arquivo:** src/services/firebase.js
- **Módulos importados:**
  - firebase/app
  - firebase/auth
  - firebase/firestore
  - firebase/functions
- **Storage:** NÃO importado ainda (precisa ser adicionado)
- **Config:** Variáveis de ambiente (EXPO_PUBLIC_FIREBASE_*)

### expo-image-picker
- **Status:** NÃO INSTALADO
- **Ação necessária:** `npm install expo-image-picker`
- **Permissões:** READ_EXTERNAL_STORAGE, CAMERA (Android/iOS)

### Padrões existentes
- **Service:** Padrão de service em src/services/ (ex: authService.js, workoutService.ts)
- **Auth:** Firebase Auth já configurado
- **Feature flag:** Padrão de EXPO_PUBLIC_* em app.json extra
- **Permission:** Sem padrão explícito encontrado (precisará implementar)

---

## Arquitetura Proposta

### 1. Seleção de Mídia

**Tecnologia:** expo-image-picker

**Opções:**
- launchImageLibraryAsync() para galeria
- launchCameraAsync() para câmera
- mediaTypes: ['images', 'videos']

**Limites (já definidos em BETA_FEEDBACK_LIMITS):**
- Imagem: até 10 MB
- Vídeo: até 50 MB
- Máximo: 5 anexos por feedback

**Preview:**
- Imagem: mostrar thumbnail, tamanho, dimensões
- Vídeo: mostrar primeiro frame, duração, tamanho
- Botão para remover antes do envio

### 2. Validação Antes do Upload

**Validação client-side:**
- MIME type (image/jpeg, image/jpg, image/png, image/webp, video/mp4, video/quicktime, video/webm)
- Tamanho (10MB imagem, 50MB vídeo)
- Quantidade máxima (5 anexos)
- Nome de arquivo não vazio

**Erros amigáveis:**
- "Arquivo muito grande (máximo X MB)"
- "Tipo de arquivo não suportado"
- "Máximo de 5 anexos por feedback"

### 3. Storage Path Proposto

```
beta-feedback/{userId}/{feedbackId}/{attachmentId}-{fileName}
```

**Exemplo:**
```
beta-feedback/user-abc-123/feedback-xyz-789/att-001-screenshot.jpg
```

### 4. Metadata por Anexo

```javascript
{
  id: string,
  type: 'image' | 'video',
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  localUri: string, // URI local do dispositivo
  storagePath: string, // Path no Firebase Storage
  downloadUrl?: string, // URL temporária após upload
  thumbnailPath?: string, // Path do thumbnail (se vídeo)
  durationMs?: number, // Duração do vídeo
  width?: number,
  height?: number,
  uploadedAt: string,
}
```

### 5. Firestore Report Proposto

```javascript
{
  id: string,
  userId: string,
  userName?: string,
  userEmail?: string,
  type: BetaFeedbackType,
  severity: BetaFeedbackSeverity,
  status: BetaFeedbackStatus,
  screenName?: string,
  routeName?: string,
  title: string,
  description: string,
  stepsToReproduce?: string,
  expectedResult?: string,
  actualResult?: string,
  attachments: BetaFeedbackAttachment[],
  appVersion?: string,
  buildNumber?: string,
  platform?: string,
  deviceModel?: string,
  osVersion?: string,
  createdAt: string,
  updatedAt: string,
  adminNotes?: AdminFeedbackNote[],
}
```

### 6. Fluxo Transacional Seguro

1. **Criar draft local** (estado React)
2. **Validar formulário** (usando helpers da Fase 2)
3. **Criar feedbackId** (UUID)
4. **Subir anexos um a um** (Firebase Storage)
5. **Salvar report no Firestore** (com attachmentIds)
6. **Rollback se upload falhar** (deletar anexos já enviados)
7. **Retry seguro** (exponential backoff, máx 3 tentativas)

### 7. Segurança

**Beta:**
- Só cria feedback próprio (userId === request.auth.uid)
- Só lê feedback próprio
- Só vê anexos próprios
- Não lista todos feedbacks
- Não muda status

**Admin:**
- Lê todos feedbacks
- Muda status
- Adiciona notas internas
- Vê anexos de qualquer feedback

**Firebase Storage Rules:**
- Beta só escreve em beta-feedback/{uid}/
- Beta só lê beta-feedback/{uid}/
- Admin lê beta-feedback/{uid}/
- Tamanho máximo 50 MB
- MIME types validados

**Firestore Rules:**
- Beta só cria feedback com userId === request.auth.uid
- Beta só lê feedback com userId === request.auth.uid
- Admin lê todos feedbacks
- Admin atualiza status
- Admin adiciona notas

### 8. Feature Flag

**Variável de ambiente:**
```javascript
EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD=1
```

**Comportamento:**
- Se false: botão de anexos desabilitado, mensagem "Upload será habilitado em fase futura"
- Se true: permite seleção de mídia e upload

**Padrão:** false (desabilitado)

### 9. Testes Obrigatórios

**Unitários:**
- Validação de arquivo (tamanho, MIME type, quantidade)
- Geração de storage path determinístico
- Montagem de metadata mínima
- Stub de upload lança "not implemented"
- Sem import real de Firebase Storage
- Sem import real de expo-image-picker

**Integração (mocks):**
- Upload service com Firebase Storage mockado
- Validação de erro de upload
- Retry em falha de rede
- Rollback em falha

**E2E (Detox):**
- Fluxo completo: selecionar imagem → preview → upload → sucesso
- Fluxo completo: selecionar vídeo → preview → upload → sucesso
- Erro: arquivo muito grande
- Erro: MIME type inválido
- Erro: permissão negada

### 10. Plano de Implementação por PRs Pequenos

**PR A:** Dependências e permissões
- Instalar expo-image-picker
- Configurar permissões Android/iOS
- Criar wrapper de permissão
- Testes de permissão

**PR B:** Attachment picker UI local
- UI de seleção de mídia
- Preview de imagem/vídeo
- Validação local
- Remoção de anexo
- Sem upload real ainda

**PR C:** Upload service mocked
- Service com Firebase Storage mockado
- Validação de erro
- Retry
- Rollback
- Testes com mocks

**PR D:** Firebase Storage integration (behind flag)
- Integração real com Firebase Storage
- Upload real
- Download URL
- Feature flag
- Regras Firebase Storage

**PR E:** Firestore submit (behind flag)
- Integração real com Firestore
- Salvar report com attachmentIds
- Feature flag
- Regras Firestore

**PR F:** Admin viewer (behind admin permission)
- Tela admin para ver anexos
- Filtros por tipo/severidade/status
- Permissão admin
- Feature flag

---

## Riscos

### MÉDIO
- Implementação de permissões Android/iOS
- Upload de vídeo (tamanho, compressão)
- Performance com muitos anexos
- Regras de segurança Firebase

### BAIXO
- Implementação de UI de seleção
- Validação de arquivo
- Mocks de Firebase Storage

### MITIGAÇÃO
- Implementação faseada por PRs pequenos
- Feature flag para desabilitar upload por padrão
- Testes em cada fase
- Rollback documentado

---

## Rollback

Se algo der errado:
1. Reverter PR específico
2. Remover expo-image-picker se necessário
3. Reverter regras Firebase Storage
4. Reverter regras Firestore
5. Reverter feature flag

---

## Veredito

**FASE 4 PREFLIGHT:** PLANEJADO
**UPLOAD REAL:** NÃO IMPLEMENTADO
**FIREBASE STORAGE REAL:** NÃO IMPLEMENTADO
**EXPO IMAGE PICKER:** NÃO INSTALADO
**FIRESTORE WRITE:** NÃO IMPLEMENTADO
**ADMIN:** SEPARADO / NÃO EXPOSTO
**UI:** NÃO WIRED PUBLICAMENTE
