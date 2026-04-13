function createSlidingWindowLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const max = Math.max(1, Number(options.max || 120));
  const store = new Map();

  function cleanup(now) {
    for (const [key, value] of store.entries()) {
      if (now - value.windowStart > windowMs) {
        store.delete(key);
      }
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    const identity = String(options.getKey ? options.getKey(req) : req.ip || 'unknown');
    const bucket = store.get(identity);

    if (!bucket || now - bucket.windowStart > windowMs) {
      store.set(identity, { count: 1, windowStart: now });
      if (store.size > 5000) cleanup(now);
      return next();
    }

    if (bucket.count >= max) {
      return res.status(429).json({
        ok: false,
        error: 'rate_limited',
      });
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = {
  createSlidingWindowLimiter,
};
