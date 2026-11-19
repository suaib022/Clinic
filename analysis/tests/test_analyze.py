from pathlib import Path

import pandas as pd

from flowq_analysis.analyze import main

FIXTURE = Path(__file__).parent / "fixtures" / "small.xes"


def test_outputs_written(tmp_path: Path) -> None:
    main(["--xes", str(FIXTURE), "--out", str(tmp_path)])
    for f in ["dfg.png", "performance.png", "stage_waits.csv", "deviations.csv", "variants.csv"]:
        assert (tmp_path / f).exists(), f
    waits = pd.read_csv(tmp_path / "stage_waits.csv")
    assert list(waits.columns) == ["stage", "n", "mean_min", "p90_min"]
    assert waits.loc[waits.stage == "doctor_wait", "n"].item() > 0
