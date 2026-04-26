# Video Audit - App TP (2026-04-18)

Base de evidência:
- Videos copiados de `/sdcard/DCIM/Videos app TP` para `artifacts/videos-app-tp/Videos app TP`.
- Análise visual por amostragem temporal (6 frames por vídeo) em `artifacts/video-audit/frames`.

## 1) COBERTURA REAL VISTA NO VIDEO

### 1.1 Abas/telas comprovadamente acessadas
- Home: dashboard inicial, cards de progresso, treino do dia, nutrição hoje, ações rápidas.
- Treino: hub de treinos, treino livre, importação IA, busca/filtro de exercícios, adição de exercício, card de execução com controles de série/carga/reps/descanso.
- Nutrição: registrar refeição, montar refeição, composição da refeição, estimativa por texto, catálogo local, salvar refeição, histórico diário.
- Coach: tela Coach Diario, ações rápidas (treino ok, registrar refeição, +300ml), envio de mensagem.
- Perfil: edição de metas/nível/frequência/peso/altura/limitação, lembrete creatina, salvar perfil.
- Semana IA / Histórico: modal de histórico semanal e tela IA da semana com consistency score e resumo.

### 1.2 Estados, modais e feedbacks vistos
- Modal/overlay de histórico dos últimos 7 dias.
- Modal de configuração Google ausente ("Google nao configurado").
- Tela de loading intermediária no Coach (spinner).
- Tela de erro do app em segundo plano no seletor de apps Android ("Algo deu errado. Reinicie o aplicativo para continuar.").

### 1.3 Interações confirmadas
- Treino: adicionar exercício, criar rotina, importar treino, navegar entre estados de treino.
- Nutrição: montar refeição, salvar refeição, estimar por texto.
- Coach: registrar água + interação textual.
- Perfil: alteração de dados e ação de salvar perfil.

## 2) GAPS ENCONTRADOS

### 2.1 Cobertura faltante ou superficial
- Social: não há evidência robusta de exploração profunda de feed, ranking, estados vazios/erro, nem ação significativa de postagem/interação.
- Fluxo fim-a-fim completo por aba não ficou comprovado em todos os vídeos (há cobertura ampla, mas com lacunas em pós-condição de algumas ações).
- Não há prova consistente de "finalizar treino" com validação de persistência real no backend para todos os cenários.

### 2.2 Gaps de robustez observados no comportamento real
- Existe instabilidade de ciclo de vida app/background (erro no app switcher), que o método atual pode não estar marcando como falha crítica.
- Há transições com loading que podem mascarar falso positivo se o teste só validar visibilidade inicial.

## 3) FALHAS DO SISTEMA ATUAL (metodo)

Falhas comprovadas em código/relatórios atuais:
- Gate por exit code: loop global considera sucesso sem validar cobertura funcional real.
- Safe mode permissivo em attached: ramo reduzido marca progresso sem interação profunda.
- Smokes com best effort: aceitam no-target/no-root-tab sem falhar.
- Checklist de cobertura existe, mas não é gate obrigatório de falha.

Referências:
- `scripts/qa-global-audit-loop.ps1` (gate por exit code): linhas 80 e 162.
- `e2e/14-full-visual-functional.e2e.js` (attached-safe/minimal skip): linhas 498, 502.
- `e2e/16-treino-tab-smoke.e2e.js` (attached-safe-no-target/no-root-tab): linhas 51-52 e 73-75.
- `e2e/17-social-tab-smoke.e2e.js` (attached-safe-no-target/no-root-tab): linhas 50-51 e 58-59.
- `qa/mobile-full-visual-functional.last.json` (missing contexts): linhas 33-34.

## 4) CORRECOES OBRIGATORIAS (metodo quase perfeito)

### 4.1 Hard fail de cobertura
- Regra: se `coverageChecklist.missingStep1Contexts` nao vazio => FAIL do ciclo.
- Regra: se `fulfilledStep1Contexts` menor que esperado => FAIL.

### 4.2 Proibir safe pass
- Remover sucesso silencioso em `attached-safe-no-root-tab` e `attached-safe-no-target`.
- Se aba alvo nao abrir em tempo maximo -> FAIL com screenshot + motivo estruturado.

### 4.3 Validacao por acao (por aba)
- Home: abrir + acao rapida (treinar/registrar refeicao/agua) + feedback.
- Treino: abrir + adicionar exercicio + iniciar + concluir/finalizar + retorno validado.
- Nutricao: abrir + montar refeicao + salvar + refletir no resumo do dia.
- Coach: abrir + enviar interacao + resposta renderizada.
- Social: abrir + explorar feed/ranking + pelo menos 1 interacao verificavel.
- Perfil: editar + salvar + reler dados para confirmar persistencia.

### 4.4 Scroll real
- Exigir evidência top/mid/end com mudança de conteúdo (hash/texto/elementos) por tela longa.

### 4.5 Delta esperado x visitado
- Gerar relatório por ciclo com:
  - telas esperadas
  - telas visitadas
  - telas visitadas sem ação
  - ações sem pós-condição

### 4.6 Tratar estados críticos de runtime
- Se aparecer tela de erro de app/background, marcar FAIL crítico no ciclo.

## 5) VALIDACAO FINAL (estado desta auditoria)

- Cobertura visual real: alta em Home/Treino/Nutrição/Coach/Perfil.
- Cobertura Social: insuficiente para declarar exploração profunda.
- Método atual: suscetível a falso positivo (pass sem cobertura completa comprovada).
- Prioridade imediata: trocar gate para cobertura obrigatória + remover safe pass.

## 6) O QUE ENVIAR NA PROXIMA REVISAO (fechar 100%)

- Vídeo único fim-a-fim contínuo (sem cortes) cobrindo todas as abas com ações profundas.
- Screenshot pack do ciclo com nomenclatura por aba/acao/resultado.
- `qa/mobile-full-visual-functional.last.json` da execução após correções.
- Logs completos do `qa-global` e de cada `detox:cycle` crítico.
- Mapa oficial de telas esperadas (abas + subfluxos + modais + erro/vazio).
