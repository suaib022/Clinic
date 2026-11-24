// Scenarios shipped with flowq, bundled for the Flow Lab simulator. Each carries its own `sources` block
// (every value tagged [cited], [derived] or [assumption]).
import defaultScenario from '../../packages/flowq/scenarios/default.json';
import busyLab from '../../packages/flowq/scenarios/busy-lab.json';
import multiTest from '../../packages/flowq/scenarios/multi-test.json';
import hospitalOpd from '../../packages/flowq/scenarios/hospitalopd.json';

export interface ScenarioOption { id: string; label: string; description: string; raw: Record<string, unknown> }

export const SCENARIOS: ScenarioOption[] = [
  { id: 'hospitalopd', label: 'HospitalOPD (real hospital data)', raw: hospitalOpd as Record<string, unknown>,
    description: 'Lab and imaging share, blood-report turnaround and visit-length variability taken from a public outpatient event log (62k+ events).' },
  { id: 'default', label: 'Default clinic day', raw: defaultScenario as Record<string, unknown>,
    description: 'Evening private chambers; parameters from published studies (see sources).' },
  { id: 'busy-lab', label: 'Busy lab', raw: busyLab as Record<string, unknown>, description: 'Same day with a heavier lab load.' },
  { id: 'multi-test', label: 'Patients with several tests', raw: multiTest as Record<string, unknown>, description: 'Patients with 2-4 tests: lab routing matters most.' },
];

export type SourceKind = 'cited' | 'derived' | 'assumption' | 'other';
/** Provenance of every parameter: the `sources` block, parsed into kind + note. */
export function scenarioSources(raw: Record<string, unknown>): { key: string; kind: SourceKind; note: string }[] {
  const s = (raw.sources ?? {}) as Record<string, string>;
  return Object.entries(s).map(([key, text]) => {
    const m = /^\[([a-z /]+)\]\s*(.*)$/i.exec(text);
    const tag = m?.[1]?.toLowerCase() ?? '';
    const kind: SourceKind = tag.startsWith('cited') ? 'cited' : tag.startsWith('derived') ? 'derived' : tag.startsWith('assumption') ? 'assumption' : 'other';
    return { key, kind, note: m ? m[2] : text };
  });
}
