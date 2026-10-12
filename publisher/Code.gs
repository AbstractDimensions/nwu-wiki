/* NWU Wiki Publisher — Google Apps Script backend (spec Section 3).
 * Project owned + executed as efundihax@gmail.com. NEVER merge into the
 * eFundiHax sync backend (other agent's live project) — this is standalone.
 *
 * Setup (one time, as efundihax@gmail.com):
 *   1. clasp push
 *   2. clasp deploy  (then set web-app access to "Anyone" — see README)
 *   3. Set ScriptProperties: GITHUB_PAT, WRITE_KEY  (via setupStore, never in code)
 *
 * API (all JSON, CORS-open for the wiki origin):
 *   GET  ?action=whoami            -> { ok, effectiveUser } (proves E identity)
 *   POST { action:'save_wiki_page', key, file, content, message, nickname, baseSha }
 *        -> { ok, commit, sha } | { ok:false, error, [currentContent, currentSha] } (409)
 */

var REPO = 'AbstractDimensions/nwu-wiki';
var WRITE_KEY_DEFAULT = 'nwu-wiki-write';
var MAX_BYTES = 200000;
var RATE_PER_MIN = 10;

function props() {
  return PropertiesService.getScriptProperties();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function gist_(e) {
  // Client IP for rate limiting (best-effort; header may be absent).
  try {
    var p = (e && e.parameters) || {};
    if (p.ip) return String(p.ip).slice(0, 64);
  } catch (err) {}
  return 'unknown';
}

function rateOk_(ip) {
  var cache = CacheService.getScriptCache();
  var k = 'rl_' + ip;
  var n = parseInt(cache.get(k) || '0', 10);
  if (n >= RATE_PER_MIN) return false;
  cache.put(k, String(n + 1), 60);
  return true;
}

function gh_(path, method, payload) {
  var pat = props().getProperty('GITHUB_PAT');
  if (!pat) throw new Error('GITHUB_PAT not configured');
  var opts = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + pat,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nwu-wiki-publisher'
    }
  };
  if (payload !== undefined) {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(payload);
  }
  var res = UrlFetchApp.fetch('https://api.github.com' + path, opts);
  return { code: res.getResponseCode(), body: res.getContentText() };
}

function doGet(e) {
  var action = ((e && e.parameter && e.parameter.action) || '');
  if (action === 'whoami') {
    return jsonOut({ ok: true, effectiveUser: Session.getEffectiveUser().getEmail() });
  }
  return jsonOut({ ok: true, service: 'nwu-wiki-publisher', usage: 'POST action=save_wiki_page' });
}

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action === 'bootstrap') {
      // One-shot PAT install: works only while GITHUB_PAT is unset.
      // Pair with action 'reset' (same key) to rotate a token.
      var wk = props().getProperty('WRITE_KEY') || WRITE_KEY_DEFAULT;
      if (p.key !== wk) return jsonOut({ ok: false, error: 'bad key' });
      if (props().getProperty('GITHUB_PAT')) return jsonOut({ ok: false, error: 'already set (use reset first)' });
      var pat = String(p.pat || '');
      if (!/^github_pat_[A-Za-z0-9_]+$/.test(pat)) return jsonOut({ ok: false, error: 'bad pat format' });
      props().setProperty('GITHUB_PAT', pat);
      return jsonOut({ ok: true, set: 'GITHUB_PAT' });
    }
    if (p.action === 'reset') {
      var wk2 = props().getProperty('WRITE_KEY') || WRITE_KEY_DEFAULT;
      if (p.key !== wk2) return jsonOut({ ok: false, error: 'bad key' });
      props().deleteProperty('GITHUB_PAT');
      return jsonOut({ ok: true, reset: 'GITHUB_PAT' });
    }
    if (p.action !== 'save_wiki_page') {
      return jsonOut({ ok: false, error: 'unknown action' });
    }
    var writeKey = props().getProperty('WRITE_KEY') || WRITE_KEY_DEFAULT;
    if (p.key !== writeKey) {
      return jsonOut({ ok: false, error: 'bad key' });
    }
    var ip = gist_(e);
    if (!rateOk_(ip)) {
      return jsonOut({ ok: false, error: 'rate limited (10/min). Try again shortly.' });
    }
    var file = String(p.file || '');
    if (!/^pages\/[a-z0-9][a-z0-9\-]*\.md$/.test(file)) {
      return jsonOut({ ok: false, error: 'bad file path' });
    }
    var content = String(p.content || '');
    if (!content.trim()) {
      return jsonOut({ ok: false, error: 'empty content' });
    }
    if (content.length > MAX_BYTES) {
      return jsonOut({ ok: false, error: 'content too large (200KB cap)' });
    }
    var cur = gh_('/repos/' + REPO + '/contents/' + file, 'get');
    if (cur.code !== 200) {
      return jsonOut({ ok: false, error: 'GitHub read failed: HTTP ' + cur.code });
    }
    var curJ = JSON.parse(cur.body);
    // No-op guard: identical content returns ok WITHOUT an empty commit.
    // (Retries and double-saves must not pollute history.)
    try {
      var curText = Utilities.newBlob(Utilities.base64Decode(curJ.content.replace(/\n/g, ''))).getDataAsString();
      if (curText === content) {
        return jsonOut({ ok: true, commit: null, sha: curJ.sha, noop: true });
      }
    } catch (e2) {}
    if (p.baseSha && p.baseSha !== curJ.sha) {
      var latest = Utilities.base64Decode(curJ.content.replace(/\n/g, ''));
      return jsonOut({
        ok: false, error: 'conflict: someone saved first',
        http: 409,
        currentSha: curJ.sha,
        currentContent: Utilities.newBlob(latest).getDataAsString()
      });
    }
    var nick = String(p.nickname || 'anonymous student').slice(0, 40).replace(/[\r\n]+/g, ' ');
    var msg = String(p.message || ('Update ' + file)).slice(0, 120) +
      ' (via wiki: ' + nick + ')';
    var put = gh_('/repos/' + REPO + '/contents/' + file, 'put', {
      message: msg,
      content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
      sha: curJ.sha
    });
    if (put.code !== 200 && put.code !== 201) {
      var ghMsg = '';
      try { ghMsg = ': ' + (JSON.parse(put.body).message || ''); } catch (e2) {}
      return jsonOut({ ok: false, error: 'GitHub write failed: HTTP ' + put.code + ghMsg.slice(0, 160) });
    }
    var putJ = JSON.parse(put.body);
    return jsonOut({
      ok: true,
      commit: putJ.commit && putJ.commit.html_url,
      sha: putJ.content && putJ.content.sha
    });
  } catch (err) {
    return jsonOut({ ok: false, error: 'server error: ' + String(err).slice(0, 160) });
  }
}

/* One-time secret setup. Run via: clasp run setupStore --params '[{"k":"GITHUB_PAT","v":"..."}]'
 * Params never touch disk. Delete the chat/command trace afterwards. */
function setupStore(req) {
  var items = (req && req.k) ? [req] : (req || []);
  var out = [];
  var ps = props();
  items.forEach(function (it) {
    if (it.k === 'GITHUB_PAT' || it.k === 'WRITE_KEY') {
      ps.setProperty(it.k, it.v);
      out.push(it.k + '=set');
    }
  });
  return JSON.stringify(out);
}
