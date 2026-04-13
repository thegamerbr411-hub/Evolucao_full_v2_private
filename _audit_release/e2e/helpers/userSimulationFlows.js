const { getUserProfile } = require('./userProfiles');
const {
  completeOnboarding,
  goToCoach,
  goToNutrition,
  goToTreinos,
  launchApp,
  runCoachHappyPath,
  runFreeWorkoutHappyPath,
  runGuidedWorkoutHappyPath,
  runNutritionHappyPath,
  saveGuidedWorkoutPartial,
} = require('./flows');
const { humanDelay, logStep, tapElement } = require('./utils');

function shouldAbandon(profile) {
  return profile.rng() < Number(profile?.behavior?.abandonRate || 0);
}

async function runOnboardingSimulation(profile = getUserProfile()) {
  logStep(`[simulation] onboarding start profile=${profile.type}`);
  await launchApp({ deleteApp: true });
  await completeOnboarding(profile);
  logStep('[simulation] onboarding done');
}

async function runWorkoutSimulation(profile = getUserProfile()) {
  logStep(`[simulation] workout start profile=${profile.type}`);
  await goToTreinos();

  if (shouldAbandon(profile)) {
    logStep('[simulation] workout abandoned intentionally');
    return { abandoned: true, flow: 'workout' };
  }

  await runGuidedWorkoutHappyPath(profile);
  await saveGuidedWorkoutPartial();
  await humanDelay(profile, 'workout-switch-mode');
  try {
    await runFreeWorkoutHappyPath(profile);
  } catch (error) {
    logStep(`[simulation] free workout skipped: ${error?.message || 'unknown_error'}`);
  }
  logStep('[simulation] workout done');
  return { abandoned: false, flow: 'workout' };
}

async function runCoachSimulation(profile = getUserProfile()) {
  logStep(`[simulation] coach start profile=${profile.type}`);
  await goToCoach();

  if (shouldAbandon(profile)) {
    logStep('[simulation] coach abandoned intentionally');
    return { abandoned: true, flow: 'coach' };
  }

  await runCoachHappyPath(profile);
  logStep('[simulation] coach done');
  return { abandoned: false, flow: 'coach' };
}

async function runNutritionSimulation(profile = getUserProfile()) {
  logStep(`[simulation] nutrition start profile=${profile.type}`);
  await goToNutrition();

  if (shouldAbandon(profile)) {
    logStep('[simulation] nutrition abandoned intentionally');
    return { abandoned: true, flow: 'nutrition' };
  }

  await runNutritionHappyPath(profile);
  logStep('[simulation] nutrition done');
  return { abandoned: false, flow: 'nutrition' };
}

async function runNavigationBurst(profile = getUserProfile()) {
  const rounds = Math.max(2, Number(profile?.behavior?.rapidSwitches || 4));
  logStep(`[simulation] navigation burst rounds=${rounds}`);

  for (let index = 0; index < rounds; index += 1) {
    await tapElement('tab-home');
    await tapElement('tab-treino');
    await tapElement('tab-conversa');
    await tapElement('tab-nutricao');
    await tapElement('tab-perfil');
    await humanDelay(profile, `navigation-burst-${index + 1}`);
  }

  logStep('[simulation] navigation burst done');
}

module.exports = {
  runCoachSimulation,
  runNavigationBurst,
  runNutritionSimulation,
  runOnboardingSimulation,
  runWorkoutSimulation,
};
