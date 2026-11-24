'use strict';
const { app, BrowserWindow, Menu, dialog, shell, clipboard, ipcMain } = require('electron');
const path = require('path');
const { once } = require('events');
const { prepararInstalacion, importarInstalacion } = require('./storage');
const { iniciarServidor } = require('../editor-ruleta-perks');

app.setName('Ruleta Perks y Killers');
app.setPath('userData', process.env.RULETA_DESKTOP_DATA || path.join(app.getPath('appData'), 'RuletaPerksKillers'));
let mainWindow, previewWindow, server, origin, instalacion;
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
  manejar('ruleta:informacion', () => ({ version: app.getVersion(), ruta: instalacion.widget, rutaLite: instalacion.widgetLite }));
  manejar('ruleta:copiar-ruta', lite => { clipboard.writeText(lite === true ? instalacion.widgetLite : instalacion.widget); return true; });
  manejar('ruleta:abrir-carpeta', async () => {
    const error = await shell.openPath(instalacion.root);
    if (error) throw new Error(error);
    return true;
  });
  manejar('ruleta:vista-previa', async () => {
    if (previewWindow && !previewWindow.isDestroyed()) { previewWindow.focus(); return true; }
    previewWindow = new BrowserWindow({ width: 1000, height: 620, parent: mainWindow, title: 'Vista previa de la ruleta', backgroundColor: '#1a1a1f', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    protegerVentana(previewWindow, origin + '/ruleta-perks.html');
    await previewWindow.loadURL(origin + '/ruleta-perks.html');
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
      const info = await window.ruletaDesktop.informacion();
      const response = await fetch('/api/habilidades');
      const habilidades = await response.json();
      return { version: info.version, ruta: info.ruta, habilidades: habilidades.length,
        puenteDisponible: !!window.ruletaDesktop, panelVisible: !document.getElementById('inicioDesktop').hidden,
        nodeExpuesto: typeof require !== 'undefined' };
    })()`);
    if (!estado.puenteDisponible || !estado.panelVisible || estado.nodeExpuesto || !estado.habilidades) throw new Error('La aplicacion no supero la prueba de arranque.');
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
