const NODE_TEST_RUNNER =
  typeof process !== 'undefined' &&
  String(process.env.EVOLUCAO_NODE_TEST_RUNNER || '') === '1';

let runtimeModulePromise = null;

function loadRuntimeModule() {
  if (!runtimeModulePromise) {
    runtimeModulePromise = import('./logger.runtime.js');
  }
  return runtimeModulePromise;
}

export function logError(error, context = {}) {
  const safeContext = {
    screen: context?.screen || 'unknown',
    action: context?.action || context?.useCase || 'unknown_action',
    ...context,
  };

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('[ERROR]', {
      code: error?.code,
      message: error?.message,
      ...safeContext,
    });
  }

  if (NODE_TEST_RUNNER) {
    return;
  }

  void loadRuntimeModule().then(({ logErrorRuntime }) => {
    logErrorRuntime(error, safeContext);
  });
}

export function logEvent(name, data = {}) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[EVENT]', name, data);
  }

  if (NODE_TEST_RUNNER) {
    return;
  }

  void loadRuntimeModule().then(({ logEventRuntime }) => {
    logEventRuntime(name, data);
  });
}
