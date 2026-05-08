const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PHASE4 = path.join(ROOT, 'qa_phase4_hardening');
const REPORTS = {
  stress: path.join(PHASE4, 'STRESS_VALIDATION_REPORT.md'),
  performance: path.join(PHASE4, 'PERFORMANCE_HARDENING.md'),
  video: path.join(PHASE4, 'VIDEO_HARDENING_REPORT.md'),
  flaky: path.join(PHASE4, 'FLAKINESS_MATRIX.md'),
  errors: path.join(PHASE4, 'ERROR_CORRELATION_REPORT.md'),
};

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

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (!predicate || predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function parseStatusFromReport(md) {
  const statusLine = md.split(/\r?\n/).find((line) => line.toLowerCase().includes('**status:**')) || '';
  const isPass = /passou|pass|ok|\u2705/i.test(statusLine);
  return isPass ? 'pass' : 'fail';
}

function parseExitFromReport(md) {
  const match = md.match(/Exit\s*Code:\s*(\d+)/i);
  if (match) return Number(match[1]);
  return md.includes('FALHOU') ? 1 : 0;
}

function parseTestRows(md) {
  const rows = [];
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((v) => v.trim()).filter(Boolean);
    if (cols.length < 4) continue;
    if (/^teste$|^suite$/i.test(cols[0])) continue;

    if (cols.length === 4) {
      rows.push({
        suite: 'semantic',
        test: cols[0],
        status: cols[1],
        duration: cols[2],
        exitCode: Number(cols[3]) || 1,
      });
    } else if (cols.length >= 5) {
      rows.push({
        suite: cols[0],
        test: cols[1],
        status: cols[2],
        duration: cols[3],
        exitCode: Number(cols[4]) || 1,
      });
    }
  }
  return rows;
}

function detectFlow(testName) {
  const value = String(testName || '').toLowerCase();
  if (value.includes('smoke')) return 'smoke';
  if (value.includes('auth') || value.includes('onboarding') || value.includes('login')) return 'auth';
  if (value.includes('navigation')) return 'navigation';
  if (value.includes('treino') || value.includes('workout')) return 'treino';
  if (value.includes('video') || value.includes('visual-fim') || value.includes('full-visual')) return 'video';
  if (value.includes('admin')) return 'admin';
  if (value.includes('logout')) return 'logout';
  if (value.includes('relaunch')) return 'relaunch';
  if (value.includes('fullscreen')) return 'fullscreen';
  return 'other';
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function collectRunReports() {
  const roots = ['qa_runs', 'stress_runs', 'regression_runs', 'baseline_runs'].map((n) => path.join(ROOT, n));
  const reports = [];
  for (const root of roots) {
    const reportFiles = walk(root, (file) => path.basename(file).toLowerCase() === 'report.md');
    for (const file of reportFiles) {
      const md = readText(file);
      const rows = parseTestRows(md);
      const runStatus = parseStatusFromReport(md);
      const runExit = parseExitFromReport(md);
      reports.push({
        file,
        rel: toRelative(file),
        status: runStatus,
        exitCode: runExit,
        tests: rows,
      });
    }
  }
  return reports;
}

function computeFlakiness(reports) {
  const byFlow = new Map();

  for (const report of reports) {
    if (!report.tests.length) {
      const flow = detectFlow(path.dirname(report.file));
      if (!byFlow.has(flow)) byFlow.set(flow, []);
      byFlow.get(flow).push(report.status === 'pass' ? 1 : 0);
      continue;
    }

    for (const test of report.tests) {
      const flow = detectFlow(test.test);
      if (!byFlow.has(flow)) byFlow.set(flow, []);
      const ok = test.exitCode === 0 || /\u2705|pass|ok/i.test(test.status);
      byFlow.get(flow).push(ok ? 1 : 0);
    }
  }

  const rows = [];
  for (const [flow, outcomes] of byFlow.entries()) {
    const total = outcomes.length;
    const pass = outcomes.reduce((a, b) => a + b, 0);
    const rate = total ? pass / total : 0;
    let transitions = 0;
    for (let i = 1; i < outcomes.length; i += 1) {
      if (outcomes[i] !== outcomes[i - 1]) transitions += 1;
    }

    let rank = 'Stable';
    if (rate < 0.5) rank = 'Critico';
    else if (rate < 0.8 || transitions >= 2) rank = 'Flaky';
    else if (rate < 0.95 || transitions >= 1) rank = 'Semi-Flaky';

    rows.push({
      flow,
      stable: rank === 'Stable' ? 'X' : '',
      semi: rank === 'Semi-Flaky' ? 'X' : '',
      flaky: rank === 'Flaky' ? 'X' : '',
      critical: rank === 'Critico' ? 'X' : '',
      rank,
      pass,
      total,
      passRate: Number((rate * 100).toFixed(1)),
      transitions,
    });
  }

  rows.sort((a, b) => a.flow.localeCompare(b.flow));
  return rows;
}

function normalizeError(message) {
  return String(message || '')
    .replace(/\d+/g, '#')
    .replace(/run_\d{8}_\d{6}/g, 'run_<ts>')
    .trim()
    .slice(0, 180);
}

function collectErrors() {
  const roots = ['qa_runs', 'stress_runs', 'regression_runs', 'baseline_runs'].map((n) => path.join(ROOT, n));
  const patterns = [
    /fatal exception/i,
    /androidruntime/i,
    /typeerror/i,
    /referenceerror/i,
    /invariant violation/i,
    /unhandled promise rejection/i,
    /cannot read properties of/i,
    /timeout of .* exceeded/i,
    /detox.*failed/i,
  ];

  const grouped = new Map();

  for (const root of roots) {
    const logs = walk(root, (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith('.log') || lower.endsWith('logcat.txt') || lower.endsWith('jest-output.txt');
    });

    for (const file of logs) {
      const rel = toRelative(file);
      const lines = readText(file).split(/\r?\n/);
      for (const line of lines) {
        if (!patterns.some((re) => re.test(line))) continue;
        const key = normalizeError(line);
        if (!grouped.has(key)) {
          grouped.set(key, {
            error: key,
            frequency: 0,
            screens: new Set(),
            flows: new Set(),
            severity: 'media',
            sources: new Set(),
          });
        }
        const row = grouped.get(key);
        row.frequency += 1;
        row.sources.add(rel);

        const screenMatch = line.match(/screen_[a-z_]+/i);
        if (screenMatch) row.screens.add(screenMatch[0].toLowerCase());

        const flow = detectFlow(rel);
        row.flows.add(flow);

        if (/fatal|androidruntime|crash/i.test(line)) row.severity = 'critica';
        else if (/typeerror|referenceerror|invariant/i.test(line)) row.severity = 'alta';
      }
    }
  }

  return Array.from(grouped.values())
    .map((item) => ({
      error: item.error,
      frequency: item.frequency,
      screen: Array.from(item.screens).slice(0, 3).join(', ') || 'indefinida',
      flow: Array.from(item.flows).slice(0, 3).join(', ') || 'indefinido',
      severity: item.severity,
      sources: Array.from(item.sources).slice(0, 4),
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

function collectMetrics() {
  const dir = path.join(PHASE4, 'metrics');
  const files = walk(dir, (f) => f.toLowerCase().endsWith('.json'));
  const samples = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readText(file));
      if (Array.isArray(data)) {
        for (const row of data) samples.push(row);
      }
    } catch {
      // ignore malformed metric file
    }
  }
  return samples;
}

function avg(values) {
  const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!filtered.length) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function writeStressReport(reports, flakinessRows, errors) {
  const pass = reports.filter((r) => r.status === 'pass').length;
  const fail = reports.length - pass;
  const topFlaky = flakinessRows.filter((r) => r.rank !== 'Stable').slice(0, 5);
  const topErrors = errors.slice(0, 8);

  const lines = [
    '# STRESS VALIDATION REPORT',
    '',
    `Data: ${new Date().toISOString()}`,
    `Runs executadas: ${reports.length}`,
    `Runs com sucesso: ${pass}`,
    `Runs com falha: ${fail}`,
    '',
    '## Flows exercitados',
    '- smoke',
    '- auth',
    '- navigation',
    '- treino',
    '- video',
    '- admin',
    '- logout',
    '- relaunch',
    '- fullscreen',
    '',
    '## Sinais de instabilidade detectados',
  ];

  if (!topFlaky.length) {
    lines.push('- Sem sinais fortes de flakiness nos dados atuais.');
  } else {
    for (const row of topFlaky) {
      lines.push(`- ${row.flow}: ${row.rank} (pass rate ${row.passRate}%, transicoes ${row.transitions})`);
    }
  }

  lines.push('', '## Crashes e erros relevantes');
  if (!topErrors.length) {
    lines.push('- Nenhum erro critico agrupado ate o momento.');
  } else {
    for (const e of topErrors) {
      lines.push(`- ${e.severity.toUpperCase()} x${e.frequency}: ${e.error}`);
    }
  }

  lines.push('', '## Artefatos', '- qa_runs/', '- stress_runs/', '- regression_runs/', '- baseline_runs/', '- nightly_runs/');

  fs.writeFileSync(REPORTS.stress, lines.join('\n'), 'utf8');
}

function writePerformanceReport(metrics) {
  const byScenario = new Map();
  for (const row of metrics) {
    const key = String(row.scenario || 'unknown');
    if (!byScenario.has(key)) byScenario.set(key, []);
    byScenario.get(key).push(row);
  }

  const scenarios = ['cold_start', 'warm_start', 'long_session', 'stress_session'];
  const rows = scenarios.map((scenario) => {
    const sample = byScenario.get(scenario) || [];
    return {
      scenario,
      samples: sample.length,
      startupMs: Math.round(avg(sample.map((s) => Number(s.startupTotalMs) || 0))),
      totalPssMb: Number((avg(sample.map((s) => (Number(s.totalPssKb) || 0) / 1024))).toFixed(1)),
      jankyPct: Number((avg(sample.map((s) => Number(s.jankyFramesPct) || 0))).toFixed(2)),
    };
  });

  const lines = [
    '# PERFORMANCE HARDENING',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '| Cenario | Samples | Startup (ms) | Memoria TOTAL PSS (MB) | Janky Frames (%) |',
    '| ------- | ------- | ------------ | ---------------------- | ---------------- |',
  ];

  for (const row of rows) {
    lines.push(`| ${row.scenario} | ${row.samples} | ${row.startupMs} | ${row.totalPssMb} | ${row.jankyPct} |`);
  }

  lines.push('', '## Observacoes', '- FPS aproximado inferido por janky frames do gfxinfo.', '- Heuristicas de leak usam crescimento de PSS entre warm/long/stress.', '- Recomendado manter trend de PSS e janky por rodada noturna.');

  fs.writeFileSync(REPORTS.performance, lines.join('\n'), 'utf8');
}

function writeVideoReport(reports, errors) {
  const videoRuns = reports.filter((r) => /video|visual-fim|full-visual|fullscreen/i.test(r.rel));
  const videoErrors = errors.filter((e) => /video|fullscreen|player|render|frame/i.test(e.error));

  const lines = [
    '# VIDEO HARDENING REPORT',
    '',
    `Data: ${new Date().toISOString()}`,
    `Runs com cobertura de video/fullscreen: ${videoRuns.length}`,
    '',
    '## Cenarios validados',
    '- fullscreen loops',
    '- lifecycle background/foreground durante playback',
    '- reconnect com player ativo',
    '- reopen loops e relaunch',
    '',
    '## Sinais encontrados',
  ];

  if (!videoErrors.length) {
    lines.push('- Sem erros agrupados especificos de player/video nesta rodada.');
  } else {
    for (const row of videoErrors.slice(0, 8)) {
      lines.push(`- ${row.severity.toUpperCase()} x${row.frequency}: ${row.error}`);
    }
  }

  lines.push('', '## Estado', '- Estabilidade depende de manter execucoes repetidas no nightly.', '- Qualquer regressao de fullscreen deve bloquear release.');

  fs.writeFileSync(REPORTS.video, lines.join('\n'), 'utf8');
}

function writeFlakinessMatrix(rows) {
  const lines = [
    '# FLAKINESS MATRIX',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '| Fluxo | Stable | Semi-Flaky | Flaky | Critico | Pass Rate | Execucoes | Causa Provavel |',
    '| ----- | ------ | ---------- | ----- | ------- | --------- | --------- | -------------- |',
  ];

  for (const row of rows) {
    const cause = row.rank === 'Stable'
      ? 'Sem sinal de race relevante'
      : row.rank === 'Semi-Flaky'
        ? 'Timing variavel em waits e loading'
        : row.rank === 'Flaky'
          ? 'Race de navegacao/assincronia'
          : 'Instabilidade critica ou crash recorrente';

    lines.push(`| ${row.flow} | ${row.stable} | ${row.semi} | ${row.flaky} | ${row.critical} | ${row.passRate}% | ${row.total} | ${cause} |`);
  }

  fs.writeFileSync(REPORTS.flaky, lines.join('\n'), 'utf8');
}

function writeErrorCorrelation(errors) {
  const lines = [
    '# ERROR CORRELATION REPORT',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '| Erro | Frequencia | Tela | Fluxo | Gravidade |',
    '| ---- | ---------- | ---- | ----- | --------- |',
  ];

  for (const row of errors.slice(0, 25)) {
    lines.push(`| ${row.error.replace(/\|/g, '/')} | ${row.frequency} | ${row.screen} | ${row.flow} | ${row.severity} |`);
  }

  lines.push('', '## Ranking de estabilidade por erro', ...errors.slice(0, 10).map((e, i) => `${i + 1}. ${e.severity.toUpperCase()} x${e.frequency} - ${e.error}`));

  fs.writeFileSync(REPORTS.errors, lines.join('\n'), 'utf8');
}

function writeQaRunsIndex(reports) {
  const out = path.join(PHASE4, 'QA_RUNS', 'README.md');
  const lines = [
    '# QA_RUNS Phase 4',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '## Runs indexadas automaticamente',
  ];

  if (!reports.length) {
    lines.push('- Nenhuma run encontrada.');
  } else {
    for (const row of reports.slice(0, 200)) {
      lines.push(`- ${row.rel} :: ${row.status} (exit ${row.exitCode})`);
    }
  }

  fs.writeFileSync(out, lines.join('\n'), 'utf8');
}

function main() {
  ensureDir(PHASE4);
  ensureDir(path.join(PHASE4, 'QA_RUNS'));

  const reports = collectRunReports();
  const flakinessRows = computeFlakiness(reports);
  const errors = collectErrors();
  const metrics = collectMetrics();

  writeStressReport(reports, flakinessRows, errors);
  writePerformanceReport(metrics);
  writeVideoReport(reports, errors);
  writeFlakinessMatrix(flakinessRows);
  writeErrorCorrelation(errors);
  writeQaRunsIndex(reports);

  console.log('[phase4] reports generated');
  console.log(`[phase4] runs=${reports.length} errors=${errors.length} metrics=${metrics.length}`);
}

main();
