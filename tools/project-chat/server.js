// Project Chat — local AI assistant + nightly agent report inbox
// Zero dependencies. Requires Node.js 18+.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
// HOME holds config.json and data/ — set by the desktop app to a writable folder
const HOME = process.env.PROJECT_CHAT_HOME || ROOT;
if (!fs.existsSync(HOME)) fs.mkdirSync(HOME, { recursive: true });
const CONFIG_PATH = path.join(HOME, 'config.json');
const DATA_DIR = path.join(HOME, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---------- config ----------
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const fresh = {
      port: 3500,
      host: '0.0.0.0',
      reportToken: crypto.randomBytes(18).toString('hex'),
      accessPassword: '',
      model: 'claude-sonnet-5-5',
      maxMessages: 30,
      keepReports: 5,
      ownerName: 'Grant'
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(fresh, null, 2));
    console.log('Created config.json with a new report token.');
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  cfg.port = Number(process.env.PORT || cfg.port || 3500);
  return cfg;
}
const cfg = loadConfig();

// AI replies run through the local `claude` CLI (Claude Code), authenticated with
// your Claude subscription, instead of a metered Anthropic API key.
function checkClaudeCli() {
  try {
    const r = spawnSync('claude', ['--version'], { timeout: 5000, shell: process.platform === 'win32' });
    return r.status === 0;
  } catch {
    return false;
  }
}
const claudeAvailable = checkClaudeCli();

// ---------- storage ----------
function seedDb() {
  const now = new Date().toISOString();
  return {
    projects: [{
      id: 'project-iron',
      team: 'designengineering.ai Development Team',
      name: 'Project Iron',
      agent: 'Lydia',
      description: 'Nightly feature spec runs for designengineering.ai',
      createdAt: now
    }],
    messages: [{
      id: uid(), projectId: 'project-iron', role: 'agent', author: 'Lydia',
      text: 'Hi ' + cfg.ownerName + ', I\'m Lydia on Project Iron. My nightly feature spec run reports will show up here. Ask me about any run.',
      ts: now
    }]
  };
}
function uid() { return crypto.randomBytes(8).toString('hex'); }
function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(seedDb(), null, 2));
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
let db = loadDb();
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_PATH);
  }, 100);
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid(); }
function findProject(ref) {
  if (!ref) return null;
  const r = String(ref).toLowerCase();
  return db.projects.find(p => p.id === r || p.name.toLowerCase() === r) || null;
}
function addMessage(m) {
  const msg = { id: uid(), ts: new Date().toISOString(), ...m };
  db.messages.push(msg);
  saveDb();
  broadcast({ type: 'message', message: msg });
  pruneProject(msg.projectId);
  return msg;
}

// Keep each project's chat thin: the newest `maxMessages` messages, plus the
// newest `keepReports` reports even if they're older (the assistant reads those).
function pruneProject(projectId) {
  const max = Number(cfg.maxMessages) || 30;
  const keepReports = Number(cfg.keepReports ?? 5);
  const mine = db.messages.filter(x => x.projectId === projectId);
  if (mine.length <= max) return;
  const keep = new Set(mine.slice(-max).map(x => x.id));
  mine.filter(x => x.role === 'report').slice(-keepReports).forEach(x => keep.add(x.id));
  const removed = mine.filter(x => !keep.has(x.id)).map(x => x.id);
  if (!removed.length) return;
  const gone = new Set(removed);
  db.messages = db.messages.filter(x => !gone.has(x.id));
  saveDb();
  broadcast({ type: 'pruned', projectId, ids: removed });
}
function pruneAll() { for (const pr of db.projects) pruneProject(pr.id); }

// ---------- live updates (SSE) ----------
const clients = new Set();
function broadcast(evt) {
  const line = 'data: ' + JSON.stringify(evt) + '\n\n';
  for (const res of clients) res.write(line);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

// ---------- AI assistant ----------
// Runs the prompt through the local `claude` CLI instead of calling the Anthropic
// API directly, so replies draw on your Claude subscription's usage rather than a
// separate metered API key. Everything goes over stdin so there's no argv size
// limit and no shell-escaping to get wrong.
function runClaude(promptText, model) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', model, '--output-format', 'text'], {
      cwd: HOME,
      // Windows: the CLI is often claude.cmd, which Node can only launch through a shell
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '', err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timed out waiting for a reply'));
    }, 60000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || ('claude exited with code ' + code)));
      resolve(out.trim());
    });
    child.stdin.end(promptText);
  });
}

async function assistantReply(project, userText) {
  const msgs = db.messages.filter(m => m.projectId === project.id);
  const reports = msgs.filter(m => m.role === 'report').slice(-5);

  if (!claudeAvailable) return offlineReply(project, reports, userText);

  const reportContext = reports.length
    ? reports.map(r => {
        const rp = r.report;
        return `### ${rp.title} (run ${rp.runDate}, status: ${rp.status})\nSummary: ${rp.summary || '-'}\n${rp.body || ''}`;
      }).join('\n\n')
    : 'No reports have been received yet.';

  const system =
`You are ${project.agent}, the AI assistant for ${project.name} on the ${project.team}.
${project.description ? 'Project: ' + project.description + '.' : ''}
Each night an agentic pipeline runs feature specs and posts a report here. You help ${cfg.ownerName} understand results, failures, trends, and next actions.
Be direct, professional, and concise. Use short structured answers. If a report doesn't contain the answer, say so.

Most recent reports (oldest first):
${reportContext}`;

  // Recent conversation (user/assistant only), must start with user; this already
  // ends with the current user turn since it's added to the db before this runs.
  let history = msgs.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20)
    .map(m => ({ role: m.role, content: m.text }));
  while (history.length && history[0].role !== 'user') history.shift();
  history = history.length ? history : [{ role: 'user', content: userText }];

  const transcript = history.map(h => (h.role === 'user' ? 'User: ' : 'Assistant: ') + h.content).join('\n\n');
  const promptText = system + '\n\n---\nConversation so far:\n\n' + transcript +
    '\n\nReply as the assistant to the last user message above. Reply with plain text only, no tool use.';

  try {
    const reply = await runClaude(promptText, cfg.model);
    return reply || '(no reply)';
  } catch (e) {
    return 'Could not get a reply from the claude CLI: ' + e.message;
  }
}

function offlineReply(project, reports, text) {
  const t = text.toLowerCase();
  if (/latest|last|status|today|tonight|last night/.test(t)) {
    if (!reports.length) return 'No reports yet for ' + project.name + '.';
    const r = reports[reports.length - 1].report;
    return `Latest run (${r.runDate}) — **${r.status.toUpperCase()}**\n${r.title}\n${r.summary || ''}`;
  }
  if (/report|runs|history|list/.test(t)) {
    if (!reports.length) return 'No reports yet for ' + project.name + '.';
    return reports.slice().reverse().map(m => `- ${m.report.runDate} · ${m.report.status} · ${m.report.title}`).join('\n');
  }
  return 'AI replies are off (the `claude` CLI isn\'t on PATH for this app). I can still answer "latest" or "list reports".';
}

// ---------- http helpers ----------
function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2e6) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(new Error('Invalid JSON')); } });
  });
}
function uiAuthorized(req) {
  if (!cfg.accessPassword) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  return safeEqual(pass, cfg.accessPassword);
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    // Report ingest: token auth, not UI password
    if (p === '/api/reports' && req.method === 'POST') {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : (req.headers['x-report-token'] || '');
      if (!safeEqual(token, cfg.reportToken)) return send(res, 401, { error: 'Invalid report token' });
      const b = await readBody(req);
      let project = findProject(b.project || b.projectId);
      if (!project) {
        if (!b.project) return send(res, 400, { error: 'Field "project" is required' });
        project = { id: slug(b.project), team: b.team || 'Default Team', name: b.project, agent: b.agent || 'Agent', description: '', createdAt: new Date().toISOString() };
        db.projects.push(project); saveDb(); broadcast({ type: 'projects' });
      }
      const status = String(b.status || 'info').toLowerCase();
      const report = {
        title: b.title || 'Nightly feature spec run',
        status,
        runDate: b.runDate || new Date().toISOString().slice(0, 10),
        summary: b.summary || '',
        body: b.body || '',
        stats: b.stats || null,
        link: b.link || ''
      };
      const msg = addMessage({ projectId: project.id, role: 'report', author: b.agent || project.agent, text: report.summary || report.title, report });
      return send(res, 201, { ok: true, id: msg.id, project: project.id });
    }

    if (p === '/api/health') return send(res, 200, { ok: true });

    if (!uiAuthorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Project Chat"' });
      return res.end('Authentication required');
    }

    if (p === '/api/info') {
      return send(res, 200, { port: cfg.port, lan: lanAddresses(), aiEnabled: claudeAvailable, model: cfg.model, owner: cfg.ownerName });
    }

    if (p === '/api/projects' && req.method === 'GET') {
      const out = db.projects.map(pr => {
        const last = db.messages.filter(m => m.projectId === pr.id).slice(-1)[0];
        return { ...pr, lastTs: last ? last.ts : pr.createdAt };
      });
      return send(res, 200, out);
    }
    if (p === '/api/projects' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b.name) return send(res, 400, { error: 'name required' });
      let id = slug(b.name);
      if (db.projects.some(x => x.id === id)) id += '-' + uid().slice(0, 4);
      const pr = { id, team: b.team || 'Default Team', name: b.name, agent: b.agent || 'Assistant', description: b.description || '', createdAt: new Date().toISOString() };
      db.projects.push(pr); saveDb(); broadcast({ type: 'projects' });
      return send(res, 201, pr);
    }

    let m = p.match(/^\/api\/projects\/([^/]+)\/messages$/);
    if (m && req.method === 'GET') {
      const pr = findProject(decodeURIComponent(m[1]));
      if (!pr) return send(res, 404, { error: 'Project not found' });
      return send(res, 200, db.messages.filter(x => x.projectId === pr.id).slice(-200));
    }

    m = p.match(/^\/api\/projects\/([^/]+)\/chat$/);
    if (m && req.method === 'POST') {
      const pr = findProject(decodeURIComponent(m[1]));
      if (!pr) return send(res, 404, { error: 'Project not found' });
      const b = await readBody(req);
      const text = String(b.text || '').trim();
      if (!text) return send(res, 400, { error: 'text required' });
      addMessage({ projectId: pr.id, role: 'user', author: cfg.ownerName, text });
      broadcast({ type: 'typing', projectId: pr.id, author: pr.agent });
      const reply = await assistantReply(pr, text);
      addMessage({ projectId: pr.id, role: 'assistant', author: pr.agent, text: reply });
      return send(res, 200, { ok: true });
    }

    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // static
    const file = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

pruneAll();
server.listen(cfg.port, cfg.host, () => {
  console.log('\nAgent Chat is running');
  console.log('  This computer:   http://localhost:' + cfg.port);
  for (const ip of lanAddresses()) console.log('  Other computers: http://' + ip + ':' + cfg.port);
  console.log('  AI replies:      ' + (claudeAvailable ? 'on (via claude CLI, ' + cfg.model + ')' : 'off — install the claude CLI and sign in with "claude" once, then restart'));
  console.log('  Report token:    ' + cfg.reportToken + '\n');
  if (module.exports.onReady) module.exports.onReady();
});
server.on('error', e => { if (module.exports.onError) module.exports.onError(e); else throw e; });

module.exports = { server, cfg, home: HOME, configPath: CONFIG_PATH, lanAddresses };
