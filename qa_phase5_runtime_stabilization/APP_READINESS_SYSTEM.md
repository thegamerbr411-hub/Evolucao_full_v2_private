# APP READINESS SYSTEM

## Official Runtime States
- BOOTING
- INITIALIZING
- RESTORING_AUTH
- HYDRATING_STORES
- NAVIGATION_READY
- READY
- BACKGROUND
- RESTORING_FROM_BACKGROUND
- ERROR

## Readiness Flow
- appInitialized
- navigationReady
- authResolved
- storesHydrated
- splashFinished
- runtimeSynchronized (derived)

## Sync Helpers
- waitForAppReady()
- assertAppReady()
- waitForNavigationReady()
- waitForStoresHydrated()
- waitForAuthResolved()
- waitForRuntimeState()
- waitForNavigationIdle()
- waitForScreenStable()
- waitForPlayerReady()
- waitForNoPendingRequests()
