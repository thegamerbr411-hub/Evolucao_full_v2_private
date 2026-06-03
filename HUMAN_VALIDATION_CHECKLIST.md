# CHECKLIST DE VALIDACAO HUMANA REAL — EVOLUCAO
> **IMPORTANTE:** Este documento so pode ser preenchido por uma pessoa com acesso fisico ao dispositivo.
> Nao marcar PASS sem ter executado o item. Se falhar, escrever o erro exato.
> Versao do app: 1.2.7 | Data prevista de validacao: _______________

---

## COMO USAR
1. Instalar o APK 1.2.7 no device.
2. Executar cada item NA ORDEM listada.
3. Marcar `[x]` apenas se o item passou de verdade.
4. Se falhar: marcar `[FAIL]` e descrever o erro real abaixo do item.
5. Ao final: assinar e datar.

**Status possíveis:**
- `[ ]` = NAO testado ainda
- `[x]` = PASS (funcionou)
- `[F]` = FAIL (nao funcionou — descrever erro)
- `[P]` = PENDENTE (bloqueado por outro item)

---

## PARTE 1 — INSTALACAO E ABERTURA

### 1.1 Instalacao
- [ ] APK instalou sem erro de "package invalid" ou "blocked"
- [ ] App aparece na lista de apps do device apos instalacao

**Erro registrado (se houver):**
```
_____________________________________________
```

### 1.2 Primeira abertura
- [ ] App abre sem crash na primeira vez
- [ ] Tela de onboarding ou login aparece (nao tela preta/branca por mais de 3s)
- [ ] Nenhum "Force Close" ou "App stopped"

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 2 — LOGIN

### 2.1 Login Google
- [ ] Botao "Entrar com Google" visivel e clicavel
- [ ] Seletor de conta Google abre corretamente
- [ ] Conta selecionada — login processa sem travar
- [ ] App mostra perfil do usuario apos login
- [ ] Nenhum erro "invalid_request", "Custom URI scheme" ou similar

**Erro registrado (se houver):**
```
_____________________________________________
```

> Se Google nao funcionar, testar login por e-mail/senha abaixo:

### 2.2 Login por e-mail/senha (alternativa ou adicional)
- [ ] Tela de login por e-mail existe
- [ ] Credenciais aceitas e login funciona
- [ ] Perfil carrega apos login

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 3 — REOPEN (fechamento e reabertura)

### 3.1 Fechar e reabrir
- [ ] App fechado pelo botao voltar OU pelo gerenciador de tarefas
- [ ] App reaberto — sessao mantida (nao pede login novamente)
- [ ] Dados e perfil carregam sem reload longo

**Erro registrado (se houver):**
```
_____________________________________________
```

### 3.2 Reopen apos tempo em background
- [ ] App mandado para segundo plano (home button) por pelo menos 30s
- [ ] Retornado — app retoma sem crash ou tela branca
- [ ] Estado da tela preservado

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 4 — LOGOUT E RE-LOGIN

### 4.1 Logout
- [ ] Opcao de logout acessada (menu/perfil)
- [ ] Logout executado — tela de login exibida
- [ ] Dados do usuario limpos da tela

### 4.2 Re-login apos logout
- [ ] Login realizado novamente (Google ou email)
- [ ] Perfil recarrega corretamente
- [ ] Sem dados de sessao anterior vazando

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 5 — PRO POR CODIGO

### 5.1 Ativacao PRO
- [ ] Tela/opcao de ativar PRO encontrada e acessada
- [ ] Campo de codigo digitavel
- [ ] Codigo de teste inserido e aceito
- [ ] Features PRO visiveis apos ativacao (badge, funcoes extras, etc.)

**Codigo usado:**
```
_____________________________________________
```

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 6 — SOCIAL BASICO

### 6.1 Navegacao social
- [ ] Aba/tela social encontrada e abrindo
- [ ] Lista de amigos ou ranking carrega (pode estar vazia, mas nao pode crashar)
- [ ] Botao de convite ou interacao basica visivel

### 6.2 Interacao social
- [ ] Tentativa de convite ou seguir usuario executada
- [ ] Resposta do servidor recebida (sucesso ou mensagem de erro compreensivel)
- [ ] Sem crash na tela social

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 7 — OCR BASICO

### 7.1 Acesso OCR
- [ ] Tela ou funcao de OCR encontrada
- [ ] Permissao de camera solicitada (se necessario) e aceita

### 7.2 Captura e resultado
- [ ] Imagem capturada ou carregada da galeria
- [ ] Processamento OCR iniciado sem crash
- [ ] Resultado retornado (valores ou mensagem de erro clara)
- [ ] Sem tela branca ou freeze durante OCR

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 8 — COACH BASICO

### 8.1 Acesso ao coach
- [ ] Secao de coach/acompanhamento encontrada
- [ ] Tela carrega sem crash

### 8.2 Interacao com coach
- [ ] Recomendacao ou insight aparece OU mensagem de placeholder clara
- [ ] Nenhum erro critico ou tela branca

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 9 — QUESTIONARIO

### 9.1 Fluxo de questionario
- [ ] Questionario/onboarding encontrado e iniciado
- [ ] Perguntas navegam corretamente (proximo/anterior)
- [ ] Respostas salvas entre as etapas
- [ ] Conclusao do questionario sem erro

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 10 — TREINO

### 10.1 Acesso e execucao de treino
- [ ] Tela de treino acessada
- [ ] Treino selecionado ou criado
- [ ] Treino iniciado — exercicios aparecem
- [ ] Navegacao entre exercicios funciona

### 10.2 Finalizacao
- [ ] Treino finalizado sem crash
- [ ] Resultado/resumo aparece

**Erro registrado (se houver):**
```
_____________________________________________
```

---

## PARTE 11 — NAVEGACAO ENTRE ABAS

### 11.1 Todas as abas principais
- [ ] Aba 1 (Home/Dashboard) — abre e carrega
- [ ] Aba 2 (Treino/Workout) — abre e carrega
- [ ] Aba 3 (Nutricao) — abre e carrega
- [ ] Aba 4 (Social) — abre e carrega
- [ ] Aba 5 (Perfil/Coach) — abre e carrega
- [ ] Transicoes entre abas fluidas (sem freeze ou flash branco)

**Abas que tiveram problema:**
```
_____________________________________________
```

---

## PARTE 12 — ESTABILIDADE VISUAL

### 12.1 Aparencia geral
- [ ] Nenhum texto cortado ou saindo da tela
- [ ] Nenhum botao sobreposto ou inacessivel
- [ ] Scrolls funcionam sem travar
- [ ] Fontes legiveis em tamanho normal

### 12.2 Orientacao e tamanho
- [ ] App em modo retrato estavel
- [ ] Teclado abre/fecha sem quebrar layout

**Problemas visuais observados:**
```
_____________________________________________
```

---

## PARTE 13 — ESTABILIDADE GERAL (15 MINUTOS DE USO)

- [ ] App usado por pelo menos 15 minutos continuo
- [ ] Nenhum crash espontaneo nesse periodo
- [ ] Nenhuma lentidao progressiva (memory leak visivel)
- [ ] Nenhuma perda de sessao sem logout intencional

**Observacoes:**
```
_____________________________________________
```

---

## RESULTADO FINAL

| Area | Status | Observacao |
|------|--------|------------|
| Instalacao e abertura | [ ] PASS / [ ] FAIL | |
| Login Google | [ ] PASS / [ ] FAIL | |
| Login email | [ ] PASS / [ ] FAIL | |
| Reopen | [ ] PASS / [ ] FAIL | |
| Logout/re-login | [ ] PASS / [ ] FAIL | |
| PRO por codigo | [ ] PASS / [ ] FAIL | |
| Social | [ ] PASS / [ ] FAIL | |
| OCR | [ ] PASS / [ ] FAIL | |
| Coach | [ ] PASS / [ ] FAIL | |
| Questionario | [ ] PASS / [ ] FAIL | |
| Treino | [ ] PASS / [ ] FAIL | |
| Navegacao entre abas | [ ] PASS / [ ] FAIL | |
| Estabilidade visual | [ ] PASS / [ ] FAIL | |
| Estabilidade 15min | [ ] PASS / [ ] FAIL | |

### Veredicto final
- [ ] **APROVADO** — todos os itens criticos passaram
- [ ] **APROVADO COM RESSALVAS** — itens nao criticos falharam (listar)
- [ ] **REPROVADO** — pelo menos um item critico falhou (nao distribuir)

**Itens criticos:** Instalacao, Login (qualquer), Reopen, Navegacao abas

**Testado por:** _____________________________

**Data/hora:** _____________________________

**Device (modelo + Android version):** _____________________________

**Versao do APK:** 1.2.7 / versionCode 20

---

> Este checklist deve ser arquivado junto com o release correspondente.
> Nao usar "assumindo" ou "parece que funcionou" — qualidade real importa.
