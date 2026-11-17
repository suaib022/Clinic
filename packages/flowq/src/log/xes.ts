import type { FlowEvent } from './events';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** XES 1849-2016: one trace per patient (their whole day), events in time order. */
export function toXes(events: FlowEvent[]): string {
  const traces = new Map<string, FlowEvent[]>();
  for (const e of events) {
    const pid = e.objects.find((o) => o.type === 'patient')?.id;
    if (!pid) continue;
    (traces.get(pid) ?? traces.set(pid, []).get(pid)!).push(e);
  }
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<log xes.version="1849-2016" xes.features="nested-attributes" xmlns="http://www.xes-standard.org/">',
    '  <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>',
    '  <extension name="Time" prefix="time" uri="http://www.xes-standard.org/time.xesext"/>',
    '  <extension name="Organizational" prefix="org" uri="http://www.xes-standard.org/org.xesext"/>',
    '  <extension name="Lifecycle" prefix="lifecycle" uri="http://www.xes-standard.org/lifecycle.xesext"/>',
  ];
  for (const [pid, evs] of traces) {
    out.push('  <trace>', `    <string key="concept:name" value="${esc(pid)}"/>`);
    for (const e of [...evs].sort((a, b) => a.time - b.time)) {
      const server = e.objects.find((o) => o.type === 'doctor' || o.type === 'lab_line')?.id ?? '';
      out.push('    <event>',
        `      <string key="concept:name" value="${esc(e.activity)}"/>`,
        `      <date key="time:timestamp" value="${new Date(e.time).toISOString()}"/>`,
        `      <string key="org:resource" value="${esc(String(e.attrs.role ?? ''))}"/>`,
        `      <string key="server" value="${esc(server)}"/>`,
        '      <string key="lifecycle:transition" value="complete"/>',
        '    </event>');
    }
    out.push('  </trace>');
  }
  out.push('</log>', '');
  return out.join('\n');
}
