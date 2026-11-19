import json
from pathlib import Path

import pandas as pd

from flowq_analysis.robustness import table


def test_table(tmp_path: Path) -> None:
    rep = tmp_path / "sweep-x" / "report"
    rep.mkdir(parents=True)
    (tmp_path / "sweep-x" / "sweep.json").write_text(json.dumps({"param": "patients.noShowP"}))
    s = []
    for value, eng in [("0.1", 7.0), ("0.35", 9.0)]:
        for policy, mae, w5, cov in [("engine", eng, 0.5, 0.8), ("history_mean", 8.0, 0.4, None), ("position_slot", 8.5, 0.3, None)]:
            s.append(dict(kind="eta", value=value, stage="doctor", metric="mae", policy=policy, mean=mae))
            s.append(dict(kind="eta", value=value, stage="doctor", metric="within5", policy=policy, mean=w5))
            if cov is not None:
                s.append(dict(kind="eta", value=value, stage="doctor", metric="coverage", policy=policy, mean=cov))
    pd.DataFrame(s).to_csv(rep / "summary.csv", index=False)
    pd.DataFrame([dict(kind="eta", value=v, stage="doctor", metric="mae", compared_to="history_mean", advantage_mean=a, ci_low=a - 0.1, ci_high=a + 0.1, p_holm=0.001)
                  for v, a in [("0.1", 1.0), ("0.35", -1.0)]]).to_csv(rep / "tests.csv", index=False)
    df = table([rep]).set_index("value")
    assert df.loc["0.1", "engine_wins_mae"] and not df.loc["0.35", "engine_wins_mae"]
    assert df.loc["0.35", "best_baseline"] == "history_mean" and df.loc["0.1", "param"] == "patients.noShowP"
