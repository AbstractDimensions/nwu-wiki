# NWU Wiki

**The student-built knowledge base for North-West University.**

A free, community-editable wiki for NWU students: modules, bursaries, campus
life, exams and the how-tos that nobody officially documents. Hosted on GitHub
Pages, edited through GitHub's web editor — no accounts, no build step, no
git required to help.

🔗 **Live site:** https://abstractdimensions.github.io/nwu-wiki

## What's here

- A tiny static site: `index.html` + `assets/` renders markdown pages from
  `pages/`, indexed by `pages.json`.
- Community content lives as one `.md` file per page in `pages/`.
- The module list is pulled **live** from the eFundiHax backend
  (`efundihax.github.io`), so it never goes stale.

## Edit in 2 minutes (no code)

1. Open any page on the wiki and click **Edit page** — that opens GitHub's web
   editor on that page's markdown.
2. Fix, extend, or correct it. Press **Commit changes**.
3. The live site updates within a minute or two.

Full walkthrough: [How to Contribute](pages/contributing.md).

## Add a page

1. Create a file in `pages/` (e.g. `pages/mafikeng-transport.md`).
2. Add an entry to `pages.json` so it shows up in the sidebar.
3. That's it — the router picks it up automatically.

## Local development

Any static file server works:

```
npx http-server -p 8080 -c-1
# open http://127.0.0.1:8080
```

Pages are plain markdown; `assets/wiki.js` is a ~200-line hash router with
client-side search. Tailwind + fonts load from CDNs.

## Relationship to eFundiHax

[eFundiHax](https://efundihax.github.io) is the machine half: it syncs eFundi
module content (announcements, calendars, resources, lessons) into one shared
place. NWU Wiki is the human half — judgement and institutional knowledge no
scraper can capture. The wiki links into the synced data; the roles stay
separate.

## Ground rules

- Student content, by students. Not official NWU communication.
- Write for a first-year; spell things out.
- No private info — other people's student numbers, marks, messages.
- Community content is CC BY-SA 4.0 unless a page says otherwise.
