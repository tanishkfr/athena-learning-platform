# Correction pass implementation map

Authority: attachment 2c7e3aa4 goal-objective.md; existing DESIGN.md; supplied FigJam user flow and MF-01 through MF-10.

1. src/store.jsx, signup.jsx, main.jsx, forms.jsx: start signed out; mock identity; preserve project title, goal and description before onboarding; resume creation. Flow: launch > browse > save > create account > verify > greeting. Login and mock provider actions use only browser identity.
2. New discovery component shared by Home and search: mixed-format masonry, bottom-right save, existing/new project selection, confirmation with continue browsing or learn. Flow: search > select source > save > create/add project > confirmation > learn.
3. Existing Learn/Notes: retain source-associated notes; connect discovered resources to this implementation. Flow: open resource > learn/skim > capture > save note to resource.
4. project.jsx, pages.jsx, review.jsx and review API: remove completion prerequisite, move Finish to dashboard, add breadcrumbs, retain existing evidence evaluation and three review modes. MF-08 dashboard, MF-09 project and MF-10 review/setup.
5. styles.css and visible copy: selective orange actions, outlined Home controls, accessible focus/contrast, reduced decorative surfaces, left-aligned later onboarding. Preserve palette, typography and unrelated layout.
6. Verify signed-out search/save and deferred project creation, signed-in saving/notes, review before completion, all three review activities, dashboard completion, mobile and keyboard behavior, build and existing regression suite.

Representative signup was exercised through invalid-code recovery and successful workspace entry. Mobile width 375px had no horizontal overflow. Broader corrections remain in progress; prior P0 acceptance is not evidence that these new requirements are complete.
