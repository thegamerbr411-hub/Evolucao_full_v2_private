const fs = require('fs');
const path = require('path');

const { ROOT, listFilesRecursive, writeJson } = require('../core/shared');

function isRawImage(filePath) {
  return /\.(png|jpg|jpeg|webp)$/i.test(filePath);
}

function safeDelete(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

async function deleteUsedRawScreenshots({ capture, config, cycle, cycleDir }) {
  const cleanupSummary = {
    cycle,
    startedAt: new Date().toISOString(),
    cleanupRawImages: Boolean(config.cleanupRawImages),
    cleanupDetoxRoot: Boolean(config.cleanupDetoxRoot),
    deletedFiles: 0,
    failedDeletes: 0,
    targets: [],
  };

  if (!config.cleanupRawImages) {
    cleanupSummary.finishedAt = new Date().toISOString();
    writeJson(path.join(cycleDir, 'cleanup', 'cleanup-report.json'), cleanupSummary);
    return cleanupSummary;
  }

  const targets = [];
  if (capture?.mirroredDetoxDir) {
    targets.push(capture.mirroredDetoxDir);
  }

  if (config.cleanupDetoxRoot) {
    targets.push(path.join(ROOT, 'artifacts', 'detox'));
  }

  cleanupSummary.targets = targets;

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const rawImages = listFilesRecursive(target).filter(isRawImage);

    for (const filePath of rawImages) {
      const ok = safeDelete(filePath);
      if (ok) cleanupSummary.deletedFiles += 1;
      else cleanupSummary.failedDeletes += 1;
    }
  }

  cleanupSummary.finishedAt = new Date().toISOString();
  writeJson(path.join(cycleDir, 'cleanup', 'cleanup-report.json'), cleanupSummary);
  return cleanupSummary;
}

module.exports = {
  deleteUsedRawScreenshots,
};
