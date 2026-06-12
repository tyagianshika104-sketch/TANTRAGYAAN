# FundedFirst — Agentic AI for Startup Job Discovery

> 🏆 Built for the **IBM Bob Hackathon** — *"Turn idea into impact faster"*
>
> Powered by **IBM Bob IDE** | **IBM Watsonx.ai Granite** | **IBM NLU** | **IBM COS** | **IBM Cloudant** | **IBM TTS** | **IBM STT**

---

## What It Does

FundedFirst is an agentic AI platform that helps students and early-career candidates discover recently funded Indian startups, assess opportunity fit, and prepare personalized application outreach — all from a beautiful web dashboard.

### Core Pipeline
1. **Scrapes** funded startup news from Inc42, YourStory, Entrackr, Google News, Crunchbase
2. **Scores** each startup as a job opportunity using IBM Watsonx Granite
3. **Analyzes** article sentiment & keywords using IBM Watson NLU
4. **Scores** the user's CV against startup sectors
5. **Drafts** cold outreach emails personalized to each startup
6. **Tracks** applications with a Kanban-style board
7. **Co-Pilot** — an AI career advisor powered by IBM Watsonx

---

## IBM Technologies Used

| Service | Purpose | Module |
|---------|---------|--------|
| **IBM Bob IDE** | Used to build, refactor, and test the entire codebase | — |
| **IBM Watsonx.ai (Granite-13b-chat-v2)** | Primary AI engine for scoring, CV analysis, email drafting, research, and co-pilot | `agents/ibm_watsonx.py` |
| **IBM Watson NLU** | Sentiment analysis and keyword extraction on funding articles | `agents/ibm_nlu.py` |
| **IBM Cloud Object Storage** | Secure CV file storage with pre-signed URLs | `agents/ibm_cos.py` |
| **IBM Cloudant** | Primary NoSQL database for startup records and user profiles | `database.py` |
| **IBM Text-to-Speech** | Audio summaries of startup cards | `agents/ibm_tts.py` |
| **IBM Speech-to-Text** | Voice input for the AI co-pilot chat | `agents/ibm_stt.py` |

> **All AI calls use IBM Watsonx as the primary engine.** Google Gemini is configured only as a fallback when Watsonx is unavailable.

---

## Architecture

```
┌─────────────┐    ┌──────────────────────────────────────────────────┐
│  React/Vite │◄──►│  Flask API (app.py)                             │
│  Dashboard  │    │  ├── /api/run          → Pipeline orchestrator  │
│  (Port 5173)│    │  ├── /api/startups     → Startup list + scoring │
│             │    │  ├── /api/cv-score     → CV analysis            │
│             │    │  ├── /api/copilot/ask  → AI career advisor      │
│             │    │  ├── /api/tts/startup  → Audio summaries        │
│             │    │  ├── /api/stt/transcribe → Voice input          │
│             │    │  └── /api/health       → Service status         │
└─────────────┘    └──────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          ▼                   ▼                       ▼
   ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐
   │ IBM Watsonx   │  │ IBM Cloudant  │  │ IBM Cloud Object    │
   │ Granite LLM   │  │ (NoSQL DB)    │  │ Storage (CVs)       │
   └──────────────┘  └───────────────┘  └─────────────────────┘
          │
   ┌──────┴──────┐
   │ IBM Watson   │
   │ NLU/TTS/STT  │
   └─────────────┘
```

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd FundedFirst
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
# IBM Watsonx.ai (REQUIRED — primary AI engine)
WATSONX_API_KEY=your_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# IBM Watson NLU
IBM_NLU_API_KEY=your_key
IBM_NLU_URL=your_url

# IBM Cloud Object Storage
COS_API_KEY=your_key
COS_ENDPOINT=your_endpoint
COS_INSTANCE_CRN=your_crn

# IBM Cloudant
CLOUDANT_API_KEY=your_key
CLOUDANT_URL=your_url

# IBM TTS / STT
IBM_TTS_API_KEY=your_key
IBM_TTS_URL=your_url
IBM_STT_API_KEY=your_key
IBM_STT_URL=your_url

# Firebase (fallback auth + DB)
FIREBASE_CREDENTIALS_PATH=firebase_credentials.json
FIREBASE_WEB_API_KEY=your_key
# ... other Firebase config

# Gemini (fallback AI only)
GEMINI_API_KEY=your_key
```

### 3. Firebase credentials

> ⚠️ **NEVER commit `firebase_credentials.json` to git.** Use `firebase_credentials.example.json` as a template.

### 4. Run

```bash
# Terminal 1 — Backend
python app.py

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Docker (production)

```bash
docker-compose up --build
```

---

## How IBM Bob Was Used

- **`/init`** — Used to understand the full codebase structure and identify architectural issues
- **Refactoring** — Migrated all 6 AI agents from Gemini-only to IBM Watsonx-first pattern
- **Bug fixing** — Identified and fixed the broken `/api/run` route and duplicate decorators
- **Test generation** — Generated test cases for CV scoring pipeline
- **Documentation** — Generated this README and AGENTS.md

---

## License

MIT