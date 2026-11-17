"""Process-mining report for a flowq XES log.

Usage: python -m flowq_analysis.analyze --xes events.xes --out report/
Writes dfg.png, performance.png, stage_waits.csv, deviations.csv, variants.csv.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import pm4py

# Waiting stages: (name, from activity, to activity). Times are per patient, first "from" to the next "to" after it.
STAGES = [
    ("doctor_wait", "check_in", "consult_start"),
    ("walk_in_wait", "walk_in", "consult_start"),
    ("lab_wait", "lab_queue", "lab_call"),
    ("report_to_return", "report_ready", "return_queue"),
]
DEVIATIONS = ["skip", "rejoin", "no_show", "priority_set", "return_queue"]


def load(xes: Path) -> pd.DataFrame:
    df = pm4py.read_xes(str(xes))
    df = pm4py.format_dataframe(df, case_id="case:concept:name", activity_key="concept:name", timestamp_key="time:timestamp")
    return df.sort_values(["case:concept:name", "time:timestamp"])


def stage_waits(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for name, start, end in STAGES:
        mins = []
        for _, g in df.groupby("case:concept:name"):
            acts = list(zip(g["concept:name"], g["time:timestamp"]))
            for i, (a, t) in enumerate(acts):
                if a != start:
                    continue
                nxt = next((t2 for a2, t2 in acts[i + 1:] if a2 == end), None)
                if nxt is not None:
                    mins.append((nxt - t).total_seconds() / 60)
        s = pd.Series(mins, dtype=float)
        rows.append({"stage": name, "n": len(s), "mean_min": round(s.mean(), 2) if len(s) else None,
                     "p90_min": round(s.quantile(0.9), 2) if len(s) else None})
    return pd.DataFrame(rows, columns=["stage", "n", "mean_min", "p90_min"])


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xes", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    df = load(a.xes)

    dfg, start, end = pm4py.discover_dfg(df)
    pm4py.save_vis_dfg(dfg, start, end, str(a.out / "dfg.png"))
    pdfg, pstart, pend = pm4py.discover_performance_dfg(df)
    pm4py.save_vis_performance_dfg(pdfg, pstart, pend, str(a.out / "performance.png"))

    stage_waits(df).to_csv(a.out / "stage_waits.csv", index=False)
    counts = df["concept:name"].value_counts()
    pd.DataFrame({"activity": DEVIATIONS, "count": [int(counts.get(x, 0)) for x in DEVIATIONS]}).to_csv(a.out / "deviations.csv", index=False)
    variants = pm4py.get_variants(df)
    top = sorted(variants.items(), key=lambda kv: -(kv[1] if isinstance(kv[1], int) else len(kv[1])))[:10]
    pd.DataFrame([{"variant": " > ".join(v), "count": c if isinstance(c, int) else len(c)} for v, c in top]).to_csv(a.out / "variants.csv", index=False)
    print(f"{df['case:concept:name'].nunique()} cases, {len(df)} events -> {a.out}")


if __name__ == "__main__":
    main()
