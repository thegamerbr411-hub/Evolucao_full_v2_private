# Fallback visual local + CTA “Ver execução” — Exercícios

**Data:** 2026-06-02  
**Relacionado:** [`EXERCISE_MEDIA_DETAIL_AUDIT.md`](EXERCISE_MEDIA_DETAIL_AUDIT.md) · RF-02  
**PASS global:** NÃO  
**Commit/push:** NÃO (aguardando OK Felipe)  

---

## Resumo

Melhoria mínima para exercícios sem mídia real: card visual local por grupo muscular, CTA honesto **“Ver execução”** no treino, detalhe sem preview quebrado nem promessa de vídeo via `cdn.app.com`.

---

## Implementação

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Helper | [`src/utils/exerciseMedia.js`](../../src/utils/exerciseMedia.js) | `isPlaceholderMediaUrl`, `resolveExerciseMedia`, copy “em preparação” |
| UI fallback | [`src/components/exercise/ExerciseMediaFallback.js`](../../src/components/exercise/ExerciseMediaFallback.js) | Card gradiente + ícone + músculo/equipamento |
| CTA | [`src/components/exercise/ExerciseExecutionCta.js`](../../src/components/exercise/ExerciseExecutionCta.js) | “Ver execução” — subtítulo não promete vídeo se placeholder |
| Treino | [`src/components/workout/ExerciseCard.js`](../../src/components/workout/ExerciseCard.js) | Fallback local; remove “Preview indisponivel” |
| Treino | [`src/screens/WorkoutScreen.js`](../../src/screens/WorkoutScreen.js) | Modo avançado: fallback + CTA no exercício ativo; `onViewExecution` → `ExerciseDetail` |
| Detalhe | [`src/screens/ExerciseDetailScreen.js`](../../src/screens/ExerciseDetailScreen.js) | Fallback hero + copy; sem YouTube genérico como fluxo principal |
| Rotinas catálogo | [`src/screens/RoutinesScreen.js`](../../src/screens/RoutinesScreen.js) | Não carrega thumb CDN placeholder |

---

## Testes

```bash
node --test __tests__/exerciseMediaFallback.test.mjs
```

**Resultado:** **8/8 PASS**

---

## QA visual

| Item | Status |
|------|--------|
| Device | **emulator-5554** online |
| Modo | **Manual guiado** (4 detalhes) + **automático** (CTA treino) — [`tools/visual_qa_exercise_workout_cta_auto.ps1`](../../tools/visual_qa_exercise_workout_cta_auto.ps1) |
| Tentativa automática (2026-06-04) | Catálogo/Detalhes **INVÁLIDA** · CTA treino **REVALIDADO** (auto, 43s) |
| PNGs `_REVALIDADO` | **4 detalhes** + **2 CTA treino** (`exercise_workout_ver_execucao_cta/detail_REVALIDADO.png`) |
| Log | [`videos/first_install_tabs_20260603_1346/exercise_manual_qa_log.json`](videos/first_install_tabs_20260603_1346/exercise_manual_qa_log.json) |
| Checkpoint | [`CHECKPOINT_EXERCISE_MANUAL_QA.txt`](videos/first_install_tabs_20260603_1346/CHECKPOINT_EXERCISE_MANUAL_QA.txt) · [`CHECKPOINT_CTA_VER_EXECUCAO.txt`](videos/first_install_tabs_20260603_1346/CHECKPOINT_CTA_VER_EXECUCAO.txt) |

**Rodada manual (2026-06-04):** 4/4 detalhes **REVALIDADO**. CTA treino: bug no `WorkoutScreen` (modo avançado não renderizava CTA) corrigido; validação automática **COMPLETA** no `emulator-5554` — `btn-ver-execucao` + fallback no XML, tap abre detalhe (nome **PARCIAL** vs exercício focado).

| Exercício | Detalhe | Arquivo |
|-----------|---------|---------|
| Supino Inclinado Halter | SIM | `exercise_detail_supino_inclinado_REVALIDADO.png` |
| Voador (Peck Deck) | SIM | `exercise_detail_voador_peckdeck_REVALIDADO.png` |
| Agachamento Livre | SIM | `exercise_detail_agachamento_REVALIDADO.png` |
| Remada Curvada Barra | SIM | `exercise_detail_remada_curvada_REVALIDADO.png` |
| CTA Ver execução (treino) | **SIM** | `exercise_workout_ver_execucao_cta_REVALIDADO.png` |
| Detalhe pós-CTA | **SIM (PARCIAL nome)** | `exercise_workout_ver_execucao_detail_REVALIDADO.png` |

**Comando CTA automático:**

```powershell
.\tools\visual_qa_exercise_workout_cta_auto.ps1 -Serial emulator-5554 -SessionId 20260603_1346
```

Script automático [`visual_qa_exercise_media_fallback.ps1`](../../tools/visual_qa_exercise_media_fallback.ps1): **DEPRECATED**.

---

## CHECKPOINT — FALLBACK EXERCÍCIOS / CTA EXECUÇÃO PRONTO

| Item | Valor |
|------|-------|
| Fallback local implementado? | **SIM** |
| CTA “Ver execução” implementado? | **SIM** |
| Preview quebrado removido? | **SIM** (treino) |
| Mídia real adicionada? | **NÃO** |
| Copyright/externos usados? | **NÃO** |
| Arquivos alterados | `exerciseMedia.js`, `ExerciseMediaFallback.js`, `ExerciseExecutionCta.js`, `ExerciseCard.js`, `ExerciseDetailScreen.js`, `WorkoutScreen.js`, `RoutinesScreen.js`, `exerciseMediaFallback.test.mjs`, `tools/visual_qa_exercise_workout_cta_auto.ps1`, `AndroidQaTarget.ps1` |
| Testes | **8/8 PASS** |
| QA visual | **COMPLETO** — 4 detalhes + CTA treino `_REVALIDADO` (auto 2026-06-04) |
| Commit/push | **NÃO** |
| PASS global | **NÃO** |
| Pode commitar? | **AGUARDANDO OK FELIPE** |

**Próxima fase:** preencher textos dos 13 prioritários vazios; depois assets próprios/licenciados.
