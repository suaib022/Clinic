"""Object-centric analysis of a flowq OCEL 2.0 log.

One patient's day touches several objects: appointments (first visit, report review), lab orders, lab queue items (one per
line), the doctor and the doctor's session. A case-centric (XES) view must pick one of them as "the case"; here each object
type is analysed on its own and the links between them are kept.

Outputs:
  object_types.csv   per object type: objects, events, events per object, lifetime (first to last event) mean / p90
  object_waits.csv   waiting stages measured on the object that owns them (appointment: joined line -> consult;
                     lab_queue_item: queued -> called; lab_order: ordered -> report ready; doctor_session: open time)
  patient_objects.csv  how many objects of each type one patient touches (journey complexity)
  ocdfg.png          object-centric directly-follows graph

Usage: python -m flowq_analysis.object_centric --ocel events.ocel.json --out report/
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import pm4py

# (object type, stage name, start activities, end activities)
STAGES = [
    ("appointment", "wait_for_doctor", {"check_in", "walk_in", "return_queue", "rejoin"}, {"consult_start"}),
    ("appointment", "consultation", {"consult_start"}, {"consult_end"}),
    ("lab_queue_item", "wait_at_lab_line", {"lab_queue"}, {"lab_call"}),
    ("lab_queue_item", "sample_collection", {"lab_call"}, {"sample_collected"}),
    ("lab_order", "order_to_report", {"lab_order"}, {"report_ready"}),
    ("doctor_session", "session_open", {"session_start"}, {"session_end"}),
]


def _minutes(a: pd.Timestamp, b: pd.Timestamp) -> float:
    return (b - a).total_seconds() / 60


def object_types(rel: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for t, g in rel.groupby("ocel:type"):
        life = g.groupby("ocel:oid")["ocel:timestamp"].agg(["min", "max"])
        mins = (life["max"] - life["min"]).dt.total_seconds() / 60
        per = g.groupby("ocel:oid").size()
        rows.append({"object_type": t, "objects": len(per), "events": int(g["ocel:eid"].nunique()),
                     "events_per_object": round(float(per.mean()), 2),
                     "lifetime_mean_min": round(float(mins.mean()), 2), "lifetime_p90_min": round(float(mins.quantile(0.9)), 2)})
    return pd.DataFrame(rows)


def object_waits(rel: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for otype, stage, starts, ends in STAGES:
        g = rel[rel["ocel:type"] == otype].sort_values("ocel:timestamp")
        mins = []
        for _, h in g.groupby("ocel:oid"):
            # The last start before the first end that follows it (a rejoin resets the wait; one stage per object).
            t_start = None
            for act, ts in zip(h["ocel:activity"], h["ocel:timestamp"]):
                if act in starts:
                    t_start = ts
                elif act in ends and t_start is not None:
                    mins.append(_minutes(t_start, ts))
                    break
        s = pd.Series(mins, dtype=float)
        rows.append({"object_type": otype, "stage": stage, "n": len(s),
                     "mean_min": round(float(s.mean()), 2) if len(s) else None,
                     "p90_min": round(float(s.quantile(0.9)), 2) if len(s) else None})
    return pd.DataFrame(rows)


def patient_objects(rel: pd.DataFrame) -> pd.DataFrame:
    """For each object type: share of patients touching it and mean objects per patient (among those)."""
    by_event = rel.groupby("ocel:eid")
    patient_of = rel[rel["ocel:type"] == "patient"].set_index("ocel:eid")["ocel:oid"]
    linked = rel[rel["ocel:type"] != "patient"].copy()
    linked["patient"] = linked["ocel:eid"].map(patient_of)
    linked = linked.dropna(subset=["patient"])
    n_pat = patient_of.nunique()
    rows = []
    for t, g in linked.groupby("ocel:type"):
        per = g.groupby("patient")["ocel:oid"].nunique()
        rows.append({"object_type": t, "share_of_patients": round(len(per) / n_pat, 3), "objects_per_patient": round(float(per.mean()), 2)})
    del by_event
    return pd.DataFrame(rows)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ocel", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    ocel = pm4py.read_ocel2_json(str(a.ocel))
    rel = ocel.relations
    object_types(rel).to_csv(a.out / "object_types.csv", index=False)
    object_waits(rel).to_csv(a.out / "object_waits.csv", index=False)
    patient_objects(rel).to_csv(a.out / "patient_objects.csv", index=False)
    # The doctor object links every event of a session; leaving it out keeps the graph readable.
    ocdfg = pm4py.discover_ocdfg(pm4py.filter_ocel_object_types(ocel, [t for t in pm4py.ocel_get_object_types(ocel) if t != "doctor"]))
    pm4py.save_vis_ocdfg(ocdfg, str(a.out / "ocdfg.png"))
    print(f"{rel['ocel:eid'].nunique()} events, {rel['ocel:oid'].nunique()} objects -> {a.out}")


if __name__ == "__main__":
    main()
