import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import joblib
import requests
import html
from typing import List, Dict, Any
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, constr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# -----------------------------------------
# Security & Rate Limiting Setup
# -----------------------------------------
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Secure RAG API", description="Cyber-secure API for Teaching Assistant")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Restrict CORS to our future frontend origin only (e.g. localhost:5173)
origins = [
    "http://localhost:5173", # Vite default
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# -----------------------------------------
# Input Validation Models
# -----------------------------------------
class ChatRequest(BaseModel):
    # Enforce strict length limits to prevent buffer overflow or DoS via massive payloads
    query: constr(min_length=1, max_length=500) = Field(..., description="The user's question about the course")
    history: List[Dict[str, Any]] = Field(default=[], description="Previous conversation messages")

# -----------------------------------------
# Load Resources
# -----------------------------------------
# Load embeddings securely
try:
    df = joblib.load('embeddings.joblib')
except Exception as e:
    print(f"Failed to load embeddings: {e}")
    df = None


def create_embedding(text_list):
    r = requests.post("http://localhost:11434/api/embed", json={
        "model": "bge-m3",
        "input": text_list
    })
    return r.json()["embeddings"]

def generate_inference_stream(prompt):
    s = requests.Session()
    with s.post("http://localhost:11434/api/generate", json={
        "model": "llama3.2",
        "prompt": prompt,
        "stream": True # Enable dynamic streaming
    }, stream=True) as resp:
        for line in resp.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    if "response" in data:
                        # Output strictly formatted SSE string so the frontend can read the chunks seamlessly
                        yield f"data: {json.dumps({'chunk': data['response']})}\n\n"
                except Exception as e:
                    pass

def rewrite_query_with_context(query: str, history: List[Dict[str, Any]]) -> str:
    if not history:
        return query
    
    # Find the most recent user message
    last_user_msg = ""
    for msg in reversed(history):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content")
            break
            
    # Simply combine the previous user question with the current one for high-speed semantic search accuracy without LLM overhead
    if last_user_msg:
        return f"{last_user_msg} {query}"
    return query

# -----------------------------------------
# Protected Route
# -----------------------------------------
@app.post("/api/chat")
@limiter.limit("10/minute") # Strict rate limit to prevent spam and high API costs
async def chat_endpoint(request: Request, payload: ChatRequest):
    if df is None:
        raise HTTPException(status_code=500, detail="Database is offline.")

    # 1. Sanitize the input to prevent XSS or prompt injection tricks using HTML formatting
    sanitized_query = html.escape(payload.query.strip())
    
    # 2. Prevent arbitrary deep logic execution or path traversal in strings
    if ".." in sanitized_query or "<script>" in sanitized_query:
        raise HTTPException(status_code=400, detail="Invalid characters in request.")

    try:
        # 3. Contextualize Query (Memory Injection)
        search_query = rewrite_query_with_context(sanitized_query, payload.history)
        print(f"Original Query: {sanitized_query}")
        print(f"Search Query: {search_query}")

        question_embedding = create_embedding([search_query])[0]
        
        # 4. Vector Search with Chronological Context Expansion
        similarities = cosine_similarity(np.vstack(df['embedding']), [question_embedding]).flatten()
        top_hits = 3 # Start with top 3 most relevant sentences
        max_indx = similarities.argsort()[::-1][0:top_hits]
        
        # Expand around the top hits to grab contiguous paragraphs for depth!
        expanded_indices = set()
        for idx in max_indx:
            base_row = df.loc[idx]
            base_title = base_row['title']
            
            # If chunk_id exists, grab the 2 chunks before it, and the 8 chunks after it to form a solid chronological block
            if 'chunk_id' in df.columns:
                base_chunk_id = base_row['chunk_id']
                # Search dataframe for neighbors in the same video
                neighbors = df[(df['title'] == base_title) & 
                               (df['chunk_id'] >= base_chunk_id - 1) & 
                               (df['chunk_id'] <= base_chunk_id + 5)]
                for n_idx in neighbors.index:
                    expanded_indices.add(n_idx)
            else:
                expanded_indices.add(idx)
                
        # Sort by chunk_id so the LLM reads them in linear order
        if 'chunk_id' in df.columns:
            new_df = df.loc[list(expanded_indices)].sort_values('chunk_id').copy()
        else:
            new_df = df.loc[list(expanded_indices)].copy()
        
        # Convert raw seconds into human-readable MM:SS format
        new_df['start'] = new_df['start'].apply(lambda x: f"{int(float(x) // 60)}:{int(float(x) % 60):02d}")
        new_df['end'] = new_df['end'].apply(lambda x: f"{int(float(x) // 60)}:{int(float(x) % 60):02d}")
        
        # 5. Prompt Engineering
        # Build prompt with history
        history_str = ""
        for msg in payload.history[-3:]: # short snippet of recent history
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f'''You are a world-class AI university professor. Here is a transcript of course material containing video chunks:

{new_df[["title", "number", "start", "end", "text"]].to_json(orient="records")}
---------------------------------
Recent Conversation Context:
{history_str}

User's Question: "{sanitized_query}"

INSTRUCTIONS:
1. You MUST fully answer the user's question using the transcript provided.
2. Provide a clear, detailed, and deeply technical explanation based on the transcript.
3. Use Markdown heavily (bullet points, bold text) to make it easy to read.
4. IMPORTANT: Do NOT make your answer too long or it will get cut off!
5. After your explanation, on a new line at the very end, you MUST provide the video reference in exactly this strict format:
[[SOURCE: <Video Title> | <MM:SS>]]
For example: [[SOURCE: 3.5 Prims Algorithm | 14:33]]
'''
        
        # 6. Stream Inference
        return StreamingResponse(generate_inference_stream(prompt), media_type="text/event-stream")
        
    except Exception as e:
        # Avoid leaking technical stack traces to the client
        print(f"Error during processing: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while processing your request.")
