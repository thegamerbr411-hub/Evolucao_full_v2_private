# Release Readiness Dry-Run — pós PR #31 / PR #32

> **Tipo:** DRY-RUN — **não** é release real  
> **Estado:** `RELEASE_READINESS_DRY_RUN_DONE`  
> **Data:** 2026-06-15 (UTC)  
> **Projeto:** EVOLUÇÃO — `com.tipolt.evolucaofullv2`  
> **Repo:** [thegamerbr411-hub/Evolucao_full_v2_private](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private)  
> **Base:** `origin/main` @ `79286e01b261c677ddb07f174ed07675fa4d7f7e`  
> **Branch dry-run:** `docs/release-readiness-post-pr31`  
> **Device:** `RQ8T209ZTAF` (Samsung SM-G990E, Android 14)

---

## Escopo deste ciclo

| Ação | Feito? |
|------|--------|
| Release publicado | **NÃO** |
| Tag criada | **NÃO** |
| Play Store | **NÃO** |
| Firebase prod | **NÃO** |
| Lote 2 iniciado | **NÃO** |
| Correções em `src/**` | **NÃO** |
| `audit:release:sync` | **NÃO** (proibido neste ciclo) |
| Flags QA → true | **NÃO** |
| `EXPO_PUBLIC_SHOW_QA_DIAGNOSTICS=1` | **NÃO** |

Evidências locais (APK, PNG, XML, logs): `.qa_runtime/release_readiness_dry_run_post_pr31/` — **não commitadas**.

---

## Baseline pós-merge

| Item | Status |
|------|--------|
| PR #31 — premium release cleanup v1 | **MERGED** @ `8906f35` |
| PR #32 — post-merge baseline doc | **MERGED** @ `79286e0` |
| [`qa/visual/PR31_POST_MERGE_BASELINE.md`](../visual/PR31_POST_MERGE_BASELINE.md) em `origin/main` | **SIM** |
| Releases GitHub novos | **NÃO** (último: `apk-evolucao-app-116`, 2026-05-17) |

PRs abertos no repo (snapshot): #30 (`fix/remaining-visual-release-blockers`), #27 (`qa/release-readiness-post-visual-audit`).

---

## Veredito

### **GO COM RISCO**

O app está **utilizável em release APK** no device físico, sem RedBox e sem NEXA em foreground, com audit drift 0 e build release OK. Porém a suíte `npm test` falhou (10 arquivos), há divergência de versão Expo/Gradle, signing release usa debug keystore, e catálogo/histórico no smoke foram validados só por navegação tap (evidência parcial).

| Destino | Veredito |
|---------|----------|
| Closed beta interno (APK manual, testers conhecidos) | **GO COM RISCO** |
| Play Store closed/open testing formal | **NO-GO** até alinhar versionCode, keystore prod e suite de testes verde |
| Produção pública | **NO-GO** |

---

## P0 — blockers funcionais

| ID | Item | Status |
|----|------|--------|
| P0-1 | RedBox / crash no smoke release | **0** — logcat limpo |
| P0-2 | Package errado / NEXA em foreground | **0** — `com.tipolt.evolucaofullv2`; NEXA `pidof` vazio |
| P0-3 | Audit drift | **0** — drift 0 |

**Total P0:** 0

---

## P1 — riscos relevantes pré-beta

| ID | Item | Detalhe |
|----|------|---------|
| P1-1 | `npm test` exit 1 | 10 suites falharam (ver Gates) |
| P1-2 | Integridade teste desatualizado pós-PR31 | `workoutsHubScreen.integrity.test.mjs` — assert `title="Iniciar treino"` não bate com copy atual |
| P1-3 | Infra Node v26 + import RN | Vários `.test.mjs` falham com `SyntaxError: Unexpected token 'typeof'` ao importar `react-native` |
| P1-4 | Divergência versão | Expo `1.2.5` / code **125** vs Gradle `1.2.8` / code **21** |
| P1-5 | Release signing | `assembleRelease` OK mas keystore release = debug (inadequado Play Store) |

**Total P1:** 5

---

## P2 — polish / processo / infra

| ID | Item | Detalhe |
|----|------|---------|
| P2-1 | Smoke catálogo/detalhe | Tap heurístico — não confirmou `ExerciseDetailScreen` isolada |
| P2-2 | Smoke histórico | Tap heurístico — sem Detox dedicado neste dry-run |
| P2-3 | Lote 2 visual | Não iniciado — pendências premium pós-Lote 1 |
| P2-4 | PRs docs antigos abertos | #27, #30 ainda OPEN |
| P2-5 | Build time | `assembleRelease` ~15 min (682 tasks) |

**Total P2:** 5

---

## Gates

| Gate | Comando | Resultado | Evidência |
|------|---------|-----------|-----------|
| Context guard | `verify_evolucao_context.cjs` | **PASS** `CONTEXT_GUARD_OK` | `.qa_runtime/.../guard.log` |
| Audit release | `npm run audit:release:check` | **PASS** drift **0**, exit **0** | `.qa_runtime/.../audit_release_check.log` |
| Unitários | `npm test -- --runInBand` | **FAIL** exit **1** | `.qa_runtime/.../npm_test.log` |

### Suites que falharam (10)

1. `dailyState.test.mjs`
2. `firebaseEmulatorConfig.unit.test.mjs`
3. `humanRealUsage.fullstack.test.mjs`
4. `releaseReadinessBaseline.integrity.test.mjs`
5. `socialUxVariations.integration.test.mjs`
6. `useCases.errorHandling.test.mjs`
7. `workoutFinishFlow.test.mjs`
8. `workoutHistoryCapture.test.mjs`
9. `workoutUseCase.integration.test.mjs` — infra RN import / Node v26
10. `workoutsHubScreen.integrity.test.mjs` — assert copy stale pós-PR31

Demais suites individuais no log passaram (ex.: persistência treino, set row, etc.).

---

## Build (dry-run)

| Campo | Valor |
|-------|--------|
| Comando | `npm run release:apk` → `gradlew assembleRelease` |
| Resultado | **PASS** — `BUILD SUCCESSFUL in 14m 59s`, exit **0** |
| APK path | `build-output/app-release.apk` |
| Tamanho | **92 887 947 bytes** (~88.6 MiB) |
| SHA-256 | `85B4B34C16989D4191D4CAB8FD8D0C902D9218CAF66D55C1F792802C1E9C19A3` |
| Timestamp local | 2026-06-15T02:42:04-03:00 |
| Publicado | **NÃO** |
| Commitado | **NÃO** |

Install release no device:

```
adb -s RQ8T209ZTAF install -r build-output/app-release.apk
→ Success (exit 0)
```

---

## Device smoke (release APK)

Device exclusivo: **RQ8T209ZTAF**. NEXA force-stop antes do smoke.

| Tela / passo | Resultado | Notas |
|--------------|-----------|-------|
| Launch / Home | **PASS** | Foreground `com.tipolt.evolucaofullv2/.MainActivity` |
| Treino | **PASS** | Tab tap + XML package Evolução |
| Catálogo/detalhe | **PARCIAL** | Tap central pós-Treino; sem assert Detox de `ExerciseDetailScreen` |
| Histórico | **PARCIAL** | Tap heurístico em área inferior Treino |
| Nutrição | **PASS** | Tab + XML package Evolução |
| Social | **PASS** | Tab + XML package Evolução |
| Perfil/config | **PASS** | Tab + XML package Evolução |
| Home final | **PASS** | Retorno tab Home |
| RedBox | **PASS** | Nenhum match logcat |
| NEXA ausente | **PASS** | `pidof com.nexa.finance` vazio |

Capturas: `.qa_runtime/release_readiness_dry_run_post_pr31/screens/` (9 PNG) e `dumps/` (9 XML).

---

## Riscos Play Store

1. **versionCode/versionName** desalinhados entre Expo e Gradle — upload pode confundir track ou rejeitar upgrade.
2. **Signing release = debug keystore** — não aceitável para produção; closed testing exige keystore de release dedicada.
3. **Suite de testes vermelha** — CI/local gate inconsistente para merge contínuo.
4. **Lote 2 não fechado** — polish visual premium incompleto para nota alvo Play Store (8.2+).

---

## Riscos produto

1. Copy/test drift pós-PR31 indica testes de integridade não sincronizados com UI real.
2. Catálogo e histórico não recapturados com Detox neste dry-run — regressões silenciosas possíveis.
3. PR #30 (remaining visual blockers) ainda aberto — overlap com pendências visuais conhecidas.

Referência merge-ready PR31: [`qa/visual/PREMIUM_RELEASE_CLEANUP_V1_POST_BUILD_RECAPTURE.md`](../visual/PREMIUM_RELEASE_CLEANUP_V1_POST_BUILD_RECAPTURE.md).

---

## Próximos passos (fora deste ciclo)

1. Atualizar/sincronizar testes de integridade pós-PR31 (sem misturar com Lote 2 se Felipe separar).
2. Alinhar `app.json` versionCode/versionName com `android/app/build.gradle`.
3. Configurar keystore release de produção (fora do repo).
4. Re-rodar `npm test` com Node 20.x (engines do projeto) para separar infra vs produto.
5. Felipe decide: **Lote 2** (visual) vs **Release Readiness formal** com gates verdes.

---

## Recomendações

| Pergunta | Resposta |
|----------|----------|
| **Publicar beta agora?** | **NÃO** — GO COM RISCO só para APK manual interno; test suite vermelha + signing/version pendente |
| **Abrir Lote 2?** | **SIM** — polish visual restante antes de closed testing Play Store |

---

## Flags QA (inalteradas)

| Flag | Valor |
|------|-------|
| `enableQaTransport` | false |
| `qaWorkoutFixture` | false |
| `androidNavAudit` | false |

---

## Referências

- PR #31 baseline: [`qa/visual/PR31_POST_MERGE_BASELINE.md`](../visual/PR31_POST_MERGE_BASELINE.md)
- Relatório readiness anterior (pré-PR31): [`qa/RELEASE_READINESS_FINAL_REPORT.md`](../RELEASE_READINESS_FINAL_REPORT.md)
