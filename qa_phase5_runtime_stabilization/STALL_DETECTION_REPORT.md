# STALL DETECTION REPORT

Date: 2026-05-08T15:01:09.833Z

## Thresholds
- BOOT_STALL > 20s
- NAVIGATION_STALL > 10s
- PLAYER_STALL > 15s

## Detected Signatures
- boot stall signatures: 3
- navigation stall signatures: 0
- player stall signatures: 0
- detox idle spikes: 0

## Interpretation
- Stalls are considered unresolved while runtime synchronization signal is missing or delayed.
- Repeated Detox idle spikes indicate potential pending async tasks or navigation/runtime desync.
