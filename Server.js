'use strict';
/*
 * Editor - HexRoll
 * Servidor HTTP con solo modulos nativos de Node (sin npm install necesario).
 *
 * Este servidor SOLO hace falta mientras se están agregando o editando habilidades.
 * Cada cambio se guarda en data.json Y ADEMAS se regraba automaticamente dentro
 * de PerksRoulette.html (los datos quedan incrustados en ese archivo).
 * En OBS se agrega PerksRoulette.html como fuente de navegador "archivo local".
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { validarDatos, fusionarDatos, construirWidgets, VARIANTES_WIDGET, WIDGET_ALIASES, guardarDatos } = require('./Roulette');
const { crearEstado } = require('./State');

function iniciarServidor({ root = __dirname, source = __dirname, port = Number(process.env.RULETA_PORT || 4002) } = {}) {
const PORT = port;
const ROOT = root;
const SOURCE = source;
const DATA_FILE = path.join(ROOT, 'data.json');
const IMG_DIR = path.join(ROOT, 'images');
const TEMPLATE_FILE = path.join(SOURCE, 'RouletteTemplate.html');
const ASESINOS_DEFAULT_FILE = path.join(SOURCE, 'Killers.json');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ habilidades: [], asesinos: [] }, null, 2));
}

function readData() {
  // Un archivo dañado debe detener el arranque, nunca convertirse en datos vacios.
  return validarDatos(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
}
function writeData(data) {
  guardarDatos(DATA_FILE, data);
}

// Si este data.json es de antes de que existiera la ruleta de asesinos, le agrega
// la lista por defecto una sola vez, conservando la configuracion existente.
function migrarDatosSiHaceFalta() {
  const data = readData();
  if (data.asesinos === undefined && fs.existsSync(ASESINOS_DEFAULT_FILE)) {
    data.asesinos = JSON.parse(fs.readFileSync(ASESINOS_DEFAULT_FILE, 'utf8'));
    writeData(data);
  }
}
migrarDatosSiHaceFalta();

// Si hay imagenes sueltas directo en images/ (de antes de separarlas en
// subcarpetas), las mueve a images/perks/ o images/killers/ segun a cual
// lista pertenezca cada nombre de archivo. No toca nada que ya este ordenado.
function migrarCarpetasImagenesSiHaceFalta() {
  const dirPerks = path.join(IMG_DIR, 'perks');
  const dirKillers = path.join(IMG_DIR, 'killers');
  if (!fs.existsSync(dirPerks)) fs.mkdirSync(dirPerks, { recursive: true });
  if (!fs.existsSync(dirKillers)) fs.mkdirSync(dirKillers, { recursive: true });

  const data = readData();
  const nombresPerks = new Set((data.habilidades || []).map(h => h.imagen).filter(Boolean));
  const nombresKillers = new Set((data.asesinos || []).map(a => a.imagen).filter(Boolean));

  for (const archivo of fs.readdirSync(IMG_DIR)) {
    const full = path.join(IMG_DIR, archivo);
    if (fs.statSync(full).isDirectory()) continue;
    if (nombresKillers.has(archivo)) {
      fs.renameSync(full, path.join(dirKillers, archivo));
    } else if (nombresPerks.has(archivo)) {
      fs.renameSync(full, path.join(dirPerks, archivo));
    }
    // si un archivo suelto no coincide con ninguna lista, se deja donde esta
  }
}
migrarCarpetasImagenesSiHaceFalta();

// Si alguna perk no tiene el campo "personaje", se lo agrega buscando por su
// nombre en ingles (no depende del id, asi funciona aunque hayas renombrado
// los tuyos). No toca nada mas de la perk.
function migrarPersonajesSiHaceFalta() {
  const archivoMapa = path.join(SOURCE, 'Characters.json');
  if (!fs.existsSync(archivoMapa)) return;
  const mapa = JSON.parse(fs.readFileSync(archivoMapa, 'utf8'));
  const data = readData();
  let cambio = false;
  data.habilidades.forEach(h => {
    if (!h.esVacio && h.general === undefined) {
      const info = mapa[h.nombre_en];
      if (info) {
        h.personaje = info.personaje;
        h.general = info.general;
        cambio = true;
      }
    }
  });
  if (cambio) writeData(data);
}
migrarPersonajesSiHaceFalta();

function regenerateWidget() {
  const normal = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const liteFile = path.join(SOURCE, 'RouletteLiteTemplate.html');
  const lite = fs.existsSync(liteFile) ? fs.readFileSync(liteFile, 'utf8') : normal;
  const widgets = construirWidgets({ normal, lite }, readData());
  for (const [archivo, html] of Object.entries(widgets)) {
    fs.writeFileSync(path.join(ROOT, archivo), html);
  }
  for (const [anterior, actual] of Object.entries(WIDGET_ALIASES)) {
    const file = path.join(ROOT, anterior);
    if (fs.existsSync(file)) fs.writeFileSync(file, widgets[actual]);
  }
}
const estado = crearEstado(ROOT, () => validarDatos(JSON.parse(fs.readFileSync(path.join(SOURCE, 'data.json'), 'utf8'))), readData, writeData, regenerateWidget);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function readBodyJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function safeFilename(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(parsed.pathname);
    if (req.headers.origin && !['GET', 'HEAD'].includes(req.method) &&
        req.headers.origin !== 'http://127.0.0.1:' + server.address().port) {
      return sendJSON(res, 403, { error: 'Esta accion debe realizarse desde el editor.' });
    }
    if (pathname === '/api/proyecto' && req.method === 'GET') {
      const config = JSON.parse(fs.readFileSync(path.join(SOURCE, 'AppLinks.json'), 'utf8'));
      return sendJSON(res, 200, config);
    }
    if (pathname === '/api/estado' && req.method === 'GET') return sendJSON(res, 200, estado.obtener());
    if (pathname === '/api/preferencias-editor' && req.method === 'PUT') {
      try { return sendJSON(res, 200, estado.preferenciasEditor(await readBodyJSON(req))); }
      catch (error) { return sendJSON(res, 400, { error: error.message }); }
    }
    if (pathname === '/api/configuracion' && req.method === 'PUT') {
      try { return sendJSON(res, 200, estado.configurar(await readBodyJSON(req))); }
      catch (error) { return sendJSON(res, 400, { error: error.message }); }
    }
    const personajeMatch = pathname.match(/^\/api\/personajes\/(.+)$/);
    const perfilMatch = pathname.match(/^\/api\/perfiles\/([a-z0-9-]+)(\/aplicar)?$/);
    const respaldoMatch = pathname.match(/^\/api\/respaldos\/([^/]+)\/restaurar$/);
    if (personajeMatch && req.method === 'PUT' || pathname === '/api/perfiles' && req.method === 'POST' || perfilMatch && ['POST', 'DELETE'].includes(req.method) || pathname === '/api/respaldos' && req.method === 'POST' || respaldoMatch && req.method === 'POST') {
      try {
        let result;
        if (personajeMatch) result = estado.personaje(personajeMatch[1], (await readBodyJSON(req)).activo);
        else if (pathname === '/api/perfiles') result = estado.crearPerfil((await readBodyJSON(req)).nombre);
        else if (perfilMatch && req.method === 'DELETE' && !perfilMatch[2]) result = estado.borrarPerfil(perfilMatch[1]);
        else if (perfilMatch && req.method === 'POST' && perfilMatch[2]) result = estado.aplicarPerfil(perfilMatch[1]);
        else if (pathname === '/api/respaldos') result = estado.crearRespaldo();
        else if (respaldoMatch) result = estado.restaurar(respaldoMatch[1]);
        else return sendJSON(res, 404, { error: 'Accion no encontrada.' });
        return sendJSON(res, 200, result);
      } catch (error) { return sendJSON(res, 400, { error: error.message }); }
    }
    if (pathname === '/api/habilidades' && req.method === 'GET') {
      return sendJSON(res, 200, readData().habilidades || []);
    }

    if (pathname === '/api/habilidades' && req.method === 'POST') {
      const body = await readBodyJSON(req);
      const data = readData();
      const nueva = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nombre_es: body.nombre_es || '',
        nombre_es_es: body.nombre_es_es || '',
        nombre_en: body.nombre_en || '',
        imagen: body.imagen || null,
        esVacio: !!body.esVacio,
        activo: body.activo !== false,
        tipo: body.tipo,
        personaje: body.personaje || '',
        general: !!body.general
      };
      data.habilidades.push(nueva);
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, nueva);
    }

    const habMatch = pathname.match(/^\/api\/habilidades\/([a-zA-Z0-9_-]+)$/);
    if (habMatch && req.method === 'PUT') {
      const body = await readBodyJSON(req);
      const data = readData();
      const item = data.habilidades.find(h => h.id === habMatch[1]);
      if (!item) return sendJSON(res, 404, { error: 'no encontrado' });
      Object.assign(item, body);
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, item);
    }
    if (habMatch && req.method === 'DELETE') {
      const data = readData();
      data.habilidades = data.habilidades.filter(h => h.id !== habMatch[1]);
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      const filename = safeFilename(parsed.searchParams.get('filename') || ('img_' + Date.now() + '.png'));
      const dest = path.join(IMG_DIR, filename);
      const writeStream = fs.createWriteStream(dest);
      req.pipe(writeStream);
      writeStream.on('finish', () => sendJSON(res, 200, { filename }));
      writeStream.on('error', (e) => sendJSON(res, 500, { error: e.message }));
      return;
    }

    if (pathname === '/api/asesinos' && req.method === 'GET') {
      return sendJSON(res, 200, readData().asesinos || []);
    }

    const asesinoMatch = pathname.match(/^\/api\/asesinos\/([a-zA-Z0-9_]+)$/);
    if (asesinoMatch && req.method === 'PUT') {
      const body = await readBodyJSON(req);
      const data = readData();
      const item = data.asesinos.find(a => a.id === asesinoMatch[1]);
      if (!item) return sendJSON(res, 404, { error: 'no encontrado' });
      Object.assign(item, body);
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, item);
    }

    if (pathname === '/api/asesinos-bulk-activo' && req.method === 'POST') {
      const body = await readBodyJSON(req);
      if (!body || !Array.isArray(body.ids) || typeof body.activo !== 'boolean') {
        return sendJSON(res, 400, { error: 'formato invalido' });
      }
      const data = readData();
      const idsSet = new Set(body.ids);
      data.asesinos.forEach(a => { if (idsSet.has(a.id)) a.activo = body.activo; });
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/habilidades-bulk-activo' && req.method === 'POST') {
      const body = await readBodyJSON(req);
      if (!body || !Array.isArray(body.ids) || typeof body.activo !== 'boolean') {
        return sendJSON(res, 400, { error: 'formato invalido' });
      }
      const data = readData();
      const idsSet = new Set(body.ids);
      data.habilidades.forEach(h => { if (idsSet.has(h.id)) h.activo = body.activo; });
      writeData(data);
      regenerateWidget();
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/import-data' && req.method === 'POST') {
      const body = await readBodyJSON(req);
      if (!body || !Array.isArray(body.habilidades)) {
        return sendJSON(res, 400, { error: 'el archivo no tiene el formato esperado' });
      }
      const actual = readData();
      let fusionado;
      try { fusionado = fusionarDatos(actual, body); }
      catch (error) { return sendJSON(res, 400, { error: error.message }); }
      const nuevas = fusionado.habilidades.length - actual.habilidades.length;
      const backups = path.join(ROOT, 'backups');
      fs.mkdirSync(backups, { recursive: true });
      fs.copyFileSync(DATA_FILE, path.join(backups, 'data-' + Date.now() + '-' + require('crypto').randomUUID() + '.json'));
      writeData(fusionado);
      regenerateWidget();
      return sendJSON(res, 200, { total: fusionado.habilidades.length, nuevas });
    }

    if (pathname === '/' || pathname === '/editor') {
      return serveStatic(res, path.join(SOURCE, 'Editor.html'));
    }
    if (pathname === '/Editor.js') return serveStatic(res, path.join(SOURCE, 'Editor.js'));
    if (pathname === '/Theme.js') return serveStatic(res, path.join(SOURCE, 'Theme.js'));

    if (VARIANTES_WIDGET.some(variante => pathname === '/' + variante.archivo) || Object.hasOwn(WIDGET_ALIASES, pathname.slice(1))) {
      return serveStatic(res, path.join(ROOT, pathname.slice(1)));
    }
    if (pathname.startsWith('/images/')) {
      const rel = pathname.replace('/images/', '');
      const partes = rel.split('/');
      if (partes.length === 2 && ['perks', 'killers', 'survivors', 'brand'].includes(partes[0])) {
        return serveStatic(res, path.join(IMG_DIR, partes[0], safeFilename(partes[1])));
      }
      if (partes.length === 1) {
        return serveStatic(res, path.join(IMG_DIR, safeFilename(partes[0])));
      }
      res.writeHead(404); res.end('No encontrado'); return;
    }

    res.writeHead(404); res.end('No encontrado');

  } catch (e) {
    console.error(e);
    sendJSON(res, 500, { error: e.message });
  }
});

regenerateWidget();

server.listen(PORT, '127.0.0.1', () => {
  const TWITCH_URL = 'https://www.twitch.tv/alfajorcit0k_';
  const DISCORD_URL = 'https://discord.gg/mKQ4ynsQKS';

  console.log('=================================================');
  console.log(' HexRoll - Editor de habilidades');
  console.log(' Editor:  http://127.0.0.1:' + server.address().port + '/editor');
  console.log(' Gratuito. Los aportes son voluntarios.');
  console.log('');
  console.log(' El widget (PerksRoulette.html) fue hecho por:');
  console.log('                     Alfajorcit0K_');
  console.log('   (' + TWITCH_URL + '  -  ' + DISCORD_URL + ')');
  console.log('=================================================');
});
server.regenerateWidget = regenerateWidget;
return server;
}

module.exports = { iniciarServidor };
if (require.main === module) iniciarServidor();
