/* NWU Wiki — client: hash router + markdown renderer + client-side search.
 * Pages are plain .md files in pages/, indexed by pages.json.
 * Editing happens on GitHub (Edit page button per page). */
(function () {
  'use strict';

  // Auto-detect the repo location from the served hostname, so transferring
  // the repo into the eFundiHax org later needs no code change.
  var REPO_OWNER = (location.hostname === 'efundihax.github.io') ? 'eFundiHax' : 'AbstractDimensions';
  var REPO_NAME = 'nwu-wiki';

  var pagesIndex = [];
  var currentPage = null;

  var elTitle = document.getElementById('pageTitle');
  var elCat = document.getElementById('pageCategory');
  var elIcon = document.getElementById('pageIcon');
  var elBody = document.getElementById('pageBody');
  var elEdit = document.getElementById('editBtn');
  var elHistory = document.getElementById('historyLink');
  var elTabArticle = document.getElementById('tabArticle');
  var elTabEdit = document.getElementById('tabEdit');
  var elTabHistory = document.getElementById('tabHistory');
  var elUpdated = document.getElementById('pageUpdated');
  var elCats = document.getElementById('pageCats');
  var navEl = document.getElementById('wikiNav');
  var navMobileEl = document.getElementById('wikiNavMobile');
  var searchEl = document.getElementById('wikiSearch');

  function githubUrl(path, action) {
    action = action || 'blob';
    return 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/' + action + '/main/' + path;
  }

  /* ---------- index ---------- */
  function loadIndex() {
    return fetch('pages.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        pagesIndex = list.pages || [];
        renderNav();
      })
      .catch(function (e) {
        navEl.innerHTML = '<div class="text-error text-xs p-2 font-label">Failed to load pages.json — ' + escapeHtml(String(e)) + '</div>';
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- sidebar nav ---------- */
  function renderNav() {
    var cats = {};
    pagesIndex.forEach(function (p) {
      var c = p.category || 'General';
      (cats[c] = cats[c] || []).push(p);
    });
    var html = '';
    Object.keys(cats).forEach(function (cat) {
      html += '<div class="nav-cat">' + escapeHtml(cat) + '</div>';
      cats[cat].forEach(function (p) {
        html += '<a class="nav-item" data-page="' + escapeHtml(p.id) + '" href="#/' + escapeHtml(p.id) + '">' +
          '<span class="material-symbols-outlined">' + escapeHtml(p.icon || 'article') + '</span>' +
          '<span class="truncate">' + escapeHtml(p.title) + '</span>' +
          (p.stub ? '<span class="badge-soon ml-auto">stub</span>' : '') +
          '</a>';
      });
    });
    navEl.innerHTML = html;
    navMobileEl.innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (el) {
      el.addEventListener('click', function () {
        var d = navMobileEl.closest('details');
        if (d) d.open = false;
      });
    });
    markActiveNav();
  }

  function markActiveNav() {
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (el) {
      el.classList.toggle('active', el.getAttribute('data-page') === currentPage);
    });
  }

  /* ---------- page rendering ---------- */
  function loadPage(id) {
    var meta = pagesIndex.filter(function (p) { return p.id === id; })[0];
    if (!meta || !meta.file) { renderNotFound(id); return; }
    currentPage = id;
    markActiveNav();

    elTitle.textContent = meta.title;
    elCat.textContent = meta.category || 'wiki';
    elIcon.textContent = meta.icon || 'article';
    elEdit.href = githubUrl('pages/' + meta.file, 'edit');
    elHistory.href = githubUrl('pages/' + meta.file, 'commits');
    elTabArticle.href = '#/' + id;
    elTabArticle.setAttribute('aria-current', 'page');
    elTabEdit.href = githubUrl('pages/' + meta.file, 'edit');
    elTabHistory.href = githubUrl('pages/' + meta.file, 'commits');
    document.title = meta.title + ' — NWU Wiki';

    // Footer: freshness stamp + category links (complaint #1: stale pages).
    var age = ageDaysOf(meta.updated);
    if (age === null) {
      elUpdated.textContent = 'Verification date unknown · not official NWU content';
    } else {
      elUpdated.textContent = 'Last verified ' + meta.updated + ' (' + age + 'd ago) · not official NWU content';
    }
    elCats.innerHTML = 'Category: <a class="hover:text-secondary" href="#/' + escapeHtml(id) + '">' +
      escapeHtml(meta.category || 'General') + '</a>';

    // keep hash printable for sharing
    var wantHash = pendingAnchor ? '#/' + id + '#' + pendingAnchor : '#/' + id;
    if (location.hash !== wantHash) {
      history.replaceState(null, '', wantHash);
    }

    fetch('pages/' + encodeURIComponent(meta.file), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (md) {
        var raw = marked.parse(md);
        var clean = window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
        elBody.innerHTML = infoboxHtml(meta) + staleHtml(meta) + sampleHtml(meta) + clean +
          (meta.stub ? stubRibbon() : '');
        postProcess();
        if (pendingAnchor) scrollToAnchor(); else window.scrollTo(0, 0);
      })
      .catch(function (e) {
        elBody.innerHTML = '<div class="text-error text-sm font-label uppercase tracking-widest">' +
          'Could not load <code>pages/' + escapeHtml(meta.file) + '</code> — ' + escapeHtml(String(e)) +
          '<p class="text-outline normal-case tracking-normal font-body mt-2 text-xs">' +
          'If this page was just added, wait a minute for GitHub Pages to rebuild.</p></div>';
      });
  }

  /* Freshness helpers: null = unknown/invalid date, never NaN. */
  function ageDaysOf(updated) {
    if (!updated) return null;
    var t = new Date(updated + 'T00:00:00Z').getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }
  /* Top-right subject box (Wikipedia layout). Data comes from pages.json so
   * editors never touch markup for it — prime directive. Missing photo
   * renders as an "add a photo" invitation: the easiest first contribution. */
  function infoboxHtml(meta) {
    if (!meta.infobox) return '';
    var ib = meta.infobox;
    var photo = ib.image
      ? '<img class="ib-photo" src="' + escapeHtml(ib.image) + '" alt="' + escapeHtml(meta.title) + '" loading="lazy">'
      : '<a class="ib-photo-empty" href="' + escapeHtml(githubUrl('pages/' + meta.file, 'edit')) + '" target="_blank" rel="noopener">' +
        '<span class="material-symbols-outlined">add_a_photo</span>No photo yet — add one</a>';
    var rows = (ib.fields || []).map(function (f) {
      if (!Array.isArray(f)) return '';
      return '<div class="ib-row"><div class="ib-key">' + escapeHtml(f[0] || '') + '</div>' +
        '<div class="ib-val">' + escapeHtml(f[1] || '') + '</div></div>';
    }).join('');
    return '<aside class="wiki-infobox"><div class="ib-title">' + escapeHtml(meta.title) + '</div>' +
      photo +
      (ib.caption ? '<div class="ib-caption">' + escapeHtml(ib.caption) + '</div>' : '') +
      rows + '</aside>';
  }

  /* Staleness banner (complaint #1). Anything unverified for 180+ days says so. */
  function staleHtml(meta) {
    var age = ageDaysOf(meta.updated);
    if (age === null || age < 180) return '';
    return '<div class="stale-ribbon">This page was last verified ' + escapeHtml(meta.updated) +
      ' — details may be outdated. If you can confirm or fix something, hit <strong>Edit</strong> above.</div>';
  }

  function sampleHtml(meta) {
    if (!meta.sample) return '';
    return '<div class="sample-wrap"><span class="sample-ribbon">Sample page — layout demo, content is illustrative</span></div>';
  }

  /* Table of contents from h2/h3 (Wikipedia layout). Skipped on short pages.
   * Links are page-scoped (#/id#sec-N) so reload/bookmark keeps its context. */
  var pendingAnchor = null;
  function buildToc() {
    var heads = elBody.querySelectorAll('h2, h3');
    if (heads.length < 3) return;
    var items = [];
    var n2 = 0, n3 = 0, scope = currentPage || 'home';
    Array.prototype.forEach.call(heads, function (h) {
      var num;
      if (h.tagName === 'H2') { n2++; n3 = 0; num = String(n2); }
      else { n3++; num = (n2 || 1) + '.' + n3; }
      var id = 'sec-' + num;
      h.id = id;
      items.push('<li class="' + (h.tagName === 'H3' ? 'toc-h3' : '') + '"><span class="toc-num">' +
        escapeHtml(num) + '</span><a href="#/' + escapeHtml(scope) + '#' + id + '">' +
        escapeHtml(h.textContent) + '</a></li>');
    });
    var nav = document.createElement('nav');
    nav.className = 'wiki-toc';
    nav.innerHTML = '<div class="toc-title">Contents</div><ol>' + items.join('') + '</ol>';
    // Wikipedia placement: after the lead paragraph (first P after H1),
    // never wedged between title and intro.
    var anchor = elBody.querySelector('h1');
    if (anchor) {
      var sib = anchor.nextElementSibling;
      while (sib && sib.tagName !== 'P') sib = sib.nextElementSibling;
      if (sib) anchor = sib;
    }
    if (anchor && anchor.nextSibling) elBody.insertBefore(nav, anchor.nextSibling);
    else elBody.insertBefore(nav, elBody.firstChild);
  }

  function stubRibbon() {
    return '<div class="mt-8 bevel-out bg-surface-container p-4 text-xs text-outline font-body">' +
      '<span class="material-symbols-outlined text-secondary text-sm align-middle">construction</span> ' +
      'This page is a <strong class="text-secondary">stub</strong> — it exists so you can expand it. ' +
      'Click <em>Edit page</em> to add what you know.</div>';
  }

  function renderNotFound(id) {
    currentPage = null;
    elTitle.textContent = 'Page not found';
    elCat.textContent = '404';
    elBody.innerHTML = '<p class="text-on-surface">No wiki page with id <code>' + escapeHtml(id) + '</code>.</p>' +
      '<p class="text-outline text-xs mt-2">Pick a page from the sidebar, or <a class="text-secondary underline" href="#/home">go home</a>.</p>';
  }

  /* Enhance rendered HTML: callout styling + external link behaviour + TOC + live hooks */
  function postProcess() {
    buildToc();
    Array.prototype.forEach.call(elBody.querySelectorAll('blockquote'), function (bq) {
      var t = (bq.textContent || '');
      var tag = (t.match(/^\s*\[!(note|tip|warning|warn)\]/i) || [])[1] || '';
      tag = tag.toLowerCase();
      if (tag === 'warning' || tag === 'warn') bq.classList.add('wiki-warn');
      else if (tag === 'tip') bq.classList.add('wiki-tip');
      else bq.classList.add('wiki-note');
      // Strip the raw [!tag] marker so readers never see markdown.
      // (First text node is often inter-tag whitespace — scan until hit.)
      try {
        var walker = document.createTreeWalker(bq, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
          if (/\[!(note|tip|warning|warn)\]/i.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(/^\s*\[!(note|tip|warning|warn)\]\s*/i, '');
            break;
          }
        }
      } catch (e) { /* cosmetic only */ }
    });
    Array.prototype.forEach.call(elBody.querySelectorAll('a[href^="http"]'), function (a) {
      a.target = '_blank';
      a.rel = 'noopener';
    });

    // Live hook: the module list renders straight from the eFundiHax backend
    // (GitHub Pages sends Access-Control-Allow-Origin: *) so the wiki never
    // shows a stale copy of what is actually synced.
    var live = elBody.querySelector('#efh-live-modules');
    if (live) {
      live.innerHTML = '<div class="text-outline text-xs font-label uppercase tracking-widest animate-pulse">Loading synced modules from eFundiHax…</div>';
      fetch('https://efundihax.github.io/data/worksites/worksites.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          var rows = list.map(function (w) {
            var name = w.title || w.slug;
            var link = w.efundiUrl || (w.siteId ? 'https://efundi.nwu.ac.za/portal/site/' + w.siteId : '');
            if (link && !/^https:\/\//i.test(link)) link = ''; // never trust exotic schemes
            var dash = 'https://efundihax.github.io/worksite.html?site=' + encodeURIComponent(w.slug);
            return '<tr><td><strong>' + escapeHtml(name) + '</strong></td>' +
              '<td><code>' + escapeHtml(w.slug) + '</code></td>' +
              '<td>' + (link ? '<a href="' + escapeHtml(link) + '">eFundi</a>' : '—') + '</td>' +
              '<td><a href="' + escapeHtml(dash) + '">synced info</a></td></tr>';
          }).join('');
          live.innerHTML = '<table><thead><tr><th>Module / site</th><th>Slug</th><th>eFundi</th><th>Synced by eFundiHax</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>' +
            '<p class="text-outline text-[11px] mt-2">Live from the shared eFundiHax backend (' + list.length + ' worksites). ' +
            'Missing a module? Install the userscript and open it in eFundi — it appears after the next sync.</p>';
        })
        .catch(function () {
          live.innerHTML = '<p class="text-error text-xs">Could not reach the eFundiHax backend. ' +
            'Try the <a class="underline" href="https://efundihax.github.io">eFundiHax hub</a> directly.</p>';
        });
    }
  }

  /* ---------- search ---------- */
  function initSearch() {
    searchEl.addEventListener('input', function () {
      var q = searchEl.value.trim().toLowerCase();
      if (!q) { renderNav(); return; }
      var hits = pagesIndex.filter(function (p) {
        return (p.title + ' ' + (p.desc || '') + ' ' + (p.keywords || []).join(' ') + ' ' + p.id)
          .toLowerCase().indexOf(q) !== -1;
      });
      var html = '<div class="nav-cat">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</div>';
      hits.forEach(function (p) {
        html += '<a class="search-hit" href="#/' + escapeHtml(p.id) + '">' +
          '<span class="material-symbols-outlined text-[13px] align-middle mr-1">' + escapeHtml(p.icon || 'article') + '</span>' +
          escapeHtml(p.title) + ' <span class="text-outline text-[10px]">' + escapeHtml(p.category || '') + '</span></a>';
      });
      navEl.innerHTML = html;
      navMobileEl.innerHTML = html;
    });
    searchEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { searchEl.value = ''; renderNav(); searchEl.blur(); }
    });
  }

  /* ---------- router ---------- */
  var flashRange = [];
  var flashTimer = null;
  function clearFlash() {
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    flashRange.forEach(function (el) {
      el.classList.remove('toc-flash');
      el.style.transition = '';
    });
    flashRange = [];
  }
  // The clicked heading's whole section: siblings until the next heading
  // of same-or-higher level (the TOC box itself is skipped).
  function sectionRange(head) {
    var range = [head];
    var stop = (head.tagName === 'H2') ? ['H2'] : ['H2', 'H3'];
    var sib = head.nextElementSibling;
    while (sib) {
      if (stop.indexOf(sib.tagName) !== -1) break;
      if (!sib.classList || !sib.classList.contains('wiki-toc')) range.push(sib);
      sib = sib.nextElementSibling;
    }
    return range;
  }
  function jumpToSection(which) {
    var anchor = which || pendingAnchor;
    pendingAnchor = null;
    if (!anchor) return;
    var el = document.getElementById(anchor);
    if (!el) return;
    // Instant centered jump (Wikipedia-style). Smooth scrolling proved
    // unreliable here — it settled ~800px off-center; the flash below
    // provides the motion cue instead.
    el.scrollIntoView({ block: 'center' });
    // Flash the entire section TWICE: instant on (fast ramp), hold, fade,
    // repeat, then clean up transitions back to each element's own style.
    clearFlash();
    flashRange = sectionRange(el);
    flashPulse(0);
  }
  function flashPulse(step) {
    if (step === 0 || step === 2) {
      flashRange.forEach(function (x) { x.style.transition = ''; });
      flashRange.forEach(function (x) { x.classList.add('toc-flash'); });
      flashTimer = setTimeout(function () { flashPulse(step + 1); }, 650);
    } else if (step === 1) {
      flashRange.forEach(function (x) { x.style.transition = 'background 0.35s ease-out'; });
      void elBody.offsetHeight; // reflow so the fade animates
      flashRange.forEach(function (x) { x.classList.remove('toc-flash'); });
      flashTimer = setTimeout(function () { flashPulse(2); }, 600);
    } else {
      flashRange.forEach(function (x) { x.style.transition = 'background 0.5s ease-out'; });
      void elBody.offsetHeight;
      flashRange.forEach(function (x) { x.classList.remove('toc-flash'); });
      var done = flashRange;
      flashRange = [];
      flashTimer = setTimeout(function () {
        flashTimer = null;
        done.forEach(function (x) { x.style.transition = ''; });
      }, 600);
    }
  }
  function scrollToAnchor(which) { jumpToSection(which); }

  function route() {
    var hash = location.hash || '';
    var m = hash.match(/^#\/([^#]+)#(.+)$/);
    if (m) { // page-scoped anchor (#/id#sec-N): load page, then jump
      pendingAnchor = m[2];
      if (m[1] === currentPage) { scrollToAnchor(); return; }
      bootPage(m[1]);
      return;
    }
    if (hash.indexOf('#sec-') === 0) { // bare anchor: keep current page context
      if (currentPage) {
        history.replaceState(null, '', '#/' + currentPage + hash);
        scrollToAnchor(hash.slice(1));
      } else {
        bootPage('home'); // fresh load with no page context: never leave blank
      }
      return;
    }
    pendingAnchor = null;
    bootPage(hash.replace(/^#\/?/, '') || 'home');
  }

  function bootPage(id) {
    if (!pagesIndex.length) {
      loadIndex().then(function () { loadPage(id); });
    } else {
      loadPage(id);
    }
  }

  window.addEventListener('hashchange', route);
  // TOC clicks: take over from the native top-jump so the heading lands
  // centered with a flash. URL still updates for sharing (no history spam).
  elBody.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('.wiki-toc a') : null;
    if (!a) return;
    var m = (a.getAttribute('href') || '').match(/^#\/([^#]+)#(.+)$/);
    if (!m) return;
    ev.preventDefault();
    pendingAnchor = null;
    history.replaceState(null, '', '#/' + m[1] + '#' + m[2]);
    jumpToSection(m[2]);
  });
  // Seed tab hrefs so early clicks never hit a placeholder '#'.
  elTabEdit.href = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME;
  elTabHistory.href = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/commits/main';
  loadIndex().then(route);
  initSearch();
})();
