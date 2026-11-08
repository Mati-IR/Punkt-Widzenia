# Dataset v0.5.0: reliability fact-check sweep (PUN-9)

**Date:** 2026-11-08. **Scope:** the 26 reliability ratings marked "Ocena wstępna" in v0.4.0.
**Result:** 9 now cite an outlet-specific external source and are no longer provisional. 17 stay provisional with the new `"provisional": true` flag, because the sweep found no external record about them. The site build passes. The data is in the working tree, not committed (the repo has no commits yet).

## What I checked
- **KRRiT:** the 2025 annual report (Sejm print no. 2725, 29 May 2026), §2.1.4 and annex 2. It lists every penalty decision and warning by company. This was the most useful source by far.
- **Demagog, AFP Sprawdzam, FakeNews.pl:** they mostly check politicians and social media posts, not news outlets. Only two outlet-level items fell inside the 24-month window: Demagog on Republika (Nov 2024) and Demagog on headlines in right-wing media (Apr 2026).
- **Rada Etyki Mediów:** its 2026 statements concern TVP Info (not on our list of 26) and a Polsat entertainment show. None concern our 26. The old domain rem.org.pl no longer resolves.
- **Courts:** news searches, plus the annex to the KRRiT report that lists court rulings. The SAOS court database has no data after 2024, so I couldn't use it.

## The 9 outlets that now have an external source

| Outlet | Score change | Evidence |
|---|---|---|
| Telewizja Republika | none (factual 1, 3 mixed, still contested) | KRRiT 2025: 10 penalties (157.5k zł), 2 of them for hate speech (art. 18), plus 3 warnings on accuracy and objectivity. Demagog 2024: misleading claims, no corrections. |
| TVN24 | none (4 mixed) | KRRiT 2025: 1 formal penalty (unregistered YouTube channel, 20k zł) and 2 accuracy warnings to TVN. Courts overturned the "Siła kłamstwa" and "29 lat bezkarności" fines in 2026. |
| Polskie Radio | none (4 mixed) | KRRiT 2025: no penalties. 1 warning on protection of minors. |
| Radio ZET | none (4 mixed) | KRRiT 2025: no penalties. In March 2025 the Appeal Court upheld, in a final ruling, the cancellation of the 476k zł "disinformation" fine. |
| Radio Maryja | contested → **not contested** (4 mixed) | KRRiT 2025: no penalties or warnings. It was marked contested only because the review hadn't been done yet. |
| Radio Wnet | contested → **not contested** (4 mixed) | KRRiT 2025: no penalties or warnings. It was marked contested only because it had no external source. |
| **Super Express** | **factual 2 → 1, total 5 high → 4 mixed, contested** | KRRiT 2025: 109k zł penalty to Time S.A. (decision DMM-116/2025) for discriminatory content in "Nocna zmiana" on the Super Express YouTube channel, plus 1 accuracy warning for that channel. |
| Kanał Zero | none (4 mixed) | KRRiT 2025: 4 proceedings, no penalty and no warning. Court injunction (Nov 2025, upheld Apr 2026) in Wysocka-Schnepf's personal-rights suit. This is an interim measure, not a ruling on the merits. |
| Do Rzeczy | none (5 high) | Demagog, Apr 2026: headlines misrepresented its fact-checks. No false factual claims were shown. |

## The 17 that stay provisional
Fakt, Frontstory, Gazeta.pl, Gazeta Wyborcza, Interia, Klub Jagielloński, Krytyka Polityczna, Kultura Liberalna, Najwyższy Czas!, Newsweek Polska, OKO.press, Onet, Polityka, Radio 357, Rzeczpospolita, Tygodnik Powszechny, Wirtualna Polska.

I found no outlet-specific record inside the 24-month window from a fact-checker, KRRiT, REM or a court. The older cases I found are outside the window: the Onet/Brodacki ruling (final 2019), the Najwyższy Czas domain link in AFP and EU DisinfoLab work (2020), and the OKO.press SLAPP suits (2020). These outlets are print or online, so KRRiT doesn't cover them, and Polish fact-checkers don't rate outlets. The text of each rating is unchanged; I only removed the "Ocena wstępna" prefix, because the site badge now shows it.

## Super Express: 2026 ZKDP check
**Not completed.** I found no 2026 ZKDP circulation data in any search, and zkdp.pl now serves an unrelated lifestyle blog. ZKDP may have moved or stopped publishing. Super Express's `reach` field stays empty.

## Decisions I need from you
1. **The 17 with no record.** Should a documented search that found nothing count as the external basis? Options: (a) keep them provisional (current state, strictest reading of §1.1); (b) accept the documented negative search, publish the search log on the methodology page, and remove the flag; (c) use a different external source for print and online outlets, such as court registers checked by request or a reader-reported issues log.
2. **Super Express downgrade** (5 high → 4 mixed, contested). The methodology puts KRRiT penalties in the 0-point column, but this penalty was for discriminatory content, not for false information. Approve 1 point, keep 2, or apply 0?
3. **Republika:** keep factual 1 (contested) or move to 0? The evidence fits either score.

## Files
- `data/outlets/*.json` (26 records), `data/sources.json` (+3 sources), `data/meta.json` (0.5.0), `docs/DATASET.md`
- `research/reliability-sweep/notes.md` (raw notes) and `apply_v050.py` (the script that applied the changes)
