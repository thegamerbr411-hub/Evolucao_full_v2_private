# Beta Feedback Phase 4 — Media Upload Plan

**Data:** 2026-06-11
**Status:** PLANEJAMENTO (não implementado)
**Fase:** 4 - Upload de Mídia

---

## Resumo

Planejamento da implementação de upload de imagem/vídeo para Beta Feedback usando Firebase Storage, com permissões de segurança, preview, validação e tratamento de erros.

---

## Fluxo de Upload

### 1. Seleção de Mídia

**Tecnologia:** expo-image-picker (já instalado)

**Opções:**
- launchImageLibraryAsync() para galeria
- launchCameraAsync() para câmera
- mediaTypes: ['images', 'videos']

**Permissões:**
- Android: READ_EXTERNAL_STORAGE, CAMERA
- iOS: PHOTOLIBRARY_ADD_ONLY, CAMERA

### 2. Preview Antes do Upload

**Imagem:**
- Mostrar thumbnail
- Mostrar tamanho
- Mostrar dimensões (width/height)
- Botão para remover

**Vídeo:**
- Mostrar thumbnail (primeiro frame)
- Mostrar duração
- Mostrar tamanho
- Botão para remover

### 3. Validação

**Limites:**
- Imagem: até 10 MB
- Vídeo: até 50 MB
- Máximo: 5 anexos por feedback

**MIME types:**
- Imagem: image/jpeg, image/jpg, image/png, image/webp
- Vídeo: video/mp4, video/quicktime, video/webm

**Validação client-side:**
- Tamanho do arquivo
- MIME type
- Quantidade de anexos

### 4. Upload para Firebase Storage

**Path:**
```
beta-feedback/{uid}/{reportId}/{attachmentId}
```

**Processo:**
1. Gerar attachmentId único
2. Criar ref Firebase Storage
3. Upload com put()
4. Monitorar progresso
5. Obter download URL
6. Salvar metadata (storagePath, fileName, size, etc.)

### 5. Tratamento de Erros

**Erros comuns:**
- Permissão negada
- Tamanho excedido
- MIME type não suportado
- Falha de rede
- Firebase quota excedida

**Retry:**
- Retry automático para erros de rede
- Limite de 3 tentativas
- Exponential backoff

---

## Firebase Storage Integration

### Configuração

```javascript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const storage = getStorage();
```

### Upload de Imagem

```javascript
async function uploadImage(reportId, file) {
  const attachmentId = generateAttachmentId();
  const storagePath = `beta-feedback/${uid}/${reportId}/${attachmentId}`;
  const storageRef = ref(storage, storagePath);

  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      id: attachmentId,
      type: 'image',
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}
```

### Upload de Vídeo

```javascript
async function uploadVideo(reportId, file) {
  // Similar a uploadImage, mas com validação de vídeo
  // Opcional: compressão antes do upload
}
```

---

## Security Rules

### Regras de Leitura

```javascript
allow read: if request.auth != null && 
  (request.auth.uid == uid || 
   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
```

### Regras de Escrita

```javascript
allow write: if request.auth != null && 
  request.auth.uid == uid &&
  request.resource.size < 52428800 && // 50 MB
  request.resource.contentType.matches('image/(jpeg|jpg|png|webp)|video/(mp4|quicktime|webm)');
```

---

## Testes

### Unitários

- uploadImage com arquivo válido
- uploadImage com arquivo muito grande
- uploadImage com MIME type inválido
- uploadVideo com arquivo válido
- uploadVideo com arquivo muito grande
- generateAttachmentId único
- retry em falha de rede

### Integração

- Upload completo (seleção + upload + URL)
- Upload múltiplos anexos
- Preview antes de upload
- Remoção de anexo

### E2E (Detox)

- Fluxo completo: selecionar imagem → preview → upload → sucesso
- Fluxo completo: selecionar vídeo → preview → upload → sucesso
- Erro: arquivo muito grande
- Erro: MIME type inválido
- Erro: permissão negada

---

## Compressão (Fase Futura)

**Opcional para Fase 4:**
- Compressão de imagem antes do upload
- Compressão de vídeo antes do upload
- Redução de qualidade para reduzir tamanho

**Bibliotecas:**
- Imagem: expo-image-manipulator
- Vídeo: FFmpeg (se necessário)

---

## Rollback

Se algo der errado:
1. Reverter código de upload
2. Reverter regras Firebase Storage
3. Remover anexos já enviados (script de limpeza)
4. Reverter para Fase 3 (screen sem upload)

---

## Status

**PLANEJAMENTO:** COMPLETO
**IMPLEMENTAÇÃO:** NÃO INICIADA
**PRÓXIMO:** Felipe autorizar implementação Fase 4
