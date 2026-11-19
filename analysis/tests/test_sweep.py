from pathlib import Path

import numpy as np
import pandas as pd

from flowq_analysis.sweep import main


def test_sweep_report(tmp_path: Path) -> None:
    rng = np.random.default_rng(1)
    rows = []
    for value in ["6", "40"]:
        for seed in range(1, 31):
            base = rng.normal(100, 5)
            gap = 0.0 if value == "6" else 10.0  # routing only matters when the lab is busy
            rows.append(("lab.outsidePerHour", value, "routing", "engine", seed, "journey", "mean_min", base))
            rows.append(("lab.outsidePerHour", value, "routing", "random", seed, "journey", "mean_min", base + gap))
    p = tmp_path / "per_day.csv"
    pd.DataFrame(rows, columns=["param", "value", "kind", "policy", "seed", "stage", "metric", "metric_value"]).to_csv(p, index=False)
    main(["--per-day", str(p), "--out", str(tmp_path / "r")])
    t = pd.read_csv(tmp_path / "r" / "tests.csv", dtype={"value": str}).set_index("value")
    assert t.loc["6", "p_holm"] == 1.0
    assert t.loc["40", "advantage_mean"] == 10.0 and t.loc["40", "p_holm"] < 0.001
    assert (tmp_path / "r" / "routing_journey_mean_min.png").exists()
