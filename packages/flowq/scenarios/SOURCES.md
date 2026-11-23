# Scenario parameter sources

Every value in `default.json` is tagged in its `sources` block as **[cited]** (taken directly from a study),
**[derived]** (computed from a study's numbers; the computation is stated), or **[assumption]** (no published
value found; covered by the sensitivity sweep). `busy-lab.json` is the same scenario with a heavier lab load.

| Parameter | Value | Kind | Source |
|---|---|---|---|
| Consultation length (median, CV) | 8.2 min, 0.49 | derived | Das MC, Zakaria M, Cheng F, Xu J. Appointment length with patients in medical consultations in Bangladesh: a hospital-based cross-sectional study. *Healthcare* 2021;9(9):1164. doi:10.3390/healthcare9091164. Mean 9.10 min, SD 4.44, n = 763. Log-normal median = mean/√(1+CV²). |
| Very short consultations (sensitivity) | 0.8 min | cited | Irving G, et al. International variations in primary care physician consultation time: a systematic review of 67 countries. *BMJ Open* 2017;7:e017902. doi:10.1136/bmjopen-2017-017902 (Bangladesh: 48 s). |
| Patient arrival vs slot (mean, SD) | −10 min, 10 min | derived | Cerruti S, Garavaldi D, Lerario A. Patient's punctuality in an outpatient clinic: the role of age, medical branch and geographical factors. *BMC Health Serv Res* 2023;23:1385. doi:10.1186/s12913-023-10379-w. 84.4% early, mostly within ±15 min (n = 410,808). |
| No-show probability | 0.23 | cited | Dantas LF, Fleck JL, Cyrino Oliveira FL, Hamacher S. No-shows in appointment scheduling – a systematic literature review. *Health Policy* 2018;122(4):412–421. doi:10.1016/j.healthpol.2018.02.002 (average ≈23%, by continent 13.2–43.0%). |
| Blood collection time per patient | 3.3 min (CV 0.2) | cited / derived | Toomukuntla S, et al. *Cureus* 2023;15(8):e43323. doi:10.7759/cureus.43323. Registration 1.1 min + phlebotomy 2.2 min, n = 1,200. |
| Blood report turnaround (median, CV) | 150 min, 0.5 | derived | Lockhat Y, et al. In-depth investigation of turn-around time of full blood count tests requested from a clinical haematology outpatient department in Cape Town, South Africa. *Afr J Lab Med* 2021;10(1):1318. doi:10.4102/ajlm.v10i1.1318. Collection→registration median 96 min + intra-lab median 55 min. |
| X-ray time per patient | 4 min | assumption | Order of magnitude from Reiner BI, et al. *Radiology* 2005;236(2):413–419. doi:10.1148/radiol.2362040671 (exact figure not verified). |
| Walk-ins, emergencies, doctor late start, pauses, ECG/urine times, test-order share, lab "now" share, same-day return willingness, line shares | see `default.json` | assumption | No published value for Bangladesh private chambers; swept in the sensitivity analysis. |

Note on the author list for Lockhat et al. 2021: verify the full author list against the article before citing.

## `hospitalopd.json`: calibrated from a real outpatient event log

Same scenario as `default.json`, with these values replaced from the HospitalOPD event log (Batool, Mehmood, Zafar; Mendeley Data 2026, doi:10.17632/j2hd2239dr.1, CC BY 4.0; 49,912 appointments, 98 doctors, April 2024 to April 2026, a Pakistan-related hospital OPD). Each changed value is tagged `[derived]` in its `sources` block.

| Parameter | default | hospitalopd | How it was derived |
|---|---|---|---|
| `lab.orderP` | 0.35 | 0.20 | Share of appointments with a lab or imaging step (lab 12.8%, imaging 10.7%) |
| `lab.lines.blood.turnaroundMin` / `Cv` | 150 / 0.5 | 73 / 0.55 | Complete Blood Count, lab start to lab end (n = 3,750, p90 152 min) |
| `visits.newMedianMin` / `cv` | 8.2 / 0.49 | 9 / 0.85 | Gaps between one doctor's consecutive prescription start times on one day (n = 41,470) |

Limits: the log holds completed visits only, so no-show rate and arrival lateness cannot be checked. The visit values are a proxy, not a measured consultation time: the gaps include idle time, which inflates the spread. Urine turnaround was not changed (the log shows a very wide spread, probably result-entry time). The data comes from another country, not a Bangladesh chamber.
