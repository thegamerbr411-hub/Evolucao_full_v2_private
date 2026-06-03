const fs = require('fs');
const path = require('path');
const {
  goHome,
  goToCoach,
  goToNutrition,
  goToProfile,
  goToSocial,
  goToTreinos,
} = require('./flows');
const {
  isVisible,
  sleep,
  waitForAny,
} = require('./utils');

const QA_DIR = path.resolve(__dirname, '..', '..', 'qa');

const TAB_AUDIT_MATRIX = [
  { key: 'home', tabId: 'tab-home', screenId: 'screen-home' },
  { key: 'treino', tabId: 'tab-treino', screenId: 'screen-treinos' },
  { key: 'nutricao', tabId: 'tab-nutricao', screenId: 'screen-nutricao' },
  { key: 'coach', tabId: 'tab-conversa', screenId: 'screen-coach' },
  { key: 'social', tabId: 'tab_mais', screenId: 'screen-social' },
  { key: 'perfil', tabId: 'tab_mais', screenId: 'screen_profile' },
];

function ensureQaDir() {
  if (!fs.existsSync(QA_DIR)) {
    fs.mkdirSync(QA_DIR, { recursive: true });
  }
}

async function shot(name) {
  await device.takeScreenshot(name);
}

async function shotAndTrack(report, name) {
  await shot(name);
  if (report && Array.isArray(report.screenshots)) {
    report.screenshots.push(name);
  }
}

async function captureScrollable(screenId, baseName, report) {
  await shotAndTrack(report, `${baseName}-top`);

  try {
    await element(by.id(screenId)).scroll(420, 'down');
    await sleep(200);
  } catch {
    return;
  }

  await shotAndTrack(report, `${baseName}-mid`);

  try {
    for (let index = 0; index < 4; index += 1) {
      await element(by.id(screenId)).scroll(500, 'down');
      await sleep(180);
    }
  } catch {
    // best effort
  }

  await shotAndTrack(report, `${baseName}-end`);
}

async function captureOverlayEvidence(report, phaseLabel, options = {}) {
  const { captureNoneFallback = false } = options;
  let captured = 0;

  const overlayIds = [
    'feedback-add-agua',
    'alimento-salvo-indicator',
    'nutrition-result-card',
    'rest-timer-floating',
    'serie-salva-indicator',
  ];

  for (const id of overlayIds) {
    if (await isVisible(id, 350)) {
      await shotAndTrack(report, `overlay-${phaseLabel}-${id}`);
      captured += 1;
    }
  }

  const dialogLabels = [
    'OK',
    'Ok',
    'Permitir',
    'Allow',
    'Nao permitir',
    'Não permitir',
    "Don't allow",
    'Fechar',
  ];

  for (const label of dialogLabels) {
    try {
      await waitFor(element(by.text(label))).toBeVisible().withTimeout(250);
      await shotAndTrack(report, `popup-${phaseLabel}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      captured += 1;
    } catch {
      // segue ate achar um dialogo visivel
    }
  }

  if (captured === 0 && captureNoneFallback) {
    await shotAndTrack(report, `overlay-${phaseLabel}-none-visible`);
  }

  return captured;
}

async function relaunchCheckpoint(persona, label, report, ensureOnboardedFn) {
  await device.launchApp({ newInstance: false });
  await device.disableSynchronization();
  await ensureOnboardedFn(persona);
  await goHome();
  await waitForAny(['screen-home', 'tab-home'], 15000);
  if (label) {
    await shotAndTrack(report, `checkpoint-${label}`);
  }
}

async function openTabForAudit(tab) {
  if (tab.key === 'home') {
    await goHome();
    return;
  }
  if (tab.key === 'treino') {
    await goToTreinos();
    return;
  }
  if (tab.key === 'nutricao') {
    await goToNutrition();
    return;
  }
  if (tab.key === 'coach') {
    await goToCoach();
    return;
  }
  if (tab.key === 'social') {
    await goToSocial();
    return;
  }
  if (tab.key === 'perfil') {
    await goToProfile();
    return;
  }

  throw new Error(`openTabForAudit: aba desconhecida ${tab.key}`);
}

async function captureAuditForCurrentTab(report, phase, tab) {
  console.log(`[e2e][audit] fase=${phase} aba=${tab.key}`);

  if (tab.screenId && await isVisible(tab.screenId, 1200)) {
    const screen = element(by.id(tab.screenId));
    await shotAndTrack(report, `audit-${phase}-${tab.key}-top`);
    try {
      await screen.scroll(320, 'down');
      await sleep(150);
    } catch {
      // sem scroll
    }
    await shotAndTrack(report, `audit-${phase}-${tab.key}-mid`);
    try {
      await screen.scroll(360, 'down');
      await sleep(150);
    } catch {
      // sem scroll
    }
    await shotAndTrack(report, `audit-${phase}-${tab.key}-end`);
    return;
  }

  await shotAndTrack(report, `audit-${phase}-${tab.key}-top`);
  try {
    await element(by.type('RCTScrollView')).atIndex(0).scroll(420, 'down');
    await sleep(180);
  } catch {
    // fallback best effort
  }
  await shotAndTrack(report, `audit-${phase}-${tab.key}-mid`);
  try {
    await element(by.type('RCTScrollView')).atIndex(0).scroll(520, 'down');
    await sleep(180);
  } catch {
    // fallback best effort
  }
  await shotAndTrack(report, `audit-${phase}-${tab.key}-end`);
}

async function captureAllMainTabsByPhase(report, phase) {
  console.log(`[e2e][audit] inicio fase=${phase}`);
  for (const tab of TAB_AUDIT_MATRIX) {
    try {
      await openTabForAudit(tab);
      await captureAuditForCurrentTab(report, phase, tab);
      await captureOverlayEvidence(report, `${phase}-${tab.key}`);
      if (report && Array.isArray(report.workflow)) {
        report.workflow.push(`audit-${phase}-${tab.key}:ok`);
      }
    } catch (error) {
      if (report && Array.isArray(report.workflow)) {
        report.workflow.push(`audit-${phase}-${tab.key}:skip:${String(error?.message || 'unknown')}`);
      }
      try {
        await goHome();
      } catch {
        // segue para proxima aba
      }
    }
  }
  console.log(`[e2e][audit] fim fase=${phase}`);
}

module.exports = {
  QA_DIR,
  TAB_AUDIT_MATRIX,
  captureAllMainTabsByPhase,
  captureOverlayEvidence,
  captureScrollable,
  ensureQaDir,
  relaunchCheckpoint,
  shotAndTrack,
};
