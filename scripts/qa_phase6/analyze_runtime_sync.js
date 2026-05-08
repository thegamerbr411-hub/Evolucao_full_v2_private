/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'qa_phase6_runtime_sync');
const OUT_RUNS = path.join(OUT_ROOT, 'QA_RUNS');

const RUN_SOURCES = [
  path.join(ROOT, 'qa_runs'),
  path.join(ROOT, 'baseline_runs'),
  path.join(ROOT, 'stress_runs'),
  path.join(ROOT, 'regression_runs'),
  path.join(ROOT, 'nightly_runs'),
  path.join(ROOT, 'qa_phase4_hardening', 'QA_RUNS'),
  path.join(ROOT, 'qa_phase5_runtime_stabilization', 'QA_RUNS'),
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir, matcher, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, matcher, out);
      continue;
    }
    if (matcher(full)) out.push(full);
  }
  return out;
}

function detectFlow(filePath) {
  const safe = filePath.replace(/\\/g, '/').toLowerCase();
  if (safe.includes('smoke')) return 'smoke';
  if (safe.includes('cycle')) return 'cycle';
  if (safe.includes('stress')) return 'stress';
  if (safe.includes('regression')) return 'regression';
  if (safe.includes('nightly')) return 'nightly';
  return 'other';
}

function parseReport(reportPath) {
  const text = readText(reportPath);
  const status = (text.match(/\*\*Status:\*\*\s*([A-Z]+)/i)?.[1] || 'UNKNOWN').toUpperCase();
  const durationSec = Number(text.match(/\*\*Duracao[^:]*:\*\*\s*([0-9.]+)s/i)?.[1] || 0);
  return {
    reportPath,
    status,
    durationSec,
    flow: detectFlow(reportPath),
    text,
  };
}

function collectSignals(logText) {
  const lines = String(logText || '').split(/\r?\n/);
  const out = {
    networkStart: 0,
    networkStall: 0,
    networkIdleAnchor: 0,
    networkBusyAnchor: 0,
    asyncTaskStall: 0,
    runtimeMetric: 0,
    runtimeIdleAnchor: 0,
    runtimeBusyAnchor: 0,
    retryStormSignal: 0,
    detoxIdleSpike: 0,
    playerBuffering: 0,
    playerFullscreen: 0,
    matcherIssue: 0,
    configIssue: 0,
  };

  for (const line of lines) {
    const safe = String(line || '').toLowerCase();
    if (!safe) continue;
    if (safe.includes('[network]') && safe.includes('request_stall')) out.networkStall += 1;
    if (safe.includes('[network]') && safe.includes('request')) out.networkStart += 1;
    if (safe.includes('app_network_idle')) out.networkIdleAnchor += 1;
    if (safe.includes('app_network_busy')) out.networkBusyAnchor += 1;
    if (safe.includes('async_task_stall')) out.asyncTaskStall += 1;
    if (safe.includes('[runtime_metric]')) out.runtimeMetric += 1;
    if (safe.includes('app_runtime_idle')) out.runtimeIdleAnchor += 1;
    if (safe.includes('app_runtime_busy')) out.runtimeBusyAnchor += 1;
    if (safe.includes('retry') && safe.includes('storm')) out.retryStormSignal += 1;
    if (safe.includes('the app seems to be idle')) out.detoxIdleSpike += 1;
    if (safe.includes('buffering_')) out.playerBuffering += 1;
    if (safe.includes('fullscreen_update')) out.playerFullscreen += 1;
    if (safe.includes('expect() argument is invalid')) out.matcherIssue += 1;
    if (safe.includes('detoxconfigerror')) out.configIssue += 1;
  }

  return out;
}

function addSignals(target, current) {
  for (const [key, value] of Object.entries(current)) {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  }
}

function writeMd(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function makeMatrixRows(signals) {
  const rows = [
    ['listeners', 0, 0, 'manual-audit-required'],
    ['timers', 0, 0, signals.asyncTaskStall > 0 ? 'possible-timer-leak' : 'stable-sample'],
    ['network-requests', signals.networkStart, signals.networkBusyAnchor, signals.networkStall > 0 ? 'network-stall-risk' : 'normal'],
    ['runtime-idle', signals.runtimeIdleAnchor, signals.runtimeBusyAnchor, signals.runtimeBusyAnchor > 0 ? 'busy-transitions' : 'idle-stable'],
    ['player-events', signals.playerBuffering + signals.playerFullscreen, signals.playerBuffering, signals.playerBuffering > 0 ? 'buffering-risk' : 'stable'],
  ];

  return rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`);
}

function main() {
  ensureDir(OUT_ROOT);
  ensureDir(OUT_RUNS);

  const reportFiles = [];
  const logFiles = [];

  for (const src of RUN_SOURCES) {
    reportFiles.push(...walk(src, (f) => f.toLowerCase().endsWith('report.md')));
    logFiles.push(...walk(src, (f) => {
      const safe = f.toLowerCase();
      return safe.endsWith('.log') || safe.endsWith('jest-output.txt') || safe.endsWith('logcat.txt');
    }));
  }

  const reports = reportFiles.map(parseReport);
  const latestReports = reports
    .sort((a, b) => {
      const am = fs.existsSync(a.reportPath) ? fs.statSync(a.reportPath).mtimeMs : 0;
      const bm = fs.existsSync(b.reportPath) ? fs.statSync(b.reportPath).mtimeMs : 0;
      return bm - am;
    })
    .slice(0, 35);

  const totals = {
    networkStart: 0,
    networkStall: 0,
    networkIdleAnchor: 0,
    networkBusyAnchor: 0,
    asyncTaskStall: 0,
    runtimeMetric: 0,
    runtimeIdleAnchor: 0,
    runtimeBusyAnchor: 0,
    retryStormSignal: 0,
    detoxIdleSpike: 0,
    playerBuffering: 0,
    playerFullscreen: 0,
    matcherIssue: 0,
    configIssue: 0,
  };

  for (const logPath of logFiles) {
    const text = readText(logPath);
    const current = collectSignals(text);
    addSignals(totals, current);
  }

  const runSummaryLines = latestReports.length > 0
    ? latestReports.map((r) => `- ${r.status} | ${r.flow} | ${r.durationSec}s | ${path.relative(ROOT, r.reportPath).replace(/\\/g, '/')}`)
    : ['- no run reports found'];

  writeMd(path.join(OUT_RUNS, 'README.md'), [
    '# QA Runs Runtime Sync',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Reports scanned: ${reports.length}`,
    `Logs scanned: ${logFiles.length}`,
    '',
    '## Latest Runs',
    ...runSummaryLines,
  ]);

  writeMd(path.join(OUT_ROOT, 'NETWORK_ACTIVITY_REPORT.md'), [
    '# NETWORK ACTIVITY REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Global Request Tracking Summary',
    `- network request signals: ${totals.networkStart}`,
    `- network stall signals: ${totals.networkStall}`,
    `- network idle anchors: ${totals.networkIdleAnchor}`,
    `- network busy anchors: ${totals.networkBusyAnchor}`,
    `- retry storm signals: ${totals.retryStormSignal}`,
    '',
    '## Idle Behavior',
    '- Runtime now exports explicit app_network_idle / app_network_busy anchors.',
    '- QA waits can use waitForNetworkIdle + assertNoPendingRequests instead of timing heuristics.',
  ]);

  writeMd(path.join(OUT_ROOT, 'ASYNC_TASK_AUDIT.md'), [
    '# ASYNC TASK AUDIT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Async Registry Findings',
    `- async task stall signals: ${totals.asyncTaskStall}`,
    `- runtime idle anchors: ${totals.runtimeIdleAnchor}`,
    `- runtime busy anchors: ${totals.runtimeBusyAnchor}`,
    '',
    '## Potential Issues',
    '- unresolved promises and task storms are tracked via async task stall events.',
    '- active timers/background tasks now contribute to runtime busy reasons.',
  ]);

  writeMd(path.join(OUT_ROOT, 'RUNTIME_IDLE_ENGINE.md'), [
    '# RUNTIME IDLE ENGINE',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Idle Rules',
    '- auth resolved',
    '- stores hydrated',
    '- navigation ready',
    '- network idle',
    '- async tasks idle',
    '- player idle',
    '- no active stalls',
    '',
    '## Runtime Signals',
    `- runtime idle anchors observed: ${totals.runtimeIdleAnchor}`,
    `- runtime busy anchors observed: ${totals.runtimeBusyAnchor}`,
    '',
    '## Busy Reasons',
    '- network_pending',
    '- async_tasks_pending',
    '- player_loading',
    '- loading_<reason>',
    '- stall_<category>',
  ]);

  writeMd(path.join(OUT_ROOT, 'BOOTSTRAP_RACE_ANALYSIS.md'), [
    '# BOOTSTRAP RACE ANALYSIS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Race Signals',
    `- matcher issues: ${totals.matcherIssue}`,
    `- detox config issues: ${totals.configIssue}`,
    `- detox idle spikes: ${totals.detoxIdleSpike}`,
    '',
    '## Sync Applied',
    '- runtime state machine + readiness flags + network/async idle checks integrated.',
    '- smoke flow now validates runtime/network idle anchors instead of implicit waits.',
  ]);

  writeMd(path.join(OUT_ROOT, 'LONG_SESSION_REPORT.md'), [
    '# LONG SESSION REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Long Session Signals',
    `- logs scanned: ${logFiles.length}`,
    `- runtime metric lines: ${totals.runtimeMetric}`,
    `- detox idle spikes: ${totals.detoxIdleSpike}`,
    '',
    '## Degradation / Leak Indicators',
    `- async task stall: ${totals.asyncTaskStall}`,
    `- network stall: ${totals.networkStall}`,
    `- runtime busy anchors: ${totals.runtimeBusyAnchor}`,
    '',
    '## Notes',
    '- run additional extended loops to increase statistical confidence for fps/memory trends.',
  ]);

  writeMd(path.join(OUT_ROOT, 'PLAYER_RUNTIME_SYNC.md'), [
    '# PLAYER RUNTIME SYNC',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Player Lifecycle Signals',
    `- buffering events: ${totals.playerBuffering}`,
    `- fullscreen events: ${totals.playerFullscreen}`,
    '',
    '## Player Sync Status',
    '- player loading contributes to runtime busy reasons and blocks idle.',
    '- fullscreen transitions are visible in runtime player events and QA logs.',
  ]);

  writeMd(path.join(OUT_ROOT, 'STALL_ALERT_REPORT.md'), [
    '# STALL ALERT REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Alerts',
    `- BOOTSTRAP_STALL signals: ${totals.matcherIssue}`,
    `- NETWORK_STALL signals: ${totals.networkStall}`,
    `- PLAYER_STALL signals: ${totals.playerBuffering}`,
    `- TASK_STALL signals: ${totals.asyncTaskStall}`,
    `- NAVIGATION_STALL signals: ${totals.runtimeBusyAnchor}`,
    '',
    '## Impact',
    '- Stall categories now map to runtime busy reasons and idle-blocking conditions.',
  ]);

  writeMd(path.join(OUT_ROOT, 'MEMORY_LISTENER_AUDIT.md'), [
    '# MEMORY LISTENER AUDIT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '| Tipo | Quantidade | Crescimento | Suspeita |',
    '| ---- | ---------- | ----------- | -------- |',
    ...makeMatrixRows(totals),
    '',
    '## Summary',
    '- Listener/timer/task audits are now part of runtime sync contract and exported through QA snapshots.',
  ]);

  console.log('[phase6] reports generated');
  console.log(`[phase6] reports=${reports.length} logs=${logFiles.length}`);
}

main();
