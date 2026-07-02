# EVOLUCAO PR54 Merge Gate Plan

Source of truth: EVOLUCAO_HEVY_UX_LOTE_D_PR54_READY_GATE_COMPLETE
PR #54 OPEN Ready, head 297c6e5 + sanitization commit pending
Main before: d46ea45e9cdf19e4c7e2af604f0f186a67477876

## Tools
git, gh, node, npm, rg, adb, PowerShell Compress-Archive/Get-FileHash

## PIN strategy (Gate H0)
Sanitize script → env var EVO_DEVICE_UNLOCK_PIN → squash merge only

## Gates
H0 PIN → A Git → B Diff → C Visual → D Tests → E Audit → F Build → G Checks → H Final rg → I Squash merge → J Main → K Build → L Real device → M Sandbox optional → N Report → O Handoff → P ZIP → Q Security

## PowerShell
No Bash heredoc. Use `git commit -m "..."` and `--body-file`.

## Verdict target
EVOLUCAO_PR54_MERGED_MAIN_VALIDATED
