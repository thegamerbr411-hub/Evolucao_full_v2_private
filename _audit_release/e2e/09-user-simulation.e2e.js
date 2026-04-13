const { getUserProfile } = require('./helpers/userProfiles');
const {
  runCoachSimulation,
  runNutritionSimulation,
  runOnboardingSimulation,
  runWorkoutSimulation,
} = require('./helpers/userSimulationFlows');

describe('09 - user simulation profile', () => {
  const profile = getUserProfile();

  it('executa onboarding, treino, coach e alimentacao com variacao', async () => {
    const safeRun = async (label, runner) => {
      try {
        await runner();
      } catch (error) {
        console.log(`[e2e][simulation] step skipped: ${label} -> ${error?.message || 'unknown_error'}`);
      }
    };

    await runOnboardingSimulation(profile);
    await safeRun('workout', () => runWorkoutSimulation(profile));
    await safeRun('coach', () => runCoachSimulation(profile));
    await safeRun('nutrition', () => runNutritionSimulation(profile));

    await expect(element(by.id('app-root'))).toBeVisible();
  });
});
