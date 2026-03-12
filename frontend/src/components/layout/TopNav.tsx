"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "EOI Analysis", href: "/dashboard/eoi-analysis" },
  { label: "Shortage", href: "/dashboard/shortage" },
  { label: "Predictors", href: "/dashboard/predictors" },
  { label: "Chat", href: "/dashboard/chat" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Admin", href: "/dashboard/admin" },
];

export default function TopNav() {
  const pathname = usePathname();

  const activeSection =
    pathname === "/dashboard"
      ? "Dashboard"
      : pathname.startsWith("/dashboard/eoi-analysis")
        ? "EOI Analysis"
        : pathname.startsWith("/dashboard/shortage")
          ? "Shortage"
          : pathname.startsWith("/dashboard/predictors")
            ? "Predictors"
            : pathname.startsWith("/dashboard/chat")
              ? "Chat"
              : pathname.startsWith("/dashboard/reports")
                ? "Reports"
                : pathname.startsWith("/dashboard/admin")
                  ? "Admin"
                  : "Dashboard";

  return (
    <nav
      style={{
        background: "#0d1117",
        borderBottom: "1px solid #161f2e",
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        height: "54px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginRight: "32px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: "linear-gradient(135deg, #2a8bff, #1d4ed8)",
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          I
        </div>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#f3f4f6",
            letterSpacing: "-0.3px",
          }}
        >
          Inter
        </span>
        <span style={{ fontSize: "14px", color: "#374151" }}>Intelligence</span>
      </div>

      {/* Nav links */}
      <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
        {NAV.map(({ label, href }) => {
          const active = activeSection === label;
          return (
            <Link
              key={label}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                color: active ? "#2a8bff" : "#4b5563",
                textDecoration: "none",
                borderBottom: active
                  ? "2px solid #2a8bff"
                  : "2px solid transparent",
                borderTop: "2px solid transparent",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right side */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span
          style={{
            background: "#10b98120",
            color: "#10b981",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "4px",
            border: "1px solid #10b98140",
          }}
        >
          ● LIVE
        </span>
        <span style={{ fontSize: "11px", color: "#4b5563" }}>
          8.3M rows · warehouse.db
        </span>
      </div>
    </nav>
  );
}
