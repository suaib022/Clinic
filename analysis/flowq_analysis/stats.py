"""Statistics for the flowq benchmark (per_day.csv from `npm run flowq:bench`).

Days are the unit of analysis: predictions inside one simulated day are not independent, so every interval and test
is over day-level values. For each stage and metric:
  * mean of the day-level values per policy with a 95% bootstrap CI (resampling days);
  * paired comparison engine vs each baseline on the same days: mean difference with a 95% bootstrap CI and the
    Wilcoxon signed-rank p-value, Holm-corrected within each (stage, metric) family.
Routing policies are compared the same way on day-level journey and wait times.

Usage: python -m flowq_analysis.stats --per-day out/bench/per_day.csv --out out/bench/stats
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

ETA_METRICS = ["mae", "medianAe", "p90Ae", "within5", "within10", "coverage"]
AHEAD = ("a0_1", "a2_3", "a4_6", "a7plus")
HIGHER_IS_BETTER = {"within5", "within10"} | {f"within5_{h}" for h in AHEAD}
HORIZON_METRICS = [f"{m}_{h}" for m in ("mae", "within5", "coverage") for h in AHEAD]
FLOW_METRICS = [("journey", "mean_min"), ("lab", "mean_wait_min"), ("doctor", "mean_wait_min")]
B = 10_000


def boot_ci(x: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    if len(x) < 2:
        return (float("nan"), float("nan"))
    idx = rng.integers(0, len(x), size=(B, len(x)))
    means = x[idx].mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def holm(p: list[float]) -> list[float]:
    order = np.argsort(p)
    adj = [0.0] * len(p)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(p) - rank) * p[i]))
        adj[i] = running
    return adj


def paired(df: pd.DataFrame, key: str, ref: str, others: list[str], stage: str, metric: str, rng: np.random.Generator) -> list[dict]:
    wide = df.pivot_table(index="seed", columns=key, values="value").dropna()
    rows = []
    for o in others:
        if ref not in wide or o not in wide:
            continue
        # Positive "advantage" always means the reference (engine) is better.
        diff = (wide[ref] - wide[o]) if metric in HIGHER_IS_BETTER else (wide[o] - wide[ref])
        d = diff.to_numpy()
        p = float(wilcoxon(d, zero_method="zsplit").pvalue) if np.any(d != 0) else 1.0
        lo, hi = boot_ci(d, rng)
        rows.append({"stage": stage, "metric": metric, "reference": ref, "compared_to": o, "days": len(d),
                     "advantage_mean": float(d.mean()), "ci_low": lo, "ci_high": hi, "p_wilcoxon": p})
    adj = holm([r["p_wilcoxon"] for r in rows]) if rows else []
    for r, a in zip(rows, adj):
        r["p_holm"] = a
    return rows


def summarise(df: pd.DataFrame, key: str, group_cols: list[str], rng: np.random.Generator) -> pd.DataFrame:
    out = []
    for keys, g in df.groupby(group_cols + [key]):
        x = g["value"].dropna().to_numpy()
        lo, hi = boot_ci(x, rng)
        out.append(dict(zip(group_cols + [key], keys if isinstance(keys, tuple) else (keys,)), days=len(x),
                        mean=float(x.mean()) if len(x) else float("nan"), ci_low=lo, ci_high=hi))
    return pd.DataFrame(out)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--per-day", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=20261117)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(a.seed)
    df = pd.read_csv(a.per_day)

    eta = df[(df.route == "engine") & df.policy.notna() & df.metric.isin(ETA_METRICS + HORIZON_METRICS)]
    eta_summary = summarise(eta, "policy", ["stage", "metric"], rng)
    eta_tests = []
    for (stage, metric), g in eta.groupby(["stage", "metric"]):
        others = sorted(p for p in g.policy.unique() if p != "engine")
        eta_tests += paired(g, "policy", "engine", others, stage, metric, rng)

    flow = df[df.policy.isna()]
    flow_summary = summarise(flow, "route", ["stage", "metric"], rng)
    flow_tests = []
    for stage, metric in FLOW_METRICS:
        g = flow[(flow.stage == stage) & (flow.metric == metric)]
        others = sorted(r for r in g.route.unique() if r != "engine")
        flow_tests += paired(g, "route", "engine", others, stage, metric, rng)

    eta_summary.to_csv(a.out / "eta_summary.csv", index=False)
    pd.DataFrame(eta_tests).to_csv(a.out / "eta_tests.csv", index=False)
    flow_summary.to_csv(a.out / "routing_summary.csv", index=False)
    pd.DataFrame(flow_tests).to_csv(a.out / "routing_tests.csv", index=False)

    def md(rows: list[dict], title: str) -> str:
        lines = [f"## {title}", "", "| stage | metric | engine vs | advantage (95% CI) | p (Holm) |", "|---|---|---|---|---|"]
        for r in rows:
            lines.append(f"| {r['stage']} | {r['metric']} | {r['compared_to']} | {r['advantage_mean']:.3f} "
                         f"({r['ci_low']:.3f} to {r['ci_high']:.3f}) | {r['p_holm']:.2g} |")
        return "\n".join(lines)

    (a.out / "stats.md").write_text(
        "Positive advantage = engine better (lower error, or higher share within 5/10 min). Unit: simulated day.\n\n"
        + md(eta_tests, "ETA accuracy") + "\n\n" + md(flow_tests, "Lab routing") + "\n")
    print(f"{eta.seed.nunique()} days -> {a.out}")


if __name__ == "__main__":
    main()
