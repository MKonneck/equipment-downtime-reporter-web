// Unit-style checks: expected values hand-derived from MainActivity.kt / MainActivity2.kt logic.
// Run: node tests/run-tests.js
var E = require('../logic.js');
var pass = 0, fail = 0;
function eq(name, got, exp) {
  if (got === exp) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + '\n  expected: ' + JSON.stringify(exp) + '\n  got:      ' + JSON.stringify(got)); }
}
function D(y, m, d, h, mi) { return new Date(y, m - 1, d, h, mi, 0); }
function A(o) { return Object.assign({ lineNo: '3', lineType: 'Cathode', lotNo: '5', startHour: '9', startMinute: '5', pm: false,
  endHour: '10', endMinute: '15', now: false, visionTime: '', hmi: '', vision: '', phenomenon: '', actions: 'Reset' }, o); }
function B(o) { return Object.assign({ lineNo: '3', lineType: 'Cathode', lotNo: '5', reason: 'Torn', ngCount: '',
  cellIDs: '12', useFooter: false, footer: '' }, o); }

// ---- Lot ID encoding
eq('lotId today', E.lotId(D(2026,10,22,14,30), '3C', '5', 9, 5), '8FJM33NC05');
eq('lotId before 6am -> yesterday', E.lotId(D(2026,10,22,14,30), '10A', '22', 5, 50), '8FJL58NA22');
eq('lotId lot too high for time -> yesterday', E.lotId(D(2026,10,22,7,0), '1C', '5', 6, 59), '8FJL31NC05');
eq('lotId boundary equal (not >) -> today', E.lotId(D(2026,10,22,7,0), '1C', '5', 7, 0), '8FJM31NC05');
eq('lotId Jan 1 rollover -> Dec 31 prev year', E.lotId(D(2027,1,1,3,0), '7A', '1', 3, 0), '8FLV54NA01');
eq('lotId Jan 9 2027', E.lotId(D(2027,1,9,12,0), '2A', '12', 12, 0), '8GA935NA12');
eq('lotId Mar 1 -> Feb 28', E.lotId(D(2026,3,1,2,0), '9C', '3', 2, 0), '8FBS53NC03');
eq('all 20 line IDs present', Object.keys(E.lineIDs).length, 20);

// ---- Screen A report
eq('A basic report', E.buildDowntime(A({ visionTime: '5', hmi: 'E-102' }), D(2026,10,22,14,30)).report,
  '8FJM33NC05\n[Equipment Downtime Report]\n1. Equipment: 3C\n2. Time: 9:05 - 10:15 (Vision 5 mins)\n3. HMI: E-102\n4. Vision: N/A\n5. Phenomenon: N/A\n6. Actions Taken: Reset');
eq('A display has trailing newline', E.buildDowntime(A({ hmi: 'x' }), D(2026,10,22,14,30)).display.slice(-1), '\n');
eq('A PM start+end, lot 30 previous day', E.buildDowntime(A({ lineNo: '10', lineType: 'Anode', lotNo: '30', startHour: '1', startMinute: '0', pm: true, endHour: '2', endMinute: '3', phenomenon: 'Jam', actions: 'Cleared' }), D(2026,10,22,15,0)).report,
  '8FJL58NA30\n[Equipment Downtime Report]\n1. Equipment: 10A\n2. Time: 13:00 - 14:03\n3. HMI: N/A\n4. Vision: N/A\n5. Phenomenon: Jam\n6. Actions Taken: Cleared');
eq('A PM end not shifted when below start', E.buildDowntime(A({ startHour: '11', startMinute: '07', pm: true, endHour: '1', endMinute: '20', phenomenon: 'p' }), D(2026,10,22,23,30)).report.split('\n')[3],
  '2. Time: 23:07 - 1:20');
eq('A PM ignored for hour >= 12', E.buildDowntime(A({ startHour: '14', startMinute: '00', pm: true, endHour: '15', endMinute: '00', phenomenon: 'p' }), D(2026,10,22,16,0)).report.split('\n')[3],
  '2. Time: 14:00 - 15:00');
eq('A Now uses current time', E.buildDowntime(A({ now: true, endHour: '', endMinute: '', phenomenon: 'p' }), D(2026,10,22,16,4)).report.split('\n')[3],
  '2. Time: 9:05 - 16:04');
eq('A multiline phenomenon: trimIndent quirk keeps 16-space indent', E.buildDowntime(A({ phenomenon: 'line1\nline2' }), D(2026,10,22,14,30)).report,
  ['8FJM33NC05','[Equipment Downtime Report]','1. Equipment: 3C','2. Time: 9:05 - 10:15','3. HMI: N/A','4. Vision: N/A','5. Phenomenon: line1','line2','6. Actions Taken: Reset']
    .map(function (l, i) { return i === 7 ? l : '                ' + l; }).join('\n'));

// ---- Screen A validation
eq('A all empty', E.verifyDowntime({ lineNo: null, lineType: null, lotNo: '', startHour: '', startMinute: '', pm: false, endHour: '', endMinute: '', now: false, visionTime: '', hmi: '', vision: '', phenomenon: '', actions: '' }).log,
  'Must select line number\nMust select line type\nMust enter start hour\nMust enter start minutes\nMust enter full end time\nMust enter phenomenon\nMust enter actions taken\n');
eq('A range errors', E.verifyDowntime(A({ startHour: '24', startMinute: '60', endHour: '24', endMinute: '99' })).log,
  'Start Hour cannot exceed 23\nStart Minute cannot exceed 59\nEnd Hour cannot exceed 23\nEnd Minute cannot exceed 59\nMust enter phenomenon\n');
eq('A HMI alone satisfies phenomenon', E.verifyDowntime(A({ hmi: 'E1' })).ok, true);
eq('A Now skips end checks', E.verifyDowntime(A({ now: true, endHour: '99', endMinute: '', phenomenon: 'x' })).ok, true);

// ---- auto-advance (switchTextBox)
eq('hour "2" stays', JSON.stringify(E.switchTextBox('2', 2, 24)), '{"value":"2","advance":false}');
eq('hour "3" advances', E.switchTextBox('3', 2, 24).advance, true);
eq('hour "25" truncated to "2"', E.switchTextBox('25', 2, 24).value, '2');
eq('minute "6" advances', E.switchTextBox('6', 5, 59).advance, true);
eq('minute "5" stays', E.switchTextBox('5', 5, 59).advance, false);

// ---- Screen B report
var ENG = "\n\n\nDon't forget to ping the engineers!\n\nDay: Jeonghoon (Jay) Park and Junyoung\nMid: JU\nNight: Leo\n\n";
var r1 = E.buildHold(B({ cellIDs: '300, 12,7 45', ngCount: '4', footer: '@Jay please check' , useFooter: true }), D(2026,10,22,14,30));
eq('B report with footer, sorted cells', r1.report,
  '<  Torn/Uncut Tab Report >\n1. #Line: 3C\n2. #Lot: 8FJM33NC05\n3. Reason: Torn\n4. NG count: 4\n5. Cell ID: 7, 12, 45, 300\n@Jay please check');
eq('B display adds engineers text', r1.display, r1.report + ENG);
eq('B no footer, NG default 1', E.buildHold(B({ lineType: 'Anode', reason: 'Zipper', cellIDs: '007' }), D(2026,10,22,14,30)).report,
  '<  Torn/Uncut Tab Report >\n1. #Line: 3A\n2. #Lot: 8FJM36NA05\n3. Reason: Zipper\n4. NG count: 1\n5. Cell ID: 7');
eq('B footer kept even if checkbox off', E.buildHold(B({ useFooter: false, footer: 'hi' }), D(2026,10,22,14,30)).report.split('\n').pop(), 'hi');
eq('B lot uses current time (06:20, lot 3 -> yesterday)', E.buildHold(B({ lotNo: '3' }), D(2026,10,22,6,20)).report.split('\n')[2], '2. #Lot: 8FJL33NC03');
eq('B cells newline separated', E.buildHold(B({ cellIDs: '9\n3\n5' }), D(2026,10,22,14,30)).report.split('\n')[5], '5. Cell ID: 3, 5, 9');

// ---- Screen B validation
eq('B all empty', E.verifyHold({ lineNo: null, lineType: null, lotNo: '', reason: null, ngCount: '', cellIDs: '', useFooter: true, footer: ' ' }).log,
  'Must select line number\nMust select line type\nMust select lot number\nMust input valid cell IDs\nMust select hold reason\nMust input custom footer or deselect it\n');
eq('B duplicate', E.verifyHold(B({ cellIDs: '5, 5' })).log, 'Cell IDs must be different\n');
eq('B out of bounds', E.verifyHold(B({ cellIDs: '0, 26001, 26000' })).log, 'Cell ID out of bounds\nCell ID out of bounds\n');
eq('B dup then invalid accumulates', E.verifyHold(B({ cellIDs: '5, 5, x' })).log, 'Cell IDs must be different\nMust input valid cell IDs\n');
eq('B double comma invalid', E.verifyHold(B({ cellIDs: '1,,2' })).log, 'Must input valid cell IDs\n');
eq('B comma+2 spaces invalid', E.verifyHold(B({ cellIDs: '1,  2' })).log, 'Must input valid cell IDs\n');
eq('B ok', E.verifyHold(B({ cellIDs: '1, 2,3 4\n5' })).ok, true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
