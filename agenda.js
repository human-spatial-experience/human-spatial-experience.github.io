/* Workshop schedule: rendered from agenda.json.
   Organizers can switch to edit mode on the page ("Organizers: edit schedule" or #edit),
   rearrange and retime items, then publish by committing the new agenda.json on GitHub. */
(function () {
  var REPO_EDIT = 'https://github.com/human-spatial-experience/human-spatial-experience.github.io/edit/main/agenda.json';
  var DRAFT_KEY = 'hse-agenda-draft';
  var pub = null, S = null, editing = false, hist = [], dragId = null, pre = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var toMin = function (s) { var p = String(s || '09:00').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
  function fmt(m, ap) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = ('0' + (m % 60)).slice(-2), h12 = h % 12 || 12; return h12 + ':' + mm + (ap ? (h < 12 ? ' am' : ' pm') : ''); }
  function used(b) { return b.kind === 'break' ? b.target : b.items.reduce(function (a, i) { return a + (+i.dur || 0); }, 0); }
  function span(b) { return b.kind === 'break' ? b.target : Math.max(b.target, used(b)); }
  function timeline() {
    var t = toMin(S.start), T = {};
    S.blocks.forEach(function (b) { var it = t; T[b.id] = t; b.items.forEach(function (i) { T[i.id] = it; it += +i.dur || 0; }); t += span(b); });
    T.end = t; return T;
  }
  function sessions() { return S.blocks.filter(function (b) { return b.kind === 'session'; }); }
  function find(id) { for (var j = 0; j < S.blocks.length; j++) { var k = S.blocks[j].items.findIndex(function (i) { return i.id === id; }); if (k > -1) return [S.blocks[j], k]; } return [null, -1]; }
  function store() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(S)); } catch (e) {} }
  function changed() { return pub && JSON.stringify(S) !== JSON.stringify(pub); }
  function change(fn) { hist.push(clone(S)); if (hist.length > 50) hist.shift(); fn(); store(); render(); }
  function clean() { var o = clone(S); o.blocks.forEach(function (b) { b.items.forEach(function (i) { delete i.showNote; }); }); return JSON.stringify(o, null, 2) + '\n'; }

  function render() {
    var T = timeline(), ss = sessions();
    $('agmeta').textContent = S.day + ' · ' + fmt(toMin(S.start), 1) + ' – ' + fmt(T.end, 1) + ' (Pittsburgh time). Tentative, subject to change.';
    $('agwrap').classList.toggle('editing', editing);
    $('edbar').hidden = !editing;
    $('orgbtn').textContent = editing ? 'Leave edit mode' : 'Organizers: edit schedule';
    if (editing) renderBar();
    $('sessions').innerHTML = ss.map(function (b, si) {
      var a = T[b.id], u = used(b);
      if (!editing) return '<div class="session"><h3>' + esc(b.title) + '</h3><div class="dur">' + fmt(a, 1) + ' – ' + fmt(a + u, 1) + ' · ' + u + ' min</div>' +
        b.items.map(function (i) { return '<div class="slot"><div class="t">' + fmt(T[i.id]) + '</div><div>' + esc(i.title) + (i.tent ? ' <span class="tentag">(tentative)</span>' : '') + (i.who ? '<small>' + esc(i.who) + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
      var over = u > b.target, pct = Math.min(100, u / b.target * 100);
      var mt = over ? (u - b.target) + ' min over' : u === b.target ? 'exactly on time' : (b.target - u) + ' min free';
      return '<div class="session" data-b="' + b.id + '"><input class="ename" data-f="btitle" value="' + esc(b.title) + '" aria-label="Session name">' +
        '<div class="meter' + (over ? ' over' : '') + '"><span>' + fmt(a, 1) + ' – ' + fmt(a + u, 1) + '</span><div class="tr"><div class="fl" style="width:' + pct + '%"></div></div><span class="mt">' + u + ' of ' + b.target + ' min · ' + mt + '</span>' +
        '<label>Slot <input data-f="btarget" inputmode="numeric" value="' + b.target + '" aria-label="Session length in minutes"></label></div>' +
        '<div data-drop="' + b.id + '">' + (b.items.length ? b.items.map(function (i, k) {
          var first = si === 0 && k === 0, last = si === ss.length - 1 && k === b.items.length - 1;
          return '<div class="eslot" data-i="' + i.id + '"><div class="hd" title="Drag to move">⋮⋮</div><div class="t">' + fmt(T[i.id]) + '</div>' +
            '<div><input class="ein" data-f="title" value="' + esc(i.title) + '" placeholder="Agenda item" aria-label="Title">' +
            '<input class="ein who" data-f="who" value="' + esc(i.who) + '" placeholder="Speaker or lead" aria-label="Speaker or lead">' +
            '<label class="chk"><input type="checkbox" data-f="tent"' + (i.tent ? ' checked' : '') + '> Tentative</label></div>' +
            '<div class="stp"><button type="button" data-a="minus" aria-label="5 minutes shorter">−</button><input data-f="dur" inputmode="numeric" value="' + i.dur + '" aria-label="Minutes"><span>min</span><button type="button" data-a="plus" aria-label="5 minutes longer">+</button></div>' +
            '<div class="ics"><button class="ic" type="button" data-a="up" aria-label="Move up"' + (first ? ' disabled' : '') + '>↑</button><button class="ic" type="button" data-a="down" aria-label="Move down"' + (last ? ' disabled' : '') + '>↓</button><button class="ic" type="button" data-a="del" aria-label="Delete">✕</button></div></div>';
        }).join('') : '<p class="edhelp">No items yet. Add one or drag a row here.</p>') + '</div>' +
        '<div class="sfoot"><button type="button" class="lk" data-a="add">+ Add item</button><button type="button" class="lk dim" data-a="sdel">Remove session</button></div></div>';
    }).join('');
    var br = S.blocks.filter(function (b) { return b.kind === 'break'; });
    $('breaks').innerHTML = editing ? br.map(function (b) {
      return '<div class="ebrk" data-b="' + b.id + '"><input class="ein" data-f="btitle" value="' + esc(b.title) + '" aria-label="Break name">' +
        '<div class="stp"><button type="button" data-a="bminus" aria-label="Shorter">−</button><input data-f="btarget" inputmode="numeric" value="' + b.target + '" aria-label="Break minutes"><span>min</span><button type="button" data-a="bplus" aria-label="Longer">+</button></div>' +
        '<span class="tm">' + fmt(T[b.id], 1) + ' – ' + fmt(T[b.id] + b.target, 1) + '</span><button class="ic" type="button" data-a="bdel" aria-label="Remove break">✕</button></div>';
    }).join('') : br.map(function (b) { return esc(b.title) + ': ' + fmt(T[b.id], 1) + ' – ' + fmt(T[b.id] + b.target, 1); }).join(' · ');
  }

  function renderBar() {
    var bar = $('edbar');
    if (!bar.dataset.built) {
      bar.dataset.built = '1';
      bar.innerHTML = '<div class="r">' +
        '<label>Day<input type="text" id="ag-day"></label>' +
        '<label>Start<input type="time" id="ag-start" step="300"></label>' +
        '<button class="eb" type="button" id="ag-undo">Undo</button>' +
        '<button class="eb" type="button" id="ag-addsess">+ Session</button>' +
        '<button class="eb" type="button" id="ag-addbreak">+ Break</button>' +
        '<button class="eb" type="button" id="ag-reset">Discard draft</button>' +
        '<button class="eb pri" type="button" id="ag-copy">Copy agenda.json</button>' +
        '<a class="eb" id="ag-gh" href="' + REPO_EDIT + '" target="_blank" rel="noopener">Commit on GitHub ↗</a>' +
        '</div><div class="edhelp" id="ag-help"></div>';
      $('ag-day').addEventListener('change', function (e) { change(function () { S.day = e.target.value.trim() || 'Day TBA'; }); });
      $('ag-start').addEventListener('change', function (e) { change(function () { S.start = e.target.value || '09:00'; }); });
      $('ag-undo').addEventListener('click', function () { if (!hist.length) return; S = hist.pop(); store(); render(); });
      $('ag-addsess').addEventListener('click', function () { change(function () { var i = S.blocks.filter(function (b) { return b.kind === 'session'; }).length + 1; S.blocks.push({ id: uid(), kind: 'session', title: 'Session ' + i, target: 90, items: [] }); }); });
      $('ag-addbreak').addEventListener('click', function () { change(function () { S.blocks.splice(Math.max(1, S.blocks.length - 1), 0, { id: uid(), kind: 'break', title: 'Break', target: 15, items: [] }); }); });
      $('ag-reset').addEventListener('click', function () { if (!changed()) return; hist.push(clone(S)); S = clone(pub); try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} render(); });
      $('ag-copy').addEventListener('click', function (e) {
        var btn = e.currentTarget, txt = clean();
        var done = function () { btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = 'Copy agenda.json'; }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); }); else { fallbackCopy(txt); done(); }
      });
    }
    $('ag-day').value = S.day; $('ag-start').value = S.start;
    $('ag-undo').disabled = !hist.length;
    $('ag-reset').disabled = !changed();
    var h = $('ag-help');
    h.className = 'edhelp' + (changed() ? ' warn' : '');
    h.innerHTML = changed()
      ? '<b>Draft saved in this browser only.</b> Visitors still see the published schedule. To publish: Copy agenda.json → Commit on GitHub → select all, paste, Commit changes. The site updates in about a minute.'
      : '<b>Edit mode.</b> Drag ⋮⋮ or use ↑ ↓ to reorder, −/+ to change minutes; start times recalculate. Changes stay in your browser until you commit agenda.json.';
  }
  function fallbackCopy(t) { var x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); } catch (e) {} x.remove(); }

  function blockOf(el) { var be = el.closest('[data-b]'); return be ? S.blocks.find(function (b) { return b.id === be.dataset.b; }) : null; }
  function itemOf(el) { var r = el.closest('[data-i]'); if (!r) return null; var f = find(r.dataset.i); return f[0].items[f[1]]; }
  function onClick(e) {
    var btn = e.target.closest('[data-a]'); if (!btn || !editing) return;
    var a = btn.dataset.a, b = blockOf(btn), it = itemOf(btn), ss = sessions(), si = ss.indexOf(b), k = it ? b.items.indexOf(it) : -1;
    change(function () {
      if (a === 'plus' || a === 'minus') it.dur = Math.max(5, Math.round(((+it.dur || 0) + (a === 'plus' ? 5 : -5)) / 5) * 5);
      if (a === 'bplus' || a === 'bminus') b.target = Math.max(5, b.target + (a === 'bplus' ? 5 : -5));
      if (a === 'del') b.items.splice(k, 1);
      if (a === 'bdel' || a === 'sdel') S.blocks.splice(S.blocks.indexOf(b), 1);
      if (a === 'add') b.items.push({ id: uid(), title: '', who: '', dur: 10, note: '', tent: false });
      if (a === 'up') { if (k > 0) b.items.splice(k - 1, 0, b.items.splice(k, 1)[0]); else if (si > 0) ss[si - 1].items.push(b.items.splice(k, 1)[0]); }
      if (a === 'down') { if (k < b.items.length - 1) b.items.splice(k + 1, 0, b.items.splice(k, 1)[0]); else if (si < ss.length - 1) ss[si + 1].items.unshift(b.items.splice(k, 1)[0]); }
    });
    if (a === 'add') { var last = b.items[b.items.length - 1]; var el = document.querySelector('[data-i="' + last.id + '"] .ein'); if (el) el.focus(); }
  }
  function onInput(e) {
    var f = e.target.dataset.f; if (!f || !editing || f === 'tent' || f === 'dur' || f === 'btarget') return;
    var b = blockOf(e.target), it = itemOf(e.target);
    if (f === 'btitle') b.title = e.target.value; else it[f] = e.target.value;
    store();
  }
  function onChange(e) {
    var f = e.target.dataset.f; if (!f || !editing) return;
    var b = blockOf(e.target), it = itemOf(e.target), n = Math.max(1, Math.min(600, Math.round(+e.target.value) || 5));
    if (f === 'dur') change(function () { it.dur = n; });
    else if (f === 'btarget') change(function () { b.target = n; });
    else if (f === 'tent') change(function () { it.tent = e.target.checked; });
    else { if (pre) { hist.push(pre); pre = null; } store(); render(); }
  }
  function clearDrop() { document.querySelectorAll('.db,.da').forEach(function (n) { n.classList.remove('db', 'da'); }); }

  function bind() {
    var root = $('agwrap');
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('focusin', function (e) { if (e.target.matches('.ein,.ename')) pre = clone(S); });
    root.addEventListener('pointerdown', function (e) { var h = e.target.closest('.hd'); if (h) h.closest('.eslot').draggable = true; });
    root.addEventListener('dragstart', function (e) { var r = e.target.closest('.eslot'); if (!r) return; dragId = r.dataset.i; r.classList.add('drag'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
    root.addEventListener('dragend', function (e) { var r = e.target.closest('.eslot'); if (r) { r.draggable = false; r.classList.remove('drag'); } dragId = null; clearDrop(); });
    root.addEventListener('dragover', function (e) {
      if (!dragId || !e.target.closest('[data-drop]')) return; e.preventDefault(); clearDrop();
      var r = e.target.closest('.eslot'); if (r && r.dataset.i !== dragId) { var rc = r.getBoundingClientRect(); r.classList.add(e.clientY < rc.top + rc.height / 2 ? 'db' : 'da'); }
    });
    root.addEventListener('drop', function (e) {
      var zone = e.target.closest('[data-drop]'); if (!dragId || !zone) return; e.preventDefault();
      var id = dragId, r = e.target.closest('.eslot'); if (r && r.dataset.i === id) return;
      var after = false; if (r) { var rc = r.getBoundingClientRect(); after = e.clientY >= rc.top + rc.height / 2; }
      change(function () {
        var src = find(id), moved = src[0].items.splice(src[1], 1)[0];
        var tb = S.blocks.find(function (b) { return b.id === zone.dataset.drop; });
        var pos = r ? tb.items.findIndex(function (i) { return i.id === r.dataset.i; }) + (after ? 1 : 0) : tb.items.length;
        tb.items.splice(pos, 0, moved);
      });
    });
    $('orgbtn').addEventListener('click', function () { setEdit(!editing); });
    window.addEventListener('hashchange', function () { if (location.hash === '#edit' && !editing) setEdit(true); });
  }
  function setEdit(on) {
    editing = on;
    if (on) { var d = null; try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) {} S = d && d.blocks ? d : clone(pub); }
    else { S = clone(pub); if (location.hash === '#edit') history.replaceState(null, '', location.pathname + '#agenda'); }
    hist = []; render();
    if (on) $('agenda').scrollIntoView();
  }

  fetch('agenda.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    pub = j; S = clone(j); bind(); render();
    if (location.hash === '#edit') setEdit(true);
  }).catch(function () { $('agmeta').textContent = 'Schedule coming soon.'; $('orgbtn').hidden = true; });
})();
