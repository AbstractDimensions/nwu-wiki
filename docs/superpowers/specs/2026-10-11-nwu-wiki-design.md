# NWU Wiki — Design (2026-10-11)

## Intent

A student-built NWU knowledge base that feels familiar on first sight
(Wikipedia layout) and matches the eFundiHax family look (dark theme).
Content covers literally anything, grouped into overarching categories with a
uniform shape per category, plus free-form pages (e.g. solar car involvement,
campus drink Wildcat).

**Prime directive (user): contributing must be easy and obvious to even the
least technical student.**

What was said vs assumed:
- Said: wiki template on GitHub that looks like Wikipedia; categories
  (lecturers, places, modules) with consistent per-category form; one-off
  pages welcome; anyone edits via browser; backend may be Apps Script or
  free Cloudflare; keep the eFundiHax theme, take Wikipedia's layout.
- Decided by user: Approach A (static site + save backend), stay on GitHub
  (real MediaWiki on Miraheze rejected after downsides review),
  Vector-2022-pixel-clone dropped in favour of theme + layout.
- Delegated to agent ("you pick"): no-login editing with revert-based
  moderation; Cloudflare Worker as primary backend.

## Section 1 — Architecture (approved)

- Static site on GitHub Pages (repo `nwu-wiki`), eFundiHax dark theme kept.
- Wikipedia **layout**, not skin: top tabs (Page / Edit / History), top-right
  infobox with subject image, table of contents, category links at page foot,
  left sidebar + search.
- The pre-existing custom build is the starting point (structure kept),
  extended with the layout elements — not scrapped.
- Saves: browser editor → Cloudflare Worker (free tier) → GitHub Contents API
  commit → Pages rebuild (~1 min). Fallback: Apps Script (proven commit
  pattern on the eFundiHax hub). Reads never touch the backend.

## Section 2 — Categories & templates (approved)

- **Lecturers**: photo, faculty, office, email, classes list.
- **Places**: photo, coordinates, building, hours.
- **Modules**: code, faculty, credits + link to the live synced eFundiHax page.
- **General**: one-offs (solar car, Wildcat) with optional image infobox.
- The save backend enforces each type's required fields; a page missing them
  is rejected with the exact field named.
- Auto indexes per category + A–Z + client-side search. Module list stays
  live from the eFundiHax backend (already working, CORS-open).

## Section 3 — Edit flow (approved, agent's recommendation)

- Page / Edit / History tabs on every page.
- Edit = in-browser editor (text + infobox fields + subject-image upload).
- No login required. Abuse handled by per-IP rate limits (Worker KV) +
  human-checkbox on save + full version history with one-click revert.
- Images stored in repo `images/`, size-capped, served by Pages.
- Contributing path must satisfy the prime directive: a first-year with a
  phone figures it out with zero instructions beyond what's on the page.

## Section 4 — Data, errors, testing (approved)

- Reads static; only saves use the backend.
- Edit conflict (stale base) → diff view, retry on latest. Backend down →
  draft preserved in localStorage + retry message. Validation/image failures
  → rejected pre-commit with the precise cause. "Live in ~1 min" state shown
  after save (rebuild lag).
- Verification on a test branch first: edit round-trip, conflict, offline,
  oversize-image, mobile layout, zero console errors, full link sweep.

## Open items (for the plan, not this spec)

- Cloudflare Worker vs Apps Script final call (primary: Worker).
- Repo transfer to the eFundiHax org still pending (needs org owner).
- Cross-link eFundiHax hub ↔ wiki footers.

## Visual language (locked 2026-10-11, user-approved refinements)

- Shell centers at max 1440px (`mx-auto`); article column max 1024px.
- Orange (#ffb77a) is reserved exclusively for page-to-page interlinks
  (no underline, including TOC and footer category links). External links
  stay purple + underlined. Nothing else uses orange.
- Infobox photo slot doubles as the "add a photo" first-contribution CTA.
