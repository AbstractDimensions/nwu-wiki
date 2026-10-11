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
    if (!meta) { renderNotFound(id); return; }
    currentPage = id;
    markActiveNav();

    elTitle.textContent = meta.title;
    elCat.textContent = meta.category || 'wiki';
    elIcon.textContent = meta.icon || 'article';
    elEdit.href = githubUrl('pages/' + meta.file, 'edit');
    elHistory.href = githubUrl('pages/' + meta.file, 'commits');
    document.title = meta.title + ' — NWU Wiki';

    // keep hash printable for sharing
    if (location.hash !== '#/' + id) {
      history.replaceState(null, '', '#/' + id);
    }

    fetch('pages/' + encodeURIComponent(meta.file), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (md) {
        var raw = marked.parse(md);
        var clean = window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
        elBody.innerHTML = clean + (meta.stub ? stubRibbon() : '');
        postProcess();
        window.scrollTo(0, 0);
      })
      .catch(function (e) {
        elBody.innerHTML = '<div class="text-error text-sm font-label uppercase tracking-widest">' +
          'Could not load <code>pages/' + escapeHtml(meta.file) + '</code> — ' + escapeHtml(String(e)) +
          '<p class="text-outline normal-case tracking-normal font-body mt-2 text-xs">' +
          'If this page was just added, wait a minute for GitHub Pages to rebuild.</p></div>';
      });
  }

  function stubRibbon() {
    return '<div class="mt-8 bevel-out bg-surface-container p-4 text-xs text-outline font-body">' +
      '<span class="material-symbols-outlined text-tertiary text-sm align-middle">construction</span> ' +
      'This page is a <strong class="text-tertiary">stub</strong> — it exists so you can expand it. ' +
      'Click <em>Edit page</em> to add what you know.</div>';
  }

  function renderNotFound(id) {
    currentPage = null;
    elTitle.textContent = 'Page not found';
    elCat.textContent = '404';
    elBody.innerHTML = '<p class="text-on-surface">No wiki page with id <code>' + escapeHtml(id) + '</code>.</p>' +
      '<p class="text-outline text-xs mt-2">Pick a page from the sidebar, or <a class="text-secondary underline" href="#/home">go home</a>.</p>';
  }

  /* Enhance rendered HTML: callout styling + external link behaviour + live hooks */
  function postProcess() {
    Array.prototype.forEach.call(elBody.querySelectorAll('blockquote'), function (bq) {
      var t = (bq.textContent || '').toLowerCase();
      if (t.indexOf('[!warning]') === 0 || t.indexOf('[!warn]') === 0) bq.classList.add('wiki-warn');
      else if (t.indexOf('[!tip]') === 0) bq.classList.add('wiki-tip');
      else bq.classList.add('wiki-note');
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
  function route() {
    var id = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (!pagesIndex.length) {
      loadIndex().then(function () { loadPage(id); });
    } else {
      loadPage(id);
    }
  }

  window.addEventListener('hashchange', route);
  loadIndex().then(route);
  initSearch();
})();
