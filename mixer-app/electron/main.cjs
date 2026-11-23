// QY100 Mixer: the Mac app.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
//
// Packaged the way MESA 101 is (Electron + electron-packager), with two differences:
// - The window is transparent and frameless: only the faceplate shows, with its rounded
//   corners and its shadow, kept at 1700:1000 and dragged from the faceplate itself.
// - The page is served from a private `qy://` scheme rather than file://, so that fetch()
//   can read voces.json and the ES modules load.
//
// Electron grants every permission by default; the handlers below grant only Web MIDI with
// SysEx, without asking, and refuse everything else (camera, microphone, notifications).
const { app, BrowserWindow, ipcMain, net, protocol, screen, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const PERMITIDOS = new Set(['midi', 'midiSysex'])
const RAIZ = path.join(__dirname, '..', 'app')
// Packaged, the icon comes from the .icns; run from the repository, the Dock gets this one.
const ICONO = path.join(__dirname, '..', 'assets', 'icono', 'qy100-mixer-512.png')
const MARGEN = 18           // px around the faceplate, for its shadow (see #marco in index.html)
const PROPORCION = 1700 / 1000

app.setName('QY100 Mixer')
// QY_MIXER_DATOS=<folder> keeps the state elsewhere (the scripted checks start from nothing).
app.setPath('userData', process.env.QY_MIXER_DATOS || path.join(app.getPath('appData'), 'qy100-mixer'))
const ESTADO = path.join(app.getPath('userData'), 'estado.json')
// Every message the app sends or receives, one line each, from the latest launch.
const REGISTRO = process.env.QY_MIXER_REGISTRO || path.join(app.getPath('userData'), 'midi.log')

// QY_MIXER_AUTOCOMPROBAR=1: opens the window, asks for Web MIDI with SysEx as the page does,
// prints what it sees (and, with QY_MIXER_CAPTURA=<file.png>, saves a picture), and quits.
// QY_MIXER_PRUEBA=<file.js>: runs that script in the page once it is ready, prints what it
// returns, and quits. Only from the repository, never in the packaged app.
const AUTOCOMPROBAR = process.env.QY_MIXER_AUTOCOMPROBAR === '1'
const PRUEBA = !app.isPackaged ? process.env.QY_MIXER_PRUEBA : undefined

protocol.registerSchemesAsPrivileged([
  { scheme: 'qy', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function servir() {
  protocol.handle('qy', (req) => {
    const ruta = decodeURIComponent(new URL(req.url).pathname)
    const archivo = path.normalize(path.join(RAIZ, ruta))
    if (!archivo.startsWith(RAIZ)) return new Response('', { status: 403 })
    return net.fetch(pathToFileURL(archivo).toString())
  })
}

function leerEstado() {
  try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')) } catch { return null }
}

let guardarTimer = null
let pendiente = null
function guardarEstado(estado) {
  pendiente = estado
  clearTimeout(guardarTimer)
  guardarTimer = setTimeout(escribirEstado, 300)
}
function escribirEstado() {
  if (!pendiente) return
  const tmp = ESTADO + '.tmp'
  fs.mkdirSync(path.dirname(ESTADO), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(pendiente, null, 1))
  fs.renameSync(tmp, ESTADO)
  pendiente = null
}

function crearVentana() {
  const area = screen.getPrimaryDisplay().workAreaSize
  const ancho = Math.round(Math.min(1400, area.width * 0.92, (area.height * 0.92 - 2 * MARGEN) * PROPORCION + 2 * MARGEN))
  const alto = Math.round((ancho - 2 * MARGEN) / PROPORCION + 2 * MARGEN)
  const win = new BrowserWindow({
    width: ancho,
    height: alto,
    minWidth: 700 + 2 * MARGEN,
    minHeight: 700 / PROPORCION + 2 * MARGEN,
    frame: false,
    transparent: true,
    hasShadow: false,        // the shadow is drawn by the page, around the faceplate's real shape
    backgroundColor: '#00000000',
    resizable: true,
    fullscreenable: false,
    show: !AUTOCOMPROBAR && !PRUEBA,
    title: 'QY100 Mixer',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  // The margin stays fixed while the faceplate keeps its proportion (macOS).
  win.setAspectRatio(PROPORCION, { width: 2 * MARGEN, height: 2 * MARGEN })
  win.loadURL('qy://app/index.html')

  if (AUTOCOMPROBAR || PRUEBA) {
    win.webContents.on('console-message', (_e, _nivel, mensaje) => console.log('[página] ' + mensaje))
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      try {
        if (PRUEBA) {
          const codigo = fs.readFileSync(PRUEBA, 'utf8')
          const r = await win.webContents.executeJavaScript(codigo)
          console.log('PRUEBA ' + JSON.stringify(r))
        } else {
          const informe = await win.webContents.executeJavaScript(`(async () => {
            const midi = await navigator.requestMIDIAccess({ sysex: true })
              .then((m) => ({ ok: true, sysex: m.sysexEnabled,
                              entradas: [...m.inputs.values()].map((p) => p.name),
                              salidas: [...m.outputs.values()].map((p) => p.name) }))
              .catch((e) => ({ ok: false, error: String(e) }))
            const notificaciones = await Notification.requestPermission()
            return { midi, notificaciones, voces: window.__mixer?.voces, pantalla: document.getElementById('mixlcd')?.innerText.replace(/\\s+/g, ' ') }
          })()`)
          console.log('AUTOCOMPROBACION ' + JSON.stringify(informe))
        }
        if (process.env.QY_MIXER_CAPTURA) {
          const img = await win.webContents.capturePage()
          fs.writeFileSync(process.env.QY_MIXER_CAPTURA, img.toPNG())
          console.log('CAPTURA ' + process.env.QY_MIXER_CAPTURA + ' ' + JSON.stringify(img.getSize()))
        }
      } catch (e) {
        console.log('ERROR ' + (e && e.stack || e))
      }
      escribirEstado()
      app.quit()
    }, 2500))
  }
  return win
}

ipcMain.handle('estado:cargar', () => leerEstado())
ipcMain.on('estado:guardar', (_e, estado) => guardarEstado(estado))
ipcMain.on('registro:empezar', () => { try { fs.writeFileSync(REGISTRO, '') } catch { /* sin registro */ } })
ipcMain.on('registro:linea', (_e, linea) => { try { fs.appendFileSync(REGISTRO, linea + '\n') } catch { /* sin registro */ } })

app.whenReady().then(() => {
  servir()
  if (!app.isPackaged && process.platform === 'darwin' && app.dock) app.dock.setIcon(ICONO)
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(PERMITIDOS.has(permiso)))
  session.defaultSession.setPermissionCheckHandler((_wc, permiso) => PERMITIDOS.has(permiso))
  crearVentana()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

// One window, one mixer: closing it quits, on the Mac too.
app.on('window-all-closed', () => app.quit())
app.on('before-quit', escribirEstado)

module.exports = { PERMITIDOS }
