(function () {
  'use strict';
  var E = window.EDR;
  var app = document.getElementById('app');
  // CarryOverInputs.lineAndLotInfo: in-memory only, like the Kotlin companion object
  var carry = { lineNo: null, lineType: null, lot: null };
  var current = 'A';

  function $(id) { return app.querySelector('#' + id); }
  function radios(container, name, values) {
    values.forEach(function (v) {
      var l = document.createElement('label');
      var r = document.createElement('input');
      r.type = 'radio'; r.name = name; r.value = v;
      l.appendChild(r); l.appendChild(document.createTextNode(v));
      container.appendChild(l);
    });
  }
  function checked(name) { var r = app.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function check(name, v) { var r = app.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; }
  function digitsOnly(el) { el.addEventListener('input', function () { var d = el.value.replace(/[^0-9]/g, ''); if (d !== el.value) el.value = d; }); }

  var toastT;
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1500);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); ok ? res() : rej(new Error('copy failed'));
    });
  }
  function autoGrow(ta) { ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }); }

  function render(which) {
    current = which;
    app.innerHTML = '';
    app.appendChild(document.getElementById(which === 'A' ? 'screenA' : 'screenB').content.cloneNode(true));
    document.body.style.background = which === 'A' ? '#a3b5d6' : '#fa7dbf';
    var tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = which === 'A' ? '#a3b5d6' : '#fa7dbf';
    radios(app.querySelector('.lineNo'), 'lineNo', ['1','2','3','4','5','6','7','8','9','10']);
    radios(app.querySelector('.lineType'), 'lineType', ['Cathode', 'Anode']);
    var sel = app.querySelector('select.lot'), max = +sel.dataset.max;
    var blank = document.createElement('option'); blank.value = ''; blank.textContent = ''; sel.appendChild(blank);
    for (var i = 1; i <= max; i++) { var o = document.createElement('option'); o.value = o.textContent = String(i); sel.appendChild(o); }
    // restoreSelectedInputs
    if (carry.lineNo) check('lineNo', carry.lineNo);
    if (carry.lineType) check('lineType', carry.lineType);
    if (carry.lot !== null) {
      var v = String(carry.lot);
      if (!sel.querySelector('option[value="' + v + '"]')) { var x = document.createElement('option'); x.value = x.textContent = v; sel.appendChild(x); }
      sel.value = v;
    }
    // Tap background -> hide keyboard
    app.querySelectorAll('.bg-tap').forEach(function (el) {
      el.addEventListener('click', function (e) { if (e.target === el && document.activeElement) document.activeElement.blur(); });
    });
    $('switchReport').addEventListener('click', function () {
      carry.lineNo = checked('lineNo'); carry.lineType = checked('lineType');
      var lv = app.querySelector('select.lot').value; carry.lot = /^[0-9]+$/.test(lv) ? parseInt(lv, 10) : null;
      render(current === 'A' ? 'B' : 'A'); window.scrollTo(0, 0);
    });
    if (which === 'A') setupA(); else setupB();
  }

  function setupA() {
    ['startHour','startMinute','endHour','endMinute','visionTime'].forEach(function (id) { digitsOnly($(id)); });
    function sw(fromId, toId, maxInt, tooHigh) {
      var from = $(fromId);
      from.addEventListener('input', function () {
        var r = E.switchTextBox(from.value, maxInt, tooHigh);
        if (r.value !== from.value) from.value = r.value;
        if (r.advance) $(toId).focus();
      });
    }
    sw('startHour', 'startMinute', 2, 24); sw('endHour', 'endMinute', 2, 24);
    sw('startMinute', 'endHour', 5, 59); sw('endMinute', 'phenomenon', 5, 59);
    autoGrow($('phenomenon')); autoGrow($('actionsTaken'));
    $('submitButton').addEventListener('click', function () {
      var out = $('mainOutputTextView');
      var f = { lineNo: checked('lineNo'), lineType: checked('lineType'), lotNo: app.querySelector('select.lot').value,
        startHour: $('startHour').value, startMinute: $('startMinute').value, pm: $('pmCheckbox').checked,
        endHour: $('endHour').value, endMinute: $('endMinute').value, now: $('nowCheckbox').checked,
        visionTime: $('visionTime').value, hmi: $('hmiErrors').value, vision: $('visionErrors').value,
        phenomenon: $('phenomenon').value, actions: $('actionsTaken').value };
      var v = E.verifyDowntime(f);
      out.textContent = v.log;
      if (!v.ok) return;
      var r;
      try { r = E.buildDowntime(f, new Date()); }
      catch (e) { console.error(e); return; } // Android app crashes here (blank lot number); we just do nothing
      out.textContent = r.display;
      if (navigator.share) {
        navigator.share({ text: r.report }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          copyText(r.report).then(function () { toast('Copied'); }, function () {});
        });
      } else {
        copyText(r.report).then(function () { toast('Copied'); }, function () {});
      }
    });
  }

  function setupB() {
    radios(app.querySelector('.reasonHeld'), 'reasonHeld', ['Uncut', 'Torn', 'Zipper']);
    digitsOnly($('ngCount'));
    var use = $('useCustomFooter'), footer = $('customFooter');
    function sync() { footer.placeholder = use.checked ? '  Enter footer here' : '  DISABLED'; footer.disabled = !use.checked; }
    sync(); use.addEventListener('change', sync);
    $('submitButton').addEventListener('click', function () {
      var out = $('mainOutputTextView');
      var f = { lineNo: checked('lineNo'), lineType: checked('lineType'), lotNo: app.querySelector('select.lot').value,
        reason: checked('reasonHeld'), ngCount: $('ngCount').value, cellIDs: $('cellIDs').value,
        useFooter: use.checked, footer: footer.value };
      var v = E.verifyHold(f);
      out.textContent = v.log;
      if (!v.ok) return;
      var r = E.buildHold(f, new Date());
      out.textContent = r.display;
      copyText(r.report).then(function () { toast('Copied'); }, function () { toast('Copy failed'); });
    });
  }

  render('A');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
