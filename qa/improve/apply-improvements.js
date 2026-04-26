const fs = require('fs');
const path = require('path');

const { ROOT, execCapture, listFilesRecursive, runShell } = require('../core/shared');

function listPendingPatches() {
  const pendingDir = path.join(ROOT, 'qa', 'improve', 'pending');
  if (!fs.existsSync(pendingDir)) return [];
  return listFilesRecursive(pendingDir).filter((filePath) => /\.patch$/i.test(filePath));
}

function changedFilesCount() {
  const output = execCapture('git', ['status', '--porcelain'], { cwd: ROOT, fallback: '' });
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

async function applyPatchFile(patchFile) {
  const commandLine = `git apply --whitespace=nowarn "${patchFile}"`;
  return runShell(commandLine, { cwd: ROOT, label: `git-apply:${path.basename(patchFile)}` });
}

async function applyImprovementsBasedOnAnalysis({ analysis, config, cycle, cycleDir }) {
  const improveDir = path.join(cycleDir, 'improve');
  const result = {
    cycle,
    startedAt: new Date().toISOString(),
    changedFilesBefore: changedFilesCount(),
    patchApplications: [],
    commandExecutions: [],
    priorityInput: analysis?.diagnosis?.priority || [],
    failed: false,
  };

  const pendingPatches = listPendingPatches();
  for (const patchFile of pendingPatches) {
    const patchRun = await applyPatchFile(patchFile);
    result.patchApplications.push({
      patchFile,
      exitCode: patchRun.code,
    });

    if (patchRun.code !== 0) {
      result.failed = true;
    }
  }

  for (const commandLine of config.improveCommands) {
    const run = await runShell(commandLine, {
      cwd: ROOT,
      env: {
        ...process.env,
        QA_LOOP_CYCLE: String(cycle),
      },
      label: `improve-cmd:${commandLine}`,
    });

    result.commandExecutions.push({
      commandLine,
      exitCode: run.code,
    });

    if (run.code !== 0) {
      result.failed = true;
    }
  }

  result.changedFilesAfter = changedFilesCount();
  result.changedFilesDelta = result.changedFilesAfter - result.changedFilesBefore;
  result.finishedAt = new Date().toISOString();

  fs.writeFileSync(path.join(improveDir, 'improve-summary.json'), JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

module.exports = {
  applyImprovementsBasedOnAnalysis,
};
