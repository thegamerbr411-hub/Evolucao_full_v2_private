const fs = require('fs');
const path = require('path');

const { captureEverything } = require('../capture/capture-everything');
const { analyzeCapturedScreenshots } = require('../analyze/analyze-captured-screenshots');
const { applyImprovementsBasedOnAnalysis } = require('../improve/apply-improvements');
const { generateNewBuild } = require('../build/generate-new-build');
const { installBuildViaAdb, relaunchAppOnDevice } = require('../install/install-build-via-adb');
const { runRealFunctionalTests, validateNoCrashOrBug } = require('../test/run-real-functional-tests');
const { deleteUsedRawScreenshots } = require('../cleanup/delete-used-raw-screenshots');
const { loadConfig, parseArgs, printHelp } = require('./config');
const { ensureDir, timestampId, writeJson } = require('./shared');

function cycleFolder(baseDir, cycle) {
  return path.join(baseDir, `cycle-${String(cycle).padStart(3, '0')}`);
}

async function runCycle(config, cycle, runId) {
  const cycleDir = cycleFolder(path.join(config.outputRoot, runId), cycle);
  ensureDir(cycleDir);
  ensureDir(path.join(cycleDir, 'capture'));
  ensureDir(path.join(cycleDir, 'analysis'));
  ensureDir(path.join(cycleDir, 'improve'));
  ensureDir(path.join(cycleDir, 'build'));
  ensureDir(path.join(cycleDir, 'test'));

  const report = {
    cycle,
    startedAt: new Date().toISOString(),
    status: 'running',
  };

  const capture = await captureEverything({ config, cycle, cycleDir });
  report.capture = capture;

  const analysis = await analyzeCapturedScreenshots({ config, cycle, cycleDir, capture });
  report.analysis = analysis;

  const improvements = await applyImprovementsBasedOnAnalysis({
    analysis,
    config,
    cycle,
    cycleDir,
  });
  report.improvements = improvements;

  if (improvements.failed && config.stopOnImproveFailure) {
    throw new Error('improve_stage_failed');
  }

  const build = await generateNewBuild({ config, cycle, cycleDir, improvements });
  report.build = build;

  const install = await installBuildViaAdb({
    build,
    config,
    cycle,
    cycleDir,
  });
  report.install = install;

  await relaunchAppOnDevice({ config, install, cycle, cycleDir });

  const tests = await runRealFunctionalTests({
    build,
    config,
    cycle,
    cycleDir,
    install,
  });
  report.tests = tests;

  report.validation = validateNoCrashOrBug({ tests, analysis, capture, config });
  if (!report.validation.ok) {
    throw new Error(`validation_failed:${report.validation.reason}`);
  }

  const cleanup = await deleteUsedRawScreenshots({
    capture,
    config,
    cycle,
    cycleDir,
  });
  report.cleanup = cleanup;

  report.finishedAt = new Date().toISOString();
  report.status = 'passed';
  writeJson(path.join(cycleDir, 'cycle-report.json'), report);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const config = loadConfig(process.argv.slice(2));
  ensureDir(config.outputRoot);

  const runId = `run-${timestampId()}`;
  const runDir = path.join(config.outputRoot, runId);
  ensureDir(runDir);

  const runSummary = {
    runId,
    startedAt: new Date().toISOString(),
    config,
    cycles: [],
    status: 'running',
  };

  writeJson(path.join(runDir, 'run-config.snapshot.json'), config);

  try {
    for (let cycle = 1; cycle <= config.cycles; cycle += 1) {
      console.log(`\n[qa-loop] ciclo ${cycle}/${config.cycles} iniciado`);
      const cycleReport = await runCycle(config, cycle, runId);
      runSummary.cycles.push({
        cycle,
        reportPath: path.join('cycle-' + String(cycle).padStart(3, '0'), 'cycle-report.json'),
        status: cycleReport.status,
      });
      writeJson(path.join(runDir, 'run-summary.partial.json'), runSummary);
    }

    runSummary.finishedAt = new Date().toISOString();
    runSummary.status = 'passed';
    writeJson(path.join(runDir, 'run-summary.json'), runSummary);

    const latestLink = path.join(config.outputRoot, 'last-run.json');
    writeJson(latestLink, {
      runId,
      status: runSummary.status,
      finishedAt: runSummary.finishedAt,
      summaryPath: path.join(runDir, 'run-summary.json'),
    });

    console.log(`[qa-loop] concluido com sucesso: ${runDir}`);
    process.exit(0);
  } catch (error) {
    runSummary.finishedAt = new Date().toISOString();
    runSummary.status = 'failed';
    runSummary.error = String(error?.message || error);
    writeJson(path.join(runDir, 'run-summary.json'), runSummary);

    console.error('[qa-loop] falhou:', runSummary.error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
