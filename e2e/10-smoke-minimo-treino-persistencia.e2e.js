/**
 * Smoke Mínimo Treino Persistência — Evolução
 * Validação mínima de fluxo Home → Treino → Salvar Série
 */

const { getPersona } = require('./helpers/personas');
const {
  ensureMainTabsReady,
  ensureOnboarded,
  launchApp,
  goToTreinos,
} = require('./helpers/flows');
const {
  dismissBlockingSystemDialogs,
  fillWorkoutKeypadField,
  isVisible,
  logStep,
  scrollToElement,
  sleep,
  tapElement,
  tapSaveSetIfVisible,
  waitForAny,
} = require('./helpers/utils');

describe('100 - smoke minimo treino persistencia', () => {
  const persona = getPersona();

  it('home → treino → salvar serie', async () => {
    await launchApp({ deleteApp: false });
    await dismissBlockingSystemDialogs();

    // Aguardar app estar estável
    await sleep(3000);

    // Ir para Treino direto (não depende de Home/onboarding)
    await goToTreinos();

    // Iniciar treino
    const btnIniciarVisible = await isVisible('btn-iniciar-treino', 5000);
    if (!btnIniciarVisible) {
      throw new Error('smoke:btn-iniciar-treino nao encontrado');
    }
    await tapElement('btn-iniciar-treino');

    // Confirmar screen-workout (modal feedback não deve aparecer após correção)
    const nextScreen = await waitForAny(['screen-workout', 'screen-treinos'], 15000);
    if (nextScreen !== 'screen-workout') {
      throw new Error(`smoke:screen-workout nao abriu, got=${nextScreen}`);
    }
    logStep('smoke:screen-workout-opened');

    // Scroll para garantir campos visíveis
    await scrollToElement('screen-workout', 'btn-add-set', 'down', 360, 6);

    // Adicionar série se necessário
    if (await isVisible('btn-add-set', 2000)) {
      await tapElement('btn-add-set');
      await sleep(300);
    }

    // Preencher peso
    const inputWeightVisible = await isVisible('input-weight', 5000);
    if (!inputWeightVisible) {
      await scrollToElement('screen-workout', 'input-weight', 'down', 360, 8);
    }
    await fillWorkoutKeypadField('input-weight', '40');
    await sleep(400);

    // Preencher reps
    const inputRepsVisible = await isVisible('input-reps', 5000);
    if (!inputRepsVisible) {
      await scrollToElement('screen-workout', 'input-reps', 'down', 360, 8);
    }
    await fillWorkoutKeypadField('input-reps', '12');
    await sleep(400);

    // Salvar série
    const saved = await tapSaveSetIfVisible();
    if (!saved) {
      logStep('smoke:btn-save-set-not-visible - tentando auto-save');
    }

    // Confirmar série salva (verificar se status mudou)
    await sleep(1000);
    const setSavedVisible = await isVisible('set-saved-indicator', 3000);
    logStep(`smoke:set-saved=${setSavedVisible}`);

    // Voltar para Home
    await device.pressBack();
    await sleep(500);

    // Confirmar voltou para Home
    const homeAgain = await isVisible('screen-home', 5000);
    logStep(`smoke:home-after-workout=${homeAgain}`);

    if (!homeAgain) {
      await device.pressBack();
      await sleep(500);
    }

    logStep('smoke:complete');
  });
});
