# RUNTIME QA CONTRACT

## Official States
- BOOTING
- INITIALIZING
- RESTORING_AUTH
- HYDRATING_STORES
- NAVIGATION_READY
- READY
- BACKGROUND
- RESTORING_FROM_BACKGROUND
- ERROR

## Mandatory Readiness Signals
- app_readiness_navigation_ready
- app_readiness_auth_resolved
- app_readiness_stores_hydrated
- app_readiness_splash_finished
- app_readiness_runtime_synchronized

## Mandatory Selectors
- app_root
- app_bootstrap_ready
- app_runtime_state_*

## Mandatory Metrics
- bootDurationMs
- navigationDurationMs
- hydrationDurationMs
- authRestoreDurationMs
- playerLoadDurationMs
- fullscreenTransitionDurationMs
- runtimeFpsApprox
- memorySnapshotsMb

## Health Events
- [RUNTIME_METRIC] metric=<name> durationMs=<ms>
- runtime transition history updates in QA health snapshot
- stall flags for boot/navigation/player
