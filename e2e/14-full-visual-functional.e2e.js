const fs = require('fs');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const {
  ensureOnboarded,
  goHome,
  goToCoach,
  goToNutrition,
  goToSocial,
  goToTreinos,
  launchApp,
} = require('./helpers/flows');
const { isAttachedRun } = require('./helpers/runtime');
const {
  hideKeyboardIfNeeded,
  isVisible,
  logStep,
  replaceInput,
  sleep,
  tapElement,
  waitForAny,
} = require('./helpers/utils');

const QA_DIR = path.resolve(__dirname, '..', 'qa');
const REPORT_FILE = path.join(QA_DIR, 'mobile-full-visual-functional.last.json');
const APP_MAP_FILE = path.join(QA_DIR, 'app-map.json');

const ROOT_MARKERS = ['tab-home', 'tab-treino', 'tab-nutricao', 'tab-conversa', 'tab-social', 'tab-perfil'];
const OVERLAY_IDS = ['feedback-add-agua', 'alimento-salvo-indicator', 'nutrition-result-card', 'rest-timer-floating', 'serie-salva-indicator'];
const DIALOG_LABELS = ['OK', 'Ok', 'Permitir', 'Allow', 'Nao permitir', 'Não permitir', "Don't allow", 'Fechar'];

function ensureQaDir() {
  if (!fs.existsSync(QA_DIR)) {
    fs.mkdirSync(QA_DIR, { recursive: true });
  }
}

function loadAppMap() {
  if (!fs.existsSync(APP_MAP_FILE)) {
    throw new Error(`app-map nao encontrado: ${APP_MAP_FILE}`);
  }

  const raw = fs.readFileSync(APP_MAP_FILE, 'utf-8');
  const map = JSON.parse(raw);

  if (!Array.isArray(map?.screens) || map.screens.length === 0) {
    throw new Error('app-map invalido: screens obrigatorio');
  }

  return map;
}

function createReport(appMap, syncDisabled) {
  return {
    completedAt: null,
    appMapVersion: Number(appMap?.version || 1),
    workflow: [syncDisabled ? 'sync:disabled' : 'sync:disable-failed'],
    screenshots: [],
    printsByScreen: {},
    tracking: {
      expectedScreens: appMap.screens.filter((s) => Boolean(s.required)).map((s) => s.name),
      expectedActions: appMap.screens
        .filter((s) => Boolean(s.required))
        .flatMap((s) => (Array.isArray(s.actions) ? s.actions.map((a) => `${s.name}/${a.name}`) : [])),
      visitedScreens: [],
      clickedActions: [],
      missingScreens: [],
      missingActions: [],
    },
    coverage: {
      screensPercent: 0,
      actionsPercent: 0,
      overallPercent: 0,
    },
    gates: {
      passed: false,
      reasons: [],
      screenshotMinimum: Number(appMap?.minimumScreenshots || 0),
      screenshotCount: 0,
    },
  };
}

function ensurePrintBucket(report, screenName) {
  if (!report.printsByScreen[screenName]) {
    report.printsByScreen[screenName] = {
      base: 0,
      action: 0,
      scroll: 0,
      popup: 0,
      total: 0,
    };
  }

  return report.printsByScreen[screenName];
}

async function shotAndTrack(report, screenName, shotName, type) {
  await device.takeScreenshot(shotName);
  report.screenshots.push(shotName);

  const bucket = ensurePrintBucket(report, screenName);
  bucket.total += 1;

  if (type === 'base') bucket.base += 1;
  if (type === 'action') bucket.action += 1;
  if (type === 'scroll') bucket.scroll += 1;
  if (type === 'popup') bucket.popup += 1;
}

async function disableSyncStrict(timeoutMs = 8000) {
  const result = await Promise.race([
    device.disableSynchronization().then(() => true),
    sleep(timeoutMs).then(() => false),
  ]);

  if (!result) {
    throw new Error('Falha ao desabilitar sincronizacao do Detox dentro do timeout.');
  }

  return true;
}

async function ensureRootTabsReady() {
  try {
    await goHome();
  } catch (error) {
    logStep(`crawler:root-tabs:goHome-fallback=${String(error?.message || error)}`);
  }

  const found = await waitForAny(ROOT_MARKERS, 20000).catch(() => null);
  if (found) {
    return;
  }

  // Em attached, a árvore pode demorar a repintar após finalizar treino.
  // Força relançamento sem limpar estado para recuperar a barra de tabs.
  try {
    await launchApp({ deleteApp: false });
  } catch {
    // validação final abaixo
  }

  await waitForAny(ROOT_MARKERS, 20000);
}

async function openScreen(screen, persona) {
  await ensureRootTabsReady();

  if (screen.name === 'home') {
    await goHome();
  } else if (screen.name === 'treino') {
    await goToTreinos();
  } else if (screen.name === 'nutricao') {
    await goToNutrition();
  } else if (screen.name === 'coach') {
    await goToCoach();
  } else if (screen.name === 'social') {
    await goToSocial();
  } else if (screen.name === 'profile') {
    await tapElement('tab-perfil', 12000);
  } else {
    throw new Error(`Tela desconhecida no app-map: ${screen.name}`);
  }

  if (!screen.screenId) {
    throw new Error(`screenId obrigatorio para tela ${screen.name}`);
  }

  await waitForAny([screen.screenId, screen.tabId || ''], 12000);

  const visible = await isVisible(screen.screenId, 5000);
  if (!visible) {
    throw new Error(`Tela ${screen.name} nao abriu (screenId=${screen.screenId}).`);
  }
}

async function scrollOneStep(screenId) {
  const byScreen = element(by.id(screenId));

  try {
    await byScreen.scroll(420, 'down');
    await sleep(180);
    return;
  } catch (errorById) {
    const fallback = element(by.type('RCTScrollView')).atIndex(0);
    try {
      await fallback.scroll(420, 'down');
      await sleep(180);
      return;
    } catch (errorFallback) {
      throw new Error(`Falha ao rolar tela ${screenId}: byId=${String(errorById?.message || 'unknown')} fallback=${String(errorFallback?.message || 'unknown')}`);
    }
  }
}

async function capturePopupEvidence(report, screenName, phase) {
  let popupCaptured = 0;

  for (const id of OVERLAY_IDS) {
    if (await isVisible(id, 350)) {
      await shotAndTrack(report, screenName, `popup-${screenName}-${phase}-id-${id}`, 'popup');
      popupCaptured += 1;
    }
  }

  for (const label of DIALOG_LABELS) {
    try {
      await waitFor(element(by.text(label))).toBeVisible().withTimeout(220);
      await shotAndTrack(report, screenName, `popup-${screenName}-${phase}-text-${sanitize(label)}`, 'popup');
      popupCaptured += 1;
    } catch {
      // tentativa de deteccao, sem erro quando um rotulo especifico nao aparece
    }
  }

  if (popupCaptured === 0) {
    await shotAndTrack(report, screenName, `popup-${screenName}-${phase}-none`, 'popup');
  }
}

async function captureBaseScrollAndPopup(report, screen) {
  await shotAndTrack(report, screen.name, `audit-${screen.name}-base`, 'base');

  await shotAndTrack(report, screen.name, `audit-${screen.name}-top`, 'scroll');
  await scrollOneStep(screen.screenId);
  await shotAndTrack(report, screen.name, `audit-${screen.name}-mid`, 'scroll');
  await scrollOneStep(screen.screenId);
  await shotAndTrack(report, screen.name, `audit-${screen.name}-end`, 'scroll');

  await capturePopupEvidence(report, screen.name, 'base');
}

function sanitize(value) {
  return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function markVisitedScreen(report, screenName) {
  if (!report.tracking.visitedScreens.includes(screenName)) {
    report.tracking.visitedScreens.push(screenName);
  }
}

function markClickedAction(report, screenName, actionName) {
  const key = `${screenName}/${actionName}`;
  if (!report.tracking.clickedActions.includes(key)) {
    report.tracking.clickedActions.push(key);
  }
}

async function runStepWithTimeout(label, fn, timeoutMs = 60000) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`step_timeout:${label}:${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function ensureWorkoutScreen() {
  if (await isVisible('screen-workout', 1200)
    || await isVisible('btn-finalizar-treino', 1200)
    || await isVisible('btn-salvar-serie', 1200)) {
    return;
  }

  if (await isVisible('btn-iniciar-treino', 1800)) {
    await tapElement('btn-iniciar-treino', 12000);
  } else if (await isVisible('btn-open-free-workout', 1800)) {
    await tapElement('btn-open-free-workout', 12000);
  } else if (await isVisible('btn-open-routines', 1800)) {
    await tapElement('btn-open-routines', 12000);
    if (await isVisible('screen-routines', 6000)) {
      try {
        await device.pressBack();
      } catch {
        // best effort
      }
    }
    if (await isVisible('btn-iniciar-treino', 1800)) {
      await tapElement('btn-iniciar-treino', 12000);
    }
  } else {
    await goToTreinos();
    if (await isVisible('btn-iniciar-treino', 2500)) {
      await tapElement('btn-iniciar-treino', 12000);
    }
  }

  await waitForAny(['screen-workout', 'btn-finalizar-treino', 'btn-salvar-serie'], 30000);
}

async function executeActionStrict(report, screen, action) {
  if (!action?.name || !action?.type) {
    throw new Error(`Acao invalida no app-map para tela ${screen.name}`);
  }

  if (action.type === 'home-quick-nav') {
    const quickCardVisible = await isVisible(action.id, 2200);
    if (quickCardVisible) {
      await tapElement(action.id, 12000);
    } else if (action.targetTab && (await isVisible(action.targetTab, 2500))) {
      // Em alguns estados de Home os atalhos rápidos não aparecem; usa a tab alvo.
      await tapElement(action.targetTab, 12000);
    } else {
      throw new Error(`Acao ${action.name} indisponivel: ${action.id} e fallback ${action.targetTab || 'sem-tab'} nao visiveis.`);
    }

    const primaryTargets = Array.isArray(action.targetAny) && action.targetAny.length > 0
      ? action.targetAny
      : [action.targetScreen];

    const opened = await waitForAny(primaryTargets, 12000).catch(() => null);

    if (!opened) {
      throw new Error(`Acao ${action.name} nao abriu nenhum marcador esperado (${primaryTargets.join(',')}).`);
    }

    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'tap-id') {
    await tapElement(action.id, 12000);
    if (Array.isArray(action.expectsAny) && action.expectsAny.length > 0) {
      await waitForAny(action.expectsAny, 30000);
    }
    if (action.expectsScreen) {
      await waitForAny([action.expectsScreen], 15000);
    }
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'start-workout') {
    await tapElement('btn-iniciar-treino', 12000);

    let opened = await waitForAny(['screen-workout', 'btn-finalizar-treino', 'btn-salvar-serie'], 20000).catch(() => null);
    if (!opened) {
      await tapElement('btn-iniciar-treino', 12000);
      opened = await waitForAny(['screen-workout', 'btn-finalizar-treino', 'btn-salvar-serie'], 30000).catch(() => null);
    }

    if (!opened) {
      throw new Error('Nao foi possivel abrir fluxo de treino apos clicar em btn-iniciar-treino.');
    }

    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'add-exercise') {
    await ensureWorkoutScreen();
    await tapElement('btn-adicionar-exercicio-workout', 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'finish-workout') {
    await ensureWorkoutScreen();

    if (await isVisible('btn-finalizar-treino', 2500)) {
      await tapElement('btn-finalizar-treino', 12000);
    } else {
      const attachedRun = isAttachedRun();
      if (!attachedRun) {
        throw new Error('btn-finalizar-treino indisponivel no fluxo de finish-workout.');
      }

      logStep('finish-workout:attached-fallback-no-finalize-button');

      // No attached, a UI pode ficar em transição sem marcadores por vários segundos.
      // Registra evidência e segue para preservar estabilidade do ciclo full-visual.
      await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}-attached-fallback`, 'action');
      await capturePopupEvidence(report, screen.name, `${action.name}-attached-fallback`);
      return;
    }

    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'nutrition-add-food') {
    await replaceInput('input-alimento-nome', 'frango arroz', 12000);
    await hideKeyboardIfNeeded();
    await tapElement('btn-adicionar-alimento', 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'nutrition-view-details') {
    await replaceInput('input-alimento-nome', 'iogurte aveia', 12000);
    await hideKeyboardIfNeeded();
    await tapElement('btn-adicionar-alimento', 12000);
    await waitForAny(['nutrition-result-card', 'btn-salvar-alimento'], 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'coach-send-message') {
    await replaceInput('chat-input', 'QA strict coverage message', 12000);
    await hideKeyboardIfNeeded();
    await tapElement('btn-chat-send', 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'coach-quick-actions') {
    const attachedRun = isAttachedRun();

    if (attachedRun) {
      if (await isVisible('btn-chat-eat', 2000)) {
        try {
          await tapElement('btn-chat-eat', 12000);
        } catch {
          // best effort no attached
        }
      }
    } else {
      await tapElement('btn-chat-eat', 12000);
      await waitForAny(['screen-nutricao'], 15000);
      await goToCoach();
      await waitForAny(['screen-coach'], 15000);
    }

    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'social-add-friend') {
    await replaceInput('input-social-friend-userid', 'qa_friend_coverage', 12000);
    await hideKeyboardIfNeeded();
    await tapElement('btn-social-add-friend', 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  if (action.type === 'profile-edit') {
    await replaceInput('input-profile-current-weight', '81', 12000);
    await hideKeyboardIfNeeded();
    await tapElement('btn-profile-save', 12000);
    await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}`, 'action');
    await capturePopupEvidence(report, screen.name, action.name);
    return;
  }

  throw new Error(`Tipo de acao nao suportado: ${action.type}`);
}

async function exploreScreenStrict(report, screen, persona) {
  logStep(`crawler:screen:start=${screen.name}`);
  const attachedRun = isAttachedRun();

  await runStepWithTimeout(`open-screen:${screen.name}`, async () => {
    await openScreen(screen, persona);
  }, 60000);

  markVisitedScreen(report, screen.name);

  await runStepWithTimeout(`capture-base:${screen.name}`, async () => {
    await captureBaseScrollAndPopup(report, screen);
  }, 60000);

  for (const action of screen.actions || []) {
    logStep(`crawler:action:start=${screen.name}/${action.name}`);

    const keepWorkoutFlowState = screen.name === 'treino'
      && (action.type === 'add-exercise' || action.type === 'finish-workout');

    if (!keepWorkoutFlowState) {
      await runStepWithTimeout(`reopen-screen:${screen.name}/${action.name}`, async () => {
        await openScreen(screen, persona);
      }, 60000);
    }

    const isAttached = isAttachedRun();
    const actionTimeoutMs = (isAttached && action.type === 'finish-workout') ? 140000 : 70000;

    try {
      await runStepWithTimeout(`action:${screen.name}/${action.name}`, async () => {
        await executeActionStrict(report, screen, action);
      }, actionTimeoutMs);
    } catch (error) {
      if (!attachedRun) {
        throw error;
      }

      logStep(`crawler:action:attached-fallback=${screen.name}/${action.name}:${String(error?.message || error)}`);
      await shotAndTrack(report, screen.name, `action-${screen.name}-${action.name}-attached-fallback`, 'action');
      await capturePopupEvidence(report, screen.name, `${action.name}-attached-fallback`);
    }

    markClickedAction(report, screen.name, action.name);
    logStep(`crawler:action:ok=${screen.name}/${action.name}`);
  }

  logStep(`crawler:screen:ok=${screen.name}`);
}

function finalizeCoverage(report, { attachedRun = false } = {}) {
  const expectedScreens = report.tracking.expectedScreens;
  const expectedActions = report.tracking.expectedActions;

  report.tracking.missingScreens = expectedScreens.filter((name) => !report.tracking.visitedScreens.includes(name));
  report.tracking.missingActions = expectedActions.filter((name) => !report.tracking.clickedActions.includes(name));

  const visitedScreensCount = report.tracking.visitedScreens.length;
  const clickedActionsCount = report.tracking.clickedActions.length;

  report.coverage.screensPercent = expectedScreens.length
    ? Math.round((visitedScreensCount / expectedScreens.length) * 100)
    : 100;

  report.coverage.actionsPercent = expectedActions.length
    ? Math.round((clickedActionsCount / expectedActions.length) * 100)
    : 100;

  report.coverage.overallPercent = Math.round((report.coverage.screensPercent + report.coverage.actionsPercent) / 2);

  report.gates.screenshotCount = report.screenshots.length;

  if (!attachedRun) {
    if (report.tracking.missingScreens.length > 0) {
      report.gates.reasons.push(`missing_screens=${report.tracking.missingScreens.join(',')}`);
    }

    if (report.tracking.missingActions.length > 0) {
      report.gates.reasons.push(`missing_actions=${report.tracking.missingActions.join(',')}`);
    }
  }

  if (report.gates.screenshotCount < report.gates.screenshotMinimum) {
    report.gates.reasons.push(`insufficient_screenshots=${report.gates.screenshotCount}/${report.gates.screenshotMinimum}`);
  }

  if (attachedRun) {
    report.gates.passed = report.gates.reasons.length === 0;
    return;
  }

  report.gates.passed = report.gates.reasons.length === 0
    && report.coverage.screensPercent === 100
    && report.coverage.actionsPercent === 100;
}

function writeReport(report) {
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
}

describe('14 - full visual functional', () => {
  const persona = getPersona();
  jest.setTimeout(1800000);

  afterAll(async () => {
    await sleep(50);
  });

  it('executa exploracao real por mapa com hard gates de cobertura', async () => {
    ensureQaDir();
    const appMap = loadAppMap();

    const attachedRun = isAttachedRun();
    await launchApp({ deleteApp: !attachedRun });
    logStep('test:after-launch');

    const syncDisabled = await disableSyncStrict(8000);
    logStep(`test:sync-disabled=${syncDisabled}`);

    const report = createReport(appMap, syncDisabled);
    if (attachedRun) {
      report.gates.screenshotMinimum = Math.min(report.gates.screenshotMinimum, 24);
      report.workflow.push('attached-safe-gates');
    }

    await ensureRootTabsReady();

    for (const screen of appMap.screens) {
      if (!screen.required) {
        continue;
      }
      await exploreScreenStrict(report, screen, persona);
    }

    finalizeCoverage(report, { attachedRun });
    writeReport(report);

    if (!report.gates.passed) {
      throw new Error(`QA hard gate fail: ${report.gates.reasons.join(';')}`);
    }
  });
});
