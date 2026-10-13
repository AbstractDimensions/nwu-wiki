# How to Contribute

You can fix or add anything on this wiki from a phone or laptop in about two
minutes. No git, no command line, no account beyond a GitHub login.

## Fix something on an existing page

1. Open the page on the wiki.
2. Click **Edit page** (top-right). GitHub opens the page's raw markdown in its
   web editor, pre-filled and ready.
3. Make your change. The page is plain text with light markdown:
   `#` for headings, `**bold**`, `-` for bullets, `| a | b |` for tables,
   `> [!tip]` / `> [!warning]` for the coloured note boxes.
4. Scroll down, press **Commit changes** (add a one-line description like
   "fixed bursary deadline").
5. Done — the live wiki updates within a minute or two.

## Add a new page

1. Go to the repo's **pages** folder:
   `github.com/eFundiHax/nwu-wiki/tree/main/pages`
2. **Add file → Create new file**. Name it something short and lowercase with
   `.md` at the end — e.g. `mafikeng-transport.md`.
3. Paste your content (start with `# Title`, then write normally).
4. **Commit changes** the same way.

Then it needs one line in the index so it appears in the sidebar:

1. Open `pages.json` (same folder), click the pencil to edit.
2. Add an entry inside the `"pages": [ ... ]` list:

```json
{
  "id": "mafikeng-transport",
  "title": "Mafikeng Transport",
  "category": "Campus",
  "icon": "directions_bus",
  "file": "mafikeng-transport.md",
  "desc": "Taxis, shuttles and parking near campus",
  "keywords": ["taxi", "shuttle", "parking", "transport"]
}
```

3. Commit. Your page is live and linked.

## Editing someone else's change (pull requests)

Committing directly to `main` is allowed here on purpose — this wiki is
student-run and speed matters more than process. If you prefer the classic
route: **Fork** the repo, make changes on your fork, then open a **Pull
Request** and someone will merge it.

## Style guide (short on purpose)

- Write for a first-year. Spell out what a term means the first time.
- Dates with years: "applications opened in April 2026", not "recently".
- Mark claims you're unsure about with *(unconfirmed — please check)*.
- Never paste private info: student numbers, marks, inboxes, phone numbers.
- Lecturer pages: business contact info already published on the NWU site
  or eFundi only (office, official email). Never cell numbers, home
  addresses, or anything from a private conversation.
- Tables and short bullets beat walls of text on a phone.

## How a page is stored (two files, one page)

Each wiki page is two things: the article text in `pages/*.md` (what the
**Edit** button opens) and its purple info box in `pages.json` (open that
file, pencil icon, find your page, edit `infobox`). Changing box facts
means editing `pages.json` too — say so in your commit message. A one-form
editor that does both at once is planned; until then, this section is the
manual.

## Headings and the Contents box

You never build the Contents box yourself — the wiki generates it from your
headings on every page load:

- `## Section` becomes a numbered top-level entry (`1`, `2`, `3`…).
- `### Subsection` nests under it (`2.1`, `2.2`…).
- The box appears automatically after the introduction (first paragraph),
  but only on pages with 3+ headings — short pages skip it.
- Clicking an entry jumps to that section, centers it, and flashes it twice.

To keep it clean: one `##` per topic, short titles, don't skip from `##`
straight to `####`, and put background/context in the intro paragraph
*before* the first heading so readers land on prose, not the box.

## What to work on

Pages marked **stub** in the sidebar are intentionally thin — they're the
community's to-do list:

- **Bursary Directory** — 195 organisations with an empty Notes column. Perfect
  first contribution: add what you know about one.
- **Campus Life** — needs everything.
- **First Weeks Guide** — what confused *you* in week 1 is missing here.

## Example pages (reference only — not editable)

Every category has one finished example showing exactly what a good page looks
like. Open one before writing yours:

- [Lecturers example](#/example-lecturer) · [Places example](#/example-place) ·
  [Residences example](#/example-residence) · [Modules example](#/example-module) ·
  [Programs example](#/example-program) · [Societies example](#/example-society) ·
  [Traditions example](#/example-event) · [Glossary example](#/example-glossary) ·
  [Guides example](#/example-guide)

## Not sure, or found a bug in the wiki itself?

- **Content question:** edit the page and ask in your commit message.
- **The site is broken:** open an issue —
  `github.com/eFundiHax/nwu-wiki/issues/new/choose` and describe what
  you saw.

Thanks for helping. Every paragraph here is a favour to the student who comes
after you.
