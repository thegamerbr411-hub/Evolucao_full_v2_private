# Beta Feedback Rollback Plan

## Overview
Este documento descreve o plano de rollback para a feature Beta Feedback com Firebase Storage e Firestore.

## Rollback Triggers
- Bug crítico em produção
- Performance degradation
- Security issue descoberto
- Data corruption
- Firebase rules permissivas acidentalmente

## Rollback Steps

### 1. Immediate Rollback (Feature Flags)
```bash
# Desativar todas as flags beta
EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_ENTRY=0
EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER=0
EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD=0
EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT=0
```

### 2. Firebase Rules Rollback
```bash
# Reverter rules para versão anterior
firebase deploy --only firestore:rules --force
firebase deploy --only storage:rules --force
```

### 3. Code Rollback
```bash
# Revert para commit anterior sem beta feedback
git revert <commit-hash>
git push origin main
```

### 4. Data Cleanup (Opcional)
```bash
# Limpar dados beta feedback (se necessário)
# Firestore: betaFeedback collection
# Storage: beta-feedback/ path
```

## Rollback Verification
- Verificar que flags estão desativadas
- Verificar que UI não mostra beta feedback
- Verificar que não há chamadas a Firebase Storage/Firestore
- Verificar que não há novos dados sendo criados

## Rollback Time Estimate
- Feature flags: < 5 minutos
- Firebase rules: < 10 minutos
- Code rollback: < 30 minutos
- Total: < 45 minutos

## Rollback Communication
- Notificar equipe de desenvolvimento
- Notificar stakeholders
- Documentar motivo do rollback
- Agendar post-mortem

## Prevention
- Testes em staging antes de produção
- Gradual rollout (canary)
- Monitoring e alertas
- Review de Firebase rules
- Feature flags sempre ativadas
