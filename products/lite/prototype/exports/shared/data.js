/* Shared sample data for the prototype. One source for projects, chats, Vault items and uploads, so every page shows the same things.
   Everything here is a placeholder (A). Projects a person adds are kept in localStorage under de-projects. */
(function () {
  var base = [
    { id: 'BC-Q-26041', name: 'Palletizer retrofit', step: 3, chats: ['Pneumatic cylinder sizing for palletizer', 'Layout review for pallet stack', 'Safety circuit for guarded cell'] },
    { id: 'BC-Q-26038', name: 'Capping station', step: 2, chats: ['Capping station I/O list draft', 'FAT checklist for capping station', 'Servo axis overcurrent fault'] },
    { id: 'BC-Q-26035', name: 'Label applicator', step: 1, chats: ['Conveyor VFD and motor selection', 'Tolerance stack-up on bracket assembly'] },
    { id: 'BC-Q-26031', name: 'Conveyor transfer bracket', step: 4, chats: ['Bracket load check'] },
    { id: 'BC-Q-26027', name: 'Washdown motor VFD sizing', step: 2, chats: ['VFD sizing for washdown duty'] },
    { id: 'BC-Q-26019', name: 'Case erector controls upgrade', step: 5, chats: ['Controls upgrade scope', 'SAT punch list'] }
  ];
  var added = [];
  try { var v = JSON.parse(localStorage.getItem('de-projects')); if (Array.isArray(v)) added = v.filter(function (p) { return p && /^BC-Q-\d+$/.test(p.id) && typeof p.name === 'string'; }); } catch (e) {}
  added.forEach(function (p) { p.added = true; p.chats = Array.isArray(p.chats) ? p.chats : []; });
  var projects = base.concat(added);

  var recents = ['GitHub branch organization workflow', 'Downtime by cause from stoppage CSV', 'Gear ratio for a hoist drive', 'Compare 304 and 316 stainless for washdown', 'Cable tray fill calculation', 'Compressed air leak estimate', 'PLC tag naming convention', 'Quote template wording'];

  /* Uploads: files people added, plus every file a chat used as a source or attachment. */
  var uploads = [
    { n: 'palletizer-frame.step', k: 'model', size: '46.0 MB', p: 'BC-Q-26041', d: 'Nov 9' },
    { n: 'site-photos.zip', k: 'zip', size: '30.0 MB', p: 'BC-Q-26041', d: 'Nov 9' },
    { n: 'gearbox-GB-220-datasheet.pdf', k: 'doc', size: '2.4 MB', p: 'BC-Q-26041', d: 'Nov 9', title: 'Gearbox GB-220 data sheet', chat: 'Gearbox running hot', use: 'Source' },
    { n: 'BC-Q-26041-conveyor-spec.pdf', k: 'doc', size: '1.1 MB', p: 'BC-Q-26041', d: 'Nov 8', title: 'BC-Q-26041 conveyor spec', chat: 'Gearbox running hot', use: 'Source' },
    { n: 'motor-M-4410-datasheet.pdf', k: 'doc', size: '0.9 MB', p: 'BC-Q-26041', d: 'Nov 8', title: 'Motor M-4410 data sheet', chat: 'Gearbox running hot', use: 'Source' },
    { n: 'BC-Q-26041-drive-spec.pdf', k: 'doc', size: '1.8 MB', p: 'BC-Q-26041', d: 'Nov 10', chat: 'Gearbox running hot', use: 'Attached' },
    { n: 'gearbox-nameplate.jpg', k: 'photo', size: '640 KB', p: 'BC-Q-26041', d: 'Nov 10', chat: 'Gearbox running hot', use: 'Attached' },
    { n: 'drive-guard-photo.jpg', k: 'photo', size: '3.8 MB', p: 'BC-Q-26041', d: 'Nov 9' },
    { n: 'capping-io-list.pdf', k: 'doc', size: '0.4 MB', p: 'BC-Q-26038', d: 'Nov 6', chat: 'Capping station I/O list draft', use: 'Source' },
    { n: 'servo-drive-manual.pdf', k: 'doc', size: '12.6 MB', p: 'BC-Q-26038', d: 'Nov 5', chat: 'Servo axis overcurrent fault', use: 'Source' },
    { n: 'label-head-bracket.step', k: 'model', size: '3.1 MB', p: 'BC-Q-26035', d: 'Nov 4' },
    { n: 'lockout-procedure-LOTO-004.pdf', k: 'doc', size: '0.6 MB', p: '', d: 'Nov 5', chat: 'Compare 304 and 316 stainless for washdown', use: 'Source' }
  ];

  /* Calculators the person built with the assistant. inp: key, label, unit, default. out: label, expression (uses the keys), unit, decimals, main. */
  var calcs = [
    { id: 'thr', name: 'Line throughput', p: '', d: 'Nov 10', about: 'Parts per hour from cycle time, parts per cycle and availability.',
      inp: [['ct', 'Cycle time', 's', 12], ['n', 'Parts per cycle', '', 4], ['av', 'Availability', '%', 85], ['hrs', 'Shift length', 'h', 8]],
      out: [['Parts per hour', function (v) { return 3600 / v.ct * v.n * v.av / 100; }, '', 0, 1], ['Parts per shift', function (v) { return 3600 / v.ct * v.n * v.av / 100 * v.hrs; }, '', 0], ['Parts per minute', function (v) { return 60 / v.ct * v.n * v.av / 100; }, '', 1]],
      form: 'Parts per hour = 3600 / cycle time × parts per cycle × availability\nParts per shift = parts per hour × shift length' },
    { id: 'hyd', name: 'Hydraulic cylinder sizing', p: 'BC-Q-26041', d: 'Nov 9', about: 'Bore, piston area and flow from the force you need and the system pressure.',
      inp: [['F', 'Force needed', 'kN', 25], ['p', 'System pressure', 'bar', 160], ['v', 'Rod speed', 'mm/s', 100]],
      out: [['Minimum bore', function (v) { return Math.sqrt(4 * v.F * 1000 / (Math.PI * v.p * 1e5)) * 1000; }, 'mm', 1, 1], ['Piston area', function (v) { return v.F * 1000 / (v.p * 1e5) * 1e4; }, 'cm²', 1], ['Flow at that speed', function (v) { return v.F * 1000 / (v.p * 1e5) * v.v / 1000 * 60 * 1000; }, 'L/min', 1]],
      form: 'A = F / P\nBore = √(4 × A / π)\nFlow = A × rod speed' },
    { id: 'pneu', name: 'Pneumatic cylinder force', p: 'BC-Q-26041', d: 'Nov 8', about: 'Extend and retract force from bore, rod and pressure.',
      inp: [['bore', 'Bore', 'mm', 63], ['rod', 'Rod diameter', 'mm', 20], ['p', 'Pressure', 'bar', 6], ['eff', 'Efficiency', '%', 90]],
      out: [['Extend force', function (v) { return v.p * 1e5 * Math.PI * Math.pow(v.bore / 2000, 2) * v.eff / 100; }, 'N', 0, 1], ['Retract force', function (v) { return v.p * 1e5 * Math.PI * (Math.pow(v.bore / 2000, 2) - Math.pow(v.rod / 2000, 2)) * v.eff / 100; }, 'N', 0]],
      form: 'F = P × A × efficiency\nA (retract) = π × ((bore / 2)² − (rod / 2)²)' }
  ];

  /* Vault: everything made in the app. Uploads and calculators are added below so the Vault lists them too. */
  var P06 = '../P06-project-workspace/index.html?project=', P08 = '../P08-3d-viewer/index.html', P03 = '../P03-chat-conversation/index.html';
  var vault = [
    { n: 'Process document, rev 3', t: 'Document', p: 'BC-Q-26041', d: '2h ago', h: P06 + 'BC-Q-26041&tab=3' },
    { n: 'Palletizer schedule', t: 'Schedule', p: 'BC-Q-26041', d: '15h ago', h: P06 + 'BC-Q-26041&tab=4' },
    { n: 'Palletizer frame v4', t: 'Model', p: 'BC-Q-26041', d: 'yesterday', h: P08 },
    { n: 'Quote for Palletizer retrofit', t: 'Document', p: 'BC-Q-26041', d: 'Nov 9', h: P06 + 'BC-Q-26041&tab=3' },
    { n: 'Capping station process document', t: 'Document', p: 'BC-Q-26038', d: 'Nov 9', h: P06 + 'BC-Q-26038&tab=3' },
    { n: 'Capping station schedule', t: 'Schedule', p: 'BC-Q-26038', d: 'Nov 5', h: P06 + 'BC-Q-26038&tab=4' },
    { n: 'Label head bracket, option B', t: 'Model', p: 'BC-Q-26035', d: 'Nov 4', h: P08 },
    { n: 'Transfer bracket, spacer', t: 'Model', p: 'BC-Q-26031', d: 'Oct 30', h: P08 },
    { n: 'VFD sizing summary', t: 'Document', p: 'BC-Q-26027', d: 'Oct 29', h: P06 + 'BC-Q-26027&tab=3' },
    { n: 'Case erector schedule', t: 'Schedule', p: 'BC-Q-26019', d: 'Oct 29', h: P06 + 'BC-Q-26019&tab=4' },
    { n: 'Case erector I/O list', t: 'Document', p: 'BC-Q-26019', d: 'Oct 28', h: P06 + 'BC-Q-26019&tab=3' }
  ];
  projects.forEach(function (p) { (p.chats || []).forEach(function (c, i) { if (i < 1) vault.push({ n: c, t: 'Chat', p: p.id, d: 'Nov 9', h: P03 + '?project=' + p.id + '&chat=' + encodeURIComponent(c) }); }); });
  calcs.forEach(function (c) { vault.push({ n: c.name, t: 'Calculator', p: c.p, d: c.d, calc: c.id }); });
  uploads.forEach(function (u) { vault.push({ n: u.title || u.n, t: 'Upload', p: u.p, d: u.d, h: '../P07-upload-flow/index.html' + (u.p ? '?project=' + u.p : ''), file: u.n }); });

  function project(id) { for (var i = 0; i < projects.length; i++) if (projects[i].id === id) return projects[i]; return null; }
  function addProject(name) {
    var max = 26041; projects.forEach(function (p) { var m = /(\d+)$/.exec(p.id); if (m) max = Math.max(max, +m[1]); });
    var p = { id: 'BC-Q-' + (max + 1), name: name, step: 1, chats: [], added: true };
    added.push(p); projects.push(p);
    try { localStorage.setItem('de-projects', JSON.stringify(added)); } catch (e) {}
    return p;
  }
  window.DE = { projects: projects, recents: recents, uploads: uploads, calcs: calcs, vault: vault, project: project, addProject: addProject,
    stages: ['Assessment', 'Design', 'Build', 'FAT', 'SAT'],
    chatUrl: function (title, pid) { return '../P03-chat-conversation/index.html?chat=' + encodeURIComponent(title) + (pid ? '&project=' + pid : ''); },
    summaryUrl: function (pid) { return '../P05A-project-summary/index.html?project=' + pid; } };
})();
