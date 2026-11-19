"""One robustness table from several ETA sweeps (reports written by flowq_analysis.sweep).

For every swept parameter value, doctor stage: engine MAE, the best baseline's MAE, the engine's advantage over the
same-information baseline (history_mean) with 95% CI and Holm p, the share of patients within 5 minutes, and the engine's
range coverage. The engine keeps its configured assumptions while the simulated world changes, so the table shows how the
result holds up when those assumptions are wrong.

Usage: python -m flowq_analysis.robustness --reports ../out/sweep/robust-*/report --out ../out/robustness
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

BASELINES = ["history_mean", "position_slot", "running_mean"]


def table(report_dirs: list[Path], stage: str = "doctor") -> pd.DataFrame:
    rows = []
    for d in report_dirs:
        s = pd.read_csv(d / "summary.csv", dtype={"value": str})
        t = pd.read_csv(d / "tests.csv", dtype={"value": str})
        meta = d.parent / "sweep.json"
        param = json.loads(meta.read_text())["param"] if meta.exists() else d.parent.name
        s, t = s[(s.kind == "eta") & (s.stage == stage)], t[(t.kind == "eta") & (t.stage == stage)]
        for value, g in s.groupby("value"):
            mae = g[g.metric == "mae"].set_index("policy")["mean"]
            w5 = g[g.metric == "within5"].set_index("policy")["mean"]
            cov = g[g.metric == "coverage"].set_index("policy")["mean"]
            best = mae[[b for b in BASELINES if b in mae]].idxmin()
            tt = t[(t.value == value) & (t.metric == "mae") & (t.compared_to == "history_mean")]
            r = tt.iloc[0] if len(tt) else None
            rows.append({
                "param": param, "value": value, "engine_mae": round(float(mae["engine"]), 2),
                "best_baseline": best, "best_baseline_mae": round(float(mae[best]), 2),
                "advantage_vs_history_mean": None if r is None else round(float(r.advantage_mean), 2),
                "ci_low": None if r is None else round(float(r.ci_low), 2), "ci_high": None if r is None else round(float(r.ci_high), 2),
                "p_holm": None if r is None else float(r.p_holm),
                "engine_within5": round(float(w5.get("engine", float("nan"))), 3),
                "best_baseline_within5": round(float(w5[[b for b in BASELINES if b in w5]].max()), 3),
                "engine_coverage": round(float(cov.get("engine", float("nan"))), 3),
                "engine_wins_mae": bool(mae["engine"] < mae[best]),
            })
    return pd.DataFrame(rows)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reports", nargs="+", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    df = table(a.reports)
    df.to_csv(a.out / "robustness.csv", index=False)
    lines = ["# Robustness of the doctor ETA (engine assumptions fixed, simulated world varied)", "",
             "| parameter | value | engine MAE | best baseline (MAE) | advantage vs history_mean (95% CI) | p (Holm) | within 5 min engine / best | coverage |",
             "|---|---|---|---|---|---|---|---|"]
    for r in df.itertuples():
        lines.append(f"| {r.param} | {r.value} | {r.engine_mae} | {r.best_baseline} ({r.best_baseline_mae}) | {r.advantage_vs_history_mean} "
                     f"({r.ci_low} to {r.ci_high}) | {r.p_holm:.2g} | {r.engine_within5} / {r.best_baseline_within5} | {r.engine_coverage} |")
    lines += ["", f"Engine has the lowest MAE in {int(df.engine_wins_mae.sum())} of {len(df)} settings."]
    (a.out / "robustness.md").write_text("\n".join(lines) + "\n")
    print(f"{len(df)} settings -> {a.out}")


if __name__ == "__main__":
    main()
