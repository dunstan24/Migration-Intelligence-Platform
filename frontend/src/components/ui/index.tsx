// Shared UI primitives used across all pages

export const C = {
  bg:      "#080b11",
  surface: "#0d1117",
  border:  "#161f2e",
  text:    "#e5e7eb",
  muted:   "#4b5563",
  dimmed:  "#1f2937",
  blue:    "#2a8bff",
  green:   "#10b981",
  amber:   "#f59e0b",
  purple:  "#8b5cf6",
  red:     "#ef4444",
  cyan:    "#06b6d4",
  orange:  "#f97316",
};

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  );
}

export function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <p style={{ fontSize: 11, color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 5 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#111827" }}>{sub}</p>
    </Card>
  );
}

export function ChartHeader({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      {children}
    </p>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + "20", color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, border: `1px solid ${color}40`, letterSpacing: "0.04em" }}>
      {label}
    </span>
  );
}

export function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || C.muted, margin: "2px 0" }}>
          {p.name}: <strong style={{ color: C.text }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function PageWrapper({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1440 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{title}</h1>
        {sub && <p style={{ fontSize: 12, color: C.muted }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export const Grid = {
  two:  { display: "grid", gridTemplateColumns: "1fr 1fr",         gap: 16, marginBottom: 22 } as React.CSSProperties,
  three:{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",     gap: 16, marginBottom: 22 } as React.CSSProperties,
  four: { display: "grid", gridTemplateColumns: "repeat(4,1fr)",   gap: 14, marginBottom: 22 } as React.CSSProperties,
};
