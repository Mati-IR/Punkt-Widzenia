# Content sample codebook (methodology §3.3) – dataset v1.1

Window: 5–27 Oct 2026 (10 sample days drawn within 4 consecutive weeks, 5 Oct – 1 Nov).
Sample days: 5, 7, 12, 14, 15, 17, 18, 19, 22, 27 Oct. Snapshot target 10:00 Warsaw time (±6 h).

## Pipeline
1. `collect_leads.py` – archived homepage (Wayback Machine) per outlet per day → up to 25 headline candidates → `leads_raw.json`.
2. `select_items.py` – fixed selection rule (see script docstring) → `items.json` (10 leads + 10 comparative per outlet).
3. Hand coding → `coding/<outlet-id>.json`, one record per item.
4. `aggregate.py` → per-outlet shares → compared with §3 thresholds.

Radio/TV brands are sampled via their news website homepage (the URL in the dataset), the same rule for all.

## Fields per item
- `topic`: budget-taxes | rule-of-law | migration | eu | current-dispute | other-domestic | foreign | non-political
- `toneGov`: + / 0 / − / na – tone towards the governing coalition (KO, PSL, Polska 2050, Lewica, Tusk government, ministers)
- `toneOpp`: + / 0 / − / na – tone towards the opposition (PiS, Konfederacja, their leaders). President Nawrocki is coded as opposition-aligned when a story frames a government–president dispute.
- `headline`: pro-gov | neutral | pro-opp | na – overall direction of the headline as written.
- `note`: one line, required when tone ≠ 0.

## Coding rules
- The unit is the **headline as published on the homepage** (plus standfirst where captured). We code the outlet's own framing, not the quoted speaker's view: a quote headline counts as one-sided only if the outlet selects or frames it evaluatively (scare quotes, loaded verbs, labels such as "reżim", "afera Tuska", "pisowski").
- Pure reporting of an event that is bad for one side ("Sejm odrzucił projekt PiS") = `0`.
- `pro-gov` = positive to the government **or** negative to the opposition, with nothing the other way; `pro-opp` vice versa.
- Non-political items: `na`, excluded from shares.

## Aggregation (per outlet)
- Political items P = items with headline ≠ na.
- One-sided share = max(pro-gov, pro-opp) / P; direction = the larger side.
- §3 thresholds: "aligned" ≥ 2/3 one-sided **plus** a structural/audience indicator (from the existing external sources); "leans" = predominantly one-sided (> 50% of P, and the opposite side ≤ 1/4 of the one-sided count); otherwise "independent / mixed".
- Minimum P for a conclusion: 10. Below that → rating stays as is, `contested` kept, reason recorded.

## Clearing `contested`
Clear only when the sample result falls on the **same value** as the external-source rating. If the sample differs by one step or more → keep `contested`, flag for founder review with both results. Never change a published value without founder approval.

## Known limits
- Headline-level coding, not full-text reading; tone of body text and guest selection not captured.
- Single coder (no inter-coder reliability check); 20 % re-check by a second pass planned before release.
