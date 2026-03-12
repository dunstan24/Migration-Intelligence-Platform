"use client";
/**
 * Chat — Powered by Claude (claude-opus-4-6)
 * POST /api/llm/chat → SSE stream
 * Note: RAG (ChromaDB) not yet implemented — Sprint 5.
 * Claude responds based on its training knowledge + general migration context.
 */
import { useState, useRef, useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import { C, Card, Badge, PageWrapper } from "@/components/ui";

// Questions answerable from real DB data or Claude's knowledge
const SUGGESTED = [
  "Which states have the most shortage occupations in 2025?",
  "What is the current EOI points cutoff for state nomination?",
  "Tell me about the Visa 190 and Visa 491 differences",
  "What occupations have the highest invitation rate in SkillSelect?",
  "Explain how the NERO regional employment index works",
];

const SESSION_ID = `session_${Date.now()}`;

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } =
    useSSE(SESSION_ID);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <PageWrapper
      title="Migration Advisor Chat"
      sub="Powered by claude-opus-4-6 · Ask about Australian visas, occupations, and migration pathways"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 16,
          height: "calc(100vh - 180px)",
        }}
      >
        {/* Chat window */}
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                Migration Advisor
              </p>
              <p style={{ fontSize: 11, color: C.muted }}>
                claude-opus-4-6 · Australian migration expertise
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge
                label={isStreaming ? "● Streaming" : "● Ready"}
                color={isStreaming ? C.amber : C.green}
              />
              <button
                onClick={clearMessages}
                style={{
                  background: "none",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "5px 10px",
                  color: C.muted,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: C.muted,
                }}
              >
                <p style={{ fontSize: 32, marginBottom: 12 }}>◻</p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 6,
                  }}
                >
                  Ask anything about Australian migration
                </p>
                <p style={{ fontSize: 12 }}>
                  Visas · Occupation shortages · SkillSelect · State nomination
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {msg.role === "user" ? "You" : "Migration Advisor"}
                  </span>
                  {msg.streaming && (
                    <Badge label="streaming..." color={C.amber} />
                  )}
                </div>
                <div
                  style={{
                    maxWidth: "80%",
                    background: msg.role === "user" ? `${C.blue}18` : C.bg,
                    border: `1px solid ${msg.role === "user" ? C.blue + "40" : C.border}`,
                    borderRadius:
                      msg.role === "user"
                        ? "12px 12px 4px 12px"
                        : "12px 12px 12px 4px",
                    padding: "12px 16px",
                    fontSize: 13,
                    color: C.text,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content ||
                    (msg.streaming ? (
                      <span style={{ color: C.muted }}>▋</span>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            ))}

            {error && (
              <div
                style={{
                  background: `${C.red}15`,
                  border: `1px solid ${C.red}40`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: C.red,
                  marginBottom: 12,
                }}
              >
                ⚠ {error} — Check that FastAPI backend is running on port 8000
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder="Ask about occupations, visas, shortage trends..."
                style={{
                  flex: 1,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: C.text,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                style={{
                  padding: "10px 20px",
                  background: isStreaming ? C.border : C.blue,
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isStreaming ? "not-allowed" : "pointer",
                }}
              >
                {isStreaming ? "..." : "Send"}
              </button>
            </div>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
              Requires ANTHROPIC_API_KEY in backend/.env · Add key to enable
              chat
            </p>
          </div>
        </Card>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text,
                marginBottom: 12,
              }}
            >
              Suggested Questions
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    sendMessage(s);
                  }}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: "8px 12px",
                    color: C.muted,
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                    lineHeight: 1.4,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text,
                marginBottom: 10,
              }}
            >
              Status
            </p>
            {[
              {
                label: "Claude API",
                status: "Ready (needs API key)",
                ok: null,
              },
              {
                label: "RAG (ChromaDB)",
                status: "Sprint 5 — not yet built",
                ok: false,
              },
              {
                label: "sentence-transformers",
                status: "Sprint 5 — not yet built",
                ok: false,
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>{s.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: s.ok === false ? C.muted : C.text,
                    }}
                  >
                    {s.status}
                  </span>
                  {s.ok === true && (
                    <span style={{ color: C.green, fontSize: 12 }}>●</span>
                  )}
                  {s.ok === false && (
                    <span style={{ color: C.red, fontSize: 12 }}>●</span>
                  )}
                  {s.ok === null && (
                    <span style={{ color: C.amber, fontSize: 12 }}>●</span>
                  )}
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: `${C.amber}10`,
                border: `1px solid ${C.amber}30`,
                borderRadius: 6,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: C.amber,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Sprint 5: RAG Pipeline
              </p>
              <p style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                Will add ChromaDB vector search over OSL, JSA, EOI data chunks
                so Claude answers with grounded database context.
              </p>
            </div>
          </Card>

          <Card>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}
            >
              Real Data Available
            </p>
            {[
              "8.3M EOI records (2024–2026)",
              "OSL shortage 2021–2025",
              "JSA Labour Atlas (skills, jobs, demos)",
              "NERO regional employment index",
              "Visa quota allocations 2024-25",
            ].map((kb) => (
              <div
                key={kb}
                style={{
                  fontSize: 11,
                  color: C.muted,
                  padding: "5px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                ◈ {kb}
              </div>
            ))}
            <p style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
              This data will be indexed into ChromaDB in Sprint 5 so the AI can
              reference it directly.
            </p>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
