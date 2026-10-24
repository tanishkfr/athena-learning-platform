# Athena design system

Source authority: supplied PRD section 65 and image-1.png style guide. Composition follows the supplied mid-fidelity project, review setup, active review and report screens. Behaviour follows the final PRD over exploratory FigJam content.

Visual thesis: a calm editorial learning desk in warm cream, with navy typography, generous space and restrained orange emphasis.

Content structure: search-first Home; recent learning then project grid/list; tabbed project workspace with topic/goal area and saved resources; Learn with adjacent notes; review modes followed by resource selection and instructions; active response area with scope sidebar; report with analysis and concept evidence.

Tokens: cream #FFFAED, navy #173461, light blue #A9C9D8, orange #D95F32. Literata Medium for display, Rubik Regular for UI/body with -0.03em tracking. Body text remains readable at 15–17px. Spacing uses 4/8/12/16/24/32/48/64px. Pills for actions/inputs, restrained panel corners and borders.

Interaction thesis: short panel entrances, clear hover/focus affordances, and smooth focus-panel resizing. Reduced motion removes these transitions. No decorative motion during reading or retrieval.

Preserve the signature moment: after an independent response, reveal specific strengths and gaps alongside the exact supporting source, with one route back into learning. Never equate completion, confidence or self-rating with mastery.

## Phase 1 implementation conventions

The opening sections of `src/styles.css` own the shared foundation, shell and everyday workspace. Superseded Phase 1 rules were removed from the old cascade; the remaining specialised Reader, Reviews, Notes, Reports and onboarding rules are grouped afterward for Phase 2. Extend the owning rule rather than appending another screen override.

- Keep cream `#FFFAED`, navy `#173461`, soft blue `#A9C9D8` and terracotta `#D95F32`. Use the darker `--action: #ad4524` for readable cream text on primary buttons. Paper surfaces use `--surface`, subdued groupings use `--surface-blue`, and boundaries use `--line`.
- Literata carries editorial headings and learning goals; Rubik carries controls, metadata and compact workspace section labels. Display tracking stops at `-.04em`. Main copy stays at 14–16px; secondary source metadata stays at 11–13px. Reading-size preferences remain independent.
- Use the 1240px content envelope with 48px desktop, 32px tablet, 24px mobile and 16px narrow-mobile gutters. Content moves to one column before it becomes cramped. Navigation collapses at 900px, collections at 600px, and narrow project tabs scroll within their own container when needed.
- Actions and search controls remain pill-shaped; source and project cards use 12px corners, one restrained border, and no decorative shadow. Hover and pressed states communicate interaction. Keep visible keyboard focus and reduced-motion support.
- Home pairs the editorial invitation with sample search and project/import actions. Recent work comes before discovery for returning learners. Do not describe the fixed sample collection as personal recommendations or live web search.
- Project cards lead with title and learning goal. Do not invent cover images, progress percentages or achievements. Keep resource counts and tested concepts distinct. Grid and list use the same content and controls.
- The overview leads with the goal and saved sources. Keep resource activity and knowledge evidence visibly separate, including their honest empty states. Preserve source-linked review feedback as the signature moment when working on Phase 2.
- Discovery cards follow reading order in a responsive grid. Preserve the original sample diagrams as resource content. Saved Library sources and public sample discovery have different labels and search scopes.
- Mock sign-in, browser-local persistence and scripted feedback remain explicitly disclosed. Local indexing and file/URL extraction claims apply only to the real local workspace.
