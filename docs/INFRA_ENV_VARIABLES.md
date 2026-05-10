# INFRA ENV VARIABLES

## Escopo
Variaveis necessarias para backend e app.

## Backend obrigatorias
- JWT_SECRET
- NODE_ENV
- APP_API_KEY (se usado por middleware de cliente)
- RESEND_API_KEY ou SMTP_HOST+SMTP_USER+SMTP_PASS
- PASSWORD_RESET_URL (recomendado para reset real)

## Backend opcionais controladas
- ENABLE_QA_LOCAL_BYPASS
- ENABLE_QA_ENDPOINTS
- ADMIN_EMAILS
- ADMIN_EMAIL

## App (Expo/Firebase/OAuth)
- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID
- EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
- EXPO_PUBLIC_GOOGLE_CLIENT_ID (fallback)

## Regras de seguranca
- Nunca commitar segredo novo em texto puro.
- Usar secret manager da plataforma (Render/CI/EAS).
- Se token vazar, revogar imediatamente e rotacionar.

## Validacao
Executar scripts/check-env.ps1 antes de release.