param([string]$Device = "RQ8T209ZTAF")

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$dir = "f:\projetos\evolucao app\screenshots"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$step = 0
$log  = @()

function SS([string]$label) {
    $script:step++
    $n = "{0:D2}" -f $script:step
    $file = "$dir\${n}_${label}.png"
    & $adb -s $Device shell screencap -p /sdcard/s.png 2>&1 | Out-Null
    & $adb -s $Device pull /sdcard/s.png $file 2>&1 | Out-Null
    $sz = (Get-Item $file -EA SilentlyContinue).Length
    $entry = "[$n] $label => ${sz}b"
    $script:log += $entry
    Write-Host $entry
    return $sz
}

function Tap([int]$x,[int]$y,[int]$ms=1500) { & $adb -s $Device shell input tap $x $y; Start-Sleep -Milliseconds $ms }
function Back([int]$ms=1200) { & $adb -s $Device shell input keyevent 4; Start-Sleep -Milliseconds $ms }
function Tab([int]$x,[int]$ms=2500) { & $adb -s $Device shell input tap $x 2137; Start-Sleep -Milliseconds $ms }
function Swipe([int]$x1,[int]$y1,[int]$x2,[int]$y2,[int]$ms=300) { & $adb -s $Device shell input swipe $x1 $y1 $x2 $y2 $ms; Start-Sleep -Milliseconds 800 }
function Key([int]$code,[int]$ms=600) { & $adb -s $Device shell input keyevent $code; Start-Sleep -Milliseconds $ms }

# Coords das tabs (bounds do UI dump: y=2137)
# Home=90 Treino=270 Nutricao=450 Coach=630 Social=810 Perfil=990
$TAB_HOME    = 90
$TAB_TREINO  = 270
$TAB_NUTRI   = 450
$TAB_COACH   = 630
$TAB_SOCIAL  = 810
$TAB_PERFIL  = 990

Write-Host "`n===== INICIANDO TOUR COMPLETO DO APP ====="

# ======= HOME =======
Write-Host "`n--- HOME ---"
Back; Back
Tab $TAB_HOME 3000
SS "home_01_inicial"

# Rola para cima para ver tudo
Swipe 540 1000 540 1600 400
SS "home_02_scroll_cima"

# Rola para baixo para ver acoes rapidas
Swipe 540 1200 540 600 400
SS "home_03_scroll_baixo"
Swipe 540 1200 540 600 400
SS "home_04_scroll_mais_baixo"

# Volta ao topo
Swipe 540 600 540 1600 400; Swipe 540 600 540 1600 400
Start-Sleep -Seconds 1

# Clica em "Treinar" (quick action - home-quick-treino bounds [48,1811][528,1941])
Write-Host "Clicando Treinar (atalho home)..."
Tap 288 1876 4000
SS "home_05_atalho_treinar"
Back 2000

# Clica em "Registrar refeicao" (home-quick-nutricao bounds [552,1811][1032,1941])
Write-Host "Clicando Registrar refeicao..."
Tap 792 1876 4000
SS "home_06_atalho_nutricao"
Back 2000

# Botao agua (+300ml) -- tab volta para home primeiro
Tab $TAB_HOME 2000
Write-Host "Clicando +300ml agua..."
Tap 792 1996 2000
SS "home_07_agua_adicionada"

# Coach atalho (home-quick-coach)
Tab $TAB_HOME 2000
Write-Host "Clicando Coach atalho..."
Tap 288 2096 4000
SS "home_08_atalho_coach"
Back 2000

# ======= TREINO =======
Write-Host "`n--- TREINO (WorkoutsHub) ---"
Tab $TAB_TREINO 3000
SS "treino_01_hub"

# Rola para ver todo o hub
Swipe 540 1200 540 600 400
SS "treino_02_hub_scroll"

# Botao Iniciar treino recomendado (btn-iniciar-treino bounds [48,1457][1032,1618])
Swipe 540 600 540 1600 400
Start-Sleep -Milliseconds 500
Write-Host "Clicando Iniciar treino recomendado..."
Tap 540 1537 5000
SS "treino_03_workout_screen_inicio"

# Se crash (< 60KB) - registra e volta
$sz = (Get-Item "$dir\$('{0:D2}' -f $step)_treino_03_workout_screen_inicio.png" -EA SilentlyContinue).Length
if ($sz -lt 60000) { Write-Host "*** POSSIVEL CRASH ($sz b) ***"; Back 2000 } else {

    # Dentro do WorkoutScreen - testa os elementos
    Write-Host "WorkoutScreen carregou. Explorando..."

    # Rola para ver exercicio completo
    Swipe 540 1400 540 800 400
    SS "treino_04_workout_exercicio"

    # Clica botao incrementar peso (+)
    Write-Host "Incrementando peso..."
    Tap 858 960 800  # botao + (estimado)
    Tap 858 960 800
    SS "treino_05_workout_peso_incrementado"

    # Clica botao decrementar peso (-)
    Tap 222 960 800
    SS "treino_06_workout_peso_decrementado"

    # Toca botao "Registrar Xkg" (concluir serie)
    Write-Host "Registrando serie..."
    Tap 540 1400 2500
    SS "treino_07_workout_serie_registrada"

    # Rola para ver progresso
    Swipe 540 1200 540 600 400
    SS "treino_08_workout_scroll_baixo"

    # Toca botao de descanso 60s
    Write-Host "Timer 60s..."
    Tap 540 1750 2000
    SS "treino_09_workout_timer_descanso"

    # Toca novamente para cancelar/mudar
    Tap 540 1750 1000
    SS "treino_10_workout_timer_ativo"

    # Rola de volta
    Swipe 540 800 540 1400 400
    SS "treino_11_workout_topo"

    # Botao menu/opcoes do treino (canto superior direito)
    Tap 1000 100 1500
    SS "treino_12_workout_menu"
    Back 1000

    # Botao finalizar/encerrar treino
    Write-Host "Procurando botao finalizar..."
    Swipe 540 1200 540 600 400
    Swipe 540 1200 540 600 400
    SS "treino_13_workout_scroll_fim"

    Back 2000
}

# Treino Livre
Tab $TAB_TREINO 2000
SS "treino_14_hub_apos_workout"
# Botao Treino Livre (btn-open-free-workout)
Write-Host "Clicando Treino Livre..."
# Rola para achar botao
Swipe 540 1200 540 600 400
SS "treino_15_hub_scroll"
Tap 540 1800 4000
SS "treino_16_treino_livre"
Back 2000

# ======= NUTRICAO =======
Write-Host "`n--- NUTRICAO ---"
Tab $TAB_NUTRI 3000
SS "nutri_01_scanner"

# Botao escanear (camera)
Write-Host "Testando scanner..."
Tap 540 1200 3000
SS "nutri_02_scanner_ativo"
Back 2000

Tab $TAB_NUTRI 2000
# Botao adicionar manual
Tap 900 200 3000
SS "nutri_03_adicionar_manual"
Back 1500

# Historico / log do dia
Tab $TAB_NUTRI 2000
Swipe 540 1200 540 600 400
SS "nutri_04_scroll"
Swipe 540 1200 540 600 400
SS "nutri_05_scroll_mais"

# ======= COACH =======
Write-Host "`n--- COACH ---"
Tab $TAB_COACH 3000
SS "coach_01_chat"

# Digita mensagem
Write-Host "Enviando mensagem..."
Tap 540 2050 1500
& $adb -s $Device shell input text "Qual%20meu%20proximo%20treino"
Start-Sleep -Milliseconds 800
SS "coach_02_digitando"
Key 66 500  # ENTER para enviar (se campo nao tem botao)
Tap 990 2050 4000  # botao enviar (canto direito do campo)
SS "coach_03_mensagem_enviada"
Start-Sleep -Seconds 3
SS "coach_04_resposta"

# Scroll no chat
Swipe 540 1200 540 600 400
SS "coach_05_scroll_chat"

# ======= SOCIAL =======
Write-Host "`n--- SOCIAL ---"
Tab $TAB_SOCIAL 3000
SS "social_01_feed"

Swipe 540 1200 540 600 400
SS "social_02_scroll"
Swipe 540 1200 540 600 400
SS "social_03_scroll_mais"

# Botao criar post / add (+ ou FAB)
Tap 960 1900 3000
SS "social_04_criar_post"
Back 1500

# Botao like no primeiro post
Tab $TAB_SOCIAL 2000
Tap 100 900 1500
SS "social_05_like"

# ======= PERFIL =======
Write-Host "`n--- PERFIL ---"
Tab $TAB_PERFIL 3000
SS "perfil_01_inicial"

Swipe 540 1200 540 600 400
SS "perfil_02_scroll"
Swipe 540 1200 540 600 400
SS "perfil_03_scroll_mais"

# Botao editar perfil
Write-Host "Editando perfil..."
Tap 540 400 3000
SS "perfil_04_editar"
Back 1500

# Botao configuracoes / preferencias
Tab $TAB_PERFIL 2000
Tap 1000 100 3000
SS "perfil_05_configuracoes"
Back 1500

# Botao historico de treinos
Tab $TAB_PERFIL 2000
Swipe 540 1200 540 700 400
Tap 540 1200 3000
SS "perfil_06_historico"
Back 1500

# ======= VOLTA PARA HOME - TESTE FINAL =======
Write-Host "`n--- VOLTA PARA HOME ---"
Tab $TAB_HOME 2500
SS "final_01_home"

# Treino de hoje card (se existir)
Write-Host "Procurando card Treino de hoje na home..."
Swipe 540 1600 540 1000 400
SS "final_02_home_scroll"

# ======= SUMARIO =======
Write-Host "`n===== TOUR CONCLUIDO ====="
Write-Host "Total de screenshots: $step"
$log | ForEach-Object { Write-Host $_ }

# Salva log
$log | Out-File "$dir\TOUR_LOG.txt" -Encoding UTF8
Write-Host "`nLog salvo em $dir\TOUR_LOG.txt"
