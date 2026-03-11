"use client";
/**
 * Reports — Coming Soon (Sprint 6)
 * Celery + python-pptx + WeasyPrint not yet implemented.
 */
import { C, Card, PageWrapper } from "@/components/ui";

const REPORT_TYPES = [
  {
    label: "EOI & SkillSelect Summary",
    desc: "Pool trends, invitation cutoffs, top occupations by state",
    formats: ["PDF", "PPT"],
  },
  {
    label: "Shortage Heatmap Report",
    desc: "All states × all occupations × 2021–2025 shortage history",
    formats: ["PDF", "PPT"],
  },
  {
    label: "Occupation Profile Card",
    desc: "Single occupation — full 8-tab data in print format",
    formats: ["PDF"],
  },
  {
    label: "Migration Trends Report",
    desc: "National planning levels, quota allocation, grant trends",
    formats: ["PDF", "PPT"],
  },
  {
    label: "Employment Outlook",
    desc: "JSA projected growth, top/bottom occupations by growth rate",
    formats: ["PDF", "PPT"],
  },
];

const PIPELINE = [
  {
    step: "1",
    label: "GET /api/data/report",
    desc: "Triggers Celery async job, returns job_id",
  },
  {
    step: "2",
    label: "Celery worker",
    desc: "Queries DB for filtered data per report type",
  },
  {
    step: "3",
    label: "Claude (claude-opus-4-6)",
    desc: "Writes slide titles, bullet points, speaker notes",
  },
  {
    step: "4",
    label: "python-pptx",
    desc: "Builds branded Inter PowerPoint with charts",
  },
  {
    step: "5",
    label: "WeasyPrint",
    desc: "Renders Jinja2 HTML template → PDF",
  },
  {
    step: "6",
    label: "Download link",
    desc: "File URL returned when job completes",
  },
];

export default function Reports() {
  return (
    <PageWrapper
      title="Reports"
      sub="Sprint 6 — Report generation not yet implemented · Coming soon"
    >
      {/* Banner */}
      <div
        style={{
          background: `${C.purple}12`,
          border: `1px solid ${C.purple}40`,
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>📄</div>
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.purple,
              marginBottom: 4,
            }}
          >
            Report Generation Not Yet Implemented — Sprint 6 Required
          </p>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            The report types, pipeline design, and UI layout are defined. Sprint
            6 will implement the Celery worker, python-pptx templates,
            WeasyPrint PDF rendering, and Claude-written slide copy.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Report types */}
        <Card>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 16,
            }}
          >
            Planned Report Types
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {REPORT_TYPES.map((r) => (
              <div
                key={r.label}
                style={{
                  padding: "12px 14px",
                  background: C.bg,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 4,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    {r.label}
                  </p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {r.formats.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: f === "PDF" ? C.red : C.blue,
                          background:
                            f === "PDF" ? `${C.red}15` : `${C.blue}15`,
                          padding: "2px 6px",
                          borderRadius: 3,
                          border: `1px solid ${f === "PDF" ? C.red : C.blue}35`,
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: C.muted }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Pipeline */}
        <Card>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 16,
            }}
          >
            Report Generation Pipeline
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PIPELINE.map((s) => (
              <div
                key={s.step}
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: `${C.purple}20`,
                    border: `1px solid ${C.purple}50`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.purple,
                  }}
                >
                  {s.step}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.text,
                      fontFamily: "monospace",
                    }}
                  >
                    {s.label}
                  </p>
                  <p style={{ fontSize: 11, color: C.muted }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              background: `${C.purple}10`,
              border: `1px solid ${C.purple}30`,
              borderRadius: 8,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: C.purple,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              To implement Sprint 6:
            </p>
            <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
              1. Uncomment celery, python-pptx, weasyprint, jinja2 in
              requirements.txt
              <br />
              2. Implement generate_report_task() in tasks/report_tasks.py
              <br />
              3. Create PPT + HTML/PDF templates per report type
              <br />
              4. Add GET /api/data/report/status/{"{"}job_id{"}"} polling
              endpoint
              <br />
              5. Connect frontend Download button to file URL
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
