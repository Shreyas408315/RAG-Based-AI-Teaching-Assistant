# RAG-Based AI Teaching Assistant

This project is a Retrieval-Augmented Generation (RAG) application that answers questions from course transcripts.

## Project structure

- `app.py` — FastAPI backend serving `/api/chat`
- `frontend/` — Vite React frontend
- `embeddings.joblib` — serialized embeddings datastore loaded by the backend
- `read_chunks.py`, `process_incoming.py` — helpers for creating embeddings and processing transcript chunks

## Prerequisites

- Python 3.11 or newer
- Node.js 18+ and npm
- A local model server exposing:
  - `http://localhost:11434/api/embed`
  - `http://localhost:11434/api/generate`

## Install backend dependencies

From the repo root:

```sh
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Install frontend dependencies

```sh
cd frontend
npm install
```

## Run the backend

From the repo root after activating the Python virtual environment:

```sh
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at `http://127.0.0.1:8000`.

## Run the frontend

From `frontend/`:

```sh
npm run dev
```

Open the app in your browser at `http://localhost:5173`.

## Important notes

- `app.py` requires `embeddings.joblib` in the repo root.
- The backend depends on the local model server at port `11434` for both embedding and generation requests.
- If you need to regenerate embeddings, use the root scripts such as `read_chunks.py`.

## GitHub push

Before pushing, you may want to add a `.gitignore` and confirm the repo is initialized with Git.
