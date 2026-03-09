"use client";
/**
 * Reports.jsx (Next.js: dashboard/reports/page.tsx)
 * GET /api/data/report?type=X&from=Y&to=Z
 * Triggers PPT/PDF generation via Celery async job
 */
import { useState } from "react";
import { C, Card, Badge, PageWrapper, ChartHeader, Grid } from "@/components/ui";

const REPORT_TYPES = [
  { id: "eoi_summary",        label: "EOI & SkillSelect Summary",     desc: "Pool trends, cutoffs, top occupations", format: ["PDF", "PPT"] },
  { id: "shortage_heatmap",   label: "Shortage Heatmap Report",       desc: "All states × occupations × years",     format: ["PDF", "PPT"] },
  { id: "client_pathway",     label: "Client Pathway Report Card",    desc: "All 4 models + recommendations",       format: ["PDF"] },
  { id: "migration_trends",   label: "Migration Trends Report",       desc: "2015–2030 with Prophet forecast",      format: ["PDF", "PPT"] },
  { id: "employment_outlook", label: "Employment Outlook",            desc: "Top/bottom 20 + industry forecast",    format: ["PDF", "PPT"] },
  { id: "visa_analytics",     label: "Visa Analytics Report",        desc: "Grants by subclass, country, state",   format: ["PDF", "PPT"] },
];

type JobStatus = "idle" | "queued" | "generating" | "done" | "error";

export default function Reports() {
  const [selectedType, setSelectedType] = useState("eoi_summary");
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2025-10-31");
  const [format, setFormat] = useState<"PDF" | "PPT">("PDF");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);

  const selected = REPORT_TYPES.find(r => r.id === selectedType)!;

  async function generate() {
    setStatus("queued");
    setJobId(`job_${Date.now()}`);
    // Mock Celery async job — GET /api/data/report?type=X&from=Y&to=Z
    await new Promise(r => setTimeout(r, 1200));
    setStatus("generating");
    await new Promise(r => setTimeout(r, 2000));
    setStatus("done");
  }

  const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 12, width: "100%", outline: "none" };
  const labelStyle = { fontSize: 11, color: C.muted, marginBottom: 4, display: "block", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" };

  return (
    <PageWrapper title="Reports" sub="GET /api/data/report → Celery async job → python-pptx / WeasyPrint · LLM-written slide copy">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>

        {/* Report builder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <ChartHeader color={C.blue}>Select Report Type</ChartHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REPORT_TYPES.map(r => (
                <button key={r.id} onClick={() => setSelectedType(r.id)} style={{
                  background: selectedType === r.id ? `${C.blue}15` : C.bg,
                  border: `1px solid ${selectedType === r.id ? C.blue : C.border}`,
                  borderRadius: 8, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: selectedType === r.id ? C.blue : C.text, marginBottom: 3 }}>{r.label}</p>
                    <div style={{ display: "flex", gap: 4 }}>
                      {r.format.map(f => <Badge key={f} label={f} color={f === "PDF" ? C.red : C.purple} />)}
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.muted }}>{r.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Config + output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <ChartHeader color={C.purple}>Report Configuration</ChartHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Date From</label>
                <input type="date" style={inputStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Date To</label>
                <input type="date" style={inputStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Output Format</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={format} onChange={e => setFormat(e.target.value as any)}>
                  {selected.format.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>LLM Slide Copy</label>
                <div style={{ ...inputStyle, color: C.green, fontWeight: 600 }}>✓ Enabled (claude-opus-4-6)</div>
              </div>
            </div>

            <button onClick={generate} disabled={status === "queued" || status === "generating"} style={{
              width: "100%", padding: "12px 0", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700,
              background: status === "done" ? C.green : (status === "idle" ? C.blue : C.border),
              color: "#fff", cursor: (status === "queued" || status === "generating") ? "not-allowed" : "pointer",
            }}>
              {status === "idle"       && `Generate ${format} Report`}
              {status === "queued"     && "Queuing Celery job..."}
              {status === "generating" && "Generating with LLM..."}
              {status === "done"       && "✓ Download Ready"}
              {status === "error"      && "Error — Retry"}
            </button>
          </Card>

          {/* Job status */}
          {jobId && (
            <Card>
              <ChartHeader color={status === "done" ? C.green : C.amber}>Job Status</ChartHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Job queued → Celery",           done: status !== "idle" },
                  { label: "Fetching data from DB",          done: status === "generating" || status === "done" },
                  { label: "Claude generating slide copy",   done: status === "done" },
                  { label: `Building ${format} file`,       done: status === "done" },
                ].map(step => (
                  <div key={step.label} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: step.done ? C.green : C.border }}>
                      {step.done ? "✓" : "○"}
                    </span>
                    <span style={{ fontSize: 12, color: step.done ? C.text : C.muted }}>{step.label}</span>
                  </div>
                ))}
              </div>

              {status === "done" && (
                <div style={{ marginTop: 14, padding: 14, background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 4 }}>✓ Report ready for download</p>
                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Job ID: {jobId}</p>
                  <button style={{ background: C.green, border: "none", borderRadius: 6, padding: "8px 18px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ↓ Download {format}
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Architecture note */}
          <Card>
            <ChartHeader color={C.cyan}>Report Pipeline</ChartHeader>
            {[
              { label: "GET /api/data/report",   desc: "Query filtered DB data" },
              { label: "Celery worker",           desc: "Async job queue (Redis broker)" },
              { label: "claude-opus-4-6",         desc: "LLM writes slide titles, bullets, speaker notes" },
              { label: "python-pptx",             desc: "Builds branded Inter PPT" },
              { label: "WeasyPrint",              desc: "HTML → PDF report card" },
              { label: "Download link",           desc: "Returned to React when job done" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.blue, fontWeight: 700, minWidth: 160 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{s.desc}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
