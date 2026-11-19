"""Analysis of a flowq sweep (per_day.csv from `npm run flowq:sweep`).

For every swept value, stage and metric: mean of the day-level values per policy with a 95% bootstrap CI, and paired
tests of the reference policy against each other policy on the same days (difference, 95% bootstrap CI, Wilcoxon p,
Holm-corrected within each value/stage/metric family). One figure per (kind, stage, metric): metric vs swept value.

Usage: python -m flowq_analysis.sweep --per-day out/sweep/x/per_day.csv --out out/sweep/x/report
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

from flowq_analysis.stats import HIGHER_IS_BETTER, boot_ci, holm

REFERENCE = {"routing": "engine", "eta": "engine", "returns": "advice"}
# Return counts: higher seen is better; higher turnedAway / overtime is worse.
HIGHER_BETTER = set(HIGHER_IS_BETTER) | {"seen"}


def _value_order(values: pd.Series) -> list[str]:
    def key(v: str):
        try:
            return (0, float(v))
        except ValueError:
            return (1, v)
    return sorted(values.unique(), key=key)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--per-day", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=20261117)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(a.seed)
    df = pd.read_csv(a.per_day, dtype={"value": str}).dropna(subset=["metric_value"])
    param = df.param.iloc[0]

    summary, tests = [], []
    for (kind, value, stage, metric), g in df.groupby(["kind", "value", "stage", "metric"]):
        for policy, h in g.groupby("policy"):
            x = h.metric_value.to_numpy(float)
            lo, hi = boot_ci(x, rng)
            summary.append(dict(kind=kind, value=value, stage=stage, metric=metric, policy=policy, days=len(x), mean=x.mean(), ci_low=lo, ci_high=hi))
        ref = REFERENCE[kind]
        wide = g.pivot_table(index="seed", columns="policy", values="metric_value").dropna()
        fam = []
        for other in [p for p in wide.columns if p != ref]:
            if ref not in wide:
                continue
            d = ((wide[ref] - wide[other]) if metric in HIGHER_BETTER else (wide[other] - wide[ref])).to_numpy(float)
            p = float(wilcoxon(d, zero_method="zsplit").pvalue) if np.any(d != 0) else 1.0
            lo, hi = boot_ci(d, rng)
            fam.append(dict(kind=kind, value=value, stage=stage, metric=metric, reference=ref, compared_to=other, days=len(d),
                            advantage_mean=float(d.mean()), ci_low=lo, ci_high=hi, p_wilcoxon=p))
        for r, adj in zip(fam, holm([r["p_wilcoxon"] for r in fam]) if fam else []):
            r["p_holm"] = adj
        tests += fam

    s = pd.DataFrame(summary)
    t = pd.DataFrame(tests)
    s.to_csv(a.out / "summary.csv", index=False)
    t.to_csv(a.out / "tests.csv", index=False)

    order = _value_order(df.value)
    for (kind, stage, metric), g in s.groupby(["kind", "stage", "metric"]):
        fig, ax = plt.subplots(figsize=(6, 3.6))
        for policy, h in g.groupby("policy"):
            h = h.set_index("value").reindex(order)
            x = np.arange(len(order))
            ax.errorbar(x, h["mean"], yerr=[h["mean"] - h["ci_low"], h["ci_high"] - h["mean"]], marker="o", capsize=3, label=policy)
        ax.set_xticks(np.arange(len(order)), order)
        ax.set_xlabel(param)
        ax.set_ylabel(f"{stage} {metric}")
        ax.legend(fontsize=8)
        ax.grid(alpha=0.3)
        fig.tight_layout()
        fig.savefig(a.out / f"{kind}_{stage}_{metric}.png", dpi=150)
        plt.close(fig)

    lines = [f"# Sweep over `{param}`", "", "Positive advantage = reference policy better. Unit: simulated day.", "",
             "| kind | value | stage | metric | reference vs | advantage (95% CI) | p (Holm) |", "|---|---|---|---|---|---|---|"]
    for r in tests:
        lines.append(f"| {r['kind']} | {r['value']} | {r['stage']} | {r['metric']} | {r['compared_to']} | "
                     f"{r['advantage_mean']:.3f} ({r['ci_low']:.3f} to {r['ci_high']:.3f}) | {r['p_holm']:.2g} |")
    (a.out / "sweep.md").write_text("\n".join(lines) + "\n")
    print(f"{param}: {len(order)} values -> {a.out}")


if __name__ == "__main__":
    main()
