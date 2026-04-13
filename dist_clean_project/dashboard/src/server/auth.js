const jwt = require('jsonwebtoken');
const { normalizeClientId } = require('./storage');

const QA_LOCAL_HEADER = 'x-qa-local';
const QA_CLIENT_ID_HEADER = 'x-qa-client-id';
const QA_LOCAL_SECRET_HEADER = 'x-qa-secret';

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function createAuth(config = {}) {
  const secret = String(config.secret || 'supersecret');
  const adminUser = String(config.adminUser || 'admin').trim();
  const adminPass = String(config.adminPass || '123456').trim();
  const hasAdminConfig = Boolean(String(config.adminUser || '').trim()) && Boolean(String(config.adminPass || '').trim());
  const defaultClientId = normalizeClientId(config.defaultClientId || 'default');
  const clientKeyMap = parseClientKeyMap(config.clientKeyMap);
  const allowQaLocalBypass = parseBoolean(
    config.allowQaLocalBypass,
    String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'production'
  );
  const qaLocalSecret = String(config.qaLocalSecret || process.env.QA_LOCAL_SECRET || '').trim();

  function parseClientKeyMap(rawValue) {
    if (!rawValue) {
      return {};
    }

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      return rawValue;
    }

    try {
      const parsed = JSON.parse(String(rawValue));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function getQaClientId(req) {
    return normalizeClientId(req.headers[QA_CLIENT_ID_HEADER] || defaultClientId);
  }

  function isLocalQaRequest(req) {
    if (!allowQaLocalBypass) {
      return false;
    }

    const qaLocal = String(req.headers[QA_LOCAL_HEADER] || '').trim().toLowerCase();
    if (!['1', 'true', 'yes', 'on'].includes(qaLocal)) {
      return false;
    }

    if (!qaLocalSecret) {
      return true;
    }

    return String(req.headers[QA_LOCAL_SECRET_HEADER] || '').trim() === qaLocalSecret;
  }

  function applyLocalQaAuth(req) {
    if (!isLocalQaRequest(req)) {
      return false;
    }

    const clientId = getQaClientId(req);
    req.auth = {
      role: 'qa-local',
      clientId,
    };
    req.clientId = clientId;
    req.isQaLocal = true;
    return true;
  }

  function extractBearerToken(req, errorCode) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: { ok: false, error: errorCode } };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return { error: { ok: false, error: errorCode } };
    }

    return { token };
  }

  function verifyJwtToken(token, errorCode) {
    try {
      return { decoded: jwt.verify(token, secret) };
    } catch {
      return { error: { ok: false, error: errorCode } };
    }
  }

  function issueAdminToken() {
    const payload = {
      user: adminUser,
      role: 'admin',
      clientId: 'admin',
    };
    return jwt.sign(payload, secret, { expiresIn: '6h' });
  }

  function issueClientToken(clientId) {
    return jwt.sign(
      {
        role: 'client',
        clientId: normalizeClientId(clientId),
      },
      secret,
      { expiresIn: '7d' }
    );
  }

  function validateJWT(req, res, next) {
    if (applyLocalQaAuth(req)) {
      return next();
    }

    const extracted = extractBearerToken(req, 'unauthorized_client');
    if (extracted.error) {
      return res.status(401).json(extracted.error);
    }

    const verified = verifyJwtToken(extracted.token, 'unauthorized_client');
    if (verified.error) {
      return res.status(401).json(verified.error);
    }

    req.auth = verified.decoded;
    if (verified.decoded?.clientId) {
      req.clientId = normalizeClientId(verified.decoded.clientId);
    }
    return next();
  }

  function validateClient(req, res, next) {
    if (req.isQaLocal && req.clientId) {
      return next();
    }

    const apiKey = String(req.headers['x-api-key'] || '').trim();
    const jwtClientId = normalizeClientId(req.auth?.clientId || defaultClientId);
    const isClientJwt = req.auth?.role === 'client' && Boolean(req.auth?.clientId);
    const isAdminJwt = req.auth?.role === 'admin';

    // Permite token admin + x-api-key válido para facilitar automação
    if (isAdminJwt && apiKey) {
      const mappedClientId = Object.entries(clientKeyMap).find(([, value]) => String(value) === apiKey)?.[0];
      if (!mappedClientId) {
        return res.status(401).json({ ok: false, error: 'unauthorized_client' });
      }
      req.clientId = normalizeClientId(mappedClientId);
      return next();
    }

    if (isClientJwt && !apiKey) {
      req.clientId = jwtClientId;
      return next();
    }

    if (isClientJwt && apiKey) {
      const mappedClientId = Object.entries(clientKeyMap).find(([, value]) => String(value) === apiKey)?.[0];
      if (!mappedClientId) {
        return res.status(401).json({ ok: false, error: 'unauthorized_client' });
      }

      const normalizedMappedClientId = normalizeClientId(mappedClientId);
      if (normalizedMappedClientId !== jwtClientId) {
        return res.status(401).json({ ok: false, error: 'unauthorized_client' });
      }

      req.clientId = normalizedMappedClientId;
      return next();
    }

    if (!apiKey) {
      return res.status(401).json({ ok: false, error: 'missing_api_key' });
    }

    const clientId = Object.entries(clientKeyMap).find(([, value]) => String(value) === apiKey)?.[0];

    if (!clientId) {
      return res.status(401).json({ ok: false, error: 'unauthorized_client' });
    }

    req.clientId = normalizeClientId(clientId || defaultClientId);
    return next();
  }

  function authenticateAdmin(req, res, next) {
    const extracted = extractBearerToken(req, 'unauthorized_admin');
    if (extracted.error) {
      return res.status(401).json(extracted.error);
    }

    const verified = verifyJwtToken(extracted.token, 'unauthorized_admin');
    if (verified.error) {
      return res.status(401).json(verified.error);
    }

    const decoded = verified.decoded;
    if (decoded.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'unauthorized_admin' });
    }

    req.auth = decoded;
    return next();
  }

  function authenticateClient(req, res, next) {
    return validateJWT(req, res, () => validateClient(req, res, next));
  }

  function handleLogin(req, res) {
    if (!hasAdminConfig) {
      return res.status(503).json({ ok: false, error: 'admin_credentials_not_configured' });
    }

    const username = String(req.body?.user || req.body?.email || '').trim();
    const password = String(req.body?.pass || req.body?.password || '').trim();

    const valid = (username === adminUser && password === adminPass);

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }

    const token = issueAdminToken();
    return res.json({ ok: true, token });
  }

  function handleClientToken(req, res) {
    const requestedClientId = normalizeClientId(req.body?.clientId || defaultClientId);
    const token = issueClientToken(requestedClientId);
    return res.json({ ok: true, token, clientId: requestedClientId });
  }

  return {
    QA_CLIENT_ID_HEADER,
    QA_LOCAL_HEADER,
    authenticateAdmin,
    authenticateClient,
    handleClientToken,
    handleLogin,
    isLocalQaRequest,
    validateClient,
    validateJWT,
  };
}

module.exports = {
  QA_CLIENT_ID_HEADER,
  QA_LOCAL_HEADER,
  createAuth,
};
