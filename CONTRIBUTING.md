# Contributing to NWU Wiki

Thanks for helping. This wiki exists because students keep knowledge that
universities never write down — and the fastest way to keep it useful is to let
anyone fix it in two minutes.

## The 2-minute edit

1. Open the page you want to improve on the wiki.
2. Click **Edit page** (top right). GitHub opens that page's markdown in its
   web editor.
3. Make your change and press **Commit changes**.

That's the whole workflow. No fork, no branch, no review queue — the live site
updates in a minute or two.

## Markdown cheatsheet

```
# Big heading            ## Section heading
**bold**   *italic*      `code`
- bullet                 1. numbered
| col | col |            table (keep the | pipes aligned)
> [!tip] / [!warning]    coloured note box
[link text](https://…)    link — https links open in a new tab
```

## Adding a page

1. In `pages/`, create `your-page.md` starting with `# Title`.
2. Register it in `pages.json`:

```json
{
  "id": "your-page",
  "title": "Your Page",
  "category": "Campus",
  "icon": "school",
  "file": "your-page.md",
  "desc": "One line shown in the sidebar/search",
  "keywords": ["words", "people", "search", "for"]
}
```

Categories are free-form — reuse an existing one (Start here / Studies / Money /
Campus / About) or start a new one; the sidebar groups by category name.
Icons come from Google's [Material Symbols](https://fonts.google.com/icons)
(e.g. `school`, `savings`, `location_city`, `event`).

## Content rules

- **Write for a first-year.** Spell out every term the first time.
- **Never** share private data: no other people's student numbers,
  marks, phone numbers, residences, or inbox contents.
- Put years on prices and dates ("as of 2026").
- If unsure, say so in the text rather than guessing confidently.
- Official/administrative statements: link the official source, don't
  paraphrase policy.

## If you're a developer

The whole site is `index.html`, `assets/wiki.css`, `assets/wiki.js`,
`pages.json`, and `pages/*.md`. Hash router, client-side search, markdown
rendered client-side with marked + DOMPurify. Serve locally with any static
server (`npx http-server .`). Keep dependencies CDN-loaded — no build step is a
feature.

## License

Contributions are licensed CC BY-SA 4.0 (code MIT). By contributing you agree
your content can be reused by other students with attribution.
