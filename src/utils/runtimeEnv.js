/**
 * Detect Node pure test runs (node --test) without loading React Native.
 * Does not affect Expo / Metro / device runtime.
 */
export function isNodePureTest() {
  if (typeof process === 'undefined') {
    return false;
  }
  if (String(process.env.EVOLUCAO_NODE_TEST_RUNNER || '') === '1') {
    return true;
  }
  if (String(process.env.NODE_ENV || '') === 'test') {
    return true;
  }
  const argv = Array.isArray(process.argv) ? process.argv : [];
  if (argv.includes('--test')) {
    return true;
  }
  return false;
}

export function createAsyncStorageStub() {
  const noop = async () => {};
  const nullItem = async () => null;
  return {
    getItem: nullItem,
    setItem: noop,
    removeItem: noop,
    mergeItem: noop,
    clear: noop,
    getAllKeys: async () => [],
    multiGet: async (keys) => (Array.isArray(keys) ? keys : []).map((key) => [key, null]),
    multiSet: noop,
    multiRemove: noop,
  };
}
