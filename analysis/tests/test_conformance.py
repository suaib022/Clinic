from pathlib import Path

import pandas as pd
import pm4py

from flowq_analysis.conformance import check, main

FIXTURE = Path(__file__).parent / "fixtures" / "journeys.xes"


def _log(traces: dict[str, list[str]]) -> pd.DataFrame:
    rows = []
    for case, acts in traces.items():
        for i, a in enumerate(acts):
            rows.append({"case:concept:name": case, "concept:name": a, "time:timestamp": pd.Timestamp("2026-11-17 12:00", tz="UTC") + pd.Timedelta(minutes=i)})
    return pm4py.format_dataframe(pd.DataFrame(rows), case_id="case:concept:name", activity_key="concept:name", timestamp_key="time:timestamp")


def test_intended_journeys_fit_perfectly() -> None:
    summary, dev, _ = check(_log({
        "booked": ["book", "check_in", "call", "consult_start", "consult_end"],
        "walkin_lab": ["walk_in", "call", "consult_start", "consult_end", "lab_order", "lab_queue", "lab_call", "sample_collected", "report_ready"],
        "two_lines_review": ["book", "check_in", "call", "consult_start", "consult_end", "lab_order", "lab_queue", "lab_call", "sample_collected",
                             "report_ready", "lab_queue", "lab_call", "sample_collected", "report_ready",
                             "return_queue", "call", "consult_start", "consult_end"],
        "no_show": ["book", "no_show"],
        "test_only": ["lab_order", "lab_queue", "lab_call", "sample_collected", "report_ready"],
        "order_later": ["book", "check_in", "call", "consult_start", "consult_end", "lab_order"],
    }))
    assert summary["share_fitting"] == 1.0 and summary["log_moves"] == 0 and summary["model_moves"] == 0


def test_staff_deviations_show_as_log_moves() -> None:
    summary, dev, _ = check(_log({
        "skipped": ["book", "check_in", "skip", "rejoin", "call", "consult_start", "consult_end"],
        "undo": ["book", "check_in", "call", "undo", "call", "consult_start", "consult_end"],
    }))
    moves = dict(zip(dev[dev.kind == "log_move"].activity, dev[dev.kind == "log_move"]["count"]))
    assert moves.get("skip") == 1 and moves.get("rejoin") == 1 and moves.get("undo") == 1
    assert summary["share_fitting"] == 0.0


def test_missing_step_shows_as_model_move() -> None:
    _, dev, _ = check(_log({"no_check_in": ["book", "call", "consult_start", "consult_end"]}))
    assert "check_in" in set(dev[dev.kind == "model_move"].activity)


def test_report_files(tmp_path: Path) -> None:
    main(["--xes", str(FIXTURE), "--out", str(tmp_path)])
    s = pd.read_csv(tmp_path / "conformance_summary.csv")
    assert 0 < s.mean_fitness.item() <= 1
    for f in ["deviations.csv", "trace_fitness.csv", "normative_model.png"]:
        assert (tmp_path / f).exists()
