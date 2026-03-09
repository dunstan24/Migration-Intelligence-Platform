"use client";
/**
 * Chat.jsx (Next.js: dashboard/chat/page.tsx)
 * Uses useSSE hook → POST /api/llm/chat → SSE stream token by token
 * RAG: ChromaDB top-K chunks injected into Claude prompt
 */
import { useState, useRef, useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import { C, Card, Badge, PageWrapper } from "@/components/ui";

const SUGGESTED = [
  "Which occupations have the highest PR probability in VIC?",
  "What is the current EOI points cutoff for Software Engineers?",
  "Show me shortage occupations in WA for 2025",
  "What are the chances of 189 visa approval with 90 points?",
  "Compare nursing shortage trends across all states",
];

const SESSION_ID = `session_${Date.now()}`;

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } = useSSE(SESSION_ID);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  function handleSuggestion(text: string) {
    sendMessage(text);
  }

  return (
    <PageWrapper title="Migration Advisor Chat" sub="POST /api/llm/chat → SSE stream · ChromaDB RAG · claude-opus-4-6 · useSSE hook">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, height: "calc(100vh - 180px)" }}>

        {/* Chat window */}
        <Card style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Migration Advisor</p>
              <p style={{ fontSize: 11, color: C.muted }}>Powered by claude-opus-4-6 · RAG grounded in OSL, JSA, EOI, visa data</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge label={isStreaming ? "● Streaming" : "● Ready"} color={isStreaming ? C.amber : C.green} />
              <button onClick={clearMessages} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>◻</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Ask anything about Australian migration</p>
                <p style={{ fontSize: 12 }}>Grounded in OSL 2021–2025 · JSA Labour Atlas · EOI SkillSelect · Visa data</p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {msg.role === "user" ? "You" : "Migration Advisor"}
                  </span>
                  {msg.streaming && <Badge label="streaming..." color={C.amber} />}
                </div>
                <div style={{
                  maxWidth: "80%",
                  background: msg.role === "user" ? `${C.blue}18` : C.bg,
                  border: `1px solid ${msg.role === "user" ? C.blue + "40" : C.border}`,
                  borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  padding: "12px 16px",
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content || (msg.streaming ? <span style={{ color: C.muted }}>▋</span> : "")}
                </div>
              </div>
            ))}

            {error && (
              <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red, marginBottom: 12 }}>
                ⚠ {error} — Check that FastAPI backend is running on port 8000
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about occupations, visas, shortage trends..."
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }}
              />
              <button onClick={handleSend} disabled={isStreaming || !input.trim()} style={{
                padding: "10px 20px", background: isStreaming ? C.border : C.blue, border: "none",
                borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: isStreaming ? "not-allowed" : "pointer",
              }}>
                {isStreaming ? "..." : "Send"}
              </button>
            </div>
            <p style={{ fontSize: 10, color: C.dimmed, marginTop: 6 }}>
              RAG pipeline: embed query → ChromaDB top-5 chunks → Claude prompt → SSE stream
            </p>
          </div>
        </Card>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>Suggested Questions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => handleSuggestion(s)} style={{
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
                  padding: "8px 12px", color: C.muted, fontSize: 11, cursor: "pointer", textAlign: "left", lineHeight: 1.4,
                }}>
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10 }}>RAG Architecture</p>
            {[
              { step: "1", label: "Embed query",     desc: "sentence-transformers" },
              { step: "2", label: "ChromaDB search", desc: "top-5 relevant chunks" },
              { step: "3", label: "Build prompt",    desc: "context + user message" },
              { step: "4", label: "Claude stream",   desc: "SSE token by token" },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${C.blue}30`, border: `1px solid ${C.blue}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.blue, flexShrink: 0 }}>{s.step}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: C.muted }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>Knowledge Base</p>
            {["OSL 2021–2025 (916 occ)", "JSA Labour Atlas", "EOI SkillSelect Oct 25", "Visa requirements", "SA4 regional data"].map(kb => (
              <div key={kb} style={{ fontSize: 11, color: C.muted, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>◈ {kb}</div>
            ))}
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
