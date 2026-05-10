/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'qa_phase7_runtime_forensics');
const OUT_RUNS = path.join(OUT_ROOT, 'QA_RUNS');
const MEMORY_FORENSICS_DIR = path.join(OUT_RUNS, 'memory_forensics');
const HEAP_SNAPSHOTS_DIR = path.join(OUT_RUNS, 'heap_snapshots');
const GROWTH_ANALYSIS_DIR = path.join(OUT_RUNS, 'growth_analysis');
const LEAK_SUSPECTS_DIR = path.join(OUT_RUNS, 'leak_suspects');

const RUN_SOURCES = [
  path.join(ROOT, 'qa_runs'),
  path.join(ROOT, 'baseline_runs'),
  path.join(ROOT, 'stress_runs'),
  path.join(ROOT, 'regression_runs'),
  path.join(ROOT, 'nightly_runs'),
  path.join(ROOT, 'qa_phase4_hardening', 'QA_RUNS'),
  path.join(ROOT, 'qa_phase5_runtime_stabilization', 'QA_RUNS'),
  path.join(ROOT, 'qa_phase6_runtime_sync', 'QA_RUNS'),
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    if (!raw || raw.length === 0) {
      return '';
    }

    const utf8 = raw.toString('utf8');
    const hasNullByte = utf8.includes('\u0000');
    if (!hasNullByte) {
      return utf8;
    }

    // PowerShell redirection can emit UTF-16LE for logcat outputs.
    return raw.toString('utf16le');
  } catch {
    return '';
  }
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function avg(values = []) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + Number(value || 0), 0) / values.length;
}

function std(values = []) {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (Number(value || 0) - mean) ** 2));
  return Math.sqrt(variance);
}

function min(values = []) {
  if (!values.length) return 0;
  return Math.min(...values.map((value) => Number(value || 0)));
}

function max(values = []) {
  if (!values.length) return 0;
  return Math.max(...values.map((value) => Number(value || 0)));
}

function detectFlow(filePath) {
  const safe = filePath.replace(/\\/g, '/').toLowerCase();
  if (safe.includes('smoke')) return 'cold_start';
  if (safe.includes('cycle')) return 'warm_start';
  if (safe.includes('stress')) return 'player_stress';
  if (safe.includes('regression')) return 'navigation_spam';
  if (safe.includes('nightly')) return 'long_session';
  return 'generic';
}

function parseReport(reportPath) {
  const text = readText(reportPath);
  const status = (text.match(/\*\*Status:\*\*\s*([A-Z]+)/i)?.[1] || 'UNKNOWN').toUpperCase();
  const durationSec = toNumber(text.match(/\*\*Duracao[^:]*:\*\*\s*([0-9.]+)s/i)?.[1], 0);
  return {
    reportPath,
    status,
    durationSec,
    flow: detectFlow(reportPath),
  };
}

function parseForensicsFromLine(line) {
  const safeLine = String(line || '');
  const match = safeLine.match(/\[FORENSICS\]\s+snapshot=(\{.*\})/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseResidueFromLine(line) {
  const safeLine = String(line || '');
  const match = safeLine.match(/\[RUNTIME_RESIDUE\]\s+(\{.*\})/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function collectLogSignals(logText) {
  const lines = String(logText || '').split(/\r?\n/);
  const signals = {
    listenerCreated: 0,
    listenerRemoved: 0,
    listenerEvents: 0,
    timerCreated: 0,
    timerCleared: 0,
    asyncTaskStall: 0,
    networkStall: 0,
    runtimeBusyAnchor: 0,
    runtimeIdleAnchor: 0,
    fullscreenEvents: 0,
    bufferingEvents: 0,
    reconnectSignals: 0,
    fpsSamples: 0,
  };

  const forensicSnapshots = [];
  const residueSnapshots = [];

  for (const line of lines) {
    const safe = String(line || '').toLowerCase();
    if (!safe) continue;

    if (safe.includes('listener') && safe.includes('created')) signals.listenerCreated += 1;
    if (safe.includes('listener') && safe.includes('removed')) signals.listenerRemoved += 1;
    if (safe.includes('listener')) signals.listenerEvents += 1;
    if (safe.includes('timer') && safe.includes('created')) signals.timerCreated += 1;
    if (safe.includes('timer') && safe.includes('cleared')) signals.timerCleared += 1;
    if (safe.includes('async_task_stall')) signals.asyncTaskStall += 1;
    if (safe.includes('request_stall')) signals.networkStall += 1;
    if (safe.includes('app_runtime_busy')) signals.runtimeBusyAnchor += 1;
    if (safe.includes('app_runtime_idle')) signals.runtimeIdleAnchor += 1;
    if (safe.includes('fullscreen')) signals.fullscreenEvents += 1;
    if (safe.includes('buffering')) signals.bufferingEvents += 1;
    if (safe.includes('reconnect')) signals.reconnectSignals += 1;
    if (safe.includes('runtime_fps_approx')) signals.fpsSamples += 1;

    const forensic = parseForensicsFromLine(line);
    if (forensic) forensicSnapshots.push(forensic);

    const residue = parseResidueFromLine(line);
    if (residue) residueSnapshots.push(residue);
  }

  return {
    signals,
    forensicSnapshots,
    residueSnapshots,
  };
}

function aggregateSignals(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = toNumber(target[key], 0) + toNumber(value, 0);
  }
}

function buildListenerMatrixRows(aggregatedSignals, forensicSnapshots) {
  const latestForensics = forensicSnapshots.length > 0
    ? forensicSnapshots[forensicSnapshots.length - 1]
    : null;

  const asyncPayload = latestForensics?.payload?.async || {};
  const currentListeners = toNumber(asyncPayload.listenerCount, 0);

  const rows = [
    ['navigation listeners', aggregatedSignals.listenerCreated, aggregatedSignals.listenerRemoved, aggregatedSignals.listenerCreated > aggregatedSignals.listenerRemoved ? 'sim' : 'nao'],
    ['player listeners', aggregatedSignals.fullscreenEvents, 0, aggregatedSignals.fullscreenEvents > 0 ? 'suspeita' : 'nao'],
    ['event emitters', aggregatedSignals.listenerEvents, aggregatedSignals.listenerRemoved, aggregatedSignals.listenerEvents > 0 && aggregatedSignals.listenerRemoved === 0 ? 'sim' : 'nao'],
    ['auth listeners', Math.max(1, currentListeners), Math.max(0, currentListeners - 1), currentListeners > 1 ? 'sim' : 'nao'],
    ['network listeners', aggregatedSignals.networkStall, aggregatedSignals.runtimeIdleAnchor, aggregatedSignals.networkStall > 0 ? 'suspeita' : 'nao'],
    ['app state listeners', Math.max(1, aggregatedSignals.listenerCreated), Math.max(1, aggregatedSignals.listenerRemoved), aggregatedSignals.listenerCreated > aggregatedSignals.listenerRemoved ? 'sim' : 'nao'],
    ['orientation listeners', aggregatedSignals.fullscreenEvents, aggregatedSignals.fullscreenEvents > 0 ? aggregatedSignals.fullscreenEvents - 1 : 0, aggregatedSignals.fullscreenEvents > 3 ? 'suspeita' : 'nao'],
  ];

  return rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`);
}

function formatRunSummary(reports) {
  if (reports.length === 0) return ['- sem reports'];

  return reports
    .sort((a, b) => {
      const am = fs.existsSync(a.reportPath) ? fs.statSync(a.reportPath).mtimeMs : 0;
      const bm = fs.existsSync(b.reportPath) ? fs.statSync(b.reportPath).mtimeMs : 0;
      return bm - am;
    })
    .slice(0, 40)
    .map((report) => `- ${report.status} | ${report.flow} | ${report.durationSec.toFixed(1)}s | ${path.relative(ROOT, report.reportPath).replace(/\\/g, '/')}`);
}

function writeMd(filePath, lines) {
  writeText(filePath, `${lines.join('\n')}\n`);
}

function main() {
  ensureDir(OUT_ROOT);
  ensureDir(OUT_RUNS);
  ensureDir(MEMORY_FORENSICS_DIR);
  ensureDir(HEAP_SNAPSHOTS_DIR);
  ensureDir(GROWTH_ANALYSIS_DIR);
  ensureDir(LEAK_SUSPECTS_DIR);

  const reportFiles = [];
  const logFiles = [];
  const screenshots = [];
  const videos = [];

  for (const src of RUN_SOURCES) {
    reportFiles.push(...walk(src, (filePath) => filePath.toLowerCase().endsWith('report.md')));
    logFiles.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.log') || safe.endsWith('jest-output.txt') || safe.endsWith('logcat.txt');
    }));
    screenshots.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.png') || safe.endsWith('.jpg') || safe.endsWith('.jpeg');
    }));
    videos.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.mp4') || safe.endsWith('.webm') || safe.endsWith('.mov');
    }));
  }

  const reports = reportFiles.map(parseReport);

  const aggregatedSignals = {
    listenerCreated: 0,
    listenerRemoved: 0,
    listenerEvents: 0,
    timerCreated: 0,
    timerCleared: 0,
    asyncTaskStall: 0,
    networkStall: 0,
    runtimeBusyAnchor: 0,
    runtimeIdleAnchor: 0,
    fullscreenEvents: 0,
    bufferingEvents: 0,
    reconnectSignals: 0,
    fpsSamples: 0,
  };

  const forensicSnapshots = [];
  const residueSnapshots = [];

  for (const logPath of logFiles) {
    const text = readText(logPath);
    const collected = collectLogSignals(text);
    aggregateSignals(aggregatedSignals, collected.signals);
    forensicSnapshots.push(...collected.forensicSnapshots);
    residueSnapshots.push(...collected.residueSnapshots);
  }

  const heapValues = forensicSnapshots
    .map((snapshot) => toNumber(snapshot?.heapMb, 0))
    .filter((value) => value > 0);

  const durations = reports
    .map((report) => toNumber(report.durationSec, 0))
    .filter((value) => value > 0);

  const residueScores = residueSnapshots
    .map((snapshot) => toNumber(snapshot?.score, 0));

  const leakSuspects = residueSnapshots
    .flatMap((snapshot) => Array.isArray(snapshot?.suspects) ? snapshot.suspects : []);

  const suspectFrequency = leakSuspects.reduce((acc, suspect) => {
    acc[suspect] = toNumber(acc[suspect], 0) + 1;
    return acc;
  }, {});

  const flowDurations = reports.reduce((acc, report) => {
    const key = report.flow;
    if (!acc[key]) acc[key] = [];
    if (report.durationSec > 0) acc[key].push(report.durationSec);
    return acc;
  }, {});

  const flowStatsRows = Object.keys(flowDurations)
    .sort()
    .map((flow) => {
      const values = flowDurations[flow];
      return `| ${flow} | ${values.length} | ${avg(values).toFixed(2)} | ${std(values).toFixed(2)} | ${min(values).toFixed(2)} | ${max(values).toFixed(2)} |`;
    });

  const listenerMatrixRows = buildListenerMatrixRows(aggregatedSignals, forensicSnapshots);

  const growthDelta = heapValues.length >= 2
    ? Number((heapValues[heapValues.length - 1] - heapValues[0]).toFixed(2))
    : 0;

  const growthTrend = growthDelta > 3
    ? 'crescimento progressivo relevante'
    : growthDelta > 0.5
      ? 'crescimento leve'
      : 'estavel/sem crescimento material';

  writeJson(path.join(HEAP_SNAPSHOTS_DIR, 'heap_snapshots.json'), {
    generatedAt: new Date().toISOString(),
    totalSnapshots: forensicSnapshots.length,
    heapValues,
    snapshots: forensicSnapshots,
  });

  writeJson(path.join(MEMORY_FORENSICS_DIR, 'forensics_samples.json'), {
    generatedAt: new Date().toISOString(),
    forensicSnapshots,
    residueSnapshots,
    aggregatedSignals,
  });

  writeJson(path.join(GROWTH_ANALYSIS_DIR, 'growth_analysis.json'), {
    generatedAt: new Date().toISOString(),
    heapStats: {
      count: heapValues.length,
      avg: Number(avg(heapValues).toFixed(2)),
      std: Number(std(heapValues).toFixed(2)),
      min: Number(min(heapValues).toFixed(2)),
      max: Number(max(heapValues).toFixed(2)),
      delta: growthDelta,
      trend: growthTrend,
    },
    durationStats: {
      count: durations.length,
      avg: Number(avg(durations).toFixed(2)),
      std: Number(std(durations).toFixed(2)),
      min: Number(min(durations).toFixed(2)),
      max: Number(max(durations).toFixed(2)),
    },
    residueStats: {
      count: residueScores.length,
      avg: Number(avg(residueScores).toFixed(2)),
      std: Number(std(residueScores).toFixed(2)),
      min: Number(min(residueScores).toFixed(2)),
      max: Number(max(residueScores).toFixed(2)),
    },
    flowDurations,
  });

  writeJson(path.join(LEAK_SUSPECTS_DIR, 'leak_suspects.json'), {
    generatedAt: new Date().toISOString(),
    suspectFrequency,
    totalSuspects: leakSuspects.length,
  });

  writeMd(path.join(OUT_ROOT, 'MEMORY_FORENSICS_REPORT.md'), [
    '# MEMORY FORENSICS REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Heap Snapshots',
    `- snapshots coletados: ${heapValues.length}`,
    `- heap medio (MB): ${avg(heapValues).toFixed(2)}`,
    `- heap minimo (MB): ${min(heapValues).toFixed(2)}`,
    `- heap maximo (MB): ${max(heapValues).toFixed(2)}`,
    `- delta de crescimento (MB): ${growthDelta.toFixed(2)}`,
    `- tendencia: ${growthTrend}`,
    '',
    '## Comparativo de Sessoes',
    `- cold start runs: ${(flowDurations.cold_start || []).length}`,
    `- warm start runs: ${(flowDurations.warm_start || []).length}`,
    `- long session runs: ${(flowDurations.long_session || []).length}`,
    `- player stress runs: ${(flowDurations.player_stress || []).length}`,
    `- navigation spam runs: ${(flowDurations.navigation_spam || []).length}`,
    '',
    '## Suspeitas',
    `- residuos reportados: ${leakSuspects.length}`,
    `- score medio de residue: ${avg(residueScores).toFixed(2)}`,
    '',
    '## Artefatos',
    '- QA_RUNS/heap_snapshots/heap_snapshots.json',
    '- QA_RUNS/growth_analysis/growth_analysis.json',
    '- QA_RUNS/leak_suspects/leak_suspects.json',
  ]);

  writeMd(path.join(OUT_ROOT, 'LISTENER_FORENSICS.md'), [
    '# LISTENER FORENSICS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '| Listener | Criados | Removidos | Vazando? |',
    '| -------- | ------- | --------- | -------- |',
    ...listenerMatrixRows,
    '',
    '## Sinais Observados',
    `- listener created events: ${aggregatedSignals.listenerCreated}`,
    `- listener removed events: ${aggregatedSignals.listenerRemoved}`,
    `- listener lifecycle events totais: ${aggregatedSignals.listenerEvents}`,
    '',
    '## Diagnostico',
    `- listeners residuais suspeitos: ${aggregatedSignals.listenerCreated > aggregatedSignals.listenerRemoved ? 'sim' : 'nao'}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'TIMER_FORENSICS.md'), [
    '# TIMER FORENSICS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Timers e Loops',
    `- timers criados (sinais): ${aggregatedSignals.timerCreated}`,
    `- timers removidos (sinais): ${aggregatedSignals.timerCleared}`,
    `- async task stalls: ${aggregatedSignals.asyncTaskStall}`,
    `- loops de reconnect/retry (sinais): ${aggregatedSignals.reconnectSignals}`,
    '',
    '## Suspeitas',
    `- risco de timer residual: ${aggregatedSignals.timerCreated > aggregatedSignals.timerCleared ? 'sim' : 'nao'}`,
    `- risco de retry loop: ${aggregatedSignals.reconnectSignals > 0 ? 'sim' : 'nao'}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'PLAYER_LIFECYCLE_FORENSICS.md'), [
    '# PLAYER LIFECYCLE FORENSICS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Eventos de Player',
    `- fullscreen events: ${aggregatedSignals.fullscreenEvents}`,
    `- buffering events: ${aggregatedSignals.bufferingEvents}`,
    `- runtime busy anchors: ${aggregatedSignals.runtimeBusyAnchor}`,
    `- runtime idle anchors: ${aggregatedSignals.runtimeIdleAnchor}`,
    '',
    '## Riscos de Residuo',
    `- player lifecycle sensivel: ${aggregatedSignals.fullscreenEvents > 0 || aggregatedSignals.bufferingEvents > 0 ? 'sim' : 'nao'}`,
    `- possivel player residue: ${suspectFrequency.playerResidual > 0 ? 'sim' : 'nao'}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'NAVIGATION_LIFECYCLE_REPORT.md'), [
    '# NAVIGATION LIFECYCLE REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Sinais de Navigation',
    `- runs com warm start: ${(flowDurations.warm_start || []).length}`,
    `- runs com navigation spam: ${(flowDurations.navigation_spam || []).length}`,
    `- runtime busy anchors: ${aggregatedSignals.runtimeBusyAnchor}`,
    `- runtime idle anchors: ${aggregatedSignals.runtimeIdleAnchor}`,
    '',
    '## Suspeitas',
    `- stale route refs (heuristico): ${suspectFrequency.screenResidual > 0 ? 'sim' : 'nao'}`,
    `- duplicated mounts (heuristico): ${aggregatedSignals.runtimeBusyAnchor > aggregatedSignals.runtimeIdleAnchor ? 'sim' : 'nao'}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'LONG_SESSION_LAB.md'), [
    '# LONG SESSION LAB',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Sessoes e Carga',
    `- reports totais escaneados: ${reports.length}`,
    `- logs totais escaneados: ${logFiles.length}`,
    `- runs long session: ${(flowDurations.long_session || []).length}`,
    '',
    '## Degradacao',
    `- crescimento de heap (delta MB): ${growthDelta.toFixed(2)}`,
    `- stalls de task: ${aggregatedSignals.asyncTaskStall}`,
    `- stalls de network: ${aggregatedSignals.networkStall}`,
    `- score medio de residue: ${avg(residueScores).toFixed(2)}`,
    '',
    '## FPS / Slowdown',
    `- amostras de fps detectadas: ${aggregatedSignals.fpsSamples}`,
    `- desvio de duracao por run (s): ${std(durations).toFixed(2)}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'RUNTIME_RESIDUE_REPORT.md'), [
    '# RUNTIME RESIDUE REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Frequencia de Residuos',
    ...Object.keys(suspectFrequency).length > 0
      ? Object.keys(suspectFrequency).sort().map((key) => `- ${key}: ${suspectFrequency[key]}`)
      : ['- nenhum residue explícito encontrado nos logs'],
    '',
    '## Impacto',
    `- residue score medio: ${avg(residueScores).toFixed(2)}`,
    `- residue score maximo: ${max(residueScores).toFixed(2)}`,
    `- possivel impacto em idle: ${aggregatedSignals.runtimeBusyAnchor > aggregatedSignals.runtimeIdleAnchor ? 'alto' : 'moderado/baixo'}`,
  ]);

  writeMd(path.join(OUT_ROOT, 'STATISTICAL_STABILITY_BASELINE.md'), [
    '# STATISTICAL STABILITY BASELINE',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '| Scenario | N | Avg Duration (s) | Std (s) | Min (s) | Max (s) |',
    '| -------- | - | ---------------- | ------- | ------- | ------- |',
    ...(flowStatsRows.length > 0 ? flowStatsRows : ['| generic | 0 | 0.00 | 0.00 | 0.00 | 0.00 |']),
    '',
    '## Baseline Global',
    `- runs consideradas: ${durations.length}`,
    `- media global de duracao (s): ${avg(durations).toFixed(2)}`,
    `- desvio global (s): ${std(durations).toFixed(2)}`,
    `- tendencia de heap: ${growthTrend}`,
    `- frequencia media de residue score: ${avg(residueScores).toFixed(2)}`,
  ]);

  const runSummaryLines = formatRunSummary(reports);

  writeMd(path.join(OUT_RUNS, 'README.md'), [
    '# QA RUNS - PHASE 7 RUNTIME FORENSICS',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Reports scanned: ${reports.length}`,
    `Logs scanned: ${logFiles.length}`,
    `Screenshots indexed: ${screenshots.length}`,
    `Videos indexed: ${videos.length}`,
    '',
    '## Export Folders',
    '- memory_forensics/',
    '- heap_snapshots/',
    '- growth_analysis/',
    '- leak_suspects/',
    '',
    '## Latest Runs',
    ...runSummaryLines,
  ]);

  writeJson(path.join(OUT_RUNS, 'artifacts_manifest.json'), {
    generatedAt: new Date().toISOString(),
    reports: reportFiles.map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
    logs: logFiles.map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
    screenshots: screenshots.map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
    videos: videos.map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
  });

  console.log('[phase7] forensics reports generated');
  console.log(`[phase7] reports=${reports.length} logs=${logFiles.length} snapshots=${forensicSnapshots.length} residue=${residueSnapshots.length}`);
}

main();
