import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const BASELINE_FILE = join(ROOT, 'qa', 'baseline', 'features-baseline.json');
const ROOT_NAV_FILE = join(ROOT, 'src', 'navigation', 'RootNavigator.js');
const TABS_NAV_FILE = join(ROOT, 'src', 'navigation', 'MainTabs.js');
const SCREENS_DIR = join(ROOT, 'src', 'screens');

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));

function parseStackRoutes(source) {
  const routes = [];
  const regex = /<Stack\.Screen\s+name="([^"]+)"\s+component=\{([^}]+)\}/g;
  let match = regex.exec(source);
  while (match) {
    routes.push({ name: match[1], component: match[2].trim() });
    match = regex.exec(source);
  }
  return routes;
}

function parseTabRoutes(source) {
  const routes = [];
  const lines = source.split(/\r?\n/);
  let currentName = null;

  lines.forEach((line) => {
    const nameMatch = line.match(/name="([^"]+)"/);
    if (nameMatch) {
      currentName = nameMatch[1];
    }

    const componentMatch = line.match(/component=\{([^}]+)\}/);
    if (componentMatch && currentName) {
      routes.push({ name: currentName, component: componentMatch[1].trim() });
      currentName = null;
    }
  });

  return routes;
}

function parseImports(source) {
  const imports = new Map();
  const regex = /import\s+([A-Za-z0-9_]+)\s+from\s+'([^']+)'/g;
  let match = regex.exec(source);
  while (match) {
    imports.set(match[1], match[2]);
    match = regex.exec(source);
  }
  return imports;
}

function resolveModulePath(fromFile, modulePath) {
  const base = resolve(dirname(fromFile), modulePath);
  const candidates = [base, `${base}.js`, `${base}.ts`, `${base}.tsx`];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function collectNavigateTargets() {
  const files = readdirSync(SCREENS_DIR).filter((name) => name.endsWith('.js'));
  const targets = new Set();

  files.forEach((fileName) => {
    const source = readFileSync(join(SCREENS_DIR, fileName), 'utf-8');
    const regex = /navigation\.navigate\(\s*['"]([^'"]+)['"]/g;
    let match = regex.exec(source);
    while (match) {
      targets.add(match[1]);
      match = regex.exec(source);
    }
  });

  return [...targets].sort();
}

test('baseline de rotas registradas deve permanecer presente', () => {
  const rootSource = readFileSync(ROOT_NAV_FILE, 'utf-8');
  const tabsSource = readFileSync(TABS_NAV_FILE, 'utf-8');

  const stackNames = parseStackRoutes(rootSource).map((item) => item.name);
  const tabNames = parseTabRoutes(tabsSource).map((item) => item.name);

  baseline.navigation.stackRoutes.forEach((route) => {
    assert.ok(stackNames.includes(route), `rota de stack removida sem validacao: ${route}`);
  });

  baseline.navigation.tabRoutes.forEach((route) => {
    assert.ok(tabNames.includes(route), `rota de tab removida sem validacao: ${route}`);
  });
});

test('navegacao deve apontar apenas para rotas registradas ou debt conhecido', () => {
  const rootSource = readFileSync(ROOT_NAV_FILE, 'utf-8');
  const tabsSource = readFileSync(TABS_NAV_FILE, 'utf-8');

  const validRoutes = new Set([
    ...parseStackRoutes(rootSource).map((item) => item.name),
    ...parseTabRoutes(tabsSource).map((item) => item.name),
    ...(baseline.navigation.allowedUnresolvedNavigationTargets || []),
  ]);

  const targets = collectNavigateTargets();
  const unresolved = targets.filter((route) => !validRoutes.has(route));

  assert.deepEqual(
    unresolved,
    [],
    `targets sem rota registrada: ${unresolved.join(', ')}`
  );
});

test('tabs principais devem manter marcador de renderizacao', () => {
  const tabsSource = readFileSync(TABS_NAV_FILE, 'utf-8');
  const imports = parseImports(tabsSource);
  const routes = parseTabRoutes(tabsSource);

  Object.entries(baseline.navigation.tabScreenMarkers || {}).forEach(([routeName, marker]) => {
    const route = routes.find((item) => item.name === routeName);
    assert.ok(route, `tab nao encontrada: ${routeName}`);

    const modulePath = imports.get(route.component);
    assert.ok(modulePath, `import nao encontrado para componente da tab ${routeName}`);

    const resolved = resolveModulePath(TABS_NAV_FILE, modulePath);
    assert.ok(resolved, `arquivo da tab nao resolvido para ${routeName}: ${modulePath}`);

    const source = readFileSync(resolved, 'utf-8');
    assert.ok(
      source.includes(marker),
      `marcador de renderizacao ausente em ${routeName}: ${marker}`
    );
  });
});

test('integracao service <-> backend deve manter endpoints base', () => {
  const serverSource = readFileSync(join(ROOT, baseline.integration.serverFile), 'utf-8');

  (baseline.integration.requiredServerEndpoints || []).forEach((endpoint) => {
    assert.ok(
      serverSource.includes(endpoint),
      `endpoint ausente no backend: ${endpoint}`
    );
  });

  (baseline.integration.serviceEndpointContracts || []).forEach((contract) => {
    const serviceSource = readFileSync(join(ROOT, contract.file), 'utf-8');
    (contract.endpoints || []).forEach((endpoint) => {
      assert.ok(
        serviceSource.includes(endpoint),
        `endpoint ausente no service ${contract.file}: ${endpoint}`
      );
    });
  });
});

