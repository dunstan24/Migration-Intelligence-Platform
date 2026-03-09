"""
routers/llm.py
POST /api/llm/chat → SSE stream
RAG pipeline: embed query → ChromaDB top-K → build prompt → Claude stream
Matches README useSSE hook: data: {"token": "..."} format
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import os

router = APIRouter()


class ChatRequest(BaseModel):
    message:    str
    session_id: Optional[str] = None


async def rag_retrieve(query: str) -> list[str]:
    """
    ChromaDB similarity search — top-5 relevant chunks.
    Sprint 5: real sentence-transformers embed + ChromaDB query.
    """
    # Mock top-K chunks until Sprint 5
    return [
        f"OSL 2025: Software Engineers show high shortage across VIC, NSW, QLD.",
        f"EOI Oct 2025: Points cutoff reached 97 for 189 visa stream.",
        f"JSA Atlas: Registered Nurses rated as 'shortage' in all 8 states.",
        f"Visa 190: State nominated stream granted 22,400 in 2024–25.",
        f"Employment projections: IT sector projected +64% growth by 2035.",
    ]


async def stream_claude(prompt: str):
    """
    Call Anthropic Claude API with streaming.
    Returns SSE tokens: data: {"token": "..."}\n\n
    Sprint 5: real Anthropic client implementation.
    """
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        # Dev fallback — mock stream
        mock = f"[Mock response — add ANTHROPIC_API_KEY to .env]\n\nYour question was about: {prompt[:100]}..."
        for word in mock.split():
            yield f"data: {json.dumps({'token': word + ' '})}\n\n"
        yield "data: [DONE]\n\n"
        return

    client = anthropic.Anthropic(api_key=api_key)

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {json.dumps({'token': text})}\n\n"

    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(body: ChatRequest):
    """
    POST /api/llm/chat
    RAG workflow per README:
      1. Embed user query → vector
      2. ChromaDB search → top-5 chunks
      3. Build prompt: system + context + message
      4. Claude stream → SSE tokens
    """
    # Step 1 + 2: RAG retrieval
    chunks = await rag_retrieve(body.message)

    # Step 3: Build prompt
    context = "\n".join(f"- {c}" for c in chunks)
    system = (
        "You are a Migration Advisor for Inter Studies, an Australian migration consultancy. "
        "Answer questions about Australian visas, occupation shortages, EOI/SkillSelect, "
        "and migration pathways. Always cite your sources from the context provided."
    )
    prompt = f"{system}\n\nContext from knowledge base:\n{context}\n\nUser question: {body.message}"

    # Step 4: Stream Claude response
    async def generate():
        async for chunk in stream_claude(prompt):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
