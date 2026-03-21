<p align="center">
  <h1 align="center">Clinical Promise Keeper</h1>
  <p align="center">
    <strong>No promise left behind.</strong><br/>
    An MCP-powered healthcare AI agent that tracks unfulfilled clinical commitments from physician notes.
  </p>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/MCP-Model_Context_Protocol-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3TDEyIDJ6Ii8+PC9zdmc+" alt="MCP"></a>
  <a href="#"><img src="https://img.shields.io/badge/A2A-Agent_to_Agent-purple?style=for-the-badge" alt="A2A"></a>
  <a href="#"><img src="https://img.shields.io/badge/FHIR-R4-red?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6Ii8+PC9zdmc+" alt="FHIR R4"></a>
  <a href="#"><img src="https://img.shields.io/badge/Gemini-3.1_Flash_Lite-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini"></a>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="#"><img src="https://img.shields.io/badge/Cloud_Run-Deployed-4285F4?style=flat-square&logo=googlecloud&logoColor=white" alt="Cloud Run"></a>
  <a href="#"><img src="https://img.shields.io/badge/Docker-Alpine-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Hackathon-Agents_Assemble_2026-orange?style=flat-square" alt="Hackathon"></a>
</p>

---

## The Problem

> **50–60% of clinical follow-ups are never completed.** Promises made in clinical notes — labs, referrals, imaging — slip through the cracks, leading to delayed diagnoses and adverse patient outcomes.

Clinical Promise Keeper is an **MCP server** that extracts implicit and explicit clinical commitments from physician notes, verifies them against FHIR patient records, and generates actionable FHIR Task resources for unfulfilled promises.

## Demo

<!-- Replace with your actual demo video link -->
> [Watch the 3-minute demo video →](#)

## How It Works

```
Clinical Note → [AI Extraction] → [Calibration] → [FHIR Verification] → [Clinical Insight] → [Narrative Summary]
                     ↓                   ↓                  ↓                    ↓                    ↓
              5-Pass Pipeline     Few-shot CoT      Multi-hop FHIR R4      Significance Score     Action Items
```

### 5-Pass AI Pipeline

| Pass | Stage | Description |
|------|-------|-------------|
| 1 | **Extraction** | Gemini identifies clinical promises using few-shot chain-of-thought prompting with 3 clinical note examples |
| 2 | **Calibration** | Second LLM pass validates extractions against source text — checks quote accuracy, class correctness, timeframe reasonableness |
| 3 | **FHIR Verification** | Multi-hop queries across ServiceRequest, Observation, Appointment, DiagnosticReport, and DocumentReference resources |
| 4 | **Clinical Insight** | AI generates significance scoring (high/medium/low) with rule-based fallback |
| 5 | **Narrative Summary** | Human-readable clinical narrative with prioritized action items |

### A2A Multi-Agent Collaboration

Clinical Promise Keeper collaborates with **Clinical Order Assistant** via the [A2A (Agent-to-Agent) protocol](https://google.github.io/A2A/) on the Prompt Opinion platform:

1. **Clinical Promise Keeper** identifies unkept promises (e.g., "CBC not ordered")
2. **Clinical Order Assistant** receives a consult and drafts the corresponding FHIR ServiceRequest
3. Clinician reviews and approves — closing the loop from identification to action

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Prompt Opinion Platform              │
│  ┌─────────────────┐       ┌──────────────────────┐  │
│  │  Clinical Promise│  A2A  │  Clinical Order      │  │
│  │  Keeper Agent    │◄─────►│  Assistant Agent      │  │
│  └────────┬────────┘       └──────────────────────┘  │
│           │ MCP (JSON-RPC)                            │
└───────────┼──────────────────────────────────────────┘
            │
            ▼
┌──────────────────────┐    ┌─────────────────┐
│  Cloud Run Service   │    │  FHIR R4 Server │
│  ┌────────────────┐  │    │                 │
│  │ MCP Server     │  │◄──►│ ServiceRequest  │
│  │ (JSON-RPC)     │  │    │ Observation     │
│  ├────────────────┤  │    │ Appointment     │
│  │ Gemini 3.1     │  │    │ DiagnosticReport│
│  │ Flash Lite     │  │    │ DocumentRef     │
│  ├────────────────┤  │    │ Task (write)    │
│  │ SHARP Headers  │  │    └─────────────────┘
│  │ Context Engine │  │
│  └────────────────┘  │
└──────────────────────┘
```

## MCP Tools

The server exposes 4 tools via JSON-RPC:

| Tool | Description |
|------|-------------|
| `extract_promises` | Analyzes clinical notes to extract implicit and explicit commitments (labs, appointments, imaging) |
| `check_promises` | Verifies extracted promises against FHIR data — determines kept, pending, or unkept status |
| `generate_tasks` | Creates draft FHIR R4 Task resources for unkept promises for clinician review |
| `get_promise_summary` | End-to-end pipeline: extract → verify → summarize with AI-generated clinical narrative |

### SHARP Extension Headers

The server uses [SHARP](https://build.fhir.org/ig/AIDeveloperAlliance/SHARP/) healthcare context headers:

| Header | Purpose |
|--------|---------|
| `X-FHIR-Server-URL` | Target FHIR R4 server endpoint |
| `X-FHIR-Access-Token` | OAuth2 bearer token for FHIR access |
| `X-Patient-ID` | FHIR Patient resource ID |

## Validation Results

Benchmarked against **21 clinical notes** across **8 medical specialties**:

| Metric | Score |
|--------|-------|
| **F1 Score** | **81.2%** |
| **Recall** | **84.4%** |
| **Precision** | **78.3%** |

Specialties tested: Primary Care, Cardiology, Oncology, Endocrinology, Surgery, Psychiatry, Emergency Medicine, Nephrology.

> View detailed validation metrics at the `/metrics` endpoint.

## Project Structure

```
src/
├── index.ts                    # HTTP server with direct JSON-RPC handler
├── llm/
│   ├── gemini.ts               # Gemini client (@google/genai SDK)
│   ├── summarizer.ts           # AI narrative generation
│   ├── verifier.ts             # Clinical insight scoring
│   └── extraction-examples.ts  # Few-shot chain-of-thought examples
├── promises/
│   ├── extractor.ts            # Promise extraction with CoT prompting
│   ├── calibrator.ts           # Second-pass validation
│   ├── checker.ts              # FHIR multi-hop verification
│   ├── normalizer.ts           # Temporal expression parser
│   └── types.ts                # ClinicalPromise & PromiseStatus interfaces
├── tasks/
│   └── generator.ts            # FHIR R4 Task resource generation
├── fhir/
│   ├── client.ts               # FHIR R4 REST client
│   ├── queries.ts              # FHIR search query builders
│   ├── resources.ts            # Resource type definitions
│   └── mock-data.ts            # Mock data for demo reliability
├── tools/
│   ├── extract-promises.ts     # MCP tool: extract_promises
│   ├── check-promises.ts       # MCP tool: check_promises
│   ├── generate-tasks.ts       # MCP tool: generate_tasks
│   └── get-promise-summary.ts  # MCP tool: get_promise_summary
├── sharp/
│   └── context.ts              # SHARP header extraction
├── utils/
│   └── disclaimers.ts          # Clinical & task disclaimers
└── dashboard/
    ├── index.html              # Interactive dashboard
    ├── metrics.html            # Validation metrics display
    ├── title.html              # Demo title slide
    └── closing.html            # Demo closing slide
```

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Google Cloud** project with Vertex AI API enabled
- **GCP Service Account** with `Vertex AI User` role

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GCP_PROJECT_ID` | — | Google Cloud project ID (required) |
| `GCP_LOCATION` | `global` | Gemini API location |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite-preview` | Gemini model identifier |
| `PORT` | `3000` | HTTP server port |

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run extraction validation benchmark
GCP_PROJECT_ID=your-project npm run validate
```

### Deploy to Cloud Run

```bash
# Set your project ID
export GCP_PROJECT_ID=your-project-id

# Deploy (builds container + deploys)
npm run deploy
```

The deploy script configures:
- **Region:** `us-central1` (Cloud Run) / `global` (Gemini API)
- **Resources:** 512Mi memory, 1 CPU
- **Scaling:** min 1 / max 3 instances
- **Timeout:** 300s

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/health` | GET | Health check |
| `/dashboard` | GET | Interactive promise dashboard |
| `/metrics` | GET | Validation metrics display |
| `/title` | GET | Demo title slide |
| `/closing` | GET | Demo closing slide |

## HIPAA & Compliance Considerations

> **This tool is designed for clinical decision support only and is NOT a substitute for professional medical judgment.** All outputs require clinician review before any clinical action is taken.

- No Protected Health Information (PHI) is stored, logged, or persisted by this service
- All clinical data is processed transiently in memory and discarded after each request
- The system operates as a stateless pass-through — clinical notes are sent to Gemini for extraction, and FHIR data is queried in real-time
- SHARP extension headers ensure FHIR access tokens are scoped per-request and never cached
- In a production deployment, this system would operate within a BAA-covered environment with appropriate access controls, audit logging, and encryption at rest/in transit
- The system includes clinical disclaimers on all outputs

## Hackathon

Built for the **[Agents Assemble: The Healthcare AI Endgame](https://agents-assemble-the-healthcare-ai-endgame.devpost.com/)** hackathon on the Prompt Opinion platform.

| | |
|-|-|
| **Platform** | [Prompt Opinion](https://www.promptopinion.com/) |
| **Category** | Healthcare AI Agents with MCP & FHIR |

### Judging Criteria Addressed

- **Clinical Relevance** — Solves a real patient safety problem (missed follow-ups)
- **Technical Innovation** — 5-pass AI pipeline with few-shot CoT, temporal normalization, and FHIR multi-hop verification
- **MCP Integration** — Full MCP server with 4 tools, SHARP healthcare context headers
- **A2A Collaboration** — Multi-agent workflow: promise detection → order drafting
- **FHIR Compliance** — Native FHIR R4 reads (verification) and writes (Task generation)
- **Validation** — 81.2% F1 across 8 specialties with reproducible benchmarks

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe server implementation |
| **Gemini 3.1 Flash Lite** | Clinical NLP extraction & summarization |
| **@google/genai SDK** | Unified Google Gen AI client |
| **FHIR R4** | Healthcare interoperability standard |
| **MCP (JSON-RPC)** | Agent tool protocol |
| **A2A Protocol** | Multi-agent collaboration |
| **SHARP Headers** | Healthcare context extension |
| **Cloud Run** | Serverless container deployment |
| **Docker** | Containerization (node:20-alpine) |

## License

[MIT](LICENSE) &copy; 2026 Prabhakaran Jayaraman Masani
