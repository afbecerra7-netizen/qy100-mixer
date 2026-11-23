// QY100 Mixer: what the page may ask of the app, and nothing else.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('qyMixer', {
  cargar: () => ipcRenderer.invoke('estado:cargar'),
  guardar: (estado) => ipcRenderer.send('estado:guardar', estado),
  empezarRegistro: () => ipcRenderer.send('registro:empezar'),
  registrar: (linea) => ipcRenderer.send('registro:linea', linea),
})
