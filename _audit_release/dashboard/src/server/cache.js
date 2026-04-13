function createTTLCache(defaultTtlMs = 5000) {
  const cache = new Map();

  function get(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(250, Number(ttlMs || defaultTtlMs)),
    });
  }

  function clear(prefix = '') {
    if (!prefix) {
      cache.clear();
      return;
    }

    for (const key of cache.keys()) {
      if (String(key).startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  return {
    clear,
    get,
    set,
  };
}

module.exports = {
  createTTLCache,
};
