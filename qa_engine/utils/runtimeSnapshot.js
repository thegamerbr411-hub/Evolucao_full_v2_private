const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function createQaRunFolder(baseDir) {
  const runDir = path.join(baseDir, `run_${timestampId()}`);
  ensureDir(runDir);
  ensureDir(path.join(runDir, 'screenshots'));
  ensureDir(path.join(runDir, 'video'));
  ensureDir(path.join(runDir, 'logs'));
  return runDir;
}

function writeMarkdownReport(runDir, body) {
  const reportPath = path.join(runDir, 'report.md');
  fs.writeFileSync(reportPath, body, 'utf8');
  return reportPath;
}

module.exports = {
  ensureDir,
  createQaRunFolder,
  writeMarkdownReport,
};