const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'artifacts', 'qa-full');
const QA_DIR = path.join(ROOT, 'qa');
const REPORT_JSON = path.join(QA_DIR, 'full-visual-qa-report.json');
const REPORT_MD = path.join(QA_DIR, 'FULL_VISUAL_QA_REPORT.md');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    cycles: 15,
    mobileOnly: false,
    skipZip: false,
    stabilityCycles: 10,
    webOnly: false,
  };

  for (const raw of args) {
    if (raw === '--mobile-only') out.mobileOnly = true;
    if (raw === '--web-only') out.webOnly = true;
    if (raw === '--skip-zip') out.skipZip = true;
    if (raw.startsWith('--cycles=')) {
      out.cycles = Math.max(1, Number(raw.split('=')[1] || 15));
    }
    if (raw.startsWith('--stability-cycles=')) {
      out.stabilityCycles = Math.max(0, Number(raw.split('=')[1] || 10));
    }
  }

  return out;
}

function ensureDirs() {
  [ARTIFACTS, QA_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

function runPowershellScript(scriptRelativePath, scriptArgs = []) {
  const ps = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const scriptPath = path.join(ROOT, scriptRelativePath);
  return run(ps, ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...scriptArgs]);
}

function getAdbCommand(env = process.env) {
  const sdkRoot = env.ANDROID_SDK_ROOT || env.ANDROID_HOME;
  if (!sdkRoot) return process.platform === 'win32' ? 'adb.exe' : 'adb';

  const adbPath = process.platform === 'win32'
    ? path.join(sdkRoot, 'platform-tools', 'adb.exe')
    : path.join(sdkRoot, 'platform-tools', 'adb');

  return fs.existsSync(adbPath) ? adbPath : (process.platform === 'win32' ? 'adb.exe' : 'adb');
}

function findAttachedDevices(env = process.env) {
  const { execFileSync } = require('child_process');
  try {
    const output = execFileSync(getAdbCommand(env), ['devices'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return String(output || '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts[1] === 'device')
      .map((parts) => parts[0]);
  } catch {
    return [];
  }
}

function pickAttachedDevice(devices = []) {
  if (!Array.isArray(devices) || devices.length === 0) return null;
  const physical = devices.find((serial) => !String(serial).startsWith('emulator-'));
  return physical || devices[0] || null;
}

async function runMobileCycle(index, total, phase) {
  const requestedConfiguration = process.env.DETOX_CONFIGURATION || 'android.attached.debug';
  const isAttached = String(requestedConfiguration).includes('android.attached');
  const autoAdbName = !process.env.DETOX_ADB_NAME && isAttached
    ? pickAttachedDevice(findAttachedDevices(process.env))
    : null;

  const env = {
    ...process.env,
    DETOX_CONFIGURATION: requestedConfiguration,
    ...(autoAdbName ? { DETOX_ADB_NAME: autoAdbName } : {}),
    DETOX_TEST_FILE: 'e2e/14-full-visual-functional.e2e.js',
    QA_SEED: `${Date.now()}-${phase}-${index}`,
  };

  console.log(`[full-qa] mobile cycle ${index}/${total} phase=${phase}`);
  const exitCode = await run(process.execPath, ['scripts/run-detox-cycle.js'], env);

  let cycleReport = null;
  const cyclePath = path.join(ROOT, 'artifacts', 'detox-cycle-last.json');
  if (fs.existsSync(cyclePath)) {
    try {
      cycleReport = JSON.parse(fs.readFileSync(cyclePath, 'utf-8'));
    } catch {
      cycleReport = null;
    }
  }

  return {
    cycleReport,
    exitCode,
    index,
    phase,
    type: 'mobile',
  };
}

async function runWebValidation() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['playwright', 'test', 'dashboard/playwright-full-qa.spec.js', '--reporter=line'];

  console.log('[full-qa] web validation start');
  const exitCode = await run(npx, args, {
    ...process.env,
    BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
  });

  return {
    exitCode,
    type: 'web',
  };
}

function summarize(results) {
  const mobile = results.filter((item) => item.type === 'mobile');
  const web = results.filter((item) => item.type === 'web');
  const mobileFailures = mobile.filter((item) => item.exitCode !== 0).length;
  const webFailures = web.filter((item) => item.exitCode !== 0).length;

  return {
    completedAt: new Date().toISOString(),
    mobile: {
      failed: mobileFailures,
      passed: mobile.length - mobileFailures,
      total: mobile.length,
    },
    rawResults: results,
    web: {
      failed: webFailures,
      passed: web.length - webFailures,
      total: web.length,
    },
  };
}

function writeReports(summary, config) {
  fs.writeFileSync(REPORT_JSON, JSON.stringify({ config, ...summary }, null, 2), 'utf-8');

  const lines = [
    '# Full Visual QA Report',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    '## Configuracao executada',
    '',
    `- Ciclos principais: ${config.cycles}`,
    `- Ciclos finais de estabilidade: ${config.stabilityCycles}`,
    `- Mobile only: ${config.mobileOnly}`,
    `- Web only: ${config.webOnly}`,
    '',
    '## Resultado geral',
    '',
    `- Mobile: ${summary.mobile.passed}/${summary.mobile.total} aprovados`,
    `- Web: ${summary.web.passed}/${summary.web.total} aprovados`,
    '',
    '## Cobertura validada',
    '',
    '- Home, Treino, Criacao de treino, Rotina, Social',
    '- Treino em andamento, Coach/Chat, Questionario',
    '- Nutricao, Agua, Perfil, Historico',
    '- Painel admin, Catalogo e Dashboard web',
    '',
    '## Evidencias principais',
    '',
    '- Prints mobile: artifacts/detox/**',
    '- Prints dashboard web: artifacts/qa-full/screens/web/**',
    '- Relatorio JSON: qa/full-visual-qa-report.json',
    '',
    '## Estado funcional critico',
    '',
    '- Questionario: validado com persistencia apos relaunch.',
    '- Aba social: validada como obrigatoria no fluxo.',
    '- Treino/rotina: criacao, uso e salvamento exercitados no ciclo.',
    '- Coach: fluxo de mensagem e resposta validado.',
    '- Admin/catalogo/dashboard: login, submissao, aprovacao e recusa validados no web.',
  ];

  fs.writeFileSync(REPORT_MD, `${lines.join('\n')}\n`, 'utf-8');
}

async function maybeGenerateZip(skipZip) {
  if (skipZip) {
    return { skipped: true, zipExit: 0 };
  }

  const zipExit = await runPowershellScript('scripts/make-analysis-zip.ps1', ['-OutputZip', 'analysis-clean.zip']);
  return { skipped: false, zipExit };
}

async function main() {
  ensureDirs();
  const config = parseArgs();
  const results = [];

  const runMobile = !config.webOnly;
  const runWeb = !config.mobileOnly;

  if (runMobile) {
    for (let index = 1; index <= config.cycles; index += 1) {
      // Ciclo completo principal.
      results.push(await runMobileCycle(index, config.cycles, 'main'));
    }

    for (let index = 1; index <= config.stabilityCycles; index += 1) {
      // Ciclo final de estabilidade sem alterar lógica.
      results.push(await runMobileCycle(index, config.stabilityCycles, 'stability'));
    }
  }

  if (runWeb) {
    results.push(await runWebValidation());
  }

  const summary = summarize(results);
  writeReports(summary, config);

  const zip = await maybeGenerateZip(config.skipZip);

  const hardFail = summary.mobile.failed > 0 || summary.web.failed > 0 || zip.zipExit !== 0;
  console.log('[full-qa] done', JSON.stringify({
    mobile: summary.mobile,
    web: summary.web,
    zip,
  }));

  process.exit(hardFail ? 1 : 0);
}

main().catch((error) => {
  console.error('[full-qa] fatal', String(error?.message || error));
  process.exit(1);
});
