# GUIA DE VALIDAÇÃO REAL NO DEVICE — v1.2.7
> **Data:** 11 mai 2026 | **Device:** _____________ | **Tester:** _____________
> **Objetivo:** Validação humana REAL de UX, estabilidade, crashes e bugs visuais

---

## PARTE 0 — SETUP

### 0.1 Preparar device e logs
```bash
# Terminal 1 — capturar logs em tempo real
adb logcat -c
adb logcat > device-logs-session.txt &

# Terminal 2 — manter scrcpy aberto (espelho do device)
scrcpy --record=device-session.mp4
```

### 0.2 Instalar APK
```bash
adb install -r build-output/app-release.apk
# OU se preferir via npm:
npm run release:install
```

### 0.3 Iniciar captura de screenshots
- Ter câmera/smartphone preparado para capturar tela durante teste
- Ou usar Print Screen / Screenshot do device com print

---

## PARTE 1 — INSTALAÇÃO E ABERTURA (0-2 min)

**[ ] Aplicativo instalou sem erro**
- Procurar "App installed successfully" ou erro

**[ ] App abre na primeira vez (sem crash)**
- Procurar tela de splash/loading
- Se ficar travado por >10s → screenshot + anotar tempo

**[ ] Tela inicial renderiza (sem branco/preto)**
- Anotar cor do fundo
- Verificar se os elementos estão visíveis

**Log esperado** (nos logs):
```
I/ReactNative: Starting React application
```

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 2 — LOGIN GOOGLE (2-5 min)

**[ ] Botão "Entrar com Google" visível**
- Screenshot da tela de login
- Verificar se o botão está bem posicionado

**[ ] Clicar botão Google**
- Procurar seletor de conta Google
- Se 404 ou erro: screenshot do erro

**[ ] Selecionar conta Google**
- Escolher uma conta de teste
- Procurar redirecionamento para o app

**[ ] Login conclui (aparece perfil/dashboard)**
- Tempo total: ___ segundos
- Anotar se há delay perceptível (>3s esperado, >5s = problema)

**[ ] Sessiontoken armazenado localmente**
- Esperado em armazenamento app

**Log esperado:**
```
I/AuthService: Login successful
```

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 3 — ONBOARDING (5-10 min)

**[ ] Onboarding aparece OU pula direto para dashboard**
- Anotar qual comportamento

Se onboarding:
- **[ ] Perguntas aparecem (gênero, idade, peso, altura, etc.)**
- **[ ] Navegação entre perguntas funciona (próximo/anterior)**
- **[ ] Respostas são salvas (voltar e verificar)**
- **[ ] Finalizando: sem crash**

**[ ] Dashboard inicial carrega após onboarding**
- Verificar se os cards/dados aparecem

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 4 — QUESTIONÁRIO / ONBOARDING COMPLETO (10-15 min)

**[ ] Se houver fluxo de questionário integrado:**
- **[ ] Perguntas renderizam sem layout quebrado**
- **[ ] Scrolls funcionam (não trava)**
- **[ ] Botões Next/Previous clicáveis**
- **[ ] Finalizando questões sem crash**

**[ ] Dados carregam após completar**

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 5 — NAVEGAÇÃO ENTRE ABAS (15-20 min)

**[ ] Home / Dashboard**
- Clicável? Carrega rápido? (<2s)

**[ ] Treino / Workout**
- Aba abre
- Lista de treinos aparece (ou mensagem de "nenhum treino")
- Sem tela branca

**[ ] Nutrição / Comida**
- Aba abre
- Interface aparece

**[ ] Social**
- Aba abre
- Sem crash

**[ ] Perfil**
- Aba abre
- Dados do usuário aparecem

**Comportamento esperado:** transições suaves, sem flash branco, sem delay >2s

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 6 — TREINO REAL (20-30 min)

**[ ] Criar ou selecionar treino**
- Botão "Novo Treino" funciona

**[ ] Se houver treinos pré-carregados:**
- **[ ] Clicar em um treino**
- **[ ] Exercícios carregam**
- **[ ] Descrição/imagem dos exercícios aparecem**

**[ ] Iniciar treino**
- Contador/timer começa
- Sem freeze

**[ ] Navegar exercícios durante treino**
- Próximo / Anterior funcionam
- Tempo se mantém/reseta conforme esperado

**[ ] Completar treino**
- Tela de conclusão aparece
- Resultado/resumo visível
- Sem crash

**Observação de UX:**
- Delay entre cliques: ___ ms
- Responsividade dos botões: boa / lenta / muito lenta
- Loaders aparecendo: sim / não (esperado: sim com spinner)

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 7 — ALIMENTOS / NUTRIÇÃO (30-40 min)

**[ ] Aba nutrição / comida acessada**

**[ ] Se houver busca de alimentos:**
- **[ ] Campo de busca funciona**
- **[ ] Digitar "pão" e procurar em ~1s**
- **[ ] Resultados aparecem (ou "nenhum encontrado")**

**[ ] Se houver OCR / câmera:**
- **[ ] Botão de câmera funciona**
- **[ ] Permissão solicitada**
- **[ ] Câmera abre**
- **[ ] Capturar imagem (ou usar foto da galeria)**
- **[ ] Processamento OCR inicia com loader visível**
- **[ ] Resultado retorna em <5s**
- **[ ] Sem crash ou tela branca**

**Observação de UX:**
- Loader visível durante OCR: sim / não
- Feedback ao usuário: claro / confuso / ausente
- Tempo total: ___ segundos

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 8 — SOCIAL / RANKING (40-50 min)

**[ ] Aba social abrindo**

**[ ] Se houver lista de amigos:**
- **[ ] Amigos carregam OU "nenhum amigo"**
- **[ ] Ranking visível**

**[ ] Se houver funcionalidade de convite:**
- **[ ] Botão de convidar / adicionar amigo clicável**
- **[ ] Enviar convite**
- **[ ] Feedback recebido (sucesso ou erro)**

**[ ] Se houver feed social:**
- **[ ] Posts/atividades carregam**
- **[ ] Scrolls funcionam sem travar**

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 9 — PRO / ATIVAÇÃO (50-60 min)

**[ ] Se houver botão de ativar PRO:**
- **[ ] Botão visível e clicável**
- **[ ] Tela de ativação abre**

**[ ] Inserir código PRO**
- Usar código de teste: `TEST123` (ou qual foi fornecido)
- **[ ] Código aceito**
- **[ ] Features PRO desbloqueadas (badge, funcões extras)**
- **[ ] Sem crash**

**Observação:**
- Badge PRO visível após ativação: sim / não
- Funcões PRO acessíveis: sim / não

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 10 — REOPEN / BACKGROUND (60-70 min)

**[ ] App ainda logado após reopen**
1. Botão Home (sair do app para tela inicial)
2. Esperar 30s
3. Retornar para o app (clicar ícone)
4. **[ ] App abre sem pedir login novamente**
5. **[ ] Dados mantidos (não perdeu estado)**

**[ ] Kill e reabrir via recentes**
1. Gerenciador de tarefas > fechar app
2. Esperar 10s
3. Gerenciador de tarefas > reabrir
4. **[ ] App abre sem erro**
5. **[ ] Ainda logado**

**Tempo esperado:** <2s para abrir

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 11 — ESTABILIDADE GERAL (70-80 min)

**[ ] Usar app continuamente por 10 minutos**
- Navegar entre todas as abas 2x cada
- Não deve crashar

**[ ] Procurar comportamentos anômalos:**
- Tela travando por >1s
- Elementos desaparecendo
- Textos sobrepondo
- Scrolls com lag

**Sensação geral:** 
- Muito lenta / lenta / normal / rápida

**Bugs encontrados:**
```
_________________________________________________
```

---

## PARTE 12 — LOGOUT (80-85 min)

**[ ] Encontrar opção de logout**
- Menu > Perfil > Logout OU similar

**[ ] Clicar logout**
- **[ ] Confirmação solicitada (se houver)**
- **[ ] Volta para tela de login**
- **[ ] Sem erro**

**[ ] Tentar logar novamente**
- **[ ] Login funciona segunda vez sem problema**

**Bugs encontrados:**
```
_________________________________________________
```

---

## RESULTADO FINAL

### Resumo por área

| Área | Status | Observação |
|------|--------|------------|
| Instalação | [ ] OK / [ ] FAIL | |
| Login Google | [ ] OK / [ ] FAIL | |
| Onboarding | [ ] OK / [ ] FAIL | |
| Questionário | [ ] OK / [ ] FAIL | |
| Navegação abas | [ ] OK / [ ] FAIL | |
| Treino | [ ] OK / [ ] FAIL | |
| Nutrição/OCR | [ ] OK / [ ] FAIL | |
| Social | [ ] OK / [ ] FAIL | |
| PRO | [ ] OK / [ ] FAIL | |
| Reopen | [ ] OK / [ ] FAIL | |
| Estabilidade 10min | [ ] OK / [ ] FAIL | |
| Logout | [ ] OK / [ ] FAIL | |

### Veredicto

- [ ] **PASS COMPLETO** — app pronto para release
- [ ] **PASS COM RESSALVAS** — bugs encontrados abaixo (não bloqueantes)
- [ ] **FAIL** — bugs críticos — não distribuir

### Bugs críticos (se houver)
```
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

### Bugs menores (não bloqueantes)
```
1. _______________________________________________
2. _______________________________________________
```

### Observações gerais
```
___________________________________________________
___________________________________________________
```

---

## COLETA DE EVIDÊNCIA

### Arquivos a coletar:
- [ ] `device-logs-session.txt` — logs do adb logcat
- [ ] `device-session.mp4` — vídeo do scrcpy
- [ ] Screenshots de:
  - [ ] Tela de login
  - [ ] Dashboard após login
  - [ ] Treino em execução
  - [ ] OCR processando
  - [ ] Social/ranking
  - [ ] PRO ativado
  - [ ] Qualquer erro encontrado

### Comandos úteis durante teste:
```bash
# Se app crashar, ver stack trace:
adb logcat | grep -i "crash\|exception\|fatal"

# Se ficar lento, checar CPU/RAM:
adb shell dumpsys meminfo

# Puxar logs:
adb pull /sdcard/Android/data/com.tipolt.evolucaofullv2/files/
```

---

## DEPOIS DO TESTE:
1. Enviar os resultados do formulário acima
2. Anexar logs, screenshots, vídeo
3. Se tudo GREEN: autorizar geração de APK final 1.2.7
4. Se houver FAILs: abrir issues antes de distribuir
