# Repository Guidelines

## Project Structure & Module Organization
The Next.js App Router lives in `app/`, with `page.tsx`, `host/`, `join/`, and dynamic `room/[code]/vote|discussion|result|host` routes defining every screen. Shared logic stays in `lib/` (`supabaseClient.ts`, `database.types.ts`, helpers in `utils.ts`), and Supabase SQL lives under `supabase/` (`schema.sql` for bootstrap, `clear-all-data.sql` for maintenance). Assets referenced by URLs stay remote; global styles and Tailwind layers are centralized in `app/globals.css`. Derived artifacts (`.next/`, cached env files) must remain untracked.

## Build, Test, and Development Commands
`npm install` once per workstation. `npm run dev` launches the hot-reloaded development server on `http://localhost:3000`. `npm run build` performs TypeScript checking plus Next.js production compilation, and `npm run start` serves the optimized build (use this before handing off). `npm run lint` runs `eslint-config-next`; fix or justify every warning before committing.

## Coding Style & Naming Conventions
Use TypeScript with functional React components. Component files and server actions use PascalCase (`RoomVotePanel.tsx`), utilities/functions use camelCase, and environment variables stay UPPER_SNAKE_CASE (`NEXT_PUBLIC_SUPABASE_URL`). Favor Tailwind utility classes over bespoke CSS; if layout logic gets complex, extract helpers into `lib/utils.ts` with brief doc comments. Keep data-fetching bound to `lib/supabaseClient.ts` to preserve typed queries.

## Testing Guidelines
There is no automated harness yet, so follow `TEST-GUIDE.md`: run at least four browser contexts (host dashboard, stage monitor, and three voters), walk through room creation, multiple rounds, error states, and navigation fallbacks. Update the checklist provided in the guide and attach screenshots or console logs for regressions. When adding flows, append your scenario description to `TEST-GUIDE.md` so the next agent can replay it. Validate Supabase realtime responses before marking a feature complete.

## Commit & Pull Request Guidelines
Mirror the existing history from `README-GIT.md`: one logical change per commit with messages like `feat: add host round status panel` (English, present tense, max ~72 characters). Pull requests must describe the problem, summarize the solution, call out Supabase schema or environment changes, and include links to the manual test checklist plus any UI captures. Reference GitHub issues or task IDs in the PR body, and ensure branches are rebased on `main`.

## Supabase & Configuration Tips
Keep secrets in `.env.local`, never in source. Whenever schema changes, update `supabase/schema.sql` and note the migration steps in your PR. Use `clear-all-data.sql` only against disposable dev projects, and confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are defined before launching `npm run dev`.
