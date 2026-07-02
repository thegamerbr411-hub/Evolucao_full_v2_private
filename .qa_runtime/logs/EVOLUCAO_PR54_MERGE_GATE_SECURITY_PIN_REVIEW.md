# EVOLUCAO PR54 Merge Gate — Security PIN Review

## Finding
- PIN_LITERAL_FOUND_MASKED in `.qa_runtime/scripts/hevy_ux_lote_d_real_device_read_only.ps1` (line 26, pre-sanitization)
- History exposure: commit `6110b34` on branch contained hardcoded PIN in same script

## Sanitization applied
- Removed all PIN literals from script
- Auto-unlock now uses `$env:EVO_DEVICE_UNLOCK_PIN` at runtime only
- Never logs or writes PIN value
- If env unset: `DEVICE_UNLOCK_PIN_NOT_AVAILABLE_SKIP_UNLOCK`
- If used: `DEVICE_UNLOCK_PIN_USED_MASKED` in manifest/log only
- Created `pr54_post_merge_real_device_read_only.cjs` with same env-var pattern (no hardcoded PIN)

## Scan results (post-sanitization)
| Scan | Result |
|------|--------|
| rg scripts for PIN literal | PASS — zero in `.qa_runtime/scripts/**` |
| rg generic risk (input text, UNLOCK_PIN) | PASS — only env-var references in sanitized scripts |
| handoff TO_CHATGPT.md | PASS — no PIN literal |
| Ready Gate ZIP | Not re-scanned byte-by-byte; script not in ZIP tree as literal after sanitization commit |
| artifacts sanitized | PASS for trackable merge paths |

## Merge strategy
**Squash merge required:** `gh pr merge 54 --squash --delete-branch=false`
- Reason: intermediate commit `6110b34` contained PIN; squash delivers clean final tree to main
- Merge commit / rebase prohibited

## Felipe recommendation
Rotate device PIN after this cycle (value appeared in branch/prompt during QA process).

## Verdict
PIN security gate: **PASS** (proceed to Gates A–G)
