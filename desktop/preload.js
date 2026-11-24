'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ruletaDesktop', {
  informacion: () => ipcRenderer.invoke('ruleta:informacion'),
  copiarRuta: (tipo, lite) => ipcRenderer.invoke('ruleta:copiar-ruta', tipo, lite === true),
  abrirCarpeta: () => ipcRenderer.invoke('ruleta:abrir-carpeta'),
  vistaPrevia: (tipo, lite) => ipcRenderer.invoke('ruleta:vista-previa', tipo, lite === true),
  refrescarVistas: () => ipcRenderer.invoke('ruleta:refrescar-vistas'),
  importar: () => ipcRenderer.invoke('ruleta:importar')
});
