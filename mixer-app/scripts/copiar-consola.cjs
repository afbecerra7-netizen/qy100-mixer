// Copies the two modules the mixer reuses from the web console at the root of
// this repository (js/sysex.js and js/midi.js, by Doffu, GPL-3.0) into
// app/consola/, so that the packaged app carries them. They are copied, not
// edited: the console stays the single source.
const fs = require('node:fs')
const path = require('node:path')

const desde = path.join(__dirname, '..', '..', 'js')
const hacia = path.join(__dirname, '..', 'app', 'consola')
fs.mkdirSync(hacia, { recursive: true })
for (const f of ['sysex.js', 'midi.js']) fs.copyFileSync(path.join(desde, f), path.join(hacia, f))
console.log('consola: sysex.js y midi.js copiados en app/consola/')
