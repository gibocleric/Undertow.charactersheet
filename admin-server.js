// Local Undertow community-tree editor/publisher. Run with: node admin-server.js
// Admin credentials and GitHub credentials are never sent to the public site.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { spawnSync } = require('node:child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const DATA_FILE = path.join(ROOT, 'community-trees.json');
const CONFIG_FILE = path.join(ROOT, '.admin-access.json');
const sessions = new Set();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) reject(new Error('Request is too large.')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON.')); } });
    req.on('error', reject);
  });
}
function readCatalog() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { version: 1, trees: [] }; }
}
function validCatalog(data) {
  if (!data || !Array.isArray(data.trees) || data.trees.length > 200) return false;
  const ids = new Set();
  for (const tree of data.trees) {
    if (!tree || typeof tree.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(tree.id) || ids.has(tree.id)) return false;
    ids.add(tree.id);
    if (typeof tree.title !== 'string' || !tree.title.trim() || tree.title.length > 80 || !Array.isArray(tree.periods) || !tree.periods.length || !Array.isArray(tree.perks) || tree.perks.length > 100) return false;
    const perkIds = new Set();
    for (const perk of tree.perks) {
      if (!perk || typeof perk.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(perk.id) || perkIds.has(perk.id) || typeof perk.name !== 'string' || !perk.name.trim() || perk.name.length > 80 || typeof perk.description !== 'string' || perk.description.length > 1200 || !Number.isInteger(perk.cost) || perk.cost < 0 || perk.cost > 500 || !Array.isArray(perk.requires)) return false;
      perkIds.add(perk.id);
    }
    for (const perk of tree.perks) if (perk.requires.some(id => !perkIds.has(id) || id === perk.id)) return false;
  }
  return true;
}
function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || 'Git command failed.').trim());
  return result.stdout.trim();
}
function isGitRepo() {
  try { git(['rev-parse', '--show-toplevel']); git(['remote', 'get-url', 'origin']); return true; } catch { return false; }
}
function secureEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
async function ensureAdminConfig() {
  if (fs.existsSync(CONFIG_FILE)) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\nFirst-time local admin setup. Choose an account name and password. These stay on this computer.');
    let account = '';
    while (!account.trim()) account = await rl.question('Admin account name: ');
    let password = '';
    while (password.length < 8) password = await rl.question('Admin password (at least 8 characters): ');
    let confirm = await rl.question('Confirm admin password: ');
    while (!secureEqual(password, confirm)) {
      console.log('Those passwords did not match.');
      password = await rl.question('Admin password (at least 8 characters): ');
      confirm = await rl.question('Confirm admin password: ');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ account: account.trim(), salt, hash }, null, 2), { flag: 'wx' });
    console.log('Admin account saved locally. Keep .admin-access.json private.');
  } finally { rl.close(); }
}
function verifyLogin(account, password) {
  let config;
  try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return false; }
  const hash = crypto.scryptSync(String(password || ''), config.salt, 64).toString('hex');
  return secureEqual(account || '', config.account) && secureEqual(hash, config.hash);
}
function staticFile(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(path.resolve(ROOT) + path.sep) && file !== path.join(ROOT, 'index.html')) return json(res, 403, { error: 'Forbidden.' });
  fs.readFile(file, (error, contents) => {
    if (error) return json(res, 404, { error: 'File not found.' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(contents);
  });
}

async function main() {
  await ensureAdminConfig();
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && pathname === '/api/community-trees') return json(res, 200, { ...readCatalog(), adminAvailable: true, gitReady: isGitRepo() });
      if (req.method === 'POST' && pathname === '/api/admin-login') {
        const body = await readBody(req);
        if (!verifyLogin(body.account, body.password)) return json(res, 401, { error: 'Account or password is incorrect.' });
        const token = crypto.randomBytes(32).toString('hex'); sessions.add(token);
        return json(res, 200, { token });
      }
      if (req.method === 'POST' && pathname === '/api/publish-trees') {
        const token = req.headers['x-admin-token'];
        if (!token || !sessions.has(token)) return json(res, 401, { error: 'Sign in to the local admin editor first.' });
        const body = await readBody(req);
        if (!validCatalog(body)) return json(res, 400, { error: 'The skill tree data is incomplete or invalid.' });
        const serialized = JSON.stringify({ version: 1, trees: body.trees }, null, 2) + '\n';
        const temp = DATA_FILE + '.tmp';
        fs.writeFileSync(temp, serialized, 'utf8'); fs.renameSync(temp, DATA_FILE);
        if (!isGitRepo()) return json(res, 200, { published: false, saved: true, message: 'Saved locally. Put this folder in your GitHub repository clone to publish it for everyone.' });
        try {
          git(['add', '--', 'community-trees.json']);
          const status = git(['status', '--porcelain', '--', 'community-trees.json']);
          if (status) {
            git(['commit', '--only', '-m', 'Publish community skill trees', '--', 'community-trees.json']);
            git(['push', 'origin', 'HEAD']);
          }
          return json(res, 200, { published: true, saved: true, message: status ? 'Skill trees were saved and pushed. GitHub Pages will update from your publishing branch.' : 'No changes to publish.' });
        } catch (error) {
          return json(res, 200, { published: false, saved: true, message: `Saved locally, but Git could not publish it: ${error.message}` });
        }
      }
      if (req.method === 'GET' && pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
      staticFile(req, res);
    } catch (error) { json(res, 400, { error: error.message || 'Request failed.' }); }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Undertow local editor: http://127.0.0.1:${PORT}`);
    console.log('This editor only accepts connections from this computer. Press Ctrl+C to stop it.');
    if (!isGitRepo()) console.log('No GitHub repository clone detected beside admin-server.js; edits can be saved locally but not published yet.');
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
