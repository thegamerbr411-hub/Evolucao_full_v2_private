const fs = require('fs');
const path = require('path');

const { ROOT, parseCsv, readJson } = require('./shared');

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'controlled-loop.config.json');

const DEFAULTS = {
  cycles: 1,
  detoxConfiguration: 'android.attached.debug',
  androidPackage: 'com.tipolt.evolucaofullv2',
  mainActivity: '.MainActivity',
  captureTests: [
    'e2e/14-full-visual-functional.e2e.js',
    'e2e/18-visual-map-audit.e2e.js',
  ],
  functionalTests: [
    'e2e/14-full-visual-functional.e2e.js',
    'e2e/17-social-tab-smoke.e2e.js',
  ],
  improveCommands: [],
  stopOnImproveFailure: true,
  cleanupRawImages: true,
  cleanupDetoxRoot: false,
  outputRoot: path.join(ROOT, 'artifacts', 'controlled-loop'),
};

function parseBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(normalized);
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    improveCommands: [],
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    if (raw.startsWith('--cycles=')) {
      args.cycles = Math.max(1, Number(raw.split('=')[1] || 1));
      continue;
    }

    if (raw.startsWith('--configuration=')) {
      args.detoxConfiguration = String(raw.split('=')[1] || '').trim();
      continue;
    }

    if (raw.startsWith('--device=')) {
      args.adbSerial = String(raw.split('=')[1] || '').trim();
      continue;
    }

    if (raw.startsWith('--capture-tests=')) {
      args.captureTests = parseCsv(raw.split('=')[1]);
      continue;
    }

    if (raw.startsWith('--functional-tests=')) {
      args.functionalTests = parseCsv(raw.split('=')[1]);
      continue;
    }

    if (raw.startsWith('--improve-cmd=')) {
      const commandLine = String(raw.split('=')[1] || '').trim();
      if (commandLine) args.improveCommands.push(commandLine);
      continue;
    }

    if (raw.startsWith('--config=')) {
      args.configPath = String(raw.split('=')[1] || '').trim();
      continue;
    }

    if (raw.startsWith('--android-package=')) {
      args.androidPackage = String(raw.split('=')[1] || '').trim();
      continue;
    }

    if (raw.startsWith('--main-activity=')) {
      args.mainActivity = String(raw.split('=')[1] || '').trim();
      continue;
    }

    if (raw.startsWith('--cleanup-images=')) {
      args.cleanupRawImages = parseBool(raw.split('=')[1], true);
      continue;
    }

    if (raw.startsWith('--cleanup-detox-root=')) {
      args.cleanupDetoxRoot = parseBool(raw.split('=')[1], false);
      continue;
    }
  }

  return args;
}

function resolveVersionFromAppJson() {
  const appJsonPath = path.join(ROOT, 'app.json');
  const appJson = readJson(appJsonPath, {});
  return String(appJson?.expo?.version || appJson?.expo?.extra?.appVersion || 'unknown');
}

function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const configPath = args.configPath
    ? path.resolve(ROOT, args.configPath)
    : DEFAULT_CONFIG_PATH;

  const fileConfig = fs.existsSync(configPath) ? readJson(configPath, {}) : {};

  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    ...args,
  };

  if (!Array.isArray(merged.improveCommands)) {
    merged.improveCommands = [];
  }

  if (Array.isArray(args.improveCommands) && args.improveCommands.length > 0) {
    merged.improveCommands = [...merged.improveCommands, ...args.improveCommands];
  }

  merged.cycles = Math.max(1, Number(merged.cycles || 1));
  merged.captureTests = Array.isArray(merged.captureTests) && merged.captureTests.length > 0
    ? merged.captureTests
    : DEFAULTS.captureTests;
  merged.functionalTests = Array.isArray(merged.functionalTests) && merged.functionalTests.length > 0
    ? merged.functionalTests
    : DEFAULTS.functionalTests;
  merged.cleanupRawImages = parseBool(merged.cleanupRawImages, true);
  merged.cleanupDetoxRoot = parseBool(merged.cleanupDetoxRoot, false);
  merged.stopOnImproveFailure = parseBool(merged.stopOnImproveFailure, true);
  merged.appVersion = resolveVersionFromAppJson();
  merged.configPath = configPath;

  return merged;
}

function printHelp() {
  const help = [
    'Uso: node qa/core/run-controlled-cycle.js [opcoes]',
    '',
    'Opcoes principais:',
    '  --cycles=3',
    '  --configuration=android.attached.debug',
    '  --device=ADB_SERIAL',
    '  --capture-tests=e2e/14-full-visual-functional.e2e.js,e2e/18-visual-map-audit.e2e.js',
    '  --functional-tests=e2e/14-full-visual-functional.e2e.js,e2e/17-social-tab-smoke.e2e.js',
    '  --improve-cmd="npm run test" (pode repetir)',
    '  --config=qa/core/controlled-loop.config.json',
    '  --cleanup-images=true|false',
    '  --cleanup-detox-root=true|false',
    '',
    'Regra aplicada pelo executor: se houver mudanca relevante, a validacao sempre ocorre em build nova instalada via ADB.',
  ];

  console.log(help.join('\n'));
}

module.exports = {
  loadConfig,
  parseArgs,
  printHelp,
};
