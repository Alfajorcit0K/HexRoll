'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ruletaDesktop', {
  informacion: () => ipcRenderer.invoke('ruleta:informacion'),
  colorearLogo: color => ipcRenderer.invoke('ruleta:color-logo', color),
  actualizaciones: () => ipcRenderer.invoke('ruleta:actualizaciones'),
  buscarActualizacion: () => ipcRenderer.invoke('ruleta:buscar-actualizacion'),
  instalarActualizacion: () => ipcRenderer.invoke('ruleta:instalar-actualizacion'),
  alCambiarActualizaciones: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ruleta:actualizaciones', listener);
    return () => ipcRenderer.removeListener('ruleta:actualizaciones', listener);
  },
  estadoVentana: () => ipcRenderer.invoke('ruleta:estado-ventana'),
  controlarVentana: accion => ipcRenderer.invoke('ruleta:controlar-ventana', accion),
  alCambiarVentana: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, estado) => callback({ maximizada: estado.maximizada === true });
    ipcRenderer.on('ruleta:estado-ventana', listener);
    return () => ipcRenderer.removeListener('ruleta:estado-ventana', listener);
  },
  copiarRuta: (tipo, lite) => ipcRenderer.invoke('ruleta:copiar-ruta', tipo, lite === true),
  abrirCarpeta: () => ipcRenderer.invoke('ruleta:abrir-carpeta'),
  vistaPrevia: (tipo, lite) => ipcRenderer.invoke('ruleta:vista-previa', tipo, lite === true),
  refrescarVistas: () => ipcRenderer.invoke('ruleta:refrescar-vistas'),
  importar: () => ipcRenderer.invoke('ruleta:importar')
});
