/* NWU Wiki — client: hash router + markdown renderer + client-side search.
 * Pages are plain .md files in pages/, indexed by pages.json.
 * Editing happens on GitHub (Edit page button per page). */
(function () {
  'use strict';

  // Auto-detect the repo location from the served hostname, so the old
  // abstractdimensions.io URL keeps working during the transition.
  var REPO_OWNER = (location.hostname === 'abstractdimensions.github.io') ? 'AbstractDimensions' : 'eFundiHax';
  var REPO_NAME = 'nwu-wiki';

  var pagesIndex = [];
  var currentPage = null;
  var currentMeta = null;
  var currentMarkdown = '';
  var sections = [];
  var editingIndex = -1;
  var dirty = false;
  var currentSha = null;

  // Save backend (spec Section 3): Apps Script publisher running as
  // efundihax@gmail.com. Override without code changes:
  //   wiki URL ?save=https://other-exec...&key=<write-key>
  var SAVE_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbw2iHfyHXs-q44aXPaq_4dmgOrskKgL19qt_7IlhDj2jJcP0shjkBAOYpWyAoN_ev9Y/exec';
  var SAVE_URL = null, WRITE_KEY = 'nwu-wiki-write';
  try {
    var _q = new URLSearchParams(location.search);
    if (_q.get('save')) { SAVE_URL = _q.get('save'); localStorage.setItem('nwu_save_url', SAVE_URL); }
    else { SAVE_URL = localStorage.getItem('nwu_save_url') || SAVE_URL_DEFAULT; }
    if (_q.get('key')) { WRITE_KEY = _q.get('key'); localStorage.setItem('nwu_write_key', WRITE_KEY); }
    else { WRITE_KEY = localStorage.getItem('nwu_write_key') || WRITE_KEY; }
  } catch (e) { SAVE_URL = ''; }

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
  var elSaveBar = document.getElementById('saveBar');
  var elSaveStatus = document.getElementById('saveStatus');
  var elSaveCommit = document.getElementById('saveCommit');
  var elSaveDiscard = document.getElementById('saveDiscard');
  var elDrawer = document.getElementById('saveDrawer');
  var elDrawerTitle = document.getElementById('saveDrawerTitle');
  var elDrawerBody = document.getElementById('saveDrawerBody');
  var elDrawerClose = document.getElementById('saveDrawerClose');
  var elToast = document.getElementById('wikiToast');
  var elNickField = document.getElementById('nickField');
  var elCreateDrawer = document.getElementById('createDrawer');
  var elCreateStep1 = document.getElementById('createStep1');
  var elCreateStep2 = document.getElementById('createStep2');
  var elCreateCats = document.getElementById('createCats');
  var elCreateTitle = document.getElementById('createTitle');
  var elCreateSlug = document.getElementById('createSlugPreview');
  var toastTimer = null;
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
        window.__nwuCategories = list.categories || [];
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
    // Canonical category order from pages.json; empty ones render dimmed
    // with an "add the first page" link (prime directive: invite, don't gate).
    var order = (window.__nwuCategories && window.__nwuCategories.length)
      ? window.__nwuCategories
      : Object.keys(cats).map(function (c) { return { id: c, icon: 'folder' }; });
    var html = '';
    order.forEach(function (cat) {
      var list = cats[cat.id] || [];
      html += '<div class="nav-cat">' + escapeHtml(cat.id) + '</div>';
      list.forEach(function (p) {
        html += '<a class="nav-item" data-page="' + escapeHtml(p.id) + '" href="#/' + escapeHtml(p.id) + '">' +
          '<span class="material-symbols-outlined">' + escapeHtml(p.icon || 'article') + '</span>' +
          '<span class="truncate">' + escapeHtml(p.title) + '</span>' +
          (p.stub ? '<span class="badge-soon ml-auto">stub</span>' : '') +
          '</a>';
      });
      if (!list.length) {
        html += '<a class="nav-item nav-empty" target="_blank" rel="noopener" href="' +
          escapeHtml('https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/new/main/pages') + '">' +
          '<span class="material-symbols-outlined">add</span>' +
          '<span class="truncate">Empty — add the first page</span></a>';
      }
    });
    // Anything filed under an unknown category still shows up (never orphan).
    Object.keys(cats).forEach(function (c) {
      if (order.some(function (o) { return o.id === c; })) return;
      html += '<div class="nav-cat">' + escapeHtml(c) + '</div>';
      cats[c].forEach(function (p) {
        html += '<a class="nav-item" data-page="' + escapeHtml(p.id) + '" href="#/' + escapeHtml(p.id) + '">' +
          '<span class="material-symbols-outlined">' + escapeHtml(p.icon || 'article') + '</span>' +
          '<span class="truncate">' + escapeHtml(p.title) + '</span></a>';
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
        currentMeta = meta;
        currentMarkdown = md;
        sections = splitSections(md);
        editingIndex = -1;
        dirty = false;
        currentSha = null;
        updateSaveBar();
        renderBody();
        fetchSha(meta);
        lastStableHash = location.hash;
        if (pendingAnchor) scrollToAnchor(); else window.scrollTo(0, 0);
      })
      .catch(function (e) {
        console.error('[nwu-wiki] page load FAILED', { file: meta.file, error: String(e) });
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
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(nav, anchor.nextSibling);
    else (elBody.querySelector('#mdContent') || elBody).insertBefore(nav, (elBody.querySelector('#mdContent') || elBody).firstChild);
  }

  /* ---------- in-place section editing ---------- */
  // Split raw markdown into editable sections: [0] = preamble (title + lead),
  // then one per ## / ### heading, in document order (matches the TOC).
  function splitSections(md) {
    var secs = [{ level: 0, title: '', lines: [] }];
    md.split('\n').forEach(function (ln) {
      var m = ln.match(/^(#{2,3})\s+(.*)$/);
      if (m) {
        secs.push({ level: m[1].length, title: m[2], lines: [] });
      } else {
        secs[secs.length - 1].lines.push(ln);
      }
    });
    return secs;
  }

  function serializeSection(s, i) {
    var head = (i === 0) ? '' : (s.level === 2 ? '## ' : '### ') + s.title + '\n';
    return head + s.lines.join('\n');
  }

  function joinSections(secs) {
    var text = secs.map(serializeSection).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
    return text.replace(/\s+$/, '') + '\n'; // exactly one trailing newline: no spurious diffs
  }

  function renderBody() {
    var raw = marked.parse(joinSections(sections));
    var clean = window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
    elBody.innerHTML = infoboxHtml(currentMeta) + staleHtml(currentMeta) +
      sampleHtml(currentMeta) + '<div id="mdContent">' + clean + '</div>' +
      (currentMeta.stub ? stubRibbon() : '');
    postProcess();
    if (editingIndex >= 0) mountEditor();
  }

  function showToast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.hidden = true; }, 3200);
  }

  function updateSaveBar() {
    if (!elSaveBar || !elSaveStatus) return;
    elSaveBar.hidden = !dirty;
    if (dirty) {
      var n = sections.filter(function (s, i) { return s._touched; }).length;
      elSaveStatus.textContent = 'Unsaved changes' + (n ? ' (' + n + ' section' + (n === 1 ? '' : 's') + ')' : '');
    }
  }

  function openDrawer(title, html) {
    if (!elDrawer || !elDrawerTitle || !elDrawerBody) return;
    elDrawerTitle.textContent = title;
    elDrawerBody.innerHTML = html;
    elDrawer.hidden = false;
  }

  function startEdit(idx) {
    if (editingIndex >= 0) { showToast('Finish this section first — Apply or Cancel.'); return; }
    if (idx < 0 || idx >= sections.length) return;
    editingIndex = idx;
    renderBody();
    var ta = elBody.querySelector('.section-editor textarea');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function mountEditor() {
    var md = elBody.querySelector('#mdContent');
    if (!md) return;
    var heads = md.querySelectorAll('h2, h3');
    var range;
    if (editingIndex === 0) {
      // Preamble: everything before the first h2 (title + lead + top notes).
      range = [];
      var kid = md.firstElementChild;
      while (kid && kid.tagName !== 'H2') { range.push(kid); kid = kid.nextElementSibling; }
    } else {
      var headEl = heads[editingIndex - 1];
      if (!headEl) { editingIndex = -1; return; }
      range = sectionRange(headEl);
    }
    if (!range.length) { editingIndex = -1; return; }
    var box = document.createElement('div');
    box.className = 'section-editor';
    var label = editingIndex === 0 ? 'Introduction' : ('Section: ' + sections[editingIndex].title);
    box.innerHTML = '<div class="editor-hint">Editing <strong>' + escapeHtml(label) +
      '</strong> — plain text is fine, use # sparingly.</div>' +
      '<textarea></textarea>' +
      '<div class="editor-row"><button class="editor-btn editor-apply">Apply</button>' +
      '<button class="editor-btn editor-cancel">Cancel</button>' +
      '<a class="editor-btn editor-cancel" style="text-decoration:none" target="_blank" rel="noopener" title="How to use Markdown (opens rentry.co guide)" href="https://rentry.co/how">?</a>' +
      '<span class="editor-hint">Apply keeps editing here · Save to wiki (below) publishes</span></div>';
    box.querySelector('textarea').value = serializeSection(sections[editingIndex], editingIndex);
    md.insertBefore(box, range[0]);
    range.forEach(function (el) { el.remove(); });
    var ta = box.querySelector('textarea');
    ta.rows = Math.min(24, Math.max(8, ta.value.split('\n').length + 2));
    box.querySelector('.editor-apply').addEventListener('click', applyEditor);
    box.querySelector('.editor-cancel').addEventListener('click', function () {
      editingIndex = -1;
      renderBody();
    });
  }

  function applyEditor() {
    var ta = elBody.querySelector('.section-editor textarea');
    if (!ta) return false;
    var text = ta.value;
    if (!text.trim()) { showToast('Section is empty — Cancel instead if you meant to delete.'); return false; }
    if (editingIndex === 0) {
      sections[0] = { level: 0, title: '', lines: text.split('\n') };
    } else {
      var lines = text.split('\n');
      var m = (lines[0] || '').match(/^(#{2,3})\s+(.*)$/);
      if (m) {
        sections[editingIndex] = { level: m[1].length, title: m[2], lines: lines.slice(1) };
      } else {
        sections[editingIndex].lines = lines;
      }
    }
    sections[editingIndex]._touched = true;
    editingIndex = -1;
    dirty = true;
    updateSaveBar();
    renderBody();
    showToast('Applied — review below, then Save to wiki when ready.');
    return true;
  }

  function discardAll() {
    sections = splitSections(currentMarkdown);
    editingIndex = -1;
    dirty = false;
    updateSaveBar();
    renderBody();
    showToast('Changes discarded.');
  }

  // Nickname is OPTIONAL, remembered, and lives in the save bar itself —
  // one click saves. Whatever is in the field at save time is stored.
  function readNickname() {
    var nick = '';
    try {
      if (elNickField && elNickField.value.trim()) {
        nick = elNickField.value.trim().slice(0, 40);
      } else {
        nick = localStorage.getItem('nwu_nick') || '';
      }
      localStorage.setItem('nwu_nick', nick);
      localStorage.setItem('nwu_nick_set', '1');
      if (elNickField) elNickField.value = nick;
    } catch (e) {}
    return nick || 'anonymous student';
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    done();
  }

  function saveFallback(after) {
    var content = joinSections(sections);
    openDrawer('Publish without the save backend',
      '<p>The one-click save backend is not connected yet. Until then, publishing takes two taps:</p>' +
      '<p><button class="mini-btn" id="fbCopy">1 · Copy updated page</button> ' +
      '<a class="mini-btn" style="text-decoration:none" target="_blank" rel="noopener" href="' +
      escapeHtml(githubUrl('pages/' + currentMeta.file, 'edit')) + '">2 · Open GitHub editor</a>' +
      (after ? ' <button class="mini-btn" id="fbDone">3 · Saved — continue</button>' : '') + '</p>' +
      '<p class="editor-hint">Paste over everything there, press Commit changes. Done — same result, one extra step.</p>' +
      '<textarea readonly>' + escapeHtml(content) + '</textarea>');
    document.getElementById('fbCopy').addEventListener('click', function () {
      copyText(content, function () { showToast('Copied — paste it into the GitHub editor.'); });
    });
    if (after) {
      document.getElementById('fbDone').addEventListener('click', function () {
        elDrawer.hidden = true;
        after();
      });
    }
  }

  function saveCommit(after) {
    if (typeof after !== 'function') after = null; // click events arrive here as arg 1
    console.log('[nwu-wiki] save requested', { file: currentMeta && currentMeta.file, dirty: dirty, editing: editingIndex });
    if (!dirty && editingIndex < 0) { if (after) after(); return; }
    if (editingIndex >= 0 && !applyEditor()) return;
    if (!dirty) { if (after) after(); return; }
    if (!SAVE_URL) { saveFallback(after || null); return; }
    postSave(readNickname(), after);
  }

  function postSave(nick, after) {
    var content = joinSections(sections);
    if (content.length > 200000) { showToast('Page too large to save (200KB cap).'); return; }
    if (elSaveStatus) elSaveStatus.textContent = 'Saving…';
    console.log('[nwu-wiki] POST save', { file: currentMeta.file, bytes: content.length, baseSha: currentSha, nick: nick });
    // text/plain (not application/json): keeps this a CORS-simple request so
    // no preflight is needed — Apps Script has no OPTIONS handler, while the
    // final googleusercontent response already carries ACAO:*. The backend
    // parses postData.contents as JSON regardless of content type.
    fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'save_wiki_page',
        key: WRITE_KEY,
        file: 'pages/' + currentMeta.file,
        content: content,
        message: 'Update ' + currentMeta.title,
        nickname: nick,
        baseSha: currentSha
      })
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      console.log('[nwu-wiki] save response', { status: res.status, body: res.body });
      if (res.status === 409) {
        console.warn('[nwu-wiki] save conflict, loading latest');
        copyText(content, function () {});
        openDrawer('Someone saved first',
          '<p>Another edit landed while you worked. Your version is <strong>copied to the clipboard</strong> — loading their version now so you can re-apply your change on top.</p>');
        reloadLatest();
        return;
      }
      if (!res.body || !res.body.ok) throw new Error((res.body && res.body.error) || ('HTTP ' + res.status));
      currentMarkdown = content;
      sections = splitSections(content);
      if (res.body.sha) currentSha = res.body.sha;
      dirty = false;
      updateSaveBar();
      if (elDrawer) elDrawer.hidden = true;
      renderBody();
      showToast('Saved — live in about a minute.' + (res.body.commit ? '' : ''));
      console.log('[nwu-wiki] save ok', { commit: res.body.commit, sha: res.body.sha, noop: !!res.body.noop });
      if (after) after();
    }).catch(function (e) {
      console.error('[nwu-wiki] save FAILED', e);
      if (elSaveStatus) elSaveStatus.textContent = 'Unsaved changes';
      openDrawer('Save failed',
        '<p><strong>' + escapeHtml(String((e && e.message) || e)).slice(0, 300) + '</strong></p>' +
        '<p class="editor-hint">Your edits are still here — nothing was lost. ' +
        'Common causes: no connection, or an old cached copy of this page (hard-refresh: Ctrl+Shift+R). ' +
        'Open the browser console (F12) and send the lines starting with <code>[nwu-wiki]</code>.</p>' +
        '<p><button class="mini-btn" id="saveRetry">Try again</button></p>');
      document.getElementById('saveRetry').addEventListener('click', function () {
        if (elDrawer) elDrawer.hidden = true;
        saveCommit(after);
      });
    });
  }

  function reloadLatest() {
    fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/pages/' + encodeURIComponent(currentMeta.file))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.content) throw new Error('no content');
        var md;
        try {
          md = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
        } catch (e) {
          md = atob(j.content.replace(/\n/g, ''));
        }
        currentMarkdown = md;
        currentSha = j.sha || null;
        sections = splitSections(md);
        editingIndex = -1;
        dirty = false;
        updateSaveBar();
        renderBody();
      })
      .catch(function () { showToast('Could not load latest — check connection.'); });
  }

  function fetchSha(meta) {
    fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/pages/' + encodeURIComponent(meta.file))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.sha) currentSha = j.sha; })
      .catch(function () { /* sha stays null: save still works, without conflict check */ });
  }

  /* Hover pencil affordances on editable headings + lead paragraph. */
  function markEditable() {
    var md = elBody.querySelector('#mdContent');
    if (!md) return;
    Array.prototype.forEach.call(md.querySelectorAll('h2, h3'), function (h) {
      h.classList.add('sec-editable');
      if (!h.querySelector('.sec-edit')) {
        var s = document.createElement('span');
        s.className = 'sec-edit material-symbols-outlined';
        s.textContent = 'edit';
        h.appendChild(s);
      }
    });
    var h1 = md.querySelector('h1');
    if (h1) {
      var sib = h1.nextElementSibling;
      while (sib && sib.tagName !== 'P') sib = sib.nextElementSibling;
      if (sib) {
        sib.classList.add('sec-lead');
        if (!sib.querySelector('.sec-edit')) {
          var s2 = document.createElement('span');
          s2.className = 'sec-edit material-symbols-outlined';
          s2.textContent = 'edit';
          sib.appendChild(s2);
        }
      }
    }
  }

  /* ---------- create page (template-forced) ---------- */
  var CREATE_CATEGORIES = [
    { id: 'Guides', icon: 'map' },
    { id: 'Modules', icon: 'menu_book' },
    { id: 'Lecturers', icon: 'person' },
    { id: 'Places', icon: 'location_on' },
    { id: 'Residences', icon: 'home' },
    { id: 'University Programs', icon: 'school' },
    { id: 'Societies', icon: 'groups' },
    { id: 'Traditions & Events', icon: 'celebration' },
    { id: 'Glossary', icon: 'abc' }
  ];
  var createCat = null;

  function openCreatePage() {
    if (!elCreateDrawer) return;
    createCat = null;
    elCreateStep1.hidden = false;
    elCreateStep2.hidden = true;
    elCreateTitle.value = '';
    elCreateSlug.textContent = '';
    elCreateCats.innerHTML = CREATE_CATEGORIES.map(function (c) {
      return '<button class="create-cat-btn" data-cat="' + escapeHtml(c.id) + '">' +
        '<span class="material-symbols-outlined">' + escapeHtml(c.icon) + '</span>' +
        escapeHtml(c.id) + '</button>';
    }).join('');
    Array.prototype.forEach.call(elCreateCats.querySelectorAll('.create-cat-btn'), function (btn) {
      btn.addEventListener('click', function () {
        createCat = btn.getAttribute('data-cat');
        elCreateStep1.hidden = true;
        elCreateStep2.hidden = false;
        elCreateTitle.focus();
      });
    });
    elCreateDrawer.hidden = false;
  }

  function createPageGo() {
    if (!createCat) return;
    var title = elCreateTitle.value.trim().slice(0, 80);
    if (!title) { showToast('Give the page a title.'); return; }
    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug.length < 3) { showToast('Title too short for a slug — use more letters.'); return; }
    var nick = 'anonymous student';
    try { nick = (elNickField && elNickField.value.trim()) || localStorage.getItem('nwu_nick') || nick; } catch (e) {}
    console.log('[nwu-wiki] create page', { category: createCat, title: title, slug: slug });
    if (elCreateDrawer) elCreateDrawer.hidden = true;
    showToast('Creating page…');
    // text/plain: CORS-simple, no preflight
    fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'create_wiki_page',
        key: WRITE_KEY,
        category: createCat,
        title: title,
        slug: slug,
        nickname: nick
      })
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      console.log('[nwu-wiki] create response', res.body);
      if (!res.body || !res.body.ok) {
        showToast('Create failed: ' + ((res.body && res.body.error) || ('HTTP ' + res.status)));
        return;
      }
      // Navigate to the new page — it loads with the template pre-filled
      location.hash = '#/' + slug;
      showToast('Page created — click any section to start editing.');
    }).catch(function (e) {
      console.error('[nwu-wiki] create FAILED', e);
      showToast('Create failed: ' + String((e && e.message) || e).slice(0, 120));
    });
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
    markEditable();
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
  var lastStableHash = null;
  var pendingHash = null;

  function targetPageId(hash) {
    var m = (hash || '').match(/^#\/([^#]+)/);
    return m ? m[1] : 'home';
  }

  // Unsaved work must never be lost to a navigation: route changes to a
  // different page are intercepted with Save / Discard / Stay.
  function askLeave(hash) {
    pendingHash = hash;
    if (!elDrawer) { // ancient cached shell: native dialog instead of nothing
      if (window.confirm('You have unsaved changes. Leave without saving?')) {
        pendingHash = null;
        discardAll();
        if (hash) location.hash = hash;
      } else {
        pendingHash = null;
      }
      return;
    }
    openDrawer('Unsaved changes',
      '<p>You have edits that are not saved yet. Leaving now loses them.</p>' +
      '<p><button class="mini-btn" id="lvSave">Save &amp; leave</button> ' +
      '<button class="mini-btn" id="lvDiscard">Discard &amp; leave</button> ' +
      '<button class="mini-btn" id="lvStay">Keep editing</button></p>');
    document.getElementById('lvStay').addEventListener('click', function () {
      pendingHash = null;
      if (elDrawer) elDrawer.hidden = true;
    });
    document.getElementById('lvDiscard').addEventListener('click', function () {
      var h = pendingHash;
      pendingHash = null;
      if (elDrawer) elDrawer.hidden = true;
      discardAll();
      if (h) location.hash = h;
    });
    document.getElementById('lvSave').addEventListener('click', function () {
      if (elDrawer) elDrawer.hidden = true;
      saveCommit(function () {
        var h = pendingHash;
        pendingHash = null;
        if (h) location.hash = h;
      });
    });
  }

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
      flashTimer = setTimeout(function () { flashPulse(step + 1); }, 325);
    } else if (step === 1) {
      flashRange.forEach(function (x) { x.style.transition = 'background 0.18s ease-out'; });
      void elBody.offsetHeight; // reflow so the fade animates
      flashRange.forEach(function (x) { x.classList.remove('toc-flash'); });
      flashTimer = setTimeout(function () { flashPulse(2); }, 300);
    } else {
      flashRange.forEach(function (x) { x.style.transition = 'background 0.25s ease-out'; });
      void elBody.offsetHeight;
      flashRange.forEach(function (x) { x.classList.remove('toc-flash'); });
      var done = flashRange;
      flashRange = [];
      flashTimer = setTimeout(function () {
        flashTimer = null;
        done.forEach(function (x) { x.style.transition = ''; });
      }, 300);
    }
  }
  function scrollToAnchor(which) { jumpToSection(which); }

  function route() {
    var hash = location.hash || '';
    if (pendingHash && hash === pendingHash) {
      pendingHash = null; // approved navigation (Save/Discard & leave)
    } else if (currentPage !== null && (dirty || editingIndex >= 0) &&
               targetPageId(hash) !== currentPage && hash.indexOf('#sec-') !== 0) {
      if (lastStableHash !== null) history.replaceState(null, '', lastStableHash);
      askLeave(hash);
      return;
    }
    var m = hash.match(/^#\/([^#]+)#(.+)$/);
    if (m) { // page-scoped anchor (#/id#sec-N): load page, then jump
      pendingAnchor = m[2];
      if (m[1] === currentPage) { scrollToAnchor(); lastStableHash = hash; return; }
      bootPage(m[1]);
      return;
    }
    if (hash.indexOf('#sec-') === 0) { // bare anchor: keep current page context
      if (currentPage) {
        history.replaceState(null, '', '#/' + currentPage + hash);
        lastStableHash = '#/' + currentPage + hash;
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
  console.log('[nwu-wiki] boot', { build: '2026-10-12.5', saveBackend: SAVE_URL ? 'connected' : 'fallback' });
  // Section editing clicks: headings + lead paragraph (links exempt).
  elBody.addEventListener('click', function (ev) {
    if (editingIndex >= 0 || !ev.target.closest) return;
    if (ev.target.closest('a')) return;
    var h = ev.target.closest('#mdContent h2, #mdContent h3');
    if (h) {
      var heads = Array.prototype.slice.call(elBody.querySelectorAll('#mdContent h2, #mdContent h3'));
      startEdit(heads.indexOf(h) + 1);
      return;
    }
    if (ev.target.closest('#mdContent p.sec-lead')) startEdit(0);
  });
  // Add-section flow: click the Contents title for a title prompt.
  elBody.addEventListener('click', function (ev) {
    if (editingIndex >= 0 || !ev.target.closest) return;
    var t = ev.target.closest('.toc-title');
    if (!t || t.querySelector('input')) return;
    t.innerHTML = '<input id="newSecTitle" placeholder="New section title…" style="width:70%;background:#0e0e0e;color:#e5e2e1;border:1px solid #6b3d8f;padding:2px 6px;font-size:0.8rem;"> ' +
      '<button id="newSecAdd" class="editor-btn editor-apply" style="padding:2px 8px;">Add</button> ' +
      '<button id="newSecCancel" class="editor-btn editor-cancel" style="padding:2px 8px;">✕</button>';
    var input = document.getElementById('newSecTitle');
    input.focus();
    document.getElementById('newSecCancel').addEventListener('click', function (e) {
      e.stopPropagation();
      renderBody();
    });
    var addIt = function () {
      var title = input.value.trim().slice(0, 80);
      if (!title) { showToast('Give the section a title first.'); return; }
      sections.push({ level: 2, title: title, lines: ['', 'Start writing here — click this section to edit.'], _touched: true });
      dirty = true;
      updateSaveBar();
      renderBody();
      startEdit(sections.length - 1);
    };
    document.getElementById('newSecAdd').addEventListener('click', function (e) {
      e.stopPropagation();
      addIt();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addIt();
      if (e.key === 'Escape') renderBody();
      e.stopPropagation();
    });
  });
  // Guarded: a stale cached index.html must never kill the whole script.
  if (elSaveCommit) elSaveCommit.addEventListener('click', function () { saveCommit(); });
  if (elSaveDiscard) elSaveDiscard.addEventListener('click', discardAll);
  if (elDrawerClose) elDrawerClose.addEventListener('click', function () { elDrawer.hidden = true; });
  // Create-page flow
  if (elCreateDrawer) {
    document.getElementById('createClose').addEventListener('click', function () { elCreateDrawer.hidden = true; });
    document.getElementById('createBack').addEventListener('click', function () {
      elCreateStep1.hidden = false; elCreateStep2.hidden = true;
    });
    document.getElementById('createGo').addEventListener('click', createPageGo);
    elCreateTitle.addEventListener('input', function () {
      var s = elCreateTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      elCreateSlug.textContent = s || '…';
    });
    elCreateTitle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') createPageGo();
      e.stopPropagation();
    });
  }
  // Sidebar "Add a page" + empty-category links → in-app create flow
  Array.prototype.forEach.call(document.querySelectorAll('a[href*="/new/main/pages"], a.nav-empty'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      openCreatePage();
    });
  });
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
    lastStableHash = '#/' + m[1] + '#' + m[2];
    jumpToSection(m[2]);
  });
  // Tab close / reload with unsaved work gets the browser's own warning.
  window.addEventListener('beforeunload', function (e) {
    if (dirty || editingIndex >= 0) { e.preventDefault(); e.returnValue = ''; }
  });
  // Seed tab hrefs so early clicks never hit a placeholder '#'.
  elTabEdit.href = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME;
  elTabHistory.href = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/commits/main';
  // Prefill the save-bar nickname from the remembered choice.
  try {
    if (elNickField) elNickField.value = localStorage.getItem('nwu_nick') || '';
  } catch (e) {}
  loadIndex().then(route);
  initSearch();
})();
