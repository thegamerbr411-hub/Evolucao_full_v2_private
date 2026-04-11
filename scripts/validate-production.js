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
  if (fs.existsSync(renderYaml)) {
    renderKeys = parseRenderEnvKeys(fs.readFileSync(renderYaml, 'utf-8'));
  } else {
    warnings.push('missing_render_yaml');
  }

  const requiredForProd = [
    'JWT_SECRET',
    'CLIENT_API_KEYS',
  ];

  requiredForProd.forEach((key) => {
    checkEnv(key, errors, warnings, { required: true });
  });

  const hasAdminUser = Boolean(String(process.env.ADMIN_USER || process.env.ADMIN_EMAIL || '').trim());
  const hasAdminPass = Boolean(String(process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || '').trim());
  if (!hasAdminUser) {
    errors.push('missing_admin_identity:ADMIN_USER|ADMIN_EMAIL');
  }
  if (!hasAdminPass) {
    errors.push('missing_admin_password:ADMIN_PASS|ADMIN_PASSWORD');
  }

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
