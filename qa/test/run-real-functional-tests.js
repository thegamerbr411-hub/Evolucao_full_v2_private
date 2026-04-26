const fs = require('fs');
const path = require('path');

const { ROOT, readJson, runCommand } = require('../core/shared');

async function runSingleFunctionalTest({ config, testFile, adbSerial }) {
  const env = {
    ...process.env,
    DETOX_CONFIGURATION: config.detoxConfiguration,
    DETOX_TEST_FILE: testFile,
    DETOX_ADB_NAME: adbSerial || process.env.DETOX_ADB_NAME,
  };

  const run = await runCommand(process.execPath, ['scripts/run-detox-cycle.js'], {
    cwd: ROOT,
    env,
    label: `functional:${testFile}`,
  });

  const cycleReport = readJson(path.join(ROOT, 'artifacts', 'detox-cycle-last.json'), {});
  return {
    testFile,
    exitCode: run.code,
    detoxCycle: cycleReport,
    finishedAt: new Date().toISOString(),
  };
}

async function runRealFunctionalTests({ config, cycle, cycleDir, install }) {
  const testDir = path.join(cycleDir, 'test');
  const testRuns = [];

  for (const testFile of config.functionalTests) {
    console.log(`[qa-loop] [ciclo ${cycle}] teste funcional ${testFile}`);
    const startedAt = new Date().toISOString();
    const run = await runSingleFunctionalTest({
      config,
      testFile,
      adbSerial: install?.adbSerial,
    });

    testRuns.push({
      ...run,
      startedAt,
    });

    if (run.exitCode !== 0) {
      break;
    }
  }

  const failed = testRuns.filter((item) => Number(item.exitCode || 0) !== 0);
  const result = {
    cycle,
    startedAt: testRuns[0]?.startedAt || null,
    finishedAt: new Date().toISOString(),
    total: testRuns.length,
    failed: failed.length,
    passed: testRuns.length - failed.length,
    runs: testRuns,
    ok: failed.length === 0,
  };

  fs.writeFileSync(path.join(testDir, 'functional-tests-report.json'), JSON.stringify(result, null, 2), 'utf-8');

  if (!result.ok) {
    const firstFailure = failed[0]?.testFile || 'unknown';
    throw new Error(`functional_tests_failed:${firstFailure}`);
  }

  return result;
}

function validateNoCrashOrBug({ tests, analysis, capture, config }) {
  if (!tests?.ok) {
    return { ok: false, reason: 'functional_tests_failed' };
  }

  if (Number(capture?.screenshotsCount || 0) <= 0) {
    return { ok: false, reason: 'capture_without_screenshots' };
  }

  const hasHighPriorityIssue = Array.isArray(analysis?.diagnosis?.priority)
    && analysis.diagnosis.priority.some((issue) => String(issue?.severity || '').toLowerCase() === 'high');
  if (hasHighPriorityIssue) {
    const isAttachedRun = String(config?.detoxConfiguration || '').includes('android.attached');
    if (isAttachedRun) {
      return { ok: true, reason: 'validated_attached_high_priority_waived' };
    }
    return { ok: false, reason: 'analysis_high_priority_pending' };
  }

  return { ok: true, reason: 'validated' };
}

module.exports = {
  runRealFunctionalTests,
  validateNoCrashOrBug,
};
