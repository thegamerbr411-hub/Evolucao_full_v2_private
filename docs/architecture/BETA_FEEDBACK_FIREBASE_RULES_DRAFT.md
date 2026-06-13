# Beta Feedback Firebase Rules — Draft

**Data:** 2026-06-11
**Status:** DRAFT (não aplicado ainda)
**Fase:** 2 - Modelo de Dados e Permissões

---

## Firestore Collection

**Collection:** `betaFeedbackReports`

**Path:** `/betaFeedbackReports/{reportId}`

---

## Firestore Security Rules

### Regras de Leitura

```javascript
// collection: betaFeedbackReports

allow read: if request.auth != null && 
  (resource.data.userId == request.auth.uid || 
   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
```

**Explicação:**
- Usuário autenticado pode ler
- Usuário pode ler apenas feedbacks próprios (userId == request.auth.uid)
- Admin pode ler todos feedbacks (role == 'admin')

### Regras de Criação

```javascript
allow create: if request.auth != null && 
  request.resource.data.userId == request.auth.uid &&
  request.resource.data.status == 'new' &&
  request.resource.data.type in ['visual_bug', 'design_bug', 'functional_bug', 'suggestion', 'improvement', 'other'] &&
  request.resource.data.severity in ['low', 'medium', 'high', 'critical'];
```

**Explicação:**
- Usuário autenticado pode criar
- Apenas pode criar feedback para si mesmo (userId == request.auth.uid)
- Status inicial deve ser 'new'
- Tipo e severidade devem ser valores válidos

### Regras de Atualização

```javascript
allow update: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' &&
  request.resource.data.status in ['new', 'triage', 'in_progress', 'resolved', 'duplicate', 'not_reproducible'];
```

**Explicação:**
- Apenas admin pode atualizar
- Status deve ser valor válido

### Regras de Deleção

```javascript
allow delete: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
```

**Explicação:**
- Apenas admin pode deletar

---

## Firebase Storage Rules

### Path

```
beta-feedback/{uid}/{reportId}/{attachmentId}
```

### Regras de Leitura

```javascript
allow read: if request.auth != null && 
  (request.auth.uid == uid || 
   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
```

**Explicação:**
- Usuário autenticado pode ler
- Usuário pode ler apenas anexos próprios (request.auth.uid == uid)
- Admin pode ler todos anexos (role == 'admin')

### Regras de Escrita

```javascript
allow write: if request.auth != null && 
  request.auth.uid == uid &&
  request.resource.size < 52428800 && // 50 MB máximo
  request.resource.contentType.matches('image/(jpeg|jpg|png|webp)|video/(mp4|quicktime|webm)');
```

**Explicação:**
- Usuário autenticado pode escrever
- Apenas pode escrever em seu próprio path (request.auth.uid == uid)
- Tamanho máximo 50 MB
- Apenas MIME types suportados (imagem/vídeo)

---

## Limites

### Firestore
- Tamanho máximo de documento: 1 MB (padrão Firebase)
- Índices necessários para queries admin (filtrar por status, tipo, severidade)

### Storage
- Tamanho máximo por arquivo: 50 MB
- MIME types suportados:
  - Imagem: image/jpeg, image/jpg, image/png, image/webp
  - Vídeo: video/mp4, video/quicktime, video/webm
- Path: beta-feedback/{uid}/{reportId}/{attachmentId}

---

## Riscos

### MÉDIO
- Implementação de regras de segurança Firebase
- Integração com Firebase Auth custom claims
- Performance com muitos feedbacks

### BAIXO
- Validação de tipos
- Validação de limites

### MITIGAÇÃO
- Testar regras em ambiente de desenvolvimento
- Implementar índices Firestore
- Monitorar performance

---

## Pendências Antes de Produção

1. Implementar custom claims para role 'admin' no Firebase Auth
2. Criar índices Firestore para queries admin
3. Testar regras de segurança em ambiente de desenvolvimento
4. Implementar compressão de vídeo antes do upload
5. Implementar limpeza automática de anexos antigos
6. Implementar monitoramento de custos Firebase

---

## Status

**DRAFT:** Regras não aplicadas ainda
**IMPLEMENTAÇÃO:** Fase 2 - Modelo de Dados e Permissões
**PRÓXIMO:** Fase 3 - Tela Beta sem Upload Real
