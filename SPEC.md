# Implementation scope

Implement P0 from the final Athena PRD (24 pages), complete supplied FigJam export, and three supplied reference images. All were read before implementation. The workspace was empty on inspection; no existing app, stack or local project instructions existed.

1. Foundation: React/Vite + Express, SQLite persistence, local single-learner identity, search-first Home, project CRUD, grid/list and workspace. Verify refresh persistence and navigation.
2. Learning: asynchronous ingestion for text, public articles, PDF, DOCX and video with supplied timestamped transcript; original-file fallback; chunk locations; local Ollama embeddings and grounded answers; source-linked notes. Verify input types, failure recovery, source jumps and project isolation.
3. Proof: concept extraction, finish flow, selection-based review setup, Explain Back/Cue Cards/Apply It, confidence and assistance, validated evaluation, evidence and reports. Verify real local model with positive, incomplete and irrelevant responses; preserve attempts on failed evaluation.
4. Retention/polish: deterministic concept schedules, Review Now, focus, accessibility, responsive layout, honest empty/error states. Verify golden path with Playwright and rendered inspection.

Technical decisions: SQLite via Node's built-in sqlite keeps local persistent storage small. Resources retain files and page/paragraph/timestamp chunks. Model and embedding names are environment-configurable behind an Ollama adapter, server restricted to localhost. No external model APIs. AI failure is explicit and retriable; no synthetic mastery or pretending a keyword heuristic is AI. A labelled optional example project contains original demo text, no fabricated sources or learner history. Public URL fetching does not access private network addresses. Local identity satisfies PRD's local auth equivalent; no email/account service required.

PRD resolves earlier FigJam verification tags and account flow: use source metadata and local profile, not fabricated expert verification or email delivery. Extra audio, image/doodle notes and expanded web search are P1, after P0. No deployment requested.
