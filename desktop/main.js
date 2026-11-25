'use strict';
const { app, BrowserWindow, Menu, dialog, shell, clipboard, ipcMain, nativeImage } = require('electron');
const { tintPixels } = require('../Theme');
const { NsisUpdater } = require('electron-updater');
const { createUpdates } = require('./Updates');
const path = require('path');
const fs = require('fs');
const { configuracionActual } = require('../State');
const { once } = require('events');
const { prepararInstalacion, importarInstalacion } = require('./storage');
const { iniciarServidor } = require('../Server');

app.setName('HexRoll');
app.setPath('userData', process.env.RULETA_DESKTOP_DATA || path.join(app.getPath('appData'), 'RuletaPerksKillers'));
let mainWindow, server, origin, instalacion;
const previewWindows = new Map();
const source = path.resolve(__dirname, '..');
const appIcon = path.join(source, 'images', 'brand', 'HexRoll.png');
let activeIcon = appIcon, iconColor = '', iconData = '', logoTemplate;
function colorearIcono(color) {
  if (typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Color de icono invalido.');
  if (color === iconColor) return iconData;
  if (!logoTemplate) logoTemplate = nativeImage.createFromPath(path.join(source, 'images', 'brand', 'HexRollTint.png')).resize({ width: 256, height: 256, quality: 'best' });
  const pixels = tintPixels(logoTemplate.toBitmap(), color, 'bgra');
  activeIcon = nativeImage.createFromBitmap(pixels, { width: 256, height: 256 });
  mainWindow.setIcon(activeIcon);
  for (const win of previewWindows.values()) if (!win.isDestroyed()) win.setIcon(activeIcon);
  iconColor = color; iconData = activeIcon.toDataURL(); return iconData;
}
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
  const win = new BrowserWindow({ icon: activeIcon, width: elegido.ancho + 40, height: elegido.alto + 70, show: mostrar, parent: mainWindow,
    title: 'Vista previa · ' + ({ perksSurvivor: 'Perks de survivor', perksKiller: 'Perks de killer', killers: 'Personaje killer', perks: 'Perks (anterior)' }[tipo]) + (lite ? ' · Ligera' : ''),
    backgroundColor: '#1b1417', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  previewWindows.set(key, win);
  protegerVentana(win, url);
  await win.loadURL(url);
  return win;
}

async function iniciar() {
  app.setAppUserModelId('com.alfajorcit0k.ruletaperkskillers');
  const widgetRoot = smoke ? process.env.RULETA_SMOKE_WIDGETS || path.join(app.getPath('userData'), 'exports') : app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(app.getPath('userData'), 'widget');
  instalacion = prepararInstalacion(source, path.join(app.getPath('userData'), 'widget'), app.getVersion(), widgetRoot);
  server = iniciarServidor({ root: instalacion.root, source, exportRoot: widgetRoot, port: 0 });
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    icon: appIcon, width: 1180, height: 850, minWidth: 800, minHeight: 600, frame: false,
    title: 'HexRoll', backgroundColor: '#1b1417', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  protegerVentana(mainWindow, origin + '/editor');
  const estadoVentana = () => ({ maximizada: mainWindow.isMaximized() });
  for (const evento of ['maximize', 'unmaximize']) mainWindow.on(evento, () => {
    if (!mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('ruleta:estado-ventana', estadoVentana());
  });
  manejar('ruleta:estado-ventana', estadoVentana);
  manejar('ruleta:color-logo', color => colorearIcono(color));
  manejar('ruleta:controlar-ventana', accion => {
    if (!['minimizar', 'maximizar', 'cerrar'].includes(accion)) throw new Error('Accion de ventana invalida.');
    if (accion === 'minimizar') mainWindow.minimize();
    if (accion === 'maximizar') { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); }
    if (accion === 'cerrar') { app.quit(); return {}; }
    return estadoVentana();
  });
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
    const error = await shell.openPath(instalacion.widgetRoot);
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
  const updates = createUpdates({
    version: app.getVersion(), updater: new NsisUpdater(),
    enabled: app.isPackaged && !smoke,
    changed: state => { if (!mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('ruleta:actualizaciones', state); }
  });
  manejar('ruleta:actualizaciones', () => updates.state());
  manejar('ruleta:buscar-actualizacion', () => updates.check());
  manejar('ruleta:instalar-actualizacion', () => updates.install());
  if (!smoke) {
    const initialCheck = setTimeout(() => { void updates.check(); }, 15000); initialCheck.unref();
    app.once('before-quit', () => clearTimeout(initialCheck));
  }
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
    const barraCorrecta = await mainWindow.webContents.executeJavaScript(`(async () => {
      const barra = document.getElementById('barraApp');
      const ventana = await window.ruletaDesktop.estadoVentana();
      const botones = ['minimizarVentana', 'maximizarVentana', 'cerrarVentana'].map(id => document.getElementById(id));
      const navegacion = barra.querySelector('nav');
      const contenido = navegacion.querySelector('[data-pestana="contenido"]');
      contenido.click();
      const cambio = !document.querySelector('[data-vista="contenido"]').hidden;
      navegacion.querySelector('[data-pestana="widgets"]').click();
      return !barra.hidden && document.title === 'HexRoll' && typeof ventana.maximizada === 'boolean' &&
        cambio && navegacion.querySelectorAll('[data-pestana]').length === 3 &&
        getComputedStyle(barra).getPropertyValue('-webkit-app-region') === 'drag' &&
        botones.every(b => b.getAttribute('aria-label') && getComputedStyle(b).getPropertyValue('-webkit-app-region') === 'no-drag');
    })()`);
    if (!barraCorrecta) throw new Error('La barra de navegacion de HexRoll no se preparo correctamente.');
    estado.barraPropia = true;
    const inicioCorrecto = await mainWindow.webContents.executeJavaScript(`document.getElementById('updatePanel').hidden && !document.getElementById('checkUpdate').hidden && ['idiomaSurvivor','idiomaPerksKiller','idiomaKillers','idiomaPersonajes'].every(id => document.getElementById(id).value === 'en') && !document.querySelector('[id^="guardarSurvivor"]')`);
    if (!inicioCorrecto) throw new Error('La interfaz inicial no muestra los idiomas o las actualizaciones correctamente.');
    estado.idiomaInicialIngles = true;
    await mainWindow.webContents.executeJavaScript("localStorage.setItem('perks_modo', 'asesino')");
    const perks = await abrirVistaPrevia('perksSurvivor', false, false);
    const perksKiller = await abrirVistaPrevia('perksKiller', false, false);
    const killers = await abrirVistaPrevia('killers', false, false);
    const perksCorrectas = await perks.webContents.executeJavaScript("currentModo === 'perks' && TIPO_FIJO === 'survivor' && currentTipo === 'survivor' && activePool().every(h => h.esVacio || h.tipo === 'survivor') && ASESINOS.length === 0 && document.querySelectorAll('.modo-btn,.tipo-btn').length === 0");
    await perks.webContents.executeJavaScript("document.querySelector('[data-idioma=\"en\"]').click(); applyColor(120)");
    await killers.loadURL(origin + '/KRoulette.html');
    const killersCorrectos = await killers.webContents.executeJavaScript("currentModo === 'asesino' && HABILIDADES.length === 0 && currentIdioma === 'en' && hueFromColorValue(localStorage.getItem(STORAGE_PREFIX + 'color')) !== 120 && document.querySelectorAll('.modo-btn').length === 0");
    const perksKillerCorrectas = await perksKiller.webContents.executeJavaScript("currentModo === 'perks' && TIPO_FIJO === 'killer' && currentTipo === 'killer' && activePool().every(h => h.esVacio || h.tipo === 'killer') && document.querySelectorAll('.modo-btn,.tipo-btn').length === 0");
    if (!perksCorrectas || !perksKillerCorrectas || !killersCorrectos) throw new Error('Los widgets no son independientes.');
    estado.widgetsIndependientes = true;
    // Prueba el formulario real, sus rutas HTTP y la recarga de vistas previas.
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('colorSurvivor').value = '#22bb88';
      document.getElementById('idiomaSurvivor').value = 'en';
      document.getElementById('duracionSurvivor').value = '1000';
      document.getElementById('duracionSurvivor').dispatchEvent(new Event('change', { bubbles: true }));
      await guardadoApariencia;
    })()`);
    const ajustesCorrectos = await perks.webContents.executeJavaScript("currentIdioma === 'en' && currentTipo === 'survivor' && BASE_DURATION === 1000 && document.querySelector('.top-controls').hidden && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#22bb88'");
    if (!ajustesCorrectos) throw new Error('La apariencia del formulario no se aplico al widget.');
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('colorPerksKiller').value = '#ffaa44';
      document.getElementById('idiomaPerksKiller').value = 'es-es';
      document.getElementById('duracionPerksKiller').value = '4000';
      document.getElementById('duracionPerksKiller').dispatchEvent(new Event('change', { bubbles: true }));
      await guardadoApariencia;
    })()`);
    if (!await perksKiller.webContents.executeJavaScript("currentTipo === 'killer' && currentIdioma === 'es-es' && BASE_DURATION === 4000 && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#ffaa44'") ||
        !await perks.webContents.executeJavaScript("currentTipo === 'survivor' && currentIdioma === 'en' && BASE_DURATION === 1000 && getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() === '#22bb88'")) throw new Error('Los ajustes de survivor y killer se mezclaron.');
    estado.perksSeparadas = true;
    const controlesCorrectos = await mainWindow.webContents.executeJavaScript(`(async () => {
      const controles = document.getElementById('controlesSurvivor'); controles.checked = true;
      controles.dispatchEvent(new Event('change', { bubbles: true })); await guardadoApariencia;
      return document.getElementById('tamanoSurvivor').textContent === '1120 × 520';
    })()`);
    if (!controlesCorrectos || !await perks.webContents.executeJavaScript("!document.querySelector('.top-controls').hidden && document.querySelectorAll('.modo-btn,.tipo-btn').length === 0")) throw new Error('Los controles del widget no se muestran correctamente.');
    await mainWindow.webContents.executeJavaScript(`(async () => { const control = document.getElementById('controlesSurvivor'); control.checked = false; control.dispatchEvent(new Event('change', { bubbles: true })); await guardadoApariencia; })()`);
    if (fs.readFileSync(instalacion.perksSurvivor, 'utf8') !== fs.readFileSync(path.join(instalacion.root, 'SPerksRoulette.html'), 'utf8') || !fs.existsSync(path.join(instalacion.widgetRoot, 'images', 'perks', 'BestGiftEver.png'))) throw new Error('Los HTML exportados no se sincronizan con los ajustes.');
    estado.aparienciaAutomatica = true;
    const localWidget = new BrowserWindow({ show: false, webPreferences: { partition: 'HexRollLocalSmoke', nodeIntegration: false, contextIsolation: true, sandbox: true } });
    localWidget.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !['file:', 'data:'].includes(new URL(details.url).protocol) }));
    await localWidget.loadFile(instalacion.perksSurvivor);
    const localCorrecto = await localWidget.webContents.executeJavaScript(`(async () => {
      const images = [...document.images];
      return location.protocol === 'file:' && currentIdioma === 'en' && images.length > 0 && (await Promise.all(images.map(img => img.decode().then(() => img.naturalWidth > 0, () => false)))).every(Boolean);
    })()`);
    localWidget.destroy();
    if (!localCorrecto) throw new Error('La ruleta exportada no carga sus imagenes desde el archivo local.');
    estado.htmlLocalConImagenes = true;
    const espaciosCorrectos = await mainWindow.webContents.executeJavaScript(`(async () => {
      const inicial = Number(document.getElementById('cantidadVacios').value);
      document.getElementById('agregarVacio').click();
      while (document.getElementById('cantidadVacios').disabled) await new Promise(r => setTimeout(r, 30));
      if (Number(document.getElementById('cantidadVacios').value) !== inicial + 1) return false;
      document.getElementById('quitarVacio').click();
      while (document.getElementById('cantidadVacios').disabled) await new Promise(r => setTimeout(r, 30));
      return Number(document.getElementById('cantidadVacios').value) === inicial && document.getElementById('probabilidadVacios').textContent.includes('por casilla') &&
        ['personajesKillers', 'personajesSurvivors'].every(id => document.getElementById(id).querySelector('.personaje-retrato').textContent === 'G') && document.querySelector('#personajesVacios .personaje-retrato').textContent === '—';
    })()`);
    if (!espaciosCorrectos) throw new Error('Los grupos generales o la cantidad de espacios vacios no funcionan.');
    estado.espaciosConfigurables = true;
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
      const nombres = () => [...document.querySelectorAll('#personajes .personaje-nombre')].map(n => n.firstChild.textContent);
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
    const retratosCorrectos = await mainWindow.webContents.executeJavaScript(`(async () => {
      const grupos = (await (await fetch('/api/estado')).json()).personajes;
      const [killers, survivors] = [document.getElementById('personajesKillers'), document.getElementById('personajesSurvivors')];
      if (!killers.querySelector('.personaje img') || !survivors.querySelector('.personaje img')) return false;
      for (const grupo of grupos.filter(g => g.imagen)) {
        const respuesta = await fetch('/images/' + grupo.imagen);
        if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) return false;
      }
      const aestri = grupos.find(g => g.nombre === 'Aestri Yazar & Baermar Uraz');
      const rick = grupos.find(g => g.nombre === 'Rick Grimes');
      return aestri?.imagen?.includes('TheTroupe') && rick?.imagen?.includes('RickGrimes') &&
        survivors.querySelectorAll('.personaje').length === grupos.filter(g => g.tipo === 'survivor').length &&
        killers.querySelectorAll('.personaje').length === grupos.filter(g => g.tipo === 'killer').length;
    })()`);
    if (!retratosCorrectos) throw new Error('Los cuadros de personajes o sus retratos no se cargaron correctamente.');
    estado.personajesConRetratos = true;
    await mainWindow.webContents.executeJavaScript(`(async () => {
      const color = document.getElementById('colorEditor');
      color.value = '#2478cc'; color.dispatchEvent(new Event('input')); color.dispatchEvent(new Event('change'));
      while (color.disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    const temaAnterior = await mainWindow.webContents.executeJavaScript('document.documentElement.dataset.tema');
    await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('cambiarTema').click();
      while (document.getElementById('cambiarTema').disabled) await new Promise(r => setTimeout(r, 30));
    })()`);
    await mainWindow.loadURL(origin + '/editor');
    const temaRecuperado = await mainWindow.webContents.executeJavaScript(`(async () => {
      await window.ruletaLista;
      return { tema: document.documentElement.dataset.tema, guardado: (await (await fetch('/api/estado')).json()).temaEditor,
        checked: document.getElementById('cambiarTema').getAttribute('aria-checked'), idiomaPersonajes: document.getElementById('idiomaPersonajes').value, colorEditor: document.getElementById('colorEditor').value, acento: getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(), iconos: document.querySelectorAll('#cambiarTema .tema-icon').length };
    })()`);
    if (temaRecuperado.tema === temaAnterior || temaRecuperado.tema !== temaRecuperado.guardado || temaRecuperado.checked !== String(temaRecuperado.tema === 'oscuro')) throw new Error('El tema del editor no se conserva.');
    estado.temaPersistente = true;
    if (temaRecuperado.colorEditor !== '#2478cc' || temaRecuperado.acento !== '#2478cc' || temaRecuperado.iconos !== 2) throw new Error('El color del editor o los iconos del tema no se conservaron.');
    estado.colorEditorPersistente = true;
    const marcaCorrecta = await mainWindow.webContents.executeJavaScript(`(async () => {
      await actualizarMarca('#2478cc');
      const logo = document.querySelector('.barra-marca img'); await logo.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d'); context.drawImage(logo, 0, 0, 256, 256);
      const pixels = context.getImageData(0, 0, 256, 256).data;
      let red = 0, blue = 0;
      for (let i = 0; i < pixels.length; i += 4) { red += pixels[i] * pixels[i + 3]; blue += pixels[i + 2] * pixels[i + 3]; }
      let invalidRejected = false;
      try { await window.ruletaDesktop.colorearLogo('invalid'); } catch (_) { invalidRejected = true; }
      return invalidRejected && logo.src.startsWith('data:image/png') && blue > red * 1.2 && pixels[3] === 0 &&
        document.querySelector('.marca').src === logo.src && document.querySelector('link[rel="icon"]').href === logo.src;
    })()`);
    if (!marcaCorrecta || iconColor !== '#2478cc' || activeIcon.isEmpty()) throw new Error('El logo o el icono de ventana no siguen el color del editor.');
    estado.marcaSegunTema = true;
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
      for (const [tab, name] of [['widgets', 'Dashboard'], ['contenido', 'Characters'], ['perfiles', 'Profiles']]) {
        await mainWindow.webContents.executeJavaScript(`pestana('${tab}')`);
        await new Promise(resolve => setTimeout(resolve, 150));
        fs.writeFileSync(path.join(dir, name + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
      }
      for (const [name, win] of [['SPerksPreview', perks], ['KPerksPreview', perksKiller], ['KillerPreview', killers]]) {
        fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
      }
      for (const tema of ['oscuro', 'claro']) {
        const suffix = tema === 'oscuro' ? 'Dark' : 'Light';
        await mainWindow.webContents.executeJavaScript(`aplicarTema('${tema}'); pestana('widgets'); window.scrollTo(0,0)`);
        await new Promise(resolve => setTimeout(resolve, 150));
        fs.writeFileSync(path.join(dir, 'Editor' + suffix + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
        await mainWindow.webContents.executeJavaScript("pestana('contenido'); window.scrollTo(0,0)");
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(path.join(dir, 'Characters' + suffix + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
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
