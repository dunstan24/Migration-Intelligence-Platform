import TopNav from "@/components/layout/TopNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#080b11", minHeight: "100vh", color: "#e5e7eb", fontFamily: "-apple-system,'Segoe UI',sans-serif" }}>
      <TopNav />
      {children}
    </div>
  );
}
