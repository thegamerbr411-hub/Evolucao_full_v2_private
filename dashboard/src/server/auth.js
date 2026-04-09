const jwt = require('jsonwebtoken');
const { normalizeClientId } = require('./storage');

function createAuth(config = {}) {
  const secret = String(config.secret || 'supersecret');
  const adminUser = String(config.adminUser || 'admin');
  const adminPass = String(config.adminPass || '123456');
  const defaultClientId = normalizeClientId(config.defaultClientId || 'default');

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
      user: 'admin',
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
    const extracted = extractBearerToken(req, 'unauthorized_client');
    if (extracted.error) {
      return res.status(401).json(extracted.error);
    }

    const verified = verifyJwtToken(extracted.token, 'unauthorized_client');
    if (verified.error) {
      return res.status(401).json(verified.error);
    }

    const decoded = verified.decoded;
    const headerClientId = normalizeClientId(req.headers['x-client-id'] || '');

    if (!headerClientId || decoded.role !== 'client' || normalizeClientId(decoded.clientId) !== headerClientId) {
      return res.status(401).json({ ok: false, error: 'unauthorized_client' });
    }

    req.auth = decoded;
    req.clientId = headerClientId;
    return next();
  }

  function handleLogin(req, res) {
    const user = String(req.body?.user || '').trim();
    const pass = String(req.body?.pass || '').trim();

    if (user !== adminUser || pass !== adminPass) {
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
    authenticateAdmin,
    authenticateClient,
    handleClientToken,
    handleLogin,
  };
}

module.exports = {
  createAuth,
};
