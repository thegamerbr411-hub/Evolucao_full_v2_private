const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const renderYaml = path.join(root, 'render.yaml');

function parseRenderEnvKeys(content) {
  const keys = [];
  const lines = String(content || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('- key:')) {
      keys.push(line.replace('- key:', '').trim());
    }
  }
  return keys;
}

function parseRenderEnvMap(content) {
  const map = {};
  const lines = String(content || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('- key:')) {
      continue;
    }

    const key = line.replace('- key:', '').trim();
    const next = String(lines[i + 1] || '').trim();
    if (next.startsWith('value:')) {
      const raw = next.replace('value:', '').trim();
      map[key] = raw.replace(/^['\"]|['\"]$/g, '');
    } else {
      map[key] = '';
    }
  }
  return map;
}

function checkEnv(name, errors, warnings, { required = false, allowPlaceholder = false } = {}) {
  const raw = process.env[name];
  const value = String(raw || '').trim();

  if (required && !value) {
    errors.push(`missing_env:${name}`);
    return;
  }

  if (!value) {
    return;
  }

  if (!allowPlaceholder && /changeme|example|test|123456|secret/i.test(value)) {
    warnings.push(`weak_env_value:${name}`);
  }
}

function main() {
  const errors = [];
  const warnings = [];

  let renderKeys = [];
  let renderEnvMap = {};
  if (fs.existsSync(renderYaml)) {
    const raw = fs.readFileSync(renderYaml, 'utf-8');
    renderKeys = parseRenderEnvKeys(raw);
    renderEnvMap = parseRenderEnvMap(raw);
  } else {
    warnings.push('missing_render_yaml');
  }

  const requiredForProd = [
    'JWT_SECRET',
    'CLIENT_API_KEYS',
  ];

  requiredForProd.forEach((key) => {
    const shellValue = String(process.env[key] || '').trim();
    const renderValue = String(renderEnvMap[key] || '').trim();

    if (!shellValue && !renderValue) {
      errors.push(`missing_env:${key}`);
      return;
    }

    if (!shellValue && renderValue) {
      warnings.push(`env_not_in_local_shell:${key}`);
    }

    checkEnv(key, errors, warnings, { required: false });
  });

  const hasAdminUser = Boolean(
    String(process.env.ADMIN_USER || process.env.ADMIN_EMAIL || renderEnvMap.ADMIN_USER || renderEnvMap.ADMIN_EMAIL || '').trim()
  );
  const hasAdminPass = Boolean(
    String(process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || renderEnvMap.ADMIN_PASS || renderEnvMap.ADMIN_PASSWORD || '').trim()
  );
  if (!hasAdminUser) {
    errors.push('missing_admin_identity:ADMIN_USER|ADMIN_EMAIL');
  }
  if (!hasAdminPass) {
    errors.push('missing_admin_password:ADMIN_PASS|ADMIN_PASSWORD');
  }

  const weakRenderKeys = ['ADMIN_PASS', 'JWT_SECRET', 'CLIENT_API_KEYS', 'APP_API_KEY'];
  weakRenderKeys.forEach((key) => {
    const value = String(renderEnvMap[key] || '').trim();
    if (value && /changeme|example|test|123456|super_secret|secret/i.test(value)) {
      if (key === 'JWT_SECRET' || key === 'CLIENT_API_KEYS' || key === 'APP_API_KEY') {
        errors.push(`weak_render_value_blocking:${key}`);
      } else {
        warnings.push(`weak_render_value:${key}`);
      }
    }
  });

  checkEnv('ENABLE_QA_LOCAL_BYPASS', errors, warnings, { required: false, allowPlaceholder: true });
  if (String(process.env.ENABLE_QA_LOCAL_BYPASS || '').trim() === '1') {
    warnings.push('qa_local_bypass_enabled_in_runtime');
  }

  if (process.env.REDIS_URL || process.env.QUEUE_REDIS_URL) {
    checkEnv(process.env.REDIS_URL ? 'REDIS_URL' : 'QUEUE_REDIS_URL', errors, warnings, { required: false });
  } else {
    warnings.push('redis_not_configured_optional');
  }

  const report = {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    renderEnvKeys: renderKeys,
    renderEnvMap,
    requiredForProd,
    errors,
    warnings,
  };

  const out = path.join(root, 'artifacts', 'production-check.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[prod-check] ok=${report.ok} errors=${errors.length} warnings=${warnings.length}`);
  if (errors.length) {
    errors.forEach((item) => console.error(`[prod-check][error] ${item}`));
    process.exit(1);
  }

  warnings.forEach((item) => console.log(`[prod-check][warn] ${item}`));
}

main();
