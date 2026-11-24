import type { FeedbackRow } from '@/lib/feedback/query';
import type { Summary } from '@/lib/feedback/stats';

const CATEGORY_LABEL: Record<string, { label: string; cls: string }> = {
  positive: { label: 'Positive', cls: 'bg-success-subtle text-success border-success-subtle' },
  negative: { label: 'Negative', cls: 'bg-danger-subtle text-danger border-danger-subtle' },
  improvement: { label: 'Improvement', cls: 'bg-warning-subtle text-warning-emphasis border-warning-subtle' },
  staff: { label: 'Staff', cls: 'bg-info-subtle text-info-emphasis border-info-subtle' },
};

/** Read-only feedback view: averages, category counts (filterable links), and the list. Server-rendered. */
export default function FeedbackBoard({
  rows,
  summary,
  labelA,
  labelB,
  basePath,
  activeCategory,
  whoHeading,
}: {
  rows: FeedbackRow[];
  summary: Summary;
  labelA: string;
  labelB: string;
  basePath: string;
  activeCategory: string | null;
  whoHeading: string;
}) {
  const shown = activeCategory ? rows.filter((r) => r.categories.includes(activeCategory)) : rows;

  return (
    <>
      <div className="row g-3 mb-4">
        <Stat label={`Avg ${labelA}`} value={summary.avgA} />
        <Stat label={`Avg ${labelB}`} value={summary.avgB} />
        <Stat label="Reviews" value={summary.count} />
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <a href={basePath} className={`btn btn-sm ${!activeCategory ? 'btn-dark' : 'btn-outline-dark'}`}>All</a>
        {Object.entries(CATEGORY_LABEL).map(([key, c]) => (
          <a
            key={key}
            href={`${basePath}?cat=${key}`}
            className={`btn btn-sm ${activeCategory === key ? 'btn-dark' : 'btn-outline-secondary'}`}
          >
            {c.label} ({summary.categoryCounts[key as keyof typeof summary.categoryCounts] ?? 0})
          </a>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">No feedback yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>{whoHeading}</th>
                <th className="text-center">{labelA}</th>
                <th className="text-center">{labelB}</th>
                <th>Categories</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="small text-nowrap">{new Date(r.when).toLocaleDateString('en-GB')}</td>
                  <td className="small">{r.who}</td>
                  <td className="text-center">{r.ratingA}/5</td>
                  <td className="text-center">{r.ratingB}/5</td>
                  <td>
                    {r.categories.length === 0 && <span className="text-muted small">—</span>}
                    {r.categories.map((c) => (
                      <span key={c} className={`badge border me-1 ${CATEGORY_LABEL[c]?.cls ?? 'bg-light text-dark'}`}>
                        {CATEGORY_LABEL[c]?.label ?? c}
                      </span>
                    ))}
                  </td>
                  <td className="small" style={{ maxWidth: 360 }}>
                    {r.comment ? r.comment : <span className="text-muted">No comment</span>}
                    {r.inputMethod === 'voice' && <span className="badge bg-secondary-subtle text-secondary border ms-1">voice</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="col-6 col-md-4">
      <div className="card border-0 shadow-sm p-3 h-100">
        <div className="small text-muted">{label}</div>
        <div className="fs-3 fw-bold">{value ?? '—'}</div>
      </div>
    </div>
  );
}
