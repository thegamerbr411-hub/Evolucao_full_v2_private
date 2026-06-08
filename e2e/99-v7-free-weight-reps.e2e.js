/**
 * V7 QA — treino livre peso/reps por série (local only, não commitar).
 * Evidências: qa/live_mapping/v7_weight_reps_free_*
 */
const { execSync } = require('child_process');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const {
  ensureOnboarded,
  goToTreinos,
  launchApp,
  openFreeWorkout,
} = require('./helpers/flows');
const {
  hideKeyboardIfNeeded,
  isVisible,
  logStep,
  replaceInput,
  scrollToElement,
  sleep,
  slugify,
  tapElement,
} = require('./helpers/utils');

const DEVICE = process.env.DETOX_ADB_NAME || 'RQ8T209ZTAF';
const ROOT = path.resolve(__dirname, '..');

const EX1 = 'Exercicio V7 QA';
const EX2 = 'Exercicio V7 QA B';
const EX1_SLUG = slugify(EX1);
const EX2_SLUG = slugify(EX2);

function adbUiDump(localName) {
  const remote = '/sdcard/v7_free.xml';
  const local = path.join(ROOT, 'qa', 'live_mapping', `${localName}.xml`);
  try {
    execSync(`adb -s ${DEVICE} shell uiautomator dump ${remote}`, { stdio: 'pipe' });
    execSync(`adb -s ${DEVICE} pull ${remote} "${local}"`, { stdio: 'pipe' });
    logStep(`v7-adb-dump-ok:${localName}`);
    return local;
  } catch (error) {
    logStep(`v7-adb-dump-fail:${localName}=${String(error?.message || error)}`);
    return null;
  }
}

async function resetWorkoutState() {
  try {
    await device.openURL({ url: 'evolucao://qa/workout-reset' });
    await sleep(1200);
    logStep('v7-free:workout-reset-ok');
  } catch (error) {
    logStep(`v7-free:workout-reset-fail=${String(error?.message || error)}`);
  }
}

async function addFreeExercise(name) {
  await replaceInput('input-free-exercise-name', name);
  if (!(await isVisible('btn-free-add-exercise', 900))) {
    await scrollToElement('screen-free-workout', 'btn-free-add-exercise', 'down', 260, 8);
  }
  await tapElement('btn-free-add-exercise');
  await sleep(300);
}

async function saveFreeSet(slug, weight, reps) {
  const weightId = `input-free-weight-${slug}`;
  const repsId = `input-free-reps-${slug}`;
  const saveId = `btn-free-save-set-${slug}`;

  if (!(await isVisible(weightId, 1500))) {
    await scrollToElement('screen-free-workout', weightId, 'down', 280, 10);
  }
  await replaceInput(weightId, weight);
  await replaceInput(repsId, reps);
  await hideKeyboardIfNeeded();
  await tapElement(saveId);
  await sleep(400);
}

jest.setTimeout(420000);

describe('99 - V7 free weight reps', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(persona);
    await resetWorkoutState();
  });

  it('salva peso/reps distintos em 2 exercícios livres', async () => {
    logStep('v7-free:start');
    await goToTreinos();
    await openFreeWorkout();
    await device.takeScreenshot('v7_weight_reps_free_before_fill');

    await addFreeExercise(EX1);
    await addFreeExercise(EX2);

    if (device.getPlatform() === 'android') {
      try {
        await device.pressBack();
        await sleep(180);
      } catch {
        // teclado pode já estar fechado
      }
    }
    await hideKeyboardIfNeeded();

    await waitFor(element(by.id(`card-free-exercise-${EX1_SLUG}`))).toExist().withTimeout(12000);
    await waitFor(element(by.id(`card-free-exercise-${EX2_SLUG}`))).toExist().withTimeout(12000);

    await saveFreeSet(EX1_SLUG, '20', '10');
    await device.takeScreenshot('v7_weight_reps_free_ex1_saved');

    await saveFreeSet(EX2_SLUG, '30', '8');
    await device.takeScreenshot('v7_weight_reps_free_ex2_saved');
    adbUiDump('v7_weight_reps_free_after');

    await expect(element(by.id(`card-free-exercise-${EX1_SLUG}`))).toExist();
    await expect(element(by.id(`card-free-exercise-${EX2_SLUG}`))).toExist();
    logStep('v7-free:pass');
  });
});
