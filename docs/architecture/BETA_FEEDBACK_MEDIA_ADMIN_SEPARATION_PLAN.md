# Beta Feedback com Mídia + Admin Separado — Plano Técnico

**Data:** 2026-06-11
**Branch:** feature/beta-feedback-media-admin-separation-plan
**Status:** PLANEJAMENTO (não implementado)
**Workspace:** F:\projetos\evolucao-app-main-hotfix

---

## Decisões Iniciais de Felipe

**Data das decisões:** 2026-06-11

- **Storage escolhido:** Firebase Storage
- **Admin separado do Beta:** Painéis distintos, não misturados
- **Beta inicial:** Usuários selecionados, não público geral
- **Admin inicial:** Allowlist segura por e-mail/adminIds; custom claims depois
- **Limite inicial:** 5 anexos por feedback
- **Imagem:** até 10 MB
- **Vídeo:** até 50 MB
- **Metadata automática:** appVersion, buildNumber, platform, deviceModel, osVersion, routeName/screenName, userId, createdAt
- **Compressão:** Fase posterior; primeiro upload imagem, depois vídeo
- **Implementação:** Ainda não iniciada

---

## Resumo

Planejamento de uma feature separada para permitir que testadores beta enviem feedback (bugs, sugestões, melhorias) com anexos de imagem/vídeo, mantendo o painel Admin separado da experiência do usuário beta.

---

## Motivo

O app precisa de um canal estruturado para coletar feedback dos testadores beta, especialmente para identificar:
- Bugs visuais
- Bugs de design
- Bugs funcionais
- Sugestões de melhoria
- Problemas de layout

Anexos de imagem/vídeo ajudam a entender o contexto e reproduzir problemas.

---

## O que é painel Beta

**Público:** Testadores/usuários beta

**Pode fazer:**
- Enviar feedback (bug visual, design, funcional, sugestão, melhoria, outro)
- Anexar fotos/vídeos
- Escrever descrição do problema
- Adicionar passos para reproduzir
- Definir resultado esperado vs obtido
- Selecionar severidade
- Ver os próprios feedbacks
- Ver status dos próprios feedbacks
- Complementar informação se permitido

**Não pode fazer:**
- Ver feedbacks de outros usuários
- Ver painel admin
- Ver logs internos sensíveis
- Mudar status global
- Moderar feedbacks
- Acessar ferramentas técnicas/admin

---

## O que é painel Admin

**Público:** Owner/equipe interna

**Pode fazer:**
- Ver todos feedbacks
- Abrir anexos (fotos/vídeos)
- Filtrar por tipo (visual_bug, design_bug, functional_bug, suggestion, improvement, other)
- Filtrar por severidade (low, medium, high, critical)
- Filtrar por status (new, triage, in_progress, resolved, duplicate, not_reproducible)
- Responder/comentar internamente
- Marcar como novo/em análise/resolvido/duplicado/não reproduzido
- Ver métricas agregadas
- Priorizar bugs
- Exportar lista se necessário

**Não deve:**
- Ficar misturado com a experiência comum do beta
- Expor dados sensíveis do device sem consentimento
- Coletar logs completos sem avisar

---

## O que não misturar

- **NÃO** colocar ferramentas admin dentro do painel beta
- **NÃO** expor lista global de feedbacks para usuários beta
- **NÃO** permitir que usuários beta mudem status de feedback
- **NÃO** misturar painel beta com painel admin
- **NÃO** expor logs internos sensíveis para beta
- **NÃO** permitir upload executável
- **NÃO** criar upload falso/mockado como se fosse real

---

## Fluxo Beta

1. Usuário abre "Enviar Feedback" (CTA claro, premium dark fitness)
2. Escolhe tipo: bug visual / design / funcional / sugestão / outro
3. Seleciona tela/fluxo onde aconteceu (opcional, automático se possível)
4. Escreve título e descrição
5. Adiciona passos para reproduzir (opcional)
6. Adiciona resultado esperado (opcional)
7. Adiciona resultado obtido (opcional)
8. Seleciona severidade (low/medium/high/critical)
9. Anexa foto/vídeo (opcional, até 5 anexos)
10. Vê preview dos anexos
11. Remove anexo antes do envio se necessário
12. Envia
13. Vê protocolo/status (Novo / Em análise / Resolvido)
14. Acompanha meus feedbacks em lista própria

---

## Fluxo Admin

1. Owner/equipe abre painel admin separado (rota protegida)
2. Vê lista global de feedbacks
3. Filtra por status/tipo/severidade
4. Abre feedback específico
5. Vê descrição + device/app metadata
6. Abre fotos/vídeos
7. Muda status
8. Adiciona nota interna
9. Marca resolvido/duplicado/não reproduzido
10. Vê métricas agregadas (quantos por tipo, por severidade, por status)

---

## Modelo de Dados Proposto

### BetaFeedbackReport

```typescript
type BetaFeedbackReport = {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  type: 'visual_bug' | 'design_bug' | 'functional_bug' | 'suggestion' | 'improvement' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'triage' | 'in_progress' | 'resolved' | 'duplicate' | 'not_reproducible'
  screenName?: string
  routeName?: string
  title: string
  description: string
  stepsToReproduce?: string
  expectedResult?: string
  actualResult?: string
  attachments: BetaFeedbackAttachment[]
  appVersion?: string
  buildNumber?: string
  platform?: 'android' | 'ios' | 'web'
  deviceModel?: string
  osVersion?: string
  createdAt: string
  updatedAt: string
  adminNotes?: AdminFeedbackNote[]
}
```

### BetaFeedbackAttachment

```typescript
type BetaFeedbackAttachment = {
  id: string
  type: 'image' | 'video'
  fileName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  thumbnailPath?: string
  durationMs?: number
  width?: number
  height?: number
  uploadedAt: string
}
```

### AdminFeedbackNote

```typescript
type AdminFeedbackNote = {
  id: string
  adminId: string
  adminName: string
  note: string
  createdAt: string
}
```

---

## Upload de Mídia

### Storage recomendado

**Opção 1: Firebase Storage** (RECOMENDADO)
- Já está instalado (firebase@12.11.0)
- Integração nativa com Firebase Auth
- Regras de segurança granulares
- Upload direto do app
- URLs temporárias seguras

**Opção 2: API própria no Render**
- Endpoint para assinar upload
- Upload direto para S3/R2
- Mais controle server-side
- Requer implementação backend

**Opção 3: Cloudinary**
- CDN integrado
- Compressão automática
- Custos adicionais

### Requisitos obrigatórios

- Permissão de câmera/galeria (expo-image-picker já instalado)
- Seletor de imagem/vídeo
- Preview antes de enviar
- Remoção de anexo antes do envio
- Limite por arquivo
- Limite total por feedback
- Upload com progresso
- Retry em falha
- Compressão se necessário
- Validação de mime type
- Validação de tamanho
- Não aceitar executáveis
- Storage path por uid/reportId
- URLs não públicas permanentes sem necessidade

### Limites sugeridos

- **Imagem:** até 10 MB
- **Vídeo:** até 50 MB
- **Máximo:** 5 anexos por feedback
- **Formatos imagem:** jpg/jpeg/png/webp
- **Formatos vídeo:** mp4/mov/webm se suportado

### Storage path (Firebase Storage)

```
beta-feedback/{uid}/{reportId}/{attachmentId}
```

---

## Segurança / Permissões

### Regras básicas

- **Beta lê apenas seus próprios feedbacks**
- **Beta cria feedback para si mesmo**
- **Beta não muda status admin**
- **Admin lê todos**
- **Admin altera status**
- **Admin visualiza anexos**
- **Admin adiciona nota interna**
- **Anexos ficam separados por uid/reportId**
- **Não expor dados sensíveis do device sem consentimento**
- **Não coletar logs completos sem avisar**
- **Não vender/enviar dados para terceiros**

### Regras de segurança (Firebase Firestore)

```javascript
// collection: betaFeedbackReports

allow read: if request.auth != null && 
  (resource.data.userId == request.auth.uid || 
   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');

allow create: if request.auth != null && 
  request.resource.data.userId == request.auth.uid;

allow update: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';

allow delete: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
```

### Regras de segurança (Firebase Storage)

```javascript
// path: beta-feedback/{uid}/{reportId}/{attachmentId}

allow read: if request.auth != null && 
  (request.auth.uid == uid || 
   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');

allow write: if request.auth != null && 
  request.auth.uid == uid;
```

### Se usar API própria

Endpoints:

- `POST /beta-feedback` — criar feedback (autenticado)
- `GET /beta-feedback/mine` — listar feedbacks do usuário (autenticado)
- `GET /admin/beta-feedback` — listar todos (role=admin)
- `GET /admin/beta-feedback/:id` — detalhe (role=admin)
- `PATCH /admin/beta-feedback/:id/status` — mudar status (role=admin)
- `POST /admin/beta-feedback/:id/notes` — adicionar nota (role=admin)
- `POST /beta-feedback/:id/attachments/sign-upload` — assinar upload para storage (autenticado)

Validação server-side:
- Verificar token JWT
- Verificar role (se implementado)
- Validar mime type
- Validar tamanho
- Não aceitar executáveis

---

## Arquitetura Atual Encontrada

### Auth
- **Firebase Auth** + Google OAuth via expo-auth-session (PKCE)
- User: id, email, name, avatar
- **NÃO há roles explícitos** atualmente
- SecureStore para tokens
- useAuthStore (Zustand)

### API
- **Axios** com baseURL para Render API (https://evolucao-api-dou2.onrender.com)
- Refresh token automático
- Interceptor para Bearer token

### Storage
- **Firebase Auth** (já instalado)
- **SecureStore** para tokens
- **MMKV** para estado local
- **Firebase Storage** disponível (firebase@12.11.0)

### Navigation
- Stack Navigator com várias telas
- **AdminScreen** existe mas está no .gitignore (não acessível)
- Tabs: Home, Treino, Conversa, Perfil

### Mídia
- **expo-image-picker** instalado (para selecionar fotos/vídeos)
- **expo-av** instalado (para reproduzir vídeo)

### Backend
- Render API (https://evolucao-api-dou2.onrender.com)
- Endpoints existentes (auth, workout, social, etc.)

---

## Telas Necessárias

### Beta

1. **BetaFeedbackHomeScreen**
   - CTA "Enviar Feedback"
   - Lista "Meus Feedbacks"

2. **BetaFeedbackCreateScreen**
   - Formulário de criação
   - Seleção de tipo
   - Descrição
   - Passos para reproduzir
   - Resultado esperado/obtido
   - Severidade
   - Anexos (seletor + preview)

3. **BetaFeedbackDetailScreen**
   - Detalhe do feedback próprio
   - Status
   - Anexos

4. **BetaFeedbackListMineScreen**
   - Lista de feedbacks do usuário
   - Filtros básicos (status)

5. **BetaFeedbackMediaPreviewScreen**
   - Preview de imagem/vídeo antes de enviar

### Admin

1. **AdminFeedbackInboxScreen**
   - Lista global
   - Filtros (tipo, severidade, status)

2. **AdminFeedbackDetailScreen**
   - Detalhe completo
   - Metadata device/app
   - Anexos
   - Mudar status
   - Adicionar nota

3. **AdminFeedbackMediaViewerScreen**
   - Visualizador de anexos

4. **AdminFeedbackMetricsScreen**
   - Métricas agregadas

---

## Plano de Implementação em Fases

### Fase 1 — Documentação + Arquitetura
- **Arquivos:** qa/live_mapping/BETA_FEEDBACK_MEDIA_ADMIN_SEPARATION_PLAN.md
- **Risco:** BAIXO
- **Testes:** N/A
- **Evidências:** Documento aprovado por Felipe
- **Rollback:** N/A

### Fase 2 — Modelo de Dados e Permissões
- **Arquivos:**
  - src/types/betaFeedback.ts
  - src/services/betaFeedbackService.ts (Firebase Firestore)
  - firebase.rules (atualizar regras)
- **Risco:** MÉDIO
- **Testes:** Testes unitários de modelo
- **Evidências:** Regras de segurança validadas
- **Rollback:** Reverter regras Firebase

### Fase 3 — Tela Beta sem Upload Real
- **Arquivos:**
  - src/screens/BetaFeedbackHomeScreen.js
  - src/screens/BetaFeedbackCreateScreen.js
  - src/screens/BetaFeedbackListMineScreen.js
  - src/navigation/RootNavigator.js (adicionar rotas)
- **Risco:** BAIXO
- **Testes:** Detox/visual QA
- **Evidências:** Screenshot/XML das telas
- **Rollback:** Remover rotas e telas

### Fase 4 — Upload Real de Imagem
- **Arquivos:**
  - src/services/betaFeedbackStorageService.ts (Firebase Storage)
  - src/screens/BetaFeedbackMediaPreviewScreen.js
  - firebase.rules (atualizar regras storage)
- **Risco:** MÉDIO
- **Testes:** Upload real em device
- **Evidências:** Upload/download de imagem
- **Rollback:** Reverter regras storage

### Fase 5 — Upload Real de Vídeo
- **Arquivos:**
  - Atualizar betaFeedbackStorageService.ts para vídeo
  - Compressão se necessário
- **Risco:** MÉDIO
- **Testes:** Upload/download de vídeo
- **Evidências:** Upload/download de vídeo
- **Rollback:** Reverter regras storage

### Fase 6 — Painel Admin Separado
- **Arquivos:**
  - src/screens/AdminFeedbackInboxScreen.js
  - src/screens/AdminFeedbackDetailScreen.js
  - src/screens/AdminFeedbackMediaViewerScreen.js
  - src/screens/AdminFeedbackMetricsScreen.js
  - src/navigation/RootNavigator.js (rota protegida)
- **Risco:** MÉDIO
- **Testes:** Detox/visual QA
- **Evidências:** Screenshot/XML das telas admin
- **Rollback:** Remover rotas admin

### Fase 7 — Métricas/Filtros
- **Arquivos:**
  - Atualizar AdminFeedbackInboxScreen.js com filtros
  - Atualizar AdminFeedbackMetricsScreen.js
- **Risco:** BAIXO
- **Testes:** Testes de filtros
- **Evidências:** Screenshot de filtros funcionando
- **Rollback:** Reverter filtros

### Fase 8 — QA Real em Device
- **Arquivos:** N/A
- **Risco:** BAIXO
- **Testes:** Detox completo em device físico
- **Evidências:** Screenshots/XML de todo fluxo
- **Rollback:** N/A

---

## Testes Necessários

### Unitários
- Modelo de dados BetaFeedbackReport
- Validação de tipos
- Validação de limites (tamanho, quantidade)

### Integração
- Criar feedback via service
- Listar feedbacks do usuário
- Listar feedbacks admin
- Upload/download de anexos

### E2E (Detox)
- Fluxo completo beta (criar, listar, detalhe)
- Fluxo completo admin (listar, filtrar, detalhe, mudar status)
- Upload de imagem
- Upload de vídeo

### Visual QA
- Premium dark fitness consistente
- Textos claros (sem jargão técnico)
- CTA visível
- Preview de anexos

---

## Critérios PASS/FAIL/BLOCKED

### PASS
- Beta consegue criar feedback
- Beta consegue anexar imagem
- Beta consegue ver seus feedbacks
- Admin consegue ver todos feedbacks
- Admin consegue mudar status
- Upload/download funciona
- Regras de segurança funcionam
- QA flags false
- audit:release:check drift=0
- npm test 0 novas falhas

### FAIL
- Upload falha consistentemente
- Regras de segurança não funcionam
- Beta consegue ver feedbacks de outros
- Admin não consegue ver todos feedbacks
- Crash ao abrir anexos

### BLOCKED
- Não consegue implementar storage
- Não consegue implementar permissões
- QA flags true no diff
- Novas falhas de teste
- audit:release:check drift > 0

---

## Riscos

### MÉDIO
- Implementação de regras de segurança Firebase
- Upload de vídeo (tamanho, compressão)
- Integração com storage existente
- Performance com muitos anexos

### BAIXO
- Implementação de telas
- Integração com navegação
- Validação de formulário

### MITIGAÇÃO
- Implementar faseadamente
- Testar cada fase em device
- Reverter se necessário
- Documentar rollback

---

## Perguntas para Felipe

1. **Storage:** Prefere Firebase Storage ou API própria no Render?
2. **Roles:** Vamos implementar role 'admin' no user ou usar verificação manual por email?
3. **AdminScreen:** A AdminScreen atual no .gitignore deve ser reutilizada ou criada nova?
4. **Limite de anexos:** 5 anexos por feedback está OK?
5. **Limite de tamanho:** 10MB imagem, 50MB vídeo está OK?
6. **Metadata:** Quais dados do device/app devemos coletar automaticamente?
7. **Compressão:** Devemos comprimir vídeo antes do upload?
8. **Beta público:** Quem terá acesso ao painel beta? Todos ou selecionados?

---

## Próxima Ação Recomendada

1. Felipe aprovar este plano
2. Felipe responder perguntas acima
3. Iniciar Fase 2 (Modelo de Dados e Permissões)
4. Implementar faseadamente
5. QA em cada fase
6. Merge para main após Fase 8

---

## Status

**PLANEJAMENTO:** COMPLETO
**IMPLEMENTAÇÃO:** NÃO INICIADA
**BETA E ADMIN:** SEPARADOS
**UPLOAD MÍDIA:** PLANEJADO COM STORAGE/PERMISSÕES
**PRÓXIMO:** Felipe autorizar commit do plano ou iniciar implementação faseada
