'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ruletaDesktop', {
  informacion: () => ipcRenderer.invoke('ruleta:informacion'),
  copiarRuta: lite => ipcRenderer.invoke('ruleta:copiar-ruta', lite === true),
  abrirCarpeta: () => ipcRenderer.invoke('ruleta:abrir-carpeta'),
  vistaPrevia: () => ipcRenderer.invoke('ruleta:vista-previa'),
  importar: () => ipcRenderer.invoke('ruleta:importar')
});
