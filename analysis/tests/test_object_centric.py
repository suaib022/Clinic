from pathlib import Path

import pandas as pd

from flowq_analysis.object_centric import main, object_waits

FIXTURE = Path(__file__).parent / "fixtures" / "small.ocel.json"


def _rel(rows: list[tuple[str, str, int, str, str]]) -> pd.DataFrame:
    t0 = pd.Timestamp("2026-11-17 12:00", tz="UTC")
    return pd.DataFrame([{"ocel:eid": e, "ocel:activity": a, "ocel:timestamp": t0 + pd.Timedelta(minutes=m), "ocel:oid": o, "ocel:type": t}
                         for e, a, m, o, t in rows])


def test_wait_counts_from_rejoin() -> None:
    rel = _rel([("e1", "check_in", 0, "a1", "appointment"), ("e2", "skip", 5, "a1", "appointment"),
                ("e3", "rejoin", 20, "a1", "appointment"), ("e4", "consult_start", 30, "a1", "appointment"),
                ("e5", "lab_queue", 0, "q1", "lab_queue_item"), ("e6", "lab_call", 7, "q1", "lab_queue_item")])
    w = object_waits(rel).set_index("stage")
    assert w.loc["wait_for_doctor", "mean_min"] == 10
    assert w.loc["wait_at_lab_line", "mean_min"] == 7


def test_report_files(tmp_path: Path) -> None:
    main(["--ocel", str(FIXTURE), "--out", str(tmp_path)])
    types = pd.read_csv(tmp_path / "object_types.csv").set_index("object_type")
    assert {"patient", "appointment", "lab_order", "lab_queue_item"} <= set(types.index)
    pobj = pd.read_csv(tmp_path / "patient_objects.csv").set_index("object_type")
    assert 0 < pobj.loc["lab_queue_item", "share_of_patients"] <= 1
    assert (tmp_path / "ocdfg.png").exists() and (tmp_path / "object_waits.csv").exists()
