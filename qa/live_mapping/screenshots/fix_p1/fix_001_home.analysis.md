# fix_001_home — Analise visual (pos-hotfix Metro)

**Timestamp:** 2026-05-30T17:52:58  
**Device:** emulator-5554 | **Metro:** 8081 detached (cmd start /B)  
**Evidencia:** fix_001_home.png · fix_001_home.xml

## Descricao visual

| Elemento | Conteudo |
|---|---|
| Header | Boa noite |
| Streak | Sem sequencia ativa |
| XP | +20 XP hoje |
| CTA | **CONTINUAR TREINO** / Volte para o treino atual |
| Treino | Agachamento Livre — Em andamento (~10% barra) |
| Proteina | **0 / 160 g** |
| Agua | 0.0 / 3.5 L |
| Prioridade | WORKOUT |
| Acoes rapidas | + Registrar refeicao, Ver insights do dia |

## Botoes / acoes

| Acao | Status |
|---|---|
| CONTINUAR TREINO | OK |
| + Registrar refeicao | OK |
| Ver insights do dia | OK |
| Tabs Treino/Coach/Nutricao | OK |

## Coerencia cruzada

Home, Treino hub, Coach e Nutricao alinhados: treino em andamento, meta proteina 160g, CTA Continuar.

## Perguntas de analise

1. Proteina 160g? **PASS** (0/160g)
2. Streak/XP? **PASS** (Sem sequencia, +20 XP real)
3. Treino alinhado? **PASS** (CONTINUAR + Em andamento)
4. Texto legivel? **PASS**
5. Render Error? **PASS** (ausente)
6. Bundle novo? **PASS** (sem 150g/+120 XP)

## Referencias

PNG/XML em `screenshots/fix_p1/fix_001_home.*`
