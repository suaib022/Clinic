"""Conformance checking of patient journeys against the intended outpatient process.

The intended (normative) process is written as a process tree (pm4py notation) and converted to a Petri net.
Alignments then show, per patient, where the real journey departs from it:
  * log moves  = something happened that the process does not foresee (skip, rejoin, undo, priority change, extra call);
  * model moves = a step the process requires did not happen.

Intended journeys (one trace = one patient's day):
  booked or walk-in -> call -> consult -> [lab order -> [samples (one per line) || reports] -> [report review visit]]
  booked -> no-show
  test-only patient: lab order -> samples || reports
Reports may come before a later sample of the same patient (different lines), so samples and reports run in parallel.

Usage: python -m flowq_analysis.conformance --xes events.xes --out report/
Writes conformance_summary.csv (fitness, share of fitting journeys), deviations.csv (log/model moves by activity) and
trace_fitness.csv.
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import pandas as pd
import pm4py

SAMPLES = "*( ->('lab_queue', 'lab_call', 'sample_collected'), tau )"
REPORTS = "*( 'report_ready', tau )"
LAB_WORK = f"+( {SAMPLES}, {REPORTS} )"
REVIEW = "->('return_queue', 'call', 'consult_start', 'consult_end')"
LAB_AFTER_CONSULT = f"->('lab_order', X( tau, ->( {LAB_WORK}, X( tau, {REVIEW} ) ) ) )"
CONSULT = f"->( X( ->('book', 'check_in'), 'walk_in' ), 'call', 'consult_start', 'consult_end', X( tau, {LAB_AFTER_CONSULT} ) )"
NO_SHOW = "->('book', 'no_show')"
TEST_ONLY = f"->('lab_order', {LAB_WORK})"
NORMATIVE_TREE = f"X( {CONSULT}, {NO_SHOW}, {TEST_ONLY} )"


def normative_net():
    tree = pm4py.parse_process_tree(NORMATIVE_TREE)
    return pm4py.convert_to_petri_net(tree)


def check(df: pd.DataFrame) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    net, im, fm = normative_net()
    diags = pm4py.conformance_diagnostics_alignments(df, net, im, fm, multi_processing=False)
    cases = list(df.groupby("case:concept:name", sort=False).groups.keys())
    log_moves: Counter[str] = Counter()
    model_moves: Counter[str] = Counter()
    per_trace = []
    for case, d in zip(cases, diags):
        for (log_label, model_label) in (m for m in d["alignment"]):
            if log_label != ">>" and model_label == ">>":
                log_moves[log_label] += 1
            elif log_label == ">>" and model_label not in (">>", None):
                model_moves[model_label] += 1
        per_trace.append({"case": case, "fitness": d["fitness"], "fits": d["fitness"] == 1.0, "cost": d["cost"]})
    trace = pd.DataFrame(per_trace)
    summary = {
        "traces": len(trace),
        "mean_fitness": float(trace.fitness.mean()) if len(trace) else float("nan"),
        "share_fitting": float(trace.fits.mean()) if len(trace) else float("nan"),
        "log_moves": int(sum(log_moves.values())),
        "model_moves": int(sum(model_moves.values())),
    }
    dev = pd.DataFrame(
        [{"kind": "log_move", "activity": a, "count": c} for a, c in log_moves.most_common()]
        + [{"kind": "model_move", "activity": a, "count": c} for a, c in model_moves.most_common()],
        columns=["kind", "activity", "count"],
    )
    return summary, dev, trace


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--xes", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    df = pm4py.read_xes(str(a.xes))
    df = pm4py.format_dataframe(df, case_id="case:concept:name", activity_key="concept:name", timestamp_key="time:timestamp")
    summary, dev, trace = check(df)
    pd.DataFrame([summary]).to_csv(a.out / "conformance_summary.csv", index=False)
    dev.to_csv(a.out / "deviations.csv", index=False)
    trace.to_csv(a.out / "trace_fitness.csv", index=False)
    net, im, fm = normative_net()
    pm4py.save_vis_petri_net(net, im, fm, str(a.out / "normative_model.png"))
    print(f"{summary['traces']} journeys, fitness {summary['mean_fitness']:.3f}, fitting {summary['share_fitting']:.1%} -> {a.out}")


if __name__ == "__main__":
    main()
