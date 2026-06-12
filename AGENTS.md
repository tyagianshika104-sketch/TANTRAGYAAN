# AGENTS.md — FundedFirst Codebase Guide for IBM Bob

## Project Overview

FundedFirst is a Python/Flask + React/TypeScript application that helps students discover job opportunities at recently funded Indian startups. It scrapes funding news, uses AI to score opportunities, analyses CVs, drafts cold emails, and provides an interactive AI career co-pilot.

## Key Modules

### Backend (Python/Flask)
- `app.py` — Flask API server, all REST routes, auth middleware, SSE streaming
- `main.py` — Scraping and enrichment pipeline orchestrator
- `config.py` — Environment variable loading and validation
- `database.py` — Cloudant (primary) → Firebase (fallback) data layer
- `extractor.py` — Funding data extraction and parsing
- `email_sender.py` — Email digest sender

### AI Agents (`agents/`)
- `ibm_watsonx.py` — IBM Watsonx.ai Granite inference (primary AI engine)
- `ibm_nlu.py` — IBM Watson NLU sentiment & keyword analysis
- `ibm_cos.py` — IBM Cloud Object Storage for CV files
- `ibm_tts.py` — IBM Text-to-Speech for audio summaries
- `ibm_stt.py` — IBM Speech-to-Text for voice input
- `cv_scorer.py` — CV analysis: IBM Watsonx → Gemini fallback
- `researcher.py` — Startup research: IBM Watsonx → Gemini fallback
- `scorer.py` — Opportunity scoring: IBM Watsonx → Gemini fallback
- `email_drafter.py` — Cold email generation: IBM Watsonx → Gemini fallback
- `fake_news_detector.py` — Credibility checking: IBM Watsonx → Gemini fallback
- `copilot.py` — Career co-pilot: IBM Watsonx → Gemini fallback

### Scrapers (`scrapers/`)
- `inc42.py`, `yourstory.py`, `entrackr.py`, `crunchbase.py`, `google_news.py`

### Frontend (`frontend/src/`)
- `pages/Dashboard.tsx` — Main dashboard with co-pilot chat
- `pages/DiscoverStartups.tsx` — Startup discovery with filters
- `pages/CVScore.tsx` — CV analysis with donut chart
- `pages/EmailDrafts.tsx` — Email drafting interface
- `pages/MyApplications.tsx` — Application tracking
- `pages/Settings.tsx` — Profile management
- `lib/api.ts` — API client for all backend routes

## Coding Standards

- **Python**: Type hints on all functions, docstrings on all public functions
- **TypeScript**: Strict mode, minimal `any` types
- **All AI calls**: IBM Watsonx first, Gemini fallback, always log which engine was used
- **All database writes**: Cloudant first, Firebase fallback
- **Error handling**: Never swallow exceptions silently, always log
- **Security**: No secrets in code, all credentials via `.env`

## Testing

```bash
python test_cv_scorer.py      # CV scoring tests
python -m pytest              # All tests
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Service status check |
| POST | `/api/auth/login` | No | Local auth login |
| POST | `/api/auth/signup` | No | Local auth signup |
| GET | `/api/profile` | Yes | Get user profile |
| PUT | `/api/profile` | Yes | Update profile |
| POST | `/api/profile/cv` | Yes | Upload CV (→ IBM COS) |
| POST | `/api/cv-score` | Yes | Analyse CV (→ IBM Watsonx) |
| GET | `/api/startups` | Yes | List startups |
| POST | `/api/run` | Yes | Start discovery pipeline |
| POST | `/api/copilot/ask` | Yes | Ask AI co-pilot |
| POST | `/api/tts/startup` | Yes | Text-to-speech |
| POST | `/api/stt/transcribe` | Yes | Speech-to-text |
| GET | `/api/stream` | No | SSE pipeline updates |
