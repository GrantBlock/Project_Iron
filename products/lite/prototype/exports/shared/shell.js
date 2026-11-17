/* Shared shell for every page: one sidebar, one top bar, one mobile bar, the session panel, search, menus and dialogs.
   Loaded at the top of <body> on each page, after data.js. Prototype only: state lives in localStorage. */
(function () {
  'use strict';
  var D = document, W = window, DE = W.DE || { projects: [], recents: [], uploads: [], vault: [], calcs: [] };
  var PAGE = (/\/(P\d+[A-Z]?)-/.exec(location.pathname) || [])[1] || '';
  var Q = new URLSearchParams(location.search), PID = Q.get('project') || '';
  if (!(DE.project && DE.project(PID))) PID = '';   /* only a known project id is ever written into the page */
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  /* ---------- phone or desktop: decided once, not by window width ---------- */
  var MOBILE = (function () {
    if (W.name === 'de-mobile') return true;
    if (W.name === 'de-desktop') return false;
    var v = Q.get('view');
    if (v === 'mobile') return true;
    if (v === 'desktop') return false;
    return !!(W.matchMedia && W.matchMedia('(pointer:coarse)').matches && Math.min(W.innerWidth, (W.screen && W.screen.width) || 9999) <= 760);
  })();
  D.documentElement.classList.add(MOBILE ? 'de-m' : 'de-d');
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  function fixMedia() {
    [].forEach.call(D.styleSheets, function (sh) {
      var rules; try { rules = sh.cssRules; } catch (e) { return; }
      if (!rules) return;
      [].forEach.call(rules, function (r) {
        if (!r.media || !r.cssRules || (seen && seen.has(r))) return;
        var t = r.media.mediaText;
        if (/max-width:\s*760px/.test(t)) { r.media.mediaText = MOBILE ? 'all' : 'not all'; if (seen) seen.add(r); }
        else if (/min-width:\s*761px/.test(t)) { r.media.mediaText = MOBILE ? 'not all' : 'all'; if (seen) seen.add(r); }
      });
    });
  }
  fixMedia();

  var U = {
    'new': '../P01-chat-start-desktop/Design_Engineering_App.html', newM: '../P02-chat-start-mobile/Design_Engineering_Mobile.html',
    dash: '../P19-dashboard/index.html', design: '../P08-3d-viewer/index.html', vault: '../P09-vault/index.html', uploads: '../P07-upload-flow/index.html',
    builder: '../P17-builder/index.html', projects: '../P05-projects/index.html', settings: '../P15-account-settings/index.html', signin: '../P04-sign-in/index.html', lite: '../P16-lite/index.html'
  };
  /* the new chat page has a desktop and a phone version */
  if (PAGE === 'P01' && MOBILE) { location.replace(U.newM + location.search); return; }
  if (PAGE === 'P02' && !MOBILE) { location.replace(U['new'] + location.search); return; }

  /* ---------- extensions: Design and Builder show only when bought ---------- */
  function extGet() { var v = ls('de-ext', null); return v && typeof v === 'object' ? v : { design: true, builder: true }; }
  W.DEExt = { get: extGet, set: function (k, v) { var s = extGet(); s[k] = v; ss('de-ext', s); buildSidebar(); buildRail(); } };

  /* ---------- icons ---------- */
  var IC = {
    menu: 'M4 7h16M4 12h16M4 17h16', panel: 'M4 5h16v14H4zM9 5v14', back: 'M15 6l-6 6 6 6', fwd: 'M9 6l6 6-6 6',
    chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', folder: 'M3 6h6l2 2h10v11H3z',
    plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', dash: 'M4 5h16v14H4zM4 10h16M10 10v9',
    cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', vault: 'M3 7h18v13H3zM3 7l2-3h14l2 3M10 12h4',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', more: 'M5 12h.01M12 12h.01M19 12h.01',
    prefs: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6', chev: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6',
    chatplus: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12 8v5M9.5 10.5h5',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    share: 'M12 15V4M8 8l4-4 4 4M5 12v7h14v-7', help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
    rail: 'M4 5h16v14H4zM15 5v14', x: 'M6 6l12 12M18 6L6 18', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', out: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    keys: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8', doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01', card: 'M3 6h18v12H3zM3 10h18'
  };
  function ico(n, s, w) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex-shrink:0"><path d="' + IC[n] + '"/></svg>'; }

  /* ---------- small helpers: toast, menu, dialog ---------- */
  var toastT;
  function toast(t) { var el = $('.dx-toast'); if (!el) { el = D.createElement('div'); el.className = 'dx-toast'; el.setAttribute('role', 'status'); D.body.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 2600); }
  var openMenu = null;
  function closeMenu(refocus) { if (!openMenu) return; var m = openMenu; openMenu = null; m.el.remove(); if (m.anchor) { m.anchor.setAttribute('aria-expanded', 'false'); if (refocus) m.anchor.focus(); } }
  function menu(anchor, items, opt) {
    if (openMenu && openMenu.anchor === anchor) { closeMenu(true); return; }
    closeMenu();
    var el = D.createElement('div'); el.className = 'dx-menu'; el.setAttribute('role', opt && opt.plain ? 'dialog' : 'menu'); el.setAttribute('aria-label', (opt && opt.label) || anchor.getAttribute('aria-label') || anchor.textContent.trim());
    el.innerHTML = items.map(function (it, i) {
      if (it === '-') return '<div class="dx-sep" role="separator"></div>';
      if (it.head) return '<h3>' + esc(it.head) + '</h3>';
      if (it.html) return it.html;
      var inner = (it.icon ? ico(it.icon) : '') + '<span>' + esc(it.label) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '');
      return it.href ? '<a class="dx-item" role="menuitem" href="' + esc(it.href) + '" data-i="' + i + '">' + inner + '</a>' : '<button class="dx-item" role="menuitem" type="button" data-i="' + i + '">' + inner + '</button>';
    }).join('');
    D.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), mw = el.offsetWidth, mh = el.offsetHeight;
    var left = opt && opt.left ? r.left : r.right - mw; left = Math.max(8, Math.min(left, W.innerWidth - mw - 8));
    var top = r.bottom + 6; if (top + mh > W.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { el: el, anchor: anchor };
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var it = items[+b.dataset.i]; if (it && it.action) { e.preventDefault(); closeMenu(); it.action(); } else if (it && it.href) closeMenu(); });
    el.addEventListener('keydown', function (e) { var f = $$('.dx-item,input,button', el), i = f.indexOf(D.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); f[(i + 1) % f.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); f[(i + f.length - 1) % f.length].focus(); } else if (e.key === 'Tab') { closeMenu(); } });
    var first = $('.dx-item,input', el); if (first) first.focus();
    return el;
  }
  var openDlg = null;
  function dialog(o) {
    closeMenu(); if (openDlg) openDlg.close();
    var back = D.createElement('div'); back.className = 'dx-back';
    back.innerHTML = '<div class="dx-dialog' + (o.wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' + (o.noHead ? '' : '<div class="dx-dh"><h2>' + esc(o.title) + '</h2><button class="de-iconbtn" type="button" data-x="1" aria-label="Close">' + ico('x', 20) + '</button></div>') + (o.raw || '<div class="dx-db">' + o.body + '</div>') + '</div>';
    var prev = D.activeElement; D.body.appendChild(back);
    function close() { if (openDlg !== api) return; openDlg = null; back.remove(); if (prev && prev.focus) prev.focus(); }
    var api = { el: back, close: close }; openDlg = api;
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    back.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) close(); });
    back.addEventListener('keydown', function (e) { if (e.key !== 'Tab') return; var f = $$('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]', back).filter(function (x) { return x.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && D.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && D.activeElement === z) { e.preventDefault(); a.focus(); } });
    var f = $('[autofocus],input,select,button:not([data-x])', back) || $('[data-x]', back); if (f) f.focus();
    return api;
  }
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (openMenu) { closeMenu(true); e.stopPropagation(); } else if (openDlg) { openDlg.close(); e.stopPropagation(); } else if (openSheet) closeSheet(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); search(); }
  }, true);
  D.addEventListener('mousedown', function (e) { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.anchor.contains(e.target)) closeMenu(); }, true);

  /* ---------- search ---------- */
  var PAGES = [['New chat', U['new'], 'Page'], ['Dashboard', U.dash, 'Page'], ['Projects', U.projects, 'Page'], ['Vault', U.vault, 'Page'], ['Uploads', U.uploads, 'Page'], ['Settings', U.settings, 'Page'], ['Billing and extensions', U.settings + '#billing', 'Settings'], ['Usage', U.settings + '#usage', 'Settings'], ['Team', U.settings + '#team', 'Settings']];
  function searchItems() {
    var a = PAGES.slice(), x = extGet();
    if (x.design) a.push(['3D designer', U.design, 'Extension']);
    if (x.builder && !MOBILE) a.push(['Builder', U.builder, 'Extension']);
    DE.projects.forEach(function (p) { a.push([p.name, DE.summaryUrl(p.id), p.id]); (p.chats || []).forEach(function (c) { a.push([c, DE.chatUrl(c, p.id), 'Chat · ' + p.name]); }); });
    DE.recents.forEach(function (c) { a.push([c, DE.chatUrl(c), 'Chat']); });
    DE.vault.forEach(function (v) { if (v.t !== 'Chat') a.push([v.n, v.calc ? U.vault + '?calc=' + v.calc : v.h, v.t]); });
    return a;
  }
  function search() {
    var all = searchItems();
    var d = dialog({ title: 'Search', noHead: true, raw: '<label class="dx-search">' + ico('search', 18) + '<span class="dx-sr">Search</span><input id="dx-q" type="search" placeholder="Search projects, chats, the Vault and pages" autocomplete="off"><button class="de-iconbtn" type="button" data-x="1" aria-label="Close search">' + ico('x', 18) + '</button></label><div class="dx-res" id="dx-r" role="listbox" aria-label="Results"></div>' });
    function draw() {
      var q = $('#dx-q', d.el).value.trim().toLowerCase();
      var hit = all.filter(function (x) { return !q || (x[0] + ' ' + x[2]).toLowerCase().indexOf(q) > -1; }).slice(0, q ? 24 : 9);
      $('#dx-r', d.el).innerHTML = hit.length ? hit.map(function (x) { return '<a class="dx-item" role="option" href="' + esc(x[1]) + '"><span>' + esc(x[0]) + '</span><small>' + esc(x[2]) + '</small></a>'; }).join('') : '<div class="dx-none">Nothing matches. Try a project number, a chat title or a file name.</div>';
    }
    $('#dx-q', d.el).addEventListener('input', draw);
    d.el.addEventListener('keydown', function (e) { var f = $$('.dx-item', d.el), i = f.indexOf(D.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); (f[i + 1] || f[0]).focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? f[i - 1] : $('#dx-q', d.el)).focus(); } else if (e.key === 'Enter' && D.activeElement.id === 'dx-q' && f[0]) { location.href = f[0].href; } });
    draw();
  }

  /* ---------- new project ---------- */
  function newProject() {
    var d = dialog({ title: 'New project', body: '<form class="dx-form" id="dx-np"><label for="dx-pn">Project name<input id="dx-pn" autocomplete="off" placeholder="For example: Case packer line 2"></label><p style="margin:0;font-size:13px;color:var(--bc-muted)">It gets the next project number and is shared with your organization.</p><div class="dx-err" id="dx-pe" role="alert"></div><div class="dx-row"><button class="dx-btn" type="button" data-x="1">Cancel</button><button class="dx-btn is-main" type="submit">Create project</button></div></form>' });
    $('#dx-np', d.el).addEventListener('submit', function (e) { e.preventDefault(); var n = $('#dx-pn', d.el).value.trim(); if (n.length < 2) { $('#dx-pe', d.el).textContent = 'Give the project a name.'; return; } var p = DE.addProject(n); location.href = DE.summaryUrl(p.id); });
  }
  function shortcuts() { dialog({ title: 'Keyboard shortcuts', body: '<dl class="dx-keys"><dt>Ctrl K or ⌘ K</dt><dd>Search</dd><dt>Esc</dt><dd>Close a menu, a dialog or Settings</dd><dt>Tab</dt><dd>Move to the next control</dd><dt>Arrow keys</dt><dd>Move inside a menu or the search results</dd></dl>' }); }
  function copyLink() { var u = location.href; function ok() { toast('Link copied.'); } if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok, function () { toast('Copy did not work here. The link is in the address bar.'); }); else toast('Copy is not available here. The link is in the address bar.'); }

  var moreItems = function () {
    var x = extGet(), a = [{ label: 'Projects', icon: 'folder', href: U.projects }, { label: 'Calculators', icon: 'calc', href: U.vault + '?type=Calculator' }, { label: 'Settings', icon: 'gear', href: U.settings }, { label: 'Billing and extensions', icon: 'card', href: U.settings + '#billing' }];
    a.push('-', { label: 'Keyboard shortcuts', icon: 'keys', action: shortcuts }, { label: 'Lite sample (local app)', icon: 'box', href: U.lite });
    a.push('-', { label: 'Sign out', icon: 'out', href: U.signin });
    return a;
  };
  function helpMenu(b) { menu(b, [{ head: 'Help' }, { label: 'Ask the assistant', icon: 'chat', href: MOBILE ? U.newM : U['new'] }, { label: 'Keyboard shortcuts', icon: 'keys', action: shortcuts }, '-', { html: '<p>Help center: docs.designengineering.ai (planned).<br>Support: [support contact].</p>' }]); }
  function shareMenu(b) {
    var el = menu(b, [{ head: 'Share this page' }, { html: '<p>People in your organization who can see this project can open the link.</p><div class="dx-field"><label class="dx-sr" for="dx-url">Link</label><input id="dx-url" readonly value="' + esc(location.href) + '"><button class="dx-btn" type="button" id="dx-copy">Copy</button></div>' }, '-', { label: 'Invite people', icon: 'user', href: U.settings + '#team' }], { plain: true, label: 'Share' });
    if (el) $('#dx-copy', el).addEventListener('click', function () { $('#dx-url', el).select(); copyLink(); });
  }
  function pageMenu(b) { menu(b, [{ label: 'New chat', icon: 'plus', href: MOBILE ? U.newM : U['new'] }, { label: 'Search', icon: 'search', action: search, hint: 'Ctrl K' }, { label: 'Copy link to this page', icon: 'link', action: copyLink }, '-'].concat(moreItems())); }
  function accountMenu(b) { menu(b, [{ head: 'Grant · Pro' }, { label: 'Account', icon: 'user', href: U.settings }, { label: 'Billing and extensions', icon: 'card', href: U.settings + '#billing' }, { label: 'Usage', icon: 'dash', href: U.settings + '#usage' }, '-', { label: 'Sign out', icon: 'out', href: U.signin }], { left: true, label: 'Account' }); }

  /* ---------- sidebar ---------- */
  var ACTIVE = { P01: 'new', P19: 'dash', P08: 'design', P09: 'vault', P07: 'uploads', P17: 'builder' }[PAGE] || '';
  var inProject = /^(P05|P05A|P06|P12)$/.test(PAGE);
  var sbMode = inProject ? 'projects' : ls('de-sbmode', 'chat');
  var collapsed = false, userToggled = false;
  function navRows() {
    var x = extGet(), r = [['new', 'New', 'plus', U['new']], ['search', 'Search', 'search', null], ['dash', 'Dashboard', 'dash', U.dash]];
    if (x.design) r.push(['design', 'Design', 'cube', U.design]);
    r.push(['vault', 'Vault', 'vault', U.vault], ['uploads', 'Uploads', 'upload', U.uploads]);
    if (x.builder) r.push(['builder', 'Builder', 'box', U.builder]);
    if (sbMode === 'projects') r.push(['prefs', 'Preferences', 'prefs', U.settings + '#prefs']);
    r.push(['more', 'More', 'more', null]);
    return r;
  }
  function sidebarHTML() {
    var closed = ls('de-sbclosed', null), chatNow = Q.get('chat') || '';
    var h = '<div class="sbtool"><button class="sbicon" type="button" data-de="menu" aria-label="Menu" aria-haspopup="menu" aria-expanded="false">' + ico('menu', 18) + '</button><button class="sbicon" type="button" data-de="collapse" aria-label="Collapse sidebar">' + ico('panel', 18) + '</button><button class="sbicon" type="button" data-de="back" aria-label="Back">' + ico('back', 18) + '</button><button class="sbicon" type="button" data-de="fwd" aria-label="Forward">' + ico('fwd', 18) + '</button><span style="flex:1"></span>'
      + '<div class="sbseg" role="group" aria-label="Sidebar list"><button class="sbsegb' + (sbMode === 'chat' ? ' is-on' : '') + '" type="button" data-mode="chat" aria-pressed="' + (sbMode === 'chat') + '" aria-label="General chats" title="General">' + ico('chat') + '</button><button class="sbsegb' + (sbMode === 'projects' ? ' is-on' : '') + '" type="button" data-mode="projects" aria-pressed="' + (sbMode === 'projects') + '" aria-label="Projects" title="Projects">' + ico('folder') + '</button></div></div>';
    h += '<nav class="sbnav" aria-label="Main">' + navRows().map(function (r) {
      var on = r[0] === ACTIVE, cls = (r[0] === 'new' ? 'sbnew' : 'sbrow') + (on ? ' is-active' : ''), inner = ico(r[2]) + '<span class="sblab">' + r[1] + '</span>';
      return r[3] ? '<a class="' + cls + '" href="' + r[3] + (r[0] === 'new' && sbMode === 'projects' ? '?mode=projects' + (PID ? '&project=' + PID : '') : '') + '" data-nav="' + r[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + inner + '</a>' : '<button class="' + cls + '" type="button" data-nav="' + r[0] + '"' + (r[0] === 'more' ? ' aria-haspopup="menu" aria-expanded="false"' : '') + '>' + inner + '</button>';
    }).join('') + '</nav>';
    if (sbMode === 'chat') {
      h += '<div class="sbpane"><div class="sbhead" id="dx-lh">Recents</div><div class="sbrecs de-scroll" role="group" aria-labelledby="dx-lh">' + DE.recents.map(function (c) { return '<a class="sbrec" href="' + esc(DE.chatUrl(c)) + '" title="' + esc(c) + '"' + (PAGE === 'P03' && chatNow === c ? ' aria-current="page"' : '') + '><span class="sbfade">' + esc(c) + '</span></a>'; }).join('') + '</div></div>';
    } else {
      h += '<div class="sbpane"><div class="sbhead" id="dx-lh">Projects</div><div class="sbrecs de-scroll"><button class="sbrow sbnewproj" type="button" data-de="newproject">' + ico('plus') + '<span class="sblab">New project</span></button>' + DE.projects.map(function (p, i) {
        var cur = p.id === PID, shut = closed ? !!closed[p.id] : (i > 2 && !cur); if (cur) shut = closed && closed[p.id] === true ? true : false;
        return '<div class="sbgroup' + (shut ? ' is-closed' : '') + (cur ? ' is-current' : '') + '" data-p="' + p.id + '"><div class="sbgrow"><button class="sbgtog" type="button" data-de="tog" aria-expanded="' + !shut + '" aria-label="' + (shut ? 'Show' : 'Hide') + ' chats in ' + esc(p.name) + '">' + ico('chev', 12, 2) + '</button><a class="sbgrp" href="' + DE.summaryUrl(p.id) + '" title="' + esc(p.id + ' · ' + p.name) + '"><span class="sblab">' + esc(p.name) + '</span><span class="sbcount">' + (p.chats || []).length + '</span></a><a class="sbgstart" href="' + U['new'] + '?mode=projects&project=' + p.id + '" title="Start chat in ' + esc(p.name) + '" aria-label="Start chat in ' + esc(p.name) + '">' + ico('chatplus') + '</a></div><div class="sbkids">' + ((p.chats || []).length ? p.chats.map(function (c) { return '<a class="sbrec" href="' + esc(DE.chatUrl(c, p.id)) + '" title="' + esc(c) + '"' + (PAGE === 'P03' && chatNow === c ? ' aria-current="page"' : '') + '><span class="sbfade">' + esc(c) + '</span></a>'; }).join('') : '<div class="sbempty">No chats yet</div>') + '</div></div>';
      }).join('') + '</div></div>';
    }
    h += '<div class="sbfoot"><button class="sbacct" type="button" data-de="account" aria-label="Account: Grant, Pro" aria-haspopup="menu" aria-expanded="false"><span class="sbavatar" aria-hidden="true">G</span><span class="sblab">Grant&nbsp;·&nbsp;Pro</span>' + ico('down', 12, 2) + '</button><a class="sbicon" href="' + U.settings + '" aria-label="Settings">' + ico('gear', 18) + '</a></div>';
    return h;
  }
  var sb = null, exp = null, own = false;   /* own: the page draws its own sidebar (the new chat page) */
  function setCollapsed(c) { collapsed = c; if (!sb) return; sb.style.display = c ? 'none' : ''; if (exp) exp.hidden = !c; }
  function buildSidebar() {
    if (own) { enhanceOwn(); return; }
    var old = $('.de-sidebar'); if (!old) return;
    if (!sb || old !== sb) { sb = D.createElement('aside'); sb.className = old.className; old.parentNode.replaceChild(sb, old); sb.addEventListener('click', onSidebar);
      var oe = $('.sbexpand'); exp = D.createElement('button'); exp.className = 'sbicon sbexpand'; exp.type = 'button'; exp.setAttribute('aria-label', 'Show sidebar'); exp.innerHTML = ico('panel', 18); exp.hidden = true; if (oe) oe.parentNode.replaceChild(exp, oe); else sb.parentNode.insertBefore(exp, sb.nextSibling);
      exp.addEventListener('click', function () { userToggled = true; setCollapsed(false); $('[data-de=collapse]', sb).focus(); }); }
    sb.setAttribute('aria-label', 'Sidebar'); sb.setAttribute('data-mode', sbMode);
    var st = $('.sbrecs', sb), y = st ? st.scrollTop : 0;
    sb.innerHTML = sidebarHTML(); st = $('.sbrecs', sb); if (st) st.scrollTop = y;
    setCollapsed(collapsed);
  }
  function onSidebar(e) {
    var b = e.target.closest('button,a'); if (!b) return;
    if (b.dataset.mode) { sbMode = b.dataset.mode; ss('de-sbmode', sbMode); buildSidebar(); var nb = $('[data-mode=' + sbMode + ']', sb); if (nb) nb.focus(); return; }
    var k = b.dataset.nav || b.dataset.de;
    if (k === 'search') search();
    else if (k === 'more' || k === 'menu') menu(b, moreItems(), { left: true });
    else if (k === 'collapse') { userToggled = true; setCollapsed(true); exp.focus(); }
    else if (k === 'back') history.back();
    else if (k === 'fwd') history.forward();
    else if (k === 'newproject') newProject();
    else if (k === 'account') accountMenu(b);
    else if (k === 'tog') { var g = b.closest('.sbgroup'), shut = g.classList.toggle('is-closed'), m = ls('de-sbclosed', null) || {}; if (!ls('de-sbclosed', null)) DE.projects.forEach(function (p, i) { m[p.id] = i > 2; }); m[g.dataset.p] = shut; ss('de-sbclosed', m); b.setAttribute('aria-expanded', String(!shut)); b.setAttribute('aria-label', (shut ? 'Show' : 'Hide') + ' chats in ' + $('.sblab', g).textContent); }
  }
  /* the new chat page keeps its own sidebar; add the missing rows and wire what it leaves unwired */
  function enhanceOwn() {
    var as = $('aside'); if (!as) return; sb = as;
    var nav = $('.sbnav', as); if (!nav) return;
    var x = extGet(), rows = $$(':scope > *', nav), by = {};
    rows.forEach(function (r) { var l = $('.sblab', r); by[(l ? l.textContent : r.textContent).trim()] = r; });
    if (by.New) { by.New.classList.add('is-active'); by.New.setAttribute('aria-current', 'page'); }
    if (by.Design) by.Design.style.display = x.design ? '' : 'none';
    if (!by.Builder && by.Uploads) { var nb = D.createElement('button'); nb.className = 'sbrow'; nb.type = 'button'; nb.setAttribute('data-dx', '1'); nb.innerHTML = ico('box') + '<span class="sblab">Builder</span>'; by.Uploads.parentNode.insertBefore(nb, by.Uploads.nextSibling); by.Builder = nb; }
    if (by.Builder) by.Builder.style.display = x.builder ? '' : 'none';
    /* list every project, not only the first three */
    var head = $('.sbhead', as), list = $('.sbrecs', as);
    if (head && list && /Projects/.test(head.textContent) && !$('[data-dx=projects]', list)) {
      var have = $$('.sbgroup .sblab', list).map(function (l) { return l.textContent.trim(); }), extra = DE.projects.filter(function (p) { return have.indexOf(p.name) < 0; });
      if (extra.length) { var wrap = D.createElement('div'); wrap.setAttribute('data-dx', 'projects'); wrap.innerHTML = extra.map(function (p) { return '<div class="sbgroup is-closed" data-p="' + p.id + '"><div class="sbgrow"><button class="sbgtog" type="button" data-de="tog" aria-expanded="false" aria-label="Show chats in ' + esc(p.name) + '">' + ico('chev', 12, 2) + '</button><a class="sbgrp" href="' + DE.summaryUrl(p.id) + '"><span class="sblab">' + esc(p.name) + '</span><span class="sbcount">' + (p.chats || []).length + '</span></a></div><div class="sbkids">' + ((p.chats || []).map(function (c) { return '<a class="sbrec" href="' + esc(DE.chatUrl(c, p.id)) + '"><span class="sbfade">' + esc(c) + '</span></a>'; }).join('') || '<div class="sbempty">No chats yet</div>') + '</div></div>'; }).join(''); list.appendChild(wrap); }
    }
  }
  function ownMain(e) {
    var b = e.target.closest('button,a,[role=button]'); if (!b || b.closest('.dx-top,.dx-menu,.dx-back,.dx-rail')) return false;
    var t = (b.getAttribute('aria-label') || b.textContent || '').trim(), m = /BC-Q-\d+/.exec(b.textContent || '');
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (m && DE.project(m[0])) { stop(); location.href = DE.summaryUrl(m[0]); return true; }
    if (/^Attach file$/i.test(t)) { stop(); location.href = U.uploads; return true; }
    if (/^More options$/i.test(t)) { stop(); menu(b, [{ label: 'All projects', icon: 'folder', href: U.projects }, { label: 'New project', icon: 'plus', action: newProject }]); return true; }
    return false;
  }
  function ownClick(e) {
    var as = $('aside'); if (!as || !as.contains(e.target)) { var mn = $('main'); if (mn && mn.contains(e.target)) ownMain(e); return; }
    var b = e.target.closest('button,a'); if (!b) return;
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (b.closest('[data-dx=projects]')) { if (b.dataset.de === 'tog') { stop(); var g = b.closest('.sbgroup'), s = g.classList.toggle('is-closed'); b.setAttribute('aria-expanded', String(!s)); } return; }
    if (b.classList.contains('sbsegb')) { var pm = /Projects/i.test(b.getAttribute('aria-label') || b.title || '') ? 'projects' : 'chat'; ss('de-sbmode', pm); return; }
    var lab = ($('.sblab', b) ? $('.sblab', b).textContent : b.textContent).trim(), inNav = !!b.closest('.sbnav');
    if (inNav) {
      var go = { Dashboard: U.dash, Design: U.design, Vault: U.vault, Uploads: U.uploads, Builder: U.builder, Preferences: U.settings + '#prefs' }[lab];
      if (lab === 'Search') { stop(); search(); } else if (lab === 'More') { stop(); menu(b, moreItems(), { left: true }); } else if (go) { stop(); location.href = go; }
      return;
    }
    if (b.classList.contains('sbrec')) { stop(); var grp = b.closest('.sbgroup'), pn = grp && $('.sbgrow .sblab', grp) ? $('.sbgrow .sblab', grp).textContent.trim() : '', pr = DE.projects.filter(function (p) { return p.name === pn; })[0]; location.href = DE.chatUrl(b.textContent.trim(), pr ? pr.id : ''); return; }
    if (b.classList.contains('sbnewproj') || lab === 'New project') { stop(); newProject(); return; }
    if (b.classList.contains('sbacct')) { stop(); accountMenu(b); return; }
    if (b.closest('.sbfoot') && b.classList.contains('sbicon')) { stop(); location.href = U.settings; return; }
    if (b.closest('.sbtool')) { var al = b.getAttribute('aria-label') || ''; if (/Menu/i.test(al)) { stop(); menu(b, moreItems(), { left: true }); } else if (/Back/i.test(al)) { stop(); history.back(); } else if (/Forward/i.test(al)) { stop(); history.forward(); } }
  }

  /* ---------- top bar ---------- */
  function topHTML() {
    var railOn = ls('de-rail', false);
    return '<button class="de-iconbtn" type="button" data-top="help" aria-label="Help" aria-haspopup="menu" aria-expanded="false" title="Help">' + ico('help', 18) + '</button><button class="de-iconbtn" type="button" data-top="rail" aria-label="Session panel" aria-pressed="' + railOn + '" title="Show or hide the session panel">' + ico('rail', 18) + '</button><button class="de-iconbtn" type="button" data-top="more" aria-label="More options" aria-haspopup="menu" aria-expanded="false" title="More options">' + ico('more', 18, 2.4) + '</button><button class="dx-share" type="button" data-top="share" aria-haspopup="dialog" aria-expanded="false">' + ico('share') + 'Share</button>';
  }
  function buildTop() {
    var bar = own ? $('main > header') : $('.de-topbar'); if (!bar || $('.dx-top', bar)) return;
    var acts = own ? bar.children[1] : $('.de-topbar-actions', bar);
    var t = D.createElement('div'); t.className = 'dx-top'; t.setAttribute('role', 'toolbar'); t.setAttribute('aria-label', 'Page'); t.innerHTML = topHTML();
    if (acts) { if (own) { acts.style.display = 'none'; bar.appendChild(t); } else acts.parentNode.replaceChild(t, acts); } else bar.appendChild(t);
    t.addEventListener('click', function (e) { var b = e.target.closest('[data-top]'); if (!b) return; var k = b.dataset.top; if (k === 'help') helpMenu(b); else if (k === 'more') pageMenu(b); else if (k === 'share') shareMenu(b); else if (k === 'rail') { var on = !ls('de-rail', false); ss('de-rail', on); b.setAttribute('aria-pressed', String(on)); buildRail(); if (on) { var c = $('.dx-rail [data-x]'); if (c) c.focus(); } } });
  }

  /* ---------- session panel ---------- */
  function railHTML() {
    var p = DE.project && DE.project(PID), x = extGet(), h = '<div class="dx-rail-h"><span class="de-label">Session</span><button class="de-iconbtn de-iconbtn-sm" type="button" data-x="1" aria-label="Close session panel">' + ico('x') + '</button></div><div class="dx-rail-b de-scroll">';
    if (p) { var st = ls('de-stage-' + p.id, p.step || 1); h += '<section><h3>Project</h3><a class="dx-rl" href="' + DE.summaryUrl(p.id) + '"><span>' + esc(p.name) + '</span><small>' + p.id + '</small></a><div class="dx-rl"><span>Stage ' + st + ' of 5</span><small>' + DE.stages[st - 1] + '</small></div><div class="dx-bar" role="progressbar" aria-label="Project stage" aria-valuemin="1" aria-valuemax="5" aria-valuenow="' + st + '"><i style="width:' + (st / 5 * 100) + '%"></i></div></section>'; }
    else h += '<section><h3>Project</h3><p>This page is not in a project. <a href="' + U.projects + '">Open Projects</a></p></section>';
    var up = DE.uploads.filter(function (u) { return p ? u.p === p.id : true; }).slice(0, 5);
    h += '<section><h3>Context</h3>' + (up.length ? up.map(function (u) { return '<a class="dx-rl" href="' + U.uploads + (u.p ? '?project=' + u.p : '') + '"><span>' + esc(u.title || u.n) + '</span><small>' + (u.use || 'File') + '</small></a>'; }).join('') : '<p>No files yet.</p>') + '</section>';
    var outv = DE.vault.filter(function (v) { return v.t !== 'Upload' && v.t !== 'Chat' && (p ? v.p === p.id : true); }).slice(0, 5);
    h += '<section><h3>Outputs</h3>' + (outv.length ? outv.map(function (v) { return '<a class="dx-rl" href="' + (v.calc ? U.vault + '?calc=' + v.calc : v.h) + '"><span>' + esc(v.n) + '</span><small>' + v.t + '</small></a>'; }).join('') : '<p>Nothing saved to the Vault yet.</p>') + '</section>';
    h += '<section><h3>Extensions</h3><a class="dx-rl" href="' + U.settings + '#billing"><span>Design</span><small>' + (x.design ? 'On' : 'Off') + '</small></a><a class="dx-rl" href="' + U.settings + '#billing"><span>Builder</span><small>' + (x.builder ? 'On' : 'Off') + '</small></a></section>';
    h += '<section><h3>Wallet</h3><a class="dx-rl" href="' + U.settings + '#billing"><span>$18.40 available (A)</span><small>Add funds</small></a></section></div>';
    return h;
  }
  function buildRail() {
    var host = own ? ($('aside') && $('aside').parentNode) : $('.de-shell'); if (!host || MOBILE) return;
    var r = $('.dx-rail'), on = ls('de-rail', false);
    if (!on) { if (r) r.remove(); return; }
    if (!r) { r = D.createElement('aside'); r.className = 'dx-rail'; r.setAttribute('aria-label', 'Session'); host.appendChild(r); r.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) { ss('de-rail', false); buildRail(); var b = $('[data-top=rail]'); if (b) { b.setAttribute('aria-pressed', 'false'); b.focus(); } } }); }
    r.innerHTML = railHTML();
  }

  /* ---------- phone: tab bar, More and Recents sheets ---------- */
  var openSheet = null;
  function closeSheet() { if (!openSheet) return; openSheet.el.remove(); openSheet.scrim.remove(); var a = openSheet.anchor; openSheet = null; if (a) a.focus(); }
  function sheet(anchor, title, items) {
    closeSheet();
    var scrim = D.createElement('div'); scrim.className = 'dx-scrim'; var el = D.createElement('div'); el.className = 'dx-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = '<div class="dx-sheet-h"><h2>' + esc(title) + '</h2><button class="de-iconbtn" type="button" data-x="1" aria-label="Close">' + ico('x', 20) + '</button></div>' + items.map(function (it, i) { if (it === '-') return '<div class="dx-sep"></div>'; if (it.head) return '<h3 style="margin:10px 10px 2px;font-family:var(--font-mono);font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--bc-muted)">' + esc(it.head) + '</h3>'; var inner = (it.icon ? ico(it.icon, 20) : '') + '<span>' + esc(it.label) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : ''); return it.href ? '<a class="dx-item" href="' + esc(it.href) + '">' + inner + '</a>' : '<button class="dx-item" type="button" data-i="' + i + '">' + inner + '</button>'; }).join('');
    D.body.appendChild(scrim); D.body.appendChild(el); openSheet = { el: el, scrim: scrim, anchor: anchor };
    scrim.addEventListener('click', closeSheet);
    el.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) { closeSheet(); return; } var b = e.target.closest('[data-i]'); if (b) { var it = items[+b.dataset.i]; closeSheet(); if (it.action) it.action(); } });
    $('[data-x]', el).focus();
  }
  function moreSheet(a) { var x = extGet(), it = [{ label: 'Projects', icon: 'folder', href: U.projects }, { label: 'Vault', icon: 'vault', href: U.vault }, { label: 'Uploads', icon: 'upload', href: U.uploads }]; if (x.design) it.push({ label: '3D designer', icon: 'cube', href: U.design, hint: 'View' }); it.push({ label: 'Search', icon: 'search', action: search }, '-', { label: 'Settings', icon: 'gear', href: U.settings }, { label: 'Sign out', icon: 'out', href: U.signin }); sheet(a, 'More', it); }
  function recentsSheet(a) { var it = [{ head: 'General' }]; DE.recents.slice(0, 6).forEach(function (c) { it.push({ label: c, href: DE.chatUrl(c) }); }); DE.projects.forEach(function (p) { if (!(p.chats || []).length) return; it.push({ head: p.name }); p.chats.forEach(function (c) { it.push({ label: c, href: DE.chatUrl(c, p.id) }); }); }); sheet(a, 'Recents', it); }
  var TABKEY = { P02: 'new', P03: 'recents', P19: 'dash' }[PAGE] || 'more';
  function buildTabs() {
    var tb = $('.de-tabbar'); if (!tb) return;
    if (!tb.getAttribute('data-dx')) {
      var nt = D.createElement('nav'); nt.className = tb.className; nt.setAttribute('data-dx', '1'); nt.setAttribute('aria-label', 'Main');
      nt.innerHTML = [['new', 'New chat', 'plus'], ['recents', 'Recents', 'clock'], ['dash', 'Dashboard', 'dash'], ['more', 'More', 'more']].map(function (t) { var on = t[0] === TABKEY; return '<button class="de-tab' + (on ? ' is-active' : '') + '" type="button" data-tab="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + ico(t[2], 22) + '<span>' + t[1] + '</span></button>'; }).join('');
      tb.parentNode.replaceChild(nt, tb);
      nt.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; var k = b.dataset.tab; if (k === 'new') location.href = U.newM; else if (k === 'dash') location.href = U.dash; else if (k === 'recents') recentsSheet(b); else moreSheet(b); });
    }
    $$('.de-mheader .de-avatar').forEach(function (a) { if (a.getAttribute('data-dx')) return; a.setAttribute('data-dx', '1'); a.setAttribute('role', 'link'); a.setAttribute('tabindex', '0'); a.setAttribute('aria-label', 'Settings'); a.addEventListener('click', function () { location.href = U.settings; }); a.addEventListener('keydown', function (e) { if (e.key === 'Enter') location.href = U.settings; }); });
  }
  /* the phone new chat page draws its own tab bar; wire it by its labels */
  function ownTabs(e) {
    var b = e.target.closest('button,a,[role=button]'); if (!b || b.closest('.dx-sheet,.dx-menu,.dx-back')) return;
    var t = b.textContent.trim().toLowerCase();
    function stop() { e.preventDefault(); e.stopPropagation(); }
    if (t === 'recents') { stop(); recentsSheet(b); } else if (t === 'dashboard') { stop(); location.href = U.dash; } else if (t === 'more') { stop(); moreSheet(b); }
    else if (/active projects$/.test(t)) { stop(); location.href = U.projects; }
    else if (/^ask the engineering assistant/.test(t) || /^(mechanical|electrical|controls|software|manufacturing|process|maintenance|vault|documents|uploads)\s/.test(t)) { var inp = $('input[type=text],input:not([type]),textarea'); if (inp) { stop(); if (!/^ask the/.test(t)) { var txt = b.textContent.trim().replace(/^\S+\s+/, ''); var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value'); if (set && set.set) set.set.call(inp, txt); else inp.value = txt; inp.dispatchEvent(new Event('input', { bubbles: true })); } inp.focus(); } }
    else if (t === 'see all') { stop(); location.href = U.projects; } else if ((b.getAttribute('aria-label') || '') === 'Account') { stop(); location.href = U.settings; } else { var pm = /BC-Q-\d+/.exec(b.textContent || ''); if (pm && DE.project(pm[0]) && !/start this chat/i.test(t)) { stop(); location.href = DE.summaryUrl(pm[0]); } }
  }

  /* ---------- start ---------- */
  function start() {
    fixMedia();
    if (!D.documentElement.lang) D.documentElement.lang = 'en';
    if (/^P0[12]$/.test(PAGE)) { setTimeout(function fixDoc() { if (!D.documentElement.lang) D.documentElement.lang = 'en'; if (!D.title || /Bundled/.test(D.title)) D.title = 'New chat — Design Engineering'; if (!$('h1')) setTimeout(fixDoc, 300); }, 300); }
    $$('.p3-mdock,.p8-dock,.de-mdock').forEach(function (x) { if (!x.getAttribute('role') && $('input,textarea', x)) { x.setAttribute('role', 'region'); x.setAttribute('aria-label', 'Message'); } });
    own = PAGE === 'P01';
    var main = $('.de-shell-main') || $('main');
    if (main && !main.id) main.id = 'de-main';
    if (main && !$('.dx-skip')) { main.setAttribute('tabindex', '-1'); var sk = D.createElement('a'); sk.className = 'dx-skip'; sk.href = '#' + main.id; sk.textContent = 'Skip to content'; D.body.insertBefore(sk, D.body.firstChild); }
    if (PAGE === 'P02') { D.addEventListener('click', ownTabs, true); setInterval(function () { ensureCss(); fixMedia(); }, 400); return; }
    if (own) {
      D.addEventListener('click', ownClick, true);
      var want = Q.get('mode') === 'projects' || PID ? 'projects' : ls('de-sbmode', 'chat'), tries = 0;
      var t = setInterval(function () { var as = $('aside'); tries++; if (as && $('.sbnav', as)) { clearInterval(t); if (want === 'projects') { var pb = $$('.sbsegb', as).filter(function (b) { return /Projects/i.test(b.getAttribute('aria-label') || b.title || ''); })[0]; if (pb && !/Projects/.test(($('.sbhead', as) || {}).textContent || '')) pb.click(); } apply(); new MutationObserver(function () { clearTimeout(apply.t); apply.t = setTimeout(apply, 40); }).observe(D.body, { childList: true, subtree: true }); } else if (tries > 100) clearInterval(t); }, 50);
      return;
    }
    if (!MOBILE && W.innerWidth < 900) collapsed = true;
    apply();
    W.addEventListener('resize', function () { if (MOBILE || userToggled) return; var c = W.innerWidth < 900; if (c !== collapsed) setCollapsed(c); });
  }
  function ensureCss() { if ($('link[data-dx-css]')) return; var l = D.createElement('link'); l.rel = 'stylesheet'; l.href = '../shared/shell.css'; l.setAttribute('data-dx-css', '1'); (D.head || D.documentElement).appendChild(l); }
  function apply() { ensureCss(); fixMedia(); if (MOBILE) { buildTabs(); return; } buildSidebar(); buildTop(); buildRail(); }
  W.DEShell = { toast: toast, dialog: dialog, search: search, newProject: newProject, mobile: MOBILE, ico: ico, esc: esc, more: function (b) { if (MOBILE) moreSheet(b); else pageMenu(b); }, menu: menu };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
