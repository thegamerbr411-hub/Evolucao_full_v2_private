# Evolução — QA Funcional Recursos Restantes

**Data:** 2026-06-04  
**Projeto:** `F:\projetos\evolucao app`  
**App:** `com.tipolt.evolucaofullv2`  
**Tipo:** QA funcional/visual — **sem alteração de código**  
**Commit Nutrição (baseline, fora deste escopo):** `2d3d002` — `feat(nutrition): separate text label and plate draft flows`  
**PASS global do app:** NÃO  
**Commit/push desta rodada:** NÃO  

---

## 1. Resumo executivo

| Área | Veredito | Resumo |
|------|--------|--------|
| Imports IA | PARCIAL | Nutrição 3 fluxos + import treino por texto funcionam com **rascunho/revisão**; heurística **local**, sem LLM/OCR real |
| Adicionar amigo | PARCIAL | UI + API social **carregam** no 5554; fluxo por **userId**; **2 contas não cruzadas** nesta sessão |
| Desafios admin-only | FALHA (UX) | Card **“Criar desafio” visível** para sessão sem Admin no hub Mais — risco P1 |
| Exercícios mídia | PARCIAL | Catálogo rico em texto; URLs `cdn.app.com` = placeholder; detalhe usa **YouTube search** |
| Coach | PARCIAL | Regras locais + dados do dia; **não** é API ChatGPT/Gemini |

**Próxima ação única recomendada:** **RBAC desafios** — esconder/bloquear “Criar desafio” para não-admin no client e validar no backend (`POST /api/social/challenges`).

---

## 2. Ambiente usado

| Item | Valor |
|------|--------|
| Device principal | **emulator-5554** (sessão QA manhã 04/06) |
| Device na fase 2 | **offline** (`adb devices` só RQ8T209ZTAF) — re-teste exercício/coach pendente com 5554 ligado |
| Metro reload | **OK (200)** na sessão principal |
| RQ8T209ZTAF | **não usado** (Nexa) |
| Contas planejadas | `thegamerbr411@gmail.com` (admin provável), `tipoltlabs@gmail.com` (comum) |
| Sessão observada no device | `userId` **OGzqit1InkeajxyWeqWfKmZxitK2** — painel social carregou |
| Role na sessão | **Admin no Mais: NÃO** (`btn_mais_admin` ausente); **Criar desafio: SIM** |
| E-mails ↔ contas | **Não confirmados na UI** nesta sessão (Perfil não capturado corretamente) |
| API social | Overview **OK** via app (`socialOverviewOk: true`) — host Render/QA transport |
| Dados | Sem `pm clear`; sem reset |

**Limitação:** teste amigo A→B e admin vs comum exige **logout/login** nas duas contas (Felipe manual) ou segundo emulador.

Evidências: `qa/live_mapping/videos/remaining_features/`  
Log JSON: `remaining_features_qa_log.json`

---

## 3. Imports IA

### Matriz (código + device onde aplicável)

| Fluxo | Entrada | Saída | Rascunho? | Editar? | Salva auto? | API real? | Status |
|-------|---------|-------|-----------|---------|-------------|-----------|--------|
| Texto refeição | Texto livre | Macros + itens | SIM | SIM (draft) | NÃO | NÃO (local) | **OK** |
| Tabela por texto | Texto colado | Tabela parseada | SIM | SIM | NÃO | NÃO (sem OCR foto) | **OK** (commit `2d3d002`) |
| Estimativa prato | Descrição/foto ref. | Estimativa baixa conf. | SIM | SIM | NÃO | NÃO | **OK** |
| Import treino (Import IA) | Texto multilinha | Preview exercícios | SIM (preview) | SIM (override) | NÃO (confirma) | NÃO | **OK** (código); tela import **não** re-capturada só hub |
| Rotina “IA” | — | — | — | — | — | — | **N/A** — só montagem manual em Rotinas |
| Coach import | Chat | — | — | — | — | — | **N/A** |

**Observações:**

- Botão **Import IA** no hub Treino navega para `ImportWorkout` — subtítulo honesto: “Cole texto livre…” ([`ImportWorkoutScreen.js`](../../src/screens/ImportWorkoutScreen.js)).
- Nutrição: foto **não** alimenta parser; copy UX pós-`2d3d002` deixa isso explícito.
- Nada encontrado que persista refeição/treino **sem** passo de confirmação no import treino.

**Evidências:** `imports_ia_nutrition_cards.png` (resultado tabela Monster ainda na sessão), `imports_ia_workout_import.png` (hub Treino com tile Import IA).

---

## 4. Adicionar amigo

### O que existe

- Tela: **Mais → Social** ou Treino → **Desafios** → [`SocialChallengesScreen.js`](../../src/screens/SocialChallengesScreen.js).
- Campo `input-social-friend-userid` + `btn-social-add-friend`.
- API: `POST /api/social/friends/add` ([`socialApiService.js`](../../src/services/socialApiService.js)).

### Cenários

| Cenário | Resultado |
|---------|-----------|
| Conta A adiciona B | **NÃO EXECUTADO** — falta `userId` da segunda conta logada |
| Convite / aceite | **NÃO** — add direto por ID; sem estado pendente na UI |
| Amigo em Nutrição | **NÃO** — sem UI de amigo em Nutrição (esperado) |
| Painel social | **OK** — Amigos: 0, liga BRONZE, ranking vazio |
| API indisponível | **NÃO** nesta sessão |

### Respostas às perguntas Felipe

1. **Funciona?** Infraestrutura **sim** (overview carrega); fluxo ponta a ponta **não validado** com 2 IDs.
2. **Precisa 2 contas?** **SIM** — ou duas sessões com userIds diferentes.
3. **Como adicionar?** Colar **user id do amigo** (não e-mail).

**Evidências:** `friend_add_account_a.png`, `friend_invite_sent.png` (mesma tela social).

---

## 5. Desafios admin-only

### Sessão emulator-5554 (conta atual)

| Conta | Role UI | Botão criar visível? | Criar permitido? | Bloqueio claro? | Status |
|-------|---------|----------------------|------------------|-----------------|--------|
| OGzqit1… (sem Admin no Mais) | **user** (inferido) | **SIM** | **Não testado** (tap não isolado) | **NÃO** | **FALHA UX** |

### Código

- [`SocialChallengesScreen.js`](../../src/screens/SocialChallengesScreen.js) L223–240: card **Criar desafio** sempre renderizado — **sem** `user.role === 'admin'`.
- Tipo fixo na criação: `workouts_count` + meta numérica — **não** há UI “2L água / 7 dias”.

### Admin (thegamerbr411)

- **Não re-testado** nesta sessão (emulador offline + sem troca de conta).
- Criar desafio QA só após confirmar role admin no Perfil.

**Critério Felipe:** comum não deve criar — **não atendido no frontend** (P1).

**Evidências:** `challenge_common_user_blocked.png` (mostra card Criar desafio + ranking vazio).

---

## 6. Exercícios: imagens, vídeos e detalhes

### Auditoria catálogo (Node — [`exercises.js`](../../src/data/exercises.js))

| Exercício | Imagem/thumb | Vídeo URL | Instr. | Erros | Músculo | Equip. | Status device |
|-----------|--------------|-----------|--------|-------|---------|--------|---------------|
| Supino Inclinado Halter | cdn.app.com | cdn.app.com | 4 | 2 | chest | halter | PARCIAL |
| Supino Inclinado Barra | cdn | cdn | 0 | 0 | chest | barra | PARCIAL |
| Voador (Peck Deck) | cdn | cdn | 0 | 0 | chest | maquina | PARCIAL |
| Agachamento Livre | cdn | cdn | 4 | 3 | legs | barra | PARCIAL |
| Remada Curvada Barra | cdn | cdn | 0 | 0 | back | barra | PARCIAL |
| Rosca Direta Barra | cdn | cdn | 3 | 0 | biceps | barra | PARCIAL |
| Desenvolvimento Halter | cdn | cdn | 3 | 0 | shoulders | halter | PARCIAL |
| Leg Press 45 | cdn | cdn | 4 | 2 | legs | maquina | PARCIAL |
| Cadeira Extensora | cdn | cdn | 3 | 2 | legs | maquina | PARCIAL |
| Mesa Flexora | cdn | cdn | 3 | 2 | hamstrings | maquina | PARCIAL |
| Elevação de Quadril | — | — | — | — | — | — | **N/A** (usar **Hip Thrust** no catálogo) |

### Comportamento [`ExerciseDetailScreen.js`](../../src/screens/ExerciseDetailScreen.js)

- `cdn.app.com` → **sem** player nativo → link **YouTube** (busca por nome).
- Tabs: Resumo / Histórico / Instruções.
- Acesso: botão **Detalhes** em Treino livre / Rotinas / Treino ([`FreeWorkoutScreen.js`](../../src/screens/FreeWorkoutScreen.js), [`RoutinesScreen.js`](../../src/screens/RoutinesScreen.js)).

### Treino em execução

- [`ExerciseCard.js`](../../src/components/workout/ExerciseCard.js): preview GIF/thumb; sem modal “ver execução” dedicado.

### Premium?

- **Não** — mídia real ausente; texto variável (muitos exercícios V2 sem instruções); fallback YouTube é paliativo.

**Evidências device:** re-captura `exercise_*.png` **falhou** (emulador offline; arquivos 0 bytes na fase 2). Confiar em catálogo + código + e2e `Detalhes`.

---

## 7. Coach

### Modo atual

- [`CoachChatScreen.js`](../../src/screens/CoachChatScreen.js): `buildDailyCoachState` + `buildCoachMessage` + `detectIntents` (regras locais).
- Card superior com proteína/água/treino do **dia real**.
- Firebase `subscribeToMessages` — histórico, **não** geração LLM.
- Quick actions: treino, refeição, água, rotina.

### Perguntas Felipe (análise código + intents — device chat **não** re-capturado)

| Pergunta | Usa dados reais? | Útil? | Genérica? | Notas |
|----------|------------------|-------|-----------|-------|
| Terminei treino, o que faço agora? | SIM (workout status) | Média | Parcial | intent `workout` |
| Proteína baixa hoje? | SIM | Alta | Baixa | intent `nutrition` |
| Bebi pouca água? | SIM | Alta | Baixa | intent `nutrition` / água |
| Que refeição agora? | SIM | Média | Média | sem API meal plan |
| Melhorar treino peito? | Parcial | Média | Média | intent `workout` + exercícios |
| Dica supino inclinado? | Parcial | Média | Média | `resolveGymExerciseMention` |

**Limitação:** não é “IA esperta” no sentido LLM; é **coach baseado em regras** com bom uso de contexto diário.

**Evidência:** `coach_tab_initial.png` inválido (0 bytes) na fase 2; sessão anterior capturou social em vez de coach — regravar aba Coach com 5554 online.

---

## 8. Bugs confirmados

| ID | Área | Sev. | Evidência | Próxima ação |
|----|------|------|-----------|--------------|
| RF-01 | Desafios | **P1** | `challenge_common_user_blocked.png` + código L223–240 | **FIX código** — ver [`CHALLENGE_ADMIN_RBAC_FIX_REPORT.md`](CHALLENGE_ADMIN_RBAC_FIX_REPORT.md); QA visual 5554 pendente |
| RF-02 | Exercícios | **P2** | Catálogo `cdn.app.com` + `isPlaceholderCdn` | Assets locais 15–20 exercícios + CDN real |
| RF-03 | Imports IA | **P2** | Tile “Import IA” / sparkles | Copy: “Importar por texto” |
| RF-04 | Amigos | **P2** | Social UI | UX: busca por e-mail/código + convite |
| RF-05 | Coach | **P3** | Código | Deixar explícito “regras locais” na UI |
| RF-06 | QA | **P3** | phase2 PNGs 0 bytes | Re-rodar com emulator-5554 |

---

## 9. Problemas de evidência/teste

- `profile_role_check.png` capturou scroll de **Social**, não Perfil.
- `coach_tab_initial.png` (fase 2) **0 bytes** — device ausente.
- Amigo **friend_added_success.png** / conta B **não** gerados — 2 contas não alternadas.
- Vídeo `imports_ia_overview.mp4` **não** gravado (não solicitado com conteúdo validado).

---

## 10. Inventário estático cruzado

Ver também: [`EVOLUCAO_NEXT_FEATURES_AI_NUTRITION_SOCIAL_REVIEW.md`](EVOLUCAO_NEXT_FEATURES_AI_NUTRITION_SOCIAL_REVIEW.md)

---

## CHECKPOINT — QA FUNCIONAL RECURSOS RESTANTES CONCLUÍDA

| Item | Status |
|------|--------|
| Relatório criado | **SIM** |
| Emuladores usados | **emulator-5554** (sessão principal); fase 2 sem device |
| Contas usadas | 1 sessão (`OGzqit1…`); 2 e-mails **não** cruzados |
| Imports IA | **PARCIAL** |
| Adicionar amigo | **PARCIAL** |
| Desafios admin-only | **FIX código** (UI+API); revalidar visual 5554 |
| Exercícios mídia | **PARCIAL** (catálogo + código) |
| Coach | **PARCIAL** (regras locais; chat não regravado) |
| Bugs P0/P1 | **0 / 1** (RF-01) |
| Bugs P2/P3 | **3 / 2** |
| Maior lacuna | **RBAC desafios + mídia real exercícios** |
| Próxima ação única | **QA visual RF-01 no 5554** → depois mídia exercícios (RF-02) |
| Código alterado? | **SIM** (RBAC RF-01 — aguardando OK Felipe para commit) |
| Commit/push feito? | **NÃO** |
| PASS global do app? | **NÃO** |
