#!/usr/bin/env bash
# Reproduces every experiment reported for flowq. Run from the repository root. Results go to out/ (git-ignored).
# Requires Node (npm install) and uv (for the Python analysis in analysis/).
set -euo pipefail

# Engine options used for the doctor queue in the "full" configuration (DSS defaults are the baseline rules).
FULL='{"sumWith":"mean","expectArrivals":true,"showP":0.77,"walkInPerHour":2,"latenessMeanMin":-10,"latenessSdMin":10,"rangeMethod":"normal_sum","rangeCoverage":0.8}'
DAYS=${DAYS:-500}
SWEEP_DAYS=${SWEEP_DAYS:-200}

# E1. ETA accuracy: DSS rules vs full engine vs baselines (default scenario, staff actions on).
npm run flowq:bench -- --days "$DAYS" --out out/exp/dss
npm run flowq:bench -- --days "$DAYS" --out out/exp/full --engine-doctor "$FULL"

# E2. Lab routing under increasing lab load (patients with 2-4 tests).
npm run flowq:sweep -- --scenario packages/flowq/scenarios/multi-test.json --param lab.outsidePerHour \
  --values '6;20;40;60' --what routing --days "$SWEEP_DAYS" --engine-doctor "$FULL" --out out/sweep/routing-load

# E3. Same-day report review policies vs report turnaround time.
npm run flowq:sweep -- --param 'lab.lines.*.turnaroundMin' --values '20;45;90;150' --what returns \
  --days "$SWEEP_DAYS" --engine-doctor "$FULL" --out out/sweep/returns-tat

# E4. Robustness: the engine keeps its configured assumptions while the simulated world changes.
sweep() { npm run flowq:sweep -- --param "$1" --values "$2" --what eta --days "$SWEEP_DAYS" --engine-doctor "$FULL" --out "out/sweep/robust-$3"; }
sweep patients.walkInPerHour '0;2;4;6' walkin
sweep staff.awayWhenCalledP '0;0.05;0.1;0.2' away
sweep patients.noShowP '0.1;0.23;0.35' noshow
sweep visits.cv '0.3;0.49;0.7' cv
sweep 'doctors.*.startLateMeanMin' '0;5;15' latestart
sweep patients.latenessMeanMin '-20;-10;0' punctuality

# Statistics, figures and process mining.
cd analysis
uv sync
for d in dss full; do uv run python -m flowq_analysis.stats --per-day "../out/exp/$d/per_day.csv" --out "../out/exp/$d/stats"; done
for s in routing-load returns-tat robust-walkin robust-away robust-noshow robust-cv robust-latestart robust-punctuality; do uv run python -m flowq_analysis.sweep --per-day "../out/sweep/$s/per_day.csv" --out "../out/sweep/$s/report"; done
uv run python -m flowq_analysis.analyze --xes ../out/exp/full/events-seed1.xes --out ../out/exp/full/process
uv run python -m flowq_analysis.conformance --xes ../out/exp/full/events-seed1.xes --out ../out/exp/full/conformance
uv run python -m flowq_analysis.object_centric --ocel ../out/exp/full/events-seed1.ocel.json --out ../out/exp/full/object-centric
uv run python -m flowq_analysis.robustness --reports ../out/sweep/robust-*/report --out ../out/robustness
