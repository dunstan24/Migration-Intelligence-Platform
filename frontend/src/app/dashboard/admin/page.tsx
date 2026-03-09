"use client";
/**
 * Admin.jsx (Next.js: dashboard/admin/page.tsx)
 * GET /api/data/admin/* — JWT auth protected
 * CRUD on DB tables, model management, RAG index management
 */
import { useState } from "react";
import { C, Card, Badge, PageWrapper, ChartHeader, Grid } from "@/components/ui";

const MOCK_USERS = [
  { id: 1, name: "Inter Staff 1",  email: "staff1@inter.com.au", role: "staff",  lastLogin: "2025-10-31", status: "active" },
  { id: 2, name: "Client A",       email: "clienta@gmail.com",   role: "client", lastLogin: "2025-10-30", status: "active" },
  { id: 3, name: "Client B",       email: "clientb@gmail.com",   role: "client", lastLogin: "2025-10-28", status: "active" },
  { id: 4, name: "Inter Staff 2",  email: "staff2@inter.com.au", role: "staff",  lastLogin: "2025-10-25", status: "active" },
];

const MOCK_MODELS = [
  { id: "model_a", label: "Pathway Predictor",   file: "model_a.joblib", size: "4.2 MB", status: "loaded", accuracy: "91.4%", trained: "2025-12-01" },
  { id: "model_b", label: "Shortage Forecaster",  file: "model_b.joblib", size: "8.7 MB", status: "loaded", accuracy: "88.2%", trained: "2025-12-01" },
  { id: "model_c", label: "Volume Forecaster",    file: "model_c.joblib", size: "2.1 MB", status: "loaded", accuracy: "85.6%", trained: "2025-11-15" },
  { id: "model_d", label: "Approval Scorer",      file: "model_d.joblib", size: "1.8 MB", status: "loaded", accuracy: "82.9%", trained: "2025-12-01" },
];

const MOCK_TABLES = [
  { table: "osl_shortage",        rows: 18320, updated: "2025-10-01" },
  { table: "eoi_invitations",     rows: 14980, updated: "2025-10-31" },
  { table: "visa_grants",         rows: 42100, updated: "2025-09-30" },
  { table: "employment_proj",     rows: 9160,  updated: "2025-05-01" },
  { table: "occupation_features", rows: 7328,  updated: "2025-12-01" },
  { table: "sa4_ratings",         rows: 1840,  updated: "2025-10-01" },
];

type Tab = "users" | "models" | "database" | "rag";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("users");
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");

  // Mock JWT auth — FastAPI validates real JWT in Sprint 7
  function login() {
    if (password === "admin123") setAuthed(true);
  }

  if (!authed) {
    return (
      <PageWrapper title="Admin" sub="GET /api/data/admin/* — JWT protected · FastAPI validates token">
        <div style={{ maxWidth: 400, margin: "80px auto" }}>
          <Card>
            <ChartHeader color={C.red}>Authentication Required</ChartHeader>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              FastAPI validates JWT token. Dev password: admin123
            </p>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="Enter admin password..."
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", color: C.text, fontSize: 13, width: "100%", outline: "none", marginBottom: 12 }}
            />
            <button onClick={login} style={{ width: "100%", padding: "10px 0", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Login → Admin Panel
            </button>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Admin Panel" sub="GET /api/data/admin/* · CRUD on DB tables · model management · RAG index · JWT authenticated">

      {/* Stats */}
      <div style={Grid.four}>
        {[
          { label: "Total Users",    value: "4",    color: C.blue   },
          { label: "Models Loaded",  value: "4/4",  color: C.green  },
          { label: "DB Tables",      value: "19",   color: C.amber  },
          { label: "RAG Documents",  value: "2,840",color: C.purple },
        ].map(k => (
          <Card key={k.label}>
            <p style={{ fontSize: 11, color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {(["users","models","database","rag"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent",
            padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? C.blue : C.muted, textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <Card>
          <ChartHeader color={C.blue}>User Management — /api/data/admin/users</ChartHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "7px 14px", marginBottom: 4 }}>
            {["ID","Email","Role","Last Login","Status","Action"].map(h => (
              <span key={h} style={{ fontSize: 10, color: C.dimmed, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>
          {MOCK_USERS.map((u, i) => (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", borderRadius: 7, alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a0e16" }}>
              <span style={{ fontSize: 12, color: C.muted }}>#{u.id}</span>
              <span style={{ fontSize: 12, color: C.text }}>{u.email}</span>
              <Badge label={u.role} color={u.role === "staff" ? C.blue : C.green} />
              <span style={{ fontSize: 11, color: C.muted }}>{u.lastLogin}</span>
              <Badge label={u.status} color={C.green} />
              <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>Edit</button>
            </div>
          ))}
        </Card>
      )}

      {/* Models tab */}
      {tab === "models" && (
        <Card>
          <ChartHeader color={C.green}>ML Models — models/*.joblib loaded at startup</ChartHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MOCK_MODELS.map(m => (
              <div key={m.id} style={{ background: C.bg, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{m.label}</p>
                    <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{m.file} · {m.size} · trained {m.trained}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Badge label={`● ${m.status}`} color={C.green} />
                    <Badge label={`Acc: ${m.accuracy}`} color={C.blue} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ background: `${C.amber}15`, border: `1px solid ${C.amber}40`, borderRadius: 6, padding: "6px 14px", color: C.amber, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Retrain</button>
                  <button style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}40`, borderRadius: 6, padding: "6px 14px", color: C.blue, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Reload</button>
                  <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", color: C.muted, fontSize: 11, cursor: "pointer" }}>View SHAP</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Database tab */}
      {tab === "database" && (
        <Card>
          <ChartHeader color={C.amber}>Database Tables — SQLite (dev) / PostgreSQL (prod)</ChartHeader>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "7px 14px", marginBottom: 4 }}>
            {["Table", "Rows", "Last Updated", "Action"].map(h => (
              <span key={h} style={{ fontSize: 10, color: C.dimmed, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>
          {MOCK_TABLES.map((t, i) => (
            <div key={t.table} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", borderRadius: 7, alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a0e16" }}>
              <span style={{ fontSize: 12, color: C.text, fontFamily: "monospace" }}>{t.table}</span>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{t.rows.toLocaleString()}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{t.updated}</span>
              <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>Re-ingest</button>
            </div>
          ))}
        </Card>
      )}

      {/* RAG tab */}
      {tab === "rag" && (
        <Card>
          <ChartHeader color={C.purple}>RAG Index — ChromaDB Vector Store</ChartHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total Chunks",     value: "2,840", color: C.purple },
              { label: "Embedding Model",  value: "all-MiniLM-L6-v2", color: C.blue },
              { label: "Dimensions",       value: "384", color: C.green },
            ].map(k => (
              <div key={k.label} style={{ background: C.bg, borderRadius: 8, padding: 14, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { source: "OSL shortage data 2021–2025",    chunks: 840, status: "indexed" },
              { source: "916 occupation descriptions",     chunks: 916, status: "indexed" },
              { source: "Visa subclass requirements",      chunks: 480, status: "indexed" },
              { source: "JSA policy documents",            chunks: 380, status: "indexed" },
              { source: "EOI SkillSelect rules",           chunks: 224, status: "indexed" },
            ].map(r => (
              <div key={r.source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
                <div>
                  <p style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{r.source}</p>
                  <p style={{ fontSize: 11, color: C.muted }}>{r.chunks} chunks</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Badge label={r.status} color={C.green} />
                  <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>Re-embed</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageWrapper>
  );
}
