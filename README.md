# Athena

A local learning workspace built from the supplied Athena PRD, flows, mid-fidelity screens and style guide.

## Run

Requires Node 22.13+ (built-in SQLite), npm and Ollama. Install dependencies with `npm install`, then run `npm run dev`. Open http://127.0.0.1:3000. For a production build, run `npm run build` followed by `npm start`.

Ollama needs `nomic-embed-text:latest` for indexing and an instruction model. Defaults are `http://127.0.0.1:11434` and `llama3.1:8b`. Configure `OLLAMA_BASE_URL`, `ATHENA_MODEL`, `ATHENA_EMBED_MODEL` and optionally `ATHENA_AI_TIMEOUT_MS` in the launching shell. Model requests are restricted to loopback addresses; no cloud AI credentials are used.

On this machine, the 8B model exhausted available memory. The verification session uses `llama3.2:3b` and a separate local Ollama server at port 11435. The smaller model is less capable; all outputs still pass schema and citation checks, and assessment feedback should be checked against its evidence. `start-local.ps1` starts the same isolated setup without changing the existing Ollama service. Run `ollama pull llama3.2:3b` and `ollama pull nomic-embed-text` first if those models are absent.

## Use

Create a project and learning goal. Add text, a public article URL, a PDF/DOCX document, or a video URL with a supplied transcript. Imports run in the background and retain their original. Read, capture contextual notes, and ask questions against indexed project sources. Mark the project finished when ready; it stays editable.

Extract concepts and choose a review mode and scope. Attempt a response, record confidence, and optionally request help. Evaluation records evidence against expected facts. Reports link back to sources and separate resource activity from demonstrated knowledge. Weak or assisted concepts receive earlier review dates; Reviews lets you revisit them.

The optional example contains original demo text and no fabricated learning history. The local profile needs no account. Files, notes, embeddings, attempts and schedules are saved under `data/`; browser drafts are stored in local storage. Back up the entire `data/` directory while the app is stopped. Do not expose this single-user prototype to a public network.

## Limits

- Search covers your saved local library. Expanded web discovery and resource connections are P1.
- Scanned PDFs need OCR elsewhere. Unsupported or protected websites remain as failed imports with their original link and retry action.
- Videos need a supplied transcript for grounding. YouTube uses an embedded player; manual timestamps and transcript links capture source moments. Some providers require opening the original.
- AI can be unavailable or wrong. Failed generation/evaluation preserves saved work and offers retry; activity and self-confidence never substitute for assessment evidence.
- Rich media notes, voice assessment, cloud accounts and deployment are outside this P0 prototype.

## Verify

`npm test` checks chunk preservation, source boundaries, evaluation validation, mastery, schedules and persistence. With the app running, `npm run test:api` exercises disposable imports and project CRUD and writes `output/verification/api-results.json`. `npm run build` verifies the bundled frontend. UI verification is performed in the real browser; see the acceptance record in `output/verification/` for its current status.


Use ./start-local.ps1 -Production to run the built app with the verified low-memory configuration. Run node scripts/verify-recovery.js for isolated malformed-output and model-outage tests. The acceptance record includes real-model evidence captured before test-project cleanup; the delivered example has no fabricated learning history.
