from pathlib import Path

import numpy as np
import pandas as pd

from flowq_analysis.stats import holm, main


def _per_day(tmp: Path) -> Path:
    rng = np.random.default_rng(0)
    rows = []
    for seed in range(1, 41):
        base = rng.normal(8, 1)
        engine = base + rng.normal(0, 0.1)
        rows.append(("engine", seed, "engine", "doctor", "mae", engine))
        rows.append(("engine", seed, "history_mean", "doctor", "mae", engine + 2.0 + rng.normal(0, 0.1)))
        rows.append(("engine", seed, "position_slot", "doctor", "mae", engine))  # identical: no difference at all
        for route, shift in [("engine", 0.0), ("random", 5.0)]:
            rows.append((route, seed, None, "journey", "mean_min", 150 + shift + rng.normal(0, 1)))
    p = tmp / "per_day.csv"
    pd.DataFrame(rows, columns=["route", "seed", "policy", "stage", "metric", "value"]).to_csv(p, index=False)
    return p


def test_detects_real_difference_and_not_a_fake_one(tmp_path: Path) -> None:
    main(["--per-day", str(_per_day(tmp_path)), "--out", str(tmp_path / "s")])
    t = pd.read_csv(tmp_path / "s" / "eta_tests.csv").set_index("compared_to")
    assert t.loc["history_mean", "p_holm"] < 0.001 and t.loc["history_mean", "ci_low"] > 1.5
    assert t.loc["position_slot", "p_holm"] == 1.0 and t.loc["position_slot", "advantage_mean"] == 0
    r = pd.read_csv(tmp_path / "s" / "routing_tests.csv").set_index("compared_to")
    assert r.loc["random", "advantage_mean"] > 4
    assert (tmp_path / "s" / "stats.md").read_text().startswith("Positive advantage")


def test_holm_is_monotone_and_capped() -> None:
    assert holm([0.01, 0.04, 0.03]) == [0.03, 0.06, 0.06]
    assert max(holm([0.9, 0.8])) <= 1.0
