'use strict';
const { app, BrowserWindow, Menu, dialog, shell, clipboard, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { configuracionActual } = require('../app-state');
const { once } = require('events');
const { prepararInstalacion, importarInstalacion } = require('./storage');
const { iniciarServidor } = require('../editor-ruleta-perks');

app.setName('Ruleta Perks y Killers');
app.setPath('userData', process.env.RULETA_DESKTOP_DATA || path.join(app.getPath('appData'), 'RuletaPerksKillers'));
let mainWindow, server, origin, instalacion;
const previewWindows = new Map();
const source = path.resolve(__dirname, '..');
const smoke = process.argv.includes('--smoke-test');
const lock = app.requestSingleInstanceLock();

function protegerVentana(win, allowedURL) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const external = new URL(url);
      if (external.protocol === 'https:' && ['www.twitch.tv', 'discord.gg'].includes(external.hostname)) shell.openExternal(url).catch(() => {});
    } catch (_) {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => { if (url !== allowedURL) event.preventDefault(); });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}

function manejar(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame ||
        event.senderFrame.url !== origin + '/editor') throw new Error('Origen no autorizado.');
    return callback(...args);
  });
}

function widgetElegido(tipo, lite = false) {
  if (!['perksSurvivor', 'perksKiller', 'perks', 'killers'].includes(tipo)) throw new Error('Selecciona un widget valido.');
  const killer = tipo === 'killers';
  return {
    ruta: tipo.startsWith('perks') && tipo !== 'perks' ? instalacion[tipo + (lite ? 'Lite' : '')]
      : killer ? (lite ? instalacion.killerLite : instalacion.killer) : (lite ? instalacion.widgetLite : instalacion.widget),
    ancho: killer ? 460 : 1120,
    alto: configuracionActual(JSON.parse(fs.readFileSync(path.join(instalacion.root, 'data.json'), 'utf8')))[tipo].mostrarControles ? 520 : 440
  };
}

async function abrirVistaPrevia(tipo, lite = false, mostrar = true) {
  const elegido = widgetElegido(tipo, lite);
  const key = tipo + ':' + lite;
  const anterior = previewWindows.get(key);
  if (anterior && !anterior.isDestroyed()) { if (mostrar) anterior.focus(); return anterior; }
  const url = origin + '/' + path.basename(elegido.ruta);
  const win = new BrowserWindow({ width: elegido.ancho + 40, height: elegido.alto + 70, show: mostrar, parent: mainWindow,
    title: 'Vista previa · ' + ({ perksSurvivor: 'Perks de survivor', perksKiller: 'Perks de killer', killers: 'Personaje killer', perks: 'Perks (anterior)' }[tipo]) + (lite ? ' · Ligera' : ''),
    backgroundColor: '#1a1a1f', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  previewWindows.set(key, win);
  protegerVentana(win, url);
  await win.loadURL(url);
  return win;
}

async function iniciar() {
  app.setAppUserModelId('com.alfajorcit0k.ruletaperkskillers');
  instalacion = prepararInstalacion(source, path.join(app.getPath('userData'), 'widget'), app.getVersion());
  server = iniciarServidor({ root: instalacion.root, source, port: 0 });
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1180, height: 850, minWidth: 800, minHeight: 600,
    title: 'Ruleta Perks y Killers', backgroundColor: '#1a1a1f', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  protegerVentana(mainWindow, origin + '/editor');
  // La aplicacion utiliza recursos locales. Las fuentes externas del widget
  // tienen alternativas de sistema y no deben retrasar el arranque sin internet.
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const resource = new URL(details.url);
    callback({ cancel: resource.origin !== origin && !['data:', 'devtools:'].includes(resource.protocol) });
  });
  manejar('ruleta:informacion', () => ({ version: app.getVersion(), ruta: instalacion.widget, rutaLite: instalacion.widgetLite,
    widgets: Object.fromEntries(['perksSurvivor', 'perksKiller', 'killers'].map(tipo => [tipo, { ...widgetElegido(tipo), rutaLite: widgetElegido(tipo, true).ruta }])) }));
  manejar('ruleta:copiar-ruta', (tipo, lite) => { clipboard.writeText(widgetElegido(tipo, lite === true).ruta); return true; });
  manejar('ruleta:abrir-carpeta', async () => {
    const error = await shell.openPath(instalacion.root);
    if (error) throw new Error(error);
    return true;
  });
  manejar('ruleta:vista-previa', async (tipo, lite) => {
    await abrirVistaPrevia(tipo, lite === true);
    return true;
  });
  manejar('ruleta:refrescar-vistas', async () => {
    for (const [key, win] of previewWindows) if (!win.isDestroyed()) {
      const elegido = widgetElegido(key.split(':')[0]);
      win.setSize(elegido.ancho + 40, elegido.alto + 70);
      await win.loadURL(win.webContents.getURL());
    }
    return true;
  });
  manejar('ruleta:importar', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Selecciona el data.json de tu ruleta anterior', filters: [{ name: 'Ajustes de la ruleta', extensions: ['json'] }], properties: ['openFile'] });
    if (selected.canceled) return { cancelado: true };
    const result = importarInstalacion(source, instalacion.root, selected.filePaths[0]);
    server.regenerateWidget();
    return result;
  });
  await mainWindow.loadURL(origin + '/editor');
  if (smoke) {
    const estado = await mainWindow.webContents.executeJavaScript(`(async () => {
      await window.ruletaLista;
      const info = await window.ruletaDesktop.informacion();
      const response = await fetch('/api/habilidades');
      const habilidades = await response.json();
      return { version: info.version, ruta: info.ruta, habilidades: habilidades.length,
        puenteDisponible: !!window.ruletaDesktop, panelVisible: !document.getElementById('inicioDesktop').hidden,
        nodeExpuesto: typeof require !== 'undefined' };
    })()`);
    if (!estado.puenteDisponible || !estado.panelVisible || estado.nodeExpuesto || !estado.habilidades) throw new Error('La aplicacion no supero la prueba de arranque.');
    await mainWindow.webContents.executeJavaScript("localStorage.setItem('perks_modo', 'asesino')");
    const perks = await abrirVistaPrevia('perksSurvivor', false, false);
    const perksKiller = await abrirVistaPrevia('perksKiller', false, false);
    const killers = await abrirVistaPrevia('killers', false, false);
    const perksCorrectas = await perks.webContents.executeJavaScript("currentModo === 'perks' && TIPO_FIJO === 'survivor' && currentTipo === 'survivor' && activePool().every(h => h.esVacio || h.tipo === 'survivor') && ASESINOS.length === 0 && document.querySelectorAll('.modo-btn,.tipo-btn').length === 0");
    await perks.webContents.executeJavaScript("document.querySelector('[data-idioma=\"en\"]').click(); applyColor(120)");
    await killers.loadURL(origin + '/ruleta-killers.html');
    const killersCorrectos = await killers.webContents.executeJavaScript("currentModo === 'asesino' && HABILIDADES.length === 0 && currentIdioma === 'es' && hueFromColorValue(localStorage.getItem(STORAGE_PREFIX + 'color')) !== 120 && document.querySelectorAll('.modo-btn').length === 0");
    const perksKillerCorrectas = await perksKiller.webContents.executeJavaScript("currentModo === 'perks' && TIPO_FIJO === 'killer' && currentTipo === 'killer' && activePool().every(h => h.esVacio || h.tipo === 'killer') && document.querySelectorAll('.modo-btn,.tipo-btn').length === 0");
    if (!perksCorrectas || !perksKillerCorrectas || !killersCorrectos) throw new Error('Los widgets no son independientes.');
    estado.widgetsIndependientes = true;
    // Prueba el formulario real, sus rutas HTTP y la recarga de vistas previas.
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('colorSurvivor').value = '#22bb88';
      document.getElementById('idiomaSurvivor').value = 'en';
      document.getElementById('duracionSurvivor').value = '1000';
      document.getElementById('ajustesSurvivor').requestSubmit();
      while (document.getElementById('guardarSurvivor').disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    const ajustesCorrectos = await perks.webContents.executeJavaScript("currentIdioma === 'en' && currentTipo === 'survivor' && BASE_DURATION === 1000 && document.querySelector('.top-controls').hidden && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#22bb88'");
    if (!ajustesCorrectos) throw new Error('La apariencia del formulario no se aplico al widget.');
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('colorPerksKiller').value = '#ffaa44';
      document.getElementById('idiomaPerksKiller').value = 'es-es';
      document.getElementById('duracionPerksKiller').value = '4000';
      document.getElementById('ajustesPerksKiller').requestSubmit();
      while (document.getElementById('guardarPerksKiller').disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    if (!await perksKiller.webContents.executeJavaScript("currentTipo === 'killer' && currentIdioma === 'es-es' && BASE_DURATION === 4000 && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#ffaa44'") ||
        !await perks.webContents.executeJavaScript("currentTipo === 'survivor' && currentIdioma === 'en' && BASE_DURATION === 1000 && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#22bb88'")) throw new Error('Los ajustes de survivor y killer se mezclaron.');
    estado.perksSeparadas = true;
    const perfilCorrecto = await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('nombrePerfil').value = 'Prueba de escritorio';
      document.getElementById('guardarPerfil').click();
      while (document.getElementById('guardarPerfil').disabled) await new Promise(r => setTimeout(r, 30));
      return [...document.querySelectorAll('#listaPerfiles option')].some(o => o.textContent === 'Prueba de escritorio');
    })()`);
    if (!perfilCorrecto) throw new Error('No se pudo guardar el perfil desde la aplicacion.');
    estado.configuracionYPerfiles = true;
    const datosAntesIdioma = fs.readFileSync(path.join(instalacion.root, 'data.json'), 'utf8');
    const idiomaCorrecto = await mainWindow.webContents.executeJavaScript(`(async () => {
      pestana('contenido');
      const selector = document.getElementById('idiomaPersonajes');
      const nombres = () => [...document.querySelectorAll('#personajes .personaje > span')].map(n => n.firstChild.textContent);
      for (const [idioma, esperado] of [['en', 'The Executioner'], ['es', 'El Ejecutor'], ['es-es', 'El Verdugo']]) {
        selector.value = idioma;
        selector.dispatchEvent(new Event('change'));
        while (selector.disabled) await new Promise(r => setTimeout(r, 30));
        if (!nombres().includes(esperado)) return false;
      }
      const buscador = document.getElementById('buscarPersonaje');
      buscador.value = 'El Ejecutor'; buscador.dispatchEvent(new Event('input'));
      const encuentraOtroIdioma = nombres().includes('El Verdugo');
      buscador.value = ''; buscador.dispatchEvent(new Event('input'));
      return encuentraOtroIdioma && !document.body.textContent.includes('Ruleta Perks es gratuita.');
    })()`);
    if (!idiomaCorrecto || fs.readFileSync(path.join(instalacion.root, 'data.json'), 'utf8') !== datosAntesIdioma) throw new Error('El idioma de personajes no se aplico correctamente.');
    const temaAnterior = await mainWindow.webContents.executeJavaScript('document.documentElement.dataset.tema');
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('cambiarTema').click();
      while (document.getElementById('cambiarTema').disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    await mainWindow.loadURL(origin + '/editor');
    const temaRecuperado = await mainWindow.webContents.executeJavaScript(`(async () => {
      await window.ruletaLista;
      return { tema: document.documentElement.dataset.tema, guardado: (await (await fetch('/api/estado')).json()).temaEditor,
        checked: document.getElementById('cambiarTema').getAttribute('aria-checked'), idiomaPersonajes: document.getElementById('idiomaPersonajes').value };
    })()`);
    if (temaRecuperado.tema === temaAnterior || temaRecuperado.tema !== temaRecuperado.guardado || temaRecuperado.checked !== String(temaRecuperado.tema === 'oscuro')) throw new Error('El tema del editor no se conserva.');
    estado.temaPersistente = true;
    if (temaRecuperado.idiomaPersonajes !== 'es-es') throw new Error('El idioma de personajes no se conserva al cambiar el tema y recargar.');
    estado.idiomaPersonajesPersistente = true;
    await mainWindow.webContents.executeJavaScript(`(async () => {
      const selector = document.getElementById('idiomaPersonajes');
      selector.value = 'en'; selector.dispatchEvent(new Event('change'));
      while (selector.disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    if (process.env.RULETA_SMOKE_SCREENSHOTS) {
      const dir = process.env.RULETA_SMOKE_SCREENSHOTS;
      fs.mkdirSync(dir, { recursive: true });
      for (const tab of ['widgets', 'contenido', 'perfiles']) {
        await mainWindow.webContents.executeJavaScript(`pestana('${tab}')`);
        await new Promise(resolve => setTimeout(resolve, 150));
        fs.writeFileSync(path.join(dir, tab + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
      }
      for (const [name, win] of [['widget-perks-survivor', perks], ['widget-perks-killer', perksKiller], ['widget-killers', killers]]) {
        fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
      }
      for (const tema of ['oscuro', 'claro']) {
        await mainWindow.webContents.executeJavaScript(`aplicarTema('${tema}'); pestana('widgets'); window.scrollTo(0,0)`);
        await new Promise(resolve => setTimeout(resolve, 150));
        fs.writeFileSync(path.join(dir, 'editor-' + tema + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
      }
    }
    console.log('RULETA_SMOKE_OK ' + JSON.stringify(estado));
    app.quit();
  } else {
    mainWindow.show();
  }
}

if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(iniciar).catch(error => {
    console.error(error);
    if (!smoke) dialog.showErrorBox('No se pudo abrir la ruleta', error.message + '\nTus ajustes se conservan en: ' + app.getPath('userData'));
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (server) server.close(); });
}
