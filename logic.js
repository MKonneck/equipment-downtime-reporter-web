/* Pure logic ported 1:1 from MainActivity.kt / MainActivity2.kt (EquipmentDowntimeReporter). */
(function (root) {
  'use strict';
  var alphabet = ['1','2','3','4','5','6','7','8','9','A','B','C','D','E','F','G','H','I',
    'J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  var lineIDs = {
    '1C':'31NC','2C':'32NC','3C':'33NC','4C':'41NC','5C':'42NC',
    '6C':'43NC','7C':'51NC','8C':'52NC','9C':'53NC','10C':'56NC',
    '1A':'34NA','2A':'35NA','3A':'36NA','4A':'44NA','5A':'45NA',
    '6A':'46NA','7A':'54NA','8A':'55NA','9A':'57NA','10A':'58NA'
  };
  var ENGINEERS = "Don't forget to ping the engineers!\n\nDay: Jeonghoon (Jay) Park and Junyoung\nMid: JU\nNight: Leo\n\n";

  function isWs(c) { return /\s/.test(c); }
  function isBlank(s) { return /^\s*$/.test(s); }
  function padStart(s, n, ch) { s = String(s); while (s.length < n) s = ch + s; return s; }
  // Kotlin String.toInt() (java Integer.parseInt): optional sign, digits, 32-bit range; else throws
  function ktToInt(s) {
    if (!/^[+-]?[0-9]+$/.test(s)) throw new Error('NumberFormatException: "' + s + '"');
    var v = Number(s);
    if (v > 2147483647 || v < -2147483648) throw new Error('NumberFormatException: "' + s + '"');
    return v === 0 ? 0 : v;
  }
  // Kotlin CharSequence.lines(): split on \r\n, \n, \r
  function ktLines(s) { return s.split(/\r\n|\n|\r/); }
  // Kotlin String.trimIndent() (replaceIndent(""))
  function trimIndent(s) {
    var lines = ktLines(s);
    var widths = lines.filter(function (l) { return !isBlank(l); }).map(function (l) {
      for (var i = 0; i < l.length; i++) if (!isWs(l[i])) return i;
      return l.length;
    });
    var min = widths.length ? Math.min.apply(null, widths) : 0;
    var last = lines.length - 1, out = [];
    lines.forEach(function (l, i) {
      if ((i === 0 || i === last) && isBlank(l)) return;
      out.push(l.substring(min));
    });
    return out.join('\n');
  }
  // Kotlin split(", ", ",", " ", "\n"): at each index the first matching delimiter (in that order) wins
  function ktSplit(s, delims) {
    var res = [], start = 0, i = 0;
    while (i < s.length) {
      var hit = null;
      for (var d = 0; d < delims.length; d++) if (s.startsWith(delims[d], i)) { hit = delims[d]; break; }
      if (hit !== null) { res.push(s.substring(start, i)); i += hit.length; start = i; } else i++;
    }
    res.push(s.substring(start));
    return res;
  }
  var CELL_DELIMS = [', ', ',', ' ', '\n'];

  // Lot ID. `hour`/`minute` drive the previous-day rule; `now` supplies the calendar date.
  function lotId(now, line, lotNo, hour, minute) {
    var cal = new Date(now.getTime());
    if (hour < 6 || (ktToInt(lotNo) - 1) * 15 > (hour - 6) * 60 + minute) cal.setDate(cal.getDate() - 1);
    var month = alphabet[cal.getMonth() + 9];
    var day = alphabet[cal.getDate() - 1];
    var year = alphabet[cal.getFullYear() - 2012];
    var lid = lineIDs[line];
    return '8' + year + month + day + (lid === undefined ? 'null' : lid) + padStart(lotNo, 2, '0');
  }

  /* Screen A: Easy Downtime Report. f = {lineNo, lineType ('Cathode'|'Anode'|null), lotNo, startHour,
     startMinute, pm, endHour, endMinute, now(bool), visionTime, hmi, vision, phenomenon, actions} */
  function verifyDowntime(f) {
    var log = '', ok = true;
    if (!f.lineNo) { log += 'Must select line number\n'; ok = false; }
    if (!f.lineType) { log += 'Must select line type\n'; ok = false; }
    if (isBlank(f.startHour)) { log += 'Must enter start hour\n'; ok = false; }
    else if (ktToInt(f.startHour) > 23) { log += 'Start Hour cannot exceed 23\n'; ok = false; }
    if (isBlank(f.startMinute)) { log += 'Must enter start minutes\n'; ok = false; }
    else if (ktToInt(f.startMinute) > 59) { log += 'Start Minute cannot exceed 59\n'; ok = false; }
    if (f.now) { /* nothing */ }
    else if (isBlank(f.endHour) || isBlank(f.endMinute)) { log += 'Must enter full end time\n'; ok = false; }
    else {
      if (ktToInt(f.endHour) > 23) { log += 'End Hour cannot exceed 23\n'; ok = false; }
      if (ktToInt(f.endMinute) > 59) { log += 'End Minute cannot exceed 59\n'; ok = false; }
    }
    if (isBlank(f.phenomenon) && (isBlank(f.hmi) && isBlank(f.vision))) { log += 'Must enter phenomenon\n'; ok = false; }
    if (isBlank(f.actions)) { log += 'Must enter actions taken\n'; ok = false; }
    return { ok: ok, log: log };
  }
  function ifBlank(s, d) { return isBlank(s) ? d : s; }
  function buildDowntime(f, now) {
    var line = f.lineNo + f.lineType[0];
    var lotNo = f.lotNo; // NOTE: Android never validates this; blank lot crashes the app (toInt)
    var sh = ktToInt(f.startHour);
    var startHour = (f.pm && sh < 12) ? sh + 12 : sh;
    var startMinute = padStart(f.startMinute, 2, '0');
    var endHour, endMinute;
    if (f.now) { endHour = now.getHours(); endMinute = padStart(String(now.getMinutes()), 2, '0'); }
    else {
      var eh = ktToInt(f.endHour);
      endHour = (f.pm && eh < 12 && eh + 12 >= startHour) ? eh + 12 : eh;
      endMinute = padStart(f.endMinute, 2, '0');
    }
    var visionTime = isBlank(f.visionTime) ? '' : ' (Vision ' + f.visionTime + ' mins)';
    var hmi = ifBlank(f.hmi, 'N/A'), vision = ifBlank(f.vision, 'N/A');
    var phen = ifBlank(f.phenomenon, 'N/A'), act = ifBlank(f.actions, 'N/A');
    var id = lotId(now, line, lotNo, startHour, ktToInt(startMinute));
    var I = '                ';
    var raw = '\n' +
      I + id + '\n' +
      I + '[Equipment Downtime Report]\n' +
      I + '1. Equipment: ' + line + '\n' +
      I + '2. Time: ' + startHour + ':' + startMinute + ' - ' + endHour + ':' + endMinute + visionTime + '\n' +
      I + '3. HMI: ' + hmi + '\n' +
      I + '4. Vision: ' + vision + '\n' +
      I + '5. Phenomenon: ' + phen + '\n' +
      I + '6. Actions Taken: ' + act + '\n' +
      '            ';
    var report = trimIndent(raw);
    return { report: report, display: report + '\n' };
  }

  /* Screen B: Torn/Uncut Tab Report. f = {lineNo, lineType, lotNo, reason, ngCount, cellIDs, useFooter, footer} */
  function verifyHold(f) {
    var log = '', ok = true;
    if (!f.lineNo) { log += 'Must select line number\n'; ok = false; }
    if (!f.lineType) { log += 'Must select line type\n'; ok = false; }
    if (isBlank(f.lotNo)) { log += 'Must select lot number\n'; ok = false; }
    var ids = [];
    try {
      ktSplit(f.cellIDs, CELL_DELIMS).forEach(function (i) {
        var v = ktToInt(i);
        if (ids.indexOf(v) !== -1) { log += 'Cell IDs must be different\n'; ok = false; }
        else {
          ids.push(ktToInt(i));
          if (!(v >= 1 && v <= 26000)) { log += 'Cell ID out of bounds\n'; ok = false; }
        }
      });
    } catch (e) { log += 'Must input valid cell IDs\n'; ok = false; }
    if (!f.reason) { log += 'Must select hold reason\n'; ok = false; }
    if (f.useFooter && isBlank(f.footer)) { log += 'Must input custom footer or deselect it\n'; ok = false; }
    return { ok: ok, log: log };
  }
  function buildHold(f, now) {
    var line = f.lineNo + f.lineType[0];
    var id = lotId(now, line, f.lotNo, now.getHours(), now.getMinutes());
    var ng = ifBlank(f.ngCount, '1');
    var list = ktSplit(f.cellIDs, CELL_DELIMS).map(ktToInt).sort(function (a, b) { return a - b; });
    var cells = list.map(String).join(', ');
    var footer = !isBlank(f.footer) ? f.footer : ''; // included even if checkbox off (as in Android)
    var I = '                ';
    var raw = '\n' +
      I + '<  Torn/Uncut Tab Report >\n' +
      I + '1. #Line: ' + line + '\n' +
      I + '2. #Lot: ' + id + '\n' +
      I + '3. Reason: ' + f.reason + '\n' +
      I + '4. NG count: ' + ng + '\n' +
      I + '5. Cell ID: ' + cells + '\n' +
      I + footer;
    var report = trimIndent(raw);
    return { report: report, display: report + '\n\n\n' + ENGINEERS };
  }

  // Auto-advance rule from switchTextBox(): returns {value, advance}
  function switchTextBox(value, maxInt, tooHigh) {
    var v; try { v = ktToInt(value); } catch (e) { return { value: value, advance: false }; }
    if (v > maxInt && v <= tooHigh) return { value: value, advance: true };
    if (v > tooHigh) return { value: value.substring(0, 1), advance: false };
    return { value: value, advance: false };
  }

  var api = { alphabet: alphabet, lineIDs: lineIDs, ENGINEERS: ENGINEERS, trimIndent: trimIndent, ktSplit: ktSplit,
    ktToInt: ktToInt, lotId: lotId, verifyDowntime: verifyDowntime, buildDowntime: buildDowntime,
    verifyHold: verifyHold, buildHold: buildHold, switchTextBox: switchTextBox };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EDR = api;
})(this);
