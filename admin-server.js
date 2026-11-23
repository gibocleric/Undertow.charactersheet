// Local Undertow community-tree editor/publisher. Run with: node admin-server.js
// Admin credentials and GitHub credentials are never sent to the public site.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { spawnSync, spawn } = require('node:child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const BUNDLE_MARKER = 'Undertow admin bundle: universal-admin-v15';
const DATA_FILE = path.join(ROOT, 'community-trees.json');
const SITE_CONFIG_FILE = path.join(ROOT, 'site-config.json');
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
    req.on('data', chunk => { body += chunk; if (body.length > 4_000_000) reject(new Error('Request is too large.')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON.')); } });
    req.on('error', reject);
  });
}
function readCatalog() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { version: 1, trees: [] }; }
}
function readSiteConfig() {
  try { return JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf8')); }
  catch { return { version: 1, blocks: [], pageParts: [], textOverrides: [], perkOverrides: [], inventoryItems: [], perkItems: [], stats: [], skills: [], removedSkills: [], removedItems: [], statValues: [], backgrounds: [], activeBackgroundId: '' }; }
}
function validSiteConfig(data) {
  if (!data || !['blocks', 'pageParts', 'textOverrides', 'perkOverrides', 'inventoryItems', 'perkItems', 'stats', 'skills', 'removedSkills', 'removedItems', 'statValues', 'backgrounds'].every(key => Array.isArray(data[key]) && data[key].length <= 500)) return false;
  if (JSON.stringify(data).length > 3_000_000) return false;
  const ids = new Set();
  for (const item of [...data.blocks, ...data.pageParts, ...data.inventoryItems, ...data.perkItems, ...data.stats, ...data.skills, ...data.backgrounds]) {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(item.id) || ids.has(item.id)) return false;
    ids.add(item.id);
    if (typeof item.label !== 'string' || item.label.length > 120) return false;
  }
  const pages = new Set(['character-screen', 'stats-screen', 'skills-screen', 'perks-screen', 'inventory-screen', 'final-screen']);
  const blockTypes = new Set(['text', 'textarea', 'number', 'slider', 'switch', 'checkbox', 'multiselect', 'dropdown', 'radio', 'date', 'url', 'file', 'heading', 'paragraph', 'divider', 'button', 'image']);
  for (const block of data.blocks) {
    if (!blockTypes.has(block.type) || !pages.has(block.page) || typeof block.content !== 'string' || block.content.length > 1200) return false;
    if (['number', 'slider'].includes(block.type) && (!Number.isFinite(block.min) || !Number.isFinite(block.max) || block.min > block.max || !Number.isFinite(block.step) || block.step <= 0)) return false;
    if (['dropdown', 'radio', 'multiselect'].includes(block.type) && (!Array.isArray(block.options) || block.options.length < 2 || block.options.length > 50 || block.options.some(option => typeof option !== 'string' || option.length > 120))) return false;
    if (block.type === 'button' && (typeof block.url !== 'string' || !/^(https?:\/\/|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(block.url))) return false;
    if (block.type === 'image' && (typeof block.imageData !== 'string' || block.imageData.length > 1_500_000 || !/^data:image\/(png|jpeg|webp);base64,/.test(block.imageData))) return false;
    if (block.required !== undefined && typeof block.required !== 'boolean') return false;
  }
  for (const part of data.pageParts) {
    if (!pages.has(part.page) || typeof part.visible !== 'boolean') return false;
    if (part.displayText !== undefined && (typeof part.displayText !== 'string' || part.displayText.length > 1200)) return false;
    for (const key of ['min', 'max', 'step']) if (part[key] !== undefined && part[key] !== null && !Number.isFinite(part[key])) return false;
    if (part.min != null && part.max != null && part.min > part.max) return false;
    if (part.step != null && part.step <= 0) return false;
  }
  for (const perk of data.perkOverrides) if (!perk || typeof perk.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(perk.id) || (perk.name !== undefined && (typeof perk.name !== 'string' || perk.name.length > 100)) || (perk.description !== undefined && (typeof perk.description !== 'string' || perk.description.length > 2000)) || (perk.cost !== undefined && (!Number.isInteger(perk.cost) || perk.cost < 0 || perk.cost > 500)) || (perk.requires !== undefined && (!Array.isArray(perk.requires) || perk.requires.length > 30 || perk.requires.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(id)))) || (perk.removed !== undefined && typeof perk.removed !== 'boolean')) return false;
  for (const item of data.textOverrides) if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(item.id) || !['character-screen','stats-screen','skills-screen','perks-screen','inventory-screen','final-screen','print-sheet'].includes(item.root) || typeof item.selector !== 'string' || item.selector.length > 1000 || typeof item.text !== 'string' || item.text.length > 2000) return false;
  const removableCollections = new Set(['blocks', 'pageParts', 'inventoryItems', 'perkItems', 'stats', 'skills', 'backgrounds']);
  for (const removed of data.removedItems) if (!removed || !removableCollections.has(removed.collection) || typeof removed.id !== 'string' || removed.id.length > 100) return false;
  for (const background of data.backgrounds) if (typeof background.data !== 'string' || background.data.length > 1_500_000 || !/^data:image\/(png|jpeg|webp);base64,/.test(background.data)) return false;
  if (data.activeBackgroundId && !data.backgrounds.some(item => item.id === data.activeBackgroundId)) return false;
  return true;
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
  const indexPath = path.join(ROOT, 'index.html');
  const matchingAppBundle = fs.existsSync(indexPath) && fs.readFileSync(indexPath, 'utf8').includes(BUNDLE_MARKER);
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && pathname === '/api/community-trees') return json(res, 200, { ...readCatalog(), adminAvailable: true, gitReady: isGitRepo() });
      if (req.method === 'GET' && pathname === '/api/site-config') return json(res, 200, { ...readSiteConfig(), adminAvailable: true, gitReady: isGitRepo() });
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
      if (req.method === 'POST' && pathname === '/api/publish-site-config') {
        const token = req.headers['x-admin-token'];
        if (!token || !sessions.has(token)) return json(res, 401, { error: 'Sign in to the local admin editor first.' });
        const body = await readBody(req);
        if (!validSiteConfig(body)) return json(res, 400, { error: 'The site settings are invalid or too large.' });
        const serialized = JSON.stringify({ version: 1, blocks: body.blocks, pageParts: body.pageParts, textOverrides: body.textOverrides, perkOverrides: body.perkOverrides, inventoryItems: body.inventoryItems, perkItems: body.perkItems, stats: body.stats, skills: body.skills, removedSkills: body.removedSkills, removedItems: body.removedItems, statValues: body.statValues, backgrounds: body.backgrounds, activeBackgroundId: body.activeBackgroundId || '' }, null, 2) + '\n';
        const temp = SITE_CONFIG_FILE + '.tmp'; fs.writeFileSync(temp, serialized, 'utf8'); fs.renameSync(temp, SITE_CONFIG_FILE);
        if (!isGitRepo()) return json(res, 200, { published: false, saved: true, message: 'Saved locally. Put this folder in your GitHub repository clone to publish for everyone.' });
        try {
          git(['add', '--', 'site-config.json']);
          const status = git(['status', '--porcelain', '--', 'site-config.json']);
          if (status) { git(['commit', '--only', '-m', 'Update shared character builder settings', '--', 'site-config.json']); git(['push', 'origin', 'HEAD']); }
          return json(res, 200, { published: true, saved: true, message: status ? 'Shared settings were pushed. GitHub Pages will update for everyone.' : 'No settings changes to publish.' });
        } catch (error) { return json(res, 200, { published: false, saved: true, message: `Saved locally, but Git could not publish settings: ${error.message}` }); }
      }
      if (req.method === 'GET' && pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
      staticFile(req, res);
    } catch (error) { json(res, 400, { error: error.message || 'Request failed.' }); }
  });
  let activePort = PORT;
  const listen = () => {
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' && activePort < PORT + 20) {
        activePort += 1;
        console.log(`Port ${activePort - 1} is already in use; trying ${activePort}.`);
        listen();
      } else {
        console.error(`The local editor could not start: ${error.message}`);
        process.exitCode = 1;
      }
    });
    server.listen(activePort, '127.0.0.1', () => {
      const address = `http://127.0.0.1:${activePort}`;
      console.log(`Undertow local editor: ${address}`);
      console.log('This editor only accepts connections from this computer. Press Ctrl+C to stop it.');
      if (!matchingAppBundle) console.warn('This folder has an older or mismatched index.html. Run update-admin.bat from the latest package to replace it.');
      if (!isGitRepo()) console.log('No GitHub repository clone detected beside admin-server.js; edits can be saved locally but not published yet.');
      if (process.platform === 'win32' && process.env.UNDERTOW_NO_OPEN !== '1') {
        const opener = spawn('cmd', ['/c', 'start', '', address], { detached: true, stdio: 'ignore', windowsHide: true });
        opener.unref();
      }
    });
  };
  listen();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
