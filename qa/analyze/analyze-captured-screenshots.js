const fs = require('fs');
const path = require('path');

const { listFilesRecursive } = require('../core/shared');

function dedupe(values) {
  return [...new Set(values)];
}

function buildCoverageStats(imageFiles) {
  const lower = imageFiles.map((filePath) => String(filePath).toLowerCase());
  const buckets = {
    treino: lower.some((x) => x.includes('treino') || x.includes('workout')),
    coach: lower.some((x) => x.includes('coach') || x.includes('chat')),
    nutricao: lower.some((x) => x.includes('nutri') || x.includes('meal') || x.includes('food')),
    social: lower.some((x) => x.includes('social') || x.includes('ranking')),
    dashboard: lower.some((x) => x.includes('dashboard') || x.includes('home')),
    erros: lower.some((x) => x.includes('error') || x.includes('fail')),
    loading: lower.some((x) => x.includes('load') || x.includes('splash')),
    modais: lower.some((x) => x.includes('modal') || x.includes('popup') || x.includes('alert')),
  };

  const covered = Object.entries(buckets).filter(([, ok]) => ok).map(([key]) => key);
  const missing = Object.entries(buckets).filter(([, ok]) => !ok).map(([key]) => key);

  return {
    buckets,
    covered,
    missing,
  };
}

function buildDiagnosis({ screenshotsCount, coverage, captureRuns }) {
  const issues = [];
  const runConfigs = Array.isArray(captureRuns)
    ? captureRuns.map((item) => String(item?.detox?.configuration || '')).filter(Boolean)
    : [];
  const allAttached = runConfigs.length > 0 && runConfigs.every((cfg) => cfg.includes('android.attached'));
  const minExpectedScreenshots = allAttached ? 12 : 30;

  if (screenshotsCount < minExpectedScreenshots) {
    issues.push({
      severity: 'high',
      type: 'coverage_low',
      message: 'Quantidade de screenshots abaixo do esperado para cobertura total.',
      evidence: { screenshotsCount, minExpected: minExpectedScreenshots, attachedMode: allAttached },
    });
  }

  if (coverage.missing.length > 0) {
    issues.push({
      severity: 'medium',
      type: 'missing_domains',
      message: 'Dominios importantes sem evidencias claras de captura.',
      evidence: { missing: coverage.missing },
    });
  }

  const failedRuns = (captureRuns || []).filter((item) => Number(item.exitCode || 0) !== 0);
  if (failedRuns.length > 0) {
    issues.push({
      severity: 'high',
      type: 'capture_failures',
      message: 'Uma ou mais capturas falharam durante o ciclo.',
      evidence: { failedRuns: failedRuns.map((item) => item.testFile) },
    });
  }

  const priority = issues
    .slice()
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });

  return {
    good: [
      `Capturas processadas: ${screenshotsCount}`,
      `Dominios cobertos: ${coverage.covered.join(', ') || 'nenhum identificado'}`,
    ],
    bad: issues.map((item) => item.message),
    priority,
  };
}

async function analyzeCapturedScreenshots({ cycle, cycleDir, capture }) {
  const analysisDir = path.join(cycleDir, 'analysis');
  const mirroredDir = capture.mirroredDetoxDir;
  const files = mirroredDir ? listFilesRecursive(mirroredDir) : [];
  const images = files.filter((filePath) => /\.(png|jpg|jpeg|webp)$/i.test(filePath));

  const imageGroups = dedupe(images.map((filePath) => {
    const base = path.basename(filePath).toLowerCase();
    return base.replace(/\d+/g, '').replace(/\.(png|jpg|jpeg|webp)$/i, '');
  })).slice(0, 200);

  const coverage = buildCoverageStats(images);
  const diagnosis = buildDiagnosis({
    captureRuns: capture.runs,
    coverage,
    screenshotsCount: images.length,
  });

  const result = {
    cycle,
    analyzedAt: new Date().toISOString(),
    screenshotsCount: images.length,
    groupedPatterns: imageGroups,
    coverage,
    diagnosis,
  };

  fs.writeFileSync(path.join(analysisDir, 'analysis-report.json'), JSON.stringify(result, null, 2), 'utf-8');

  const md = [
    '# Analise das Capturas',
    '',
    `- Ciclo: ${cycle}`,
    `- Screenshots encontradas: ${images.length}`,
    `- Cobertura identificada: ${coverage.covered.join(', ') || 'nenhuma'}`,
    `- Lacunas identificadas: ${coverage.missing.join(', ') || 'nenhuma'}`,
    '',
    '## Diagnostico',
    '',
    '### Pontos bons',
    ...diagnosis.good.map((line) => `- ${line}`),
    '',
    '### Pontos ruins',
    ...(diagnosis.bad.length > 0 ? diagnosis.bad.map((line) => `- ${line}`) : ['- Nenhum problema relevante detectado.']),
    '',
    '### Prioridades',
    ...(diagnosis.priority.length > 0
      ? diagnosis.priority.map((item, idx) => `- P${idx + 1} [${item.severity}] ${item.type}: ${item.message}`)
      : ['- Sem pendencias criticas.']),
    '',
  ];

  fs.writeFileSync(path.join(analysisDir, 'analysis-report.md'), `${md.join('\n')}\n`, 'utf-8');
  return result;
}

module.exports = {
  analyzeCapturedScreenshots,
};
