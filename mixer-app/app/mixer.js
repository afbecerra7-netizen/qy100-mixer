// QY100 Mixer: the page.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
//
// Everything it sends is an XG Parameter Change addressed to a part (F0 43 10 4C aa bb cc dd F7,
// device 1), never a channel message: a CC sent on a channel can land on whichever track is
// highlighted on the QY100 rather than on the part it was meant for (see ../../js/params.js).
//
//   Multi Part  08 <part> <param> <value>   part 0-15 = Song mode (part n receives channel n+1),
//                                           16-23 = Pattern tracks D1 D2 PC BA C1-C4 (Doffu)
//     01 bank MSB  02 bank LSB  03 program  04 Rcv Channel  0B volume  0E pan
//     11 dry       12 chorus    13 reverb   14 variation
//   Effects     02 01 00 / 20 / 40 <MSB> <LSB>  reverb / chorus / variation type
//               02 01 0C / 2C / 56 <value>      their returns                  [V] untried
//   System      00 00 04 <value>                master volume                  [V] untried
//
// QY button (Song): Rcv Channel 7F = the QY100 stops playing that channel, <n> = it plays again.
// [M] measured 2026-11-22: it silences the part without touching the external synth, and does not
// survive a power cycle (hence SEND ALL). VOL 0 (Pattern) is volume 0, keeping the volume it had.
//
// A value that has been neither read from the QY100 nor sent to it is shown as «—», as in MESA 101.
//
// [M] 2026-11-23, HOST SELECT = PC-2 through puente_host.py: over TO HOST the QY100 TAKES XG
// Parameter Changes (XG Display Data showed on its screen) but answers NO XG request, dump or
// parameter, with or without bulk mode; its own sequencer requests (model 5F) do answer, inside
// bulk mode. So over TO HOST the mixer can send but not read, and READ says so.

import { buildParameterChange, buildParameterRequest, buildBulkDumpRequest } from './consola/sysex.js';
import { MidiLink } from './consola/midi.js';

const disco = window.qyMixer || null;   // the app's disk (preload.cjs); absent in a plain browser
const guardado = (disco ? await disco.cargar().catch(() => null) : null) || {};
disco?.empezarRegistro();

// ---- language: Spanish by default, English to choose (as in MESA 101). The unit's labels are not translated ----
let lang = guardado.idioma === 'en' ? 'en' : 'es';
document.documentElement.lang = lang;
const I18N = {
  es: {
    pages: [['CANCIÓN 1–8', 'canales 1–8'], ['CANCIÓN 9–16', 'canales 9–16'], ['PATRÓN', 'pistas D1–C4']],
    rol: ['BATERÍA 1', 'BATERÍA 2', 'PERCUSIÓN', 'BAJO', 'ACORDE 1', 'ACORDE 2', 'ACORDE 3', 'ACORDE 4'],
    puerto: 'PUERTO', envio: 'ENVÍO', idioma: 'IDIOMA',
    cancion: 'CANCIÓN', patron: 'PATRÓN', canalesSub: 'canales',
    maestro: 'EFECTOS DEL QY100', general: 'GENERAL', fx: { rev: 'REVERB', cho: 'CHORUS', vari: 'VARIACIÓN' }, retorno: 'RETORNO', tipoDe: (fx) => 'Tipo de ' + fx,
    sendAll: 'ENVIAR<br>TODO', sendAllSub: '24 tiras', leer: 'LEER DEL QY', leerSub: 'esta página', leyendo: 'LEYENDO…',
    puertoMidi: 'PUERTO MIDI ▾', ninguno: 'ninguno', noEsta: (n) => `«${n}» no está`, efectos: 'EFECTOS',
    salida: 'SALIDA · hacia el MIDI IN del QY100', entrada: 'ENTRADA · desde su MIDI OUT (para LEER)', sinEntrada: 'ninguna',
    suena: 'suena', callado: 'callado', cinta: 'PEGAR CINTA', cerrar: 'CERRAR ✕', ahora: 'Ahora',
    parte: (n) => 'parte ' + n, pista: (t) => 'pista ' + t, canal: 'canal',
    vozDe: (q) => `Voz de la ${q}`, cintaDe: (t) => 'cinta ' + t,
    qySuena: 'QY suena', qyCallado: 'QY callado',
    bienvenida: 'Mezcla las partes internas del QY100. Pasa el mouse por cualquier control y aquí se explica qué hace.',
    inicioSinPuerto: 'Elige el PUERTO MIDI. «—» = aún ni leído ni mandado.',
    inicioMezcla: (n) => `Última mezcla cargada (${n} valores). ENVIAR TODO la manda.`,
    h: {
      idioma: 'IDIOMA: español o inglés. Se recuerda. Los rótulos del aparato (PAN, DRY, REV, QY) no se traducen.',
      cerrar: 'Cierra el QY100 Mixer. La mezcla, las cintas y el puerto quedan guardados.',
      modoCancion: 'CANCIÓN: las 16 partes del modo canción, una por canal MIDI. Se ven de a 8: elige el grupo al lado.',
      modoPatron: 'PATRÓN: las 8 pistas del modo patrón (batería, percusión, bajo y 4 acordes). Salen por los canales 1–8.',
      banco: (r) => `Grupo de partes ${r} del modo canción (canales ${r}).`,
      bancoOff: 'El patrón tiene solo 8 pistas: no hay segundo grupo.',
      fxTipo: (fx, t) => `${fx}: el efecto del QY100 entero, no de una parte (ahora ${t}). Cada tira decide cuánto le manda. Clic para cambiar el tipo.`,
      fxVari: ' En patrón la variación es siempre efecto de sistema (manual, p. 122).',
      fxRet: (fx) => `RETORNO de ${fx}: cuánto vuelve el efecto a la mezcla. Sin probar todavía en el aparato.`,
      general: 'VOLUMEN GENERAL del QY100, de 0 a 127: todo lo que suena por dentro. Sin probar todavía en el aparato',
      ledPuerto: 'Luz PUERTO: ámbar = sin salida MIDI; verde = hay salida abierta hacia el QY100.',
      ledEnvio: 'Luz ENVÍO: parpadea cada vez que algo sale hacia el QY100.',
      sendAll: 'ENVIAR TODO: manda al QY100 todo lo que la app conoce de las 24 tiras (voz, volumen, efectos y el botón QY) y los efectos. Lo que está en «—» no se manda. Úsalo al prenderlo o después de cambiar de patrón.',
      leer: 'LEER DEL QY: trae del QY100 los valores de las 8 tiras de esta página y de los efectos. Necesita una ENTRADA MIDI con el cable de vuelta (MIDI OUT del QY100). Por TO HOST no funciona: el QY100 no contesta lecturas XG por ahí.',
      puerto: 'PUERTO MIDI: la salida que llega al QY100 (en el estudio, la Zoom: L6max MIDI I/O; o «QY100 TO HOST» con puente_host.py, que manda pero no lee) y, para LEER, la entrada que trae su respuesta.',
      perilla: (txt, def) => `${txt}. Arrastra arriba o abajo (Shift = fino), rueda o flechas. Doble clic: ${def}.`,
      cabCancion: (n) => `Parte ${n} del modo canción: recibe por el canal MIDI ${n}.`,
      cabPatron: (t, rol, ch) => `Pista ${t} del patrón (${rol}): sale por el canal ${ch}.`,
      voz: (q, v) => `VOZ de la ${q}: ${v}. Clic para elegir otra entre las 530 del QY100.`,
      rev: (q) => `Envío a REVERB de la ${q}`, cho: (q) => `Envío a CHORUS de la ${q}`, vari: (q) => `Envío a VARIACIÓN de la ${q}`,
      pan: (q) => `PANEO de la ${q} (C = centro)`, dry: (q) => `DRY: la señal sin efectos de la ${q}. No es un envío: en 0 no se oye nada directo`,
      qy: (ch, s) => `QY: encendido, el QY100 suena en el canal ${ch}${s ? ' junto con ' + s : ''}. Apagado, suena solo ${s || 'el sinte externo'}. Se pierde al apagar el QY100: ENVIAR TODO.`,
      vol0: (t, s) => `VOL 0: baja a 0 el volumen de la pista ${t}. Ojo: el QY100 puede pasarlo como CC 7 y bajar también ${s || 'el sinte de ese canal'}.`,
      fader: (q) => `VOLUMEN de la ${q}, de 0 a 127. Arrastra la tapa o haz clic en la ranura (Shift = fino). Doble clic: 100, la raya.`,
      faderGeneral: 'Arrastra la tapa o haz clic en la ranura (Shift = fino). Doble clic: 127.',
      volumen: (q) => `VOLUMEN de la ${q}`,
      cinta: (ch) => `Cinta del canal ${ch}: qué sinte va en ese cable. Clic para escribir (hasta 12 letras), Enter guarda. Es la misma en canción y en patrón.`,
    },
    s: {
      sinSalida: 'Sin salida MIDI: el cambio queda en la app y no sale. Elige el PUERTO MIDI.',
      leerSinEntrada: 'Leer necesita una ENTRADA MIDI con el cable de vuelta desde el QY100. Elígela en PUERTO MIDI.',
      leerSinSalida: 'Leer necesita también la SALIDA hacia el QY100: elígela en PUERTO MIDI.',
      leido: (pg, n, f) => `Leído ${pg}: ${n} valores${f ? `, ${f} sin respuesta` : ''}.`,
      nadaLeido: 'El QY100 no contestó. Revisa la ENTRADA MIDI y los dos cables (el de ida y el de vuelta).',
      nadaLeidoHost: 'Por TO HOST el QY100 recibe los cambios pero no contesta las lecturas XG. Para LEER, usa MIDI.',
      valor: (lab, q, v) => `${lab} de la ${q}: ${v}.`,
      fabrica: (lab, q, v) => `${lab} de la ${q} a ${v} (de fábrica).`,
      qyOn: (ch) => `Canal ${ch}: el QY100 vuelve a sonar.`,
      qyOff: (ch, s) => `Canal ${ch}: el QY100 se calla; ${s || 'el sinte'} sigue sonando.`,
      vol0On: (t, v) => `${t}: volumen 0 (guardado: ${v}).`, vol0Off: (t, v) => `${t}: volumen de vuelta a ${v}.`,
      volumen: (q, v) => `Volumen de la ${q}: ${v}.`, volFabrica: (q) => `Volumen de la ${q} a 100 (de fábrica, la raya de la escala).`,
      cinta: (ch, t) => `Cinta del canal ${ch}: ${t}. Vale para canción y patrón.`, cintaFuera: (ch) => `Cinta del canal ${ch} despegada.`,
      voz: (q, v, m, l, pc) => `Voz de la ${q}: ${v} (banco ${m}/${l}, programa ${pc}).`,
      enviando: (n) => `Enviando ${n} mensajes al QY100…`,
      enviado: (n) => `Enviado: ${n} mensajes, todo lo que la app conoce de las 24 tiras y los efectos.`,
      nadaQueEnviar: 'Nada que enviar: todavía no hay ningún valor leído ni puesto.',
      salida: (n) => `Salida MIDI: ${n}.`, entrada: (n) => `Entrada MIDI: ${n}.`, sinSalidaElegida: 'Sin salida MIDI.', sinEntradaElegida: 'Sin entrada MIDI.',
      sinMidi: (e) => `No se pudo abrir el MIDI: ${e}`,
      error: (e) => `Error al mandar: ${e}`,
      fxTipo: (fx, t) => `${fx}: ${t}.`, fxRet: (fx, v) => `Retorno de ${fx}: ${v}.`, general: (v) => `Volumen general: ${v}.`,
    },
  },
  en: {
    pages: [['SONG 1–8', 'channels 1–8'], ['SONG 9–16', 'channels 9–16'], ['PATTERN', 'tracks D1–C4']],
    rol: ['DRUMS 1', 'DRUMS 2', 'PERCUSSION', 'BASS', 'CHORD 1', 'CHORD 2', 'CHORD 3', 'CHORD 4'],
    puerto: 'PORT', envio: 'SEND', idioma: 'LANGUAGE',
    cancion: 'SONG', patron: 'PATTERN', canalesSub: 'channels',
    maestro: 'QY100 EFFECTS', general: 'MASTER', fx: { rev: 'REVERB', cho: 'CHORUS', vari: 'VARIATION' }, retorno: 'RETURN', tipoDe: (fx) => fx + ' type',
    sendAll: 'SEND<br>ALL', sendAllSub: '24 strips', leer: 'READ FROM QY', leerSub: 'this page', leyendo: 'READING…',
    puertoMidi: 'MIDI PORT ▾', ninguno: 'none', noEsta: (n) => `«${n}» not found`, efectos: 'EFFECTS',
    salida: "OUTPUT · to the QY100's MIDI IN", entrada: 'INPUT · from its MIDI OUT (for READ)', sinEntrada: 'none',
    suena: 'playing', callado: 'silent', cinta: 'ADD TAPE', cerrar: 'CLOSE ✕', ahora: 'Now',
    parte: (n) => 'part ' + n, pista: (t) => 'track ' + t, canal: 'channel',
    vozDe: (q) => `Voice for ${q}`, cintaDe: (t) => 'tape ' + t,
    qySuena: 'QY playing', qyCallado: 'QY silent',
    bienvenida: "Mixes the QY100's internal parts. Point at any control and this screen says what it does.",
    inicioSinPuerto: 'Choose the MIDI PORT. «—» = not read or sent yet.',
    inicioMezcla: (n) => `Last mix loaded (${n} values). SEND ALL sends it.`,
    h: {
      idioma: "LANGUAGE: Spanish or English. Remembered. The unit's own labels (PAN, DRY, REV, QY) are not translated.",
      cerrar: 'Closes QY100 Mixer. The mix, the tapes and the port are kept.',
      modoCancion: 'SONG: the 16 Song mode parts, one per MIDI channel. Shown 8 at a time: pick the group beside it.',
      modoPatron: 'PATTERN: the 8 Pattern mode tracks (drums, percussion, bass and 4 chords). They go out on channels 1–8.',
      banco: (r) => `Song mode parts ${r} (channels ${r}).`,
      bancoOff: 'A pattern has only 8 tracks: there is no second group.',
      fxTipo: (fx, t) => `${fx}: the effect for the whole QY100, not one part (now ${t}). Each strip sets how much it sends. Click to change the type.`,
      fxVari: ' In Pattern mode variation is always a system effect (owner\'s manual, p. 122).',
      fxRet: (fx) => `${fx} RETURN: how much of the effect comes back into the mix. Not yet tried on the unit.`,
      general: 'MASTER VOLUME of the QY100, 0 to 127: everything it plays internally. Not yet tried on the unit',
      ledPuerto: 'PORT light: amber = no MIDI output; green = an output to the QY100 is open.',
      ledEnvio: 'SEND light: blinks every time something goes out to the QY100.',
      sendAll: 'SEND ALL: sends the QY100 everything the app knows about the 24 strips (voice, volume, effects and the QY button) and the effects. Anything at «—» is not sent. Use it after switching it on or changing pattern.',
      leer: "READ FROM QY: brings the values of this page's 8 strips and of the effects from the QY100. Needs a MIDI INPUT with the return cable (the QY100's MIDI OUT). Not over TO HOST: the QY100 answers no XG read there.",
      puerto: 'MIDI PORT: the output that reaches the QY100 (in the studio, the Zoom: L6max MIDI I/O; or «QY100 TO HOST» with puente_host.py, which sends but cannot read) and, for READ, the input that brings its answer.',
      perilla: (txt, def) => `${txt}. Drag up or down (Shift = fine), wheel or arrows. Double-click: ${def}.`,
      cabCancion: (n) => `Song mode part ${n}: receives on MIDI channel ${n}.`,
      cabPatron: (t, rol, ch) => `Pattern track ${t} (${rol}): goes out on channel ${ch}.`,
      voz: (q, v) => `VOICE for ${q}: ${v}. Click to choose another of the QY100's 530.`,
      rev: (q) => `REVERB send for ${q}`, cho: (q) => `CHORUS send for ${q}`, vari: (q) => `VARIATION send for ${q}`,
      pan: (q) => `PAN for ${q} (C = centre)`, dry: (q) => `DRY: the signal of ${q} without effects. Not a send: at 0 nothing direct is heard`,
      qy: (ch, s) => `QY: lit, the QY100 plays on channel ${ch}${s ? ' along with ' + s : ''}. Off, only ${s || 'the external synth'} plays. Lost when the QY100 is switched off: SEND ALL.`,
      vol0: (t, s) => `VOL 0: turns track ${t} down to 0. Careful: the QY100 may pass it on as CC 7 and turn ${s || 'the synth on that channel'} down too.`,
      fader: (q) => `VOLUME for ${q}, 0 to 127. Drag the cap or click the slot (Shift = fine). Double-click: 100, the line.`,
      faderGeneral: 'Drag the cap or click the slot (Shift = fine). Double-click: 127.',
      volumen: (q) => `VOLUME for ${q}`,
      cinta: (ch) => `Tape for channel ${ch}: which synth is on that cable. Click to write (up to 12 letters), Enter saves. Shared by Song and Pattern.`,
    },
    s: {
      sinSalida: 'No MIDI output: the change stays in the app and goes nowhere. Choose the MIDI PORT.',
      leerSinEntrada: 'Read needs a MIDI INPUT with the return cable from the QY100. Choose it under MIDI PORT.',
      leerSinSalida: 'Read also needs the OUTPUT to the QY100: choose it under MIDI PORT.',
      leido: (pg, n, f) => `Read ${pg}: ${n} values${f ? `, ${f} with no answer` : ''}.`,
      nadaLeido: 'The QY100 did not answer. Check the MIDI INPUT and both cables (out and back).',
      nadaLeidoHost: 'Over TO HOST the QY100 takes changes but answers no XG read. To READ, use MIDI.',
      valor: (lab, q, v) => `${lab} for ${q}: ${v}.`,
      fabrica: (lab, q, v) => `${lab} for ${q} back to ${v} (factory).`,
      qyOn: (ch) => `Channel ${ch}: the QY100 plays again.`,
      qyOff: (ch, s) => `Channel ${ch}: the QY100 goes silent; ${s || 'the synth'} keeps playing.`,
      vol0On: (t, v) => `${t}: volume 0 (kept: ${v}).`, vol0Off: (t, v) => `${t}: volume back to ${v}.`,
      volumen: (q, v) => `Volume for ${q}: ${v}.`, volFabrica: (q) => `Volume for ${q} back to 100 (factory, the line on the scale).`,
      cinta: (ch, t) => `Tape for channel ${ch}: ${t}. Applies to Song and Pattern.`, cintaFuera: (ch) => `Tape for channel ${ch} removed.`,
      voz: (q, v, m, l, pc) => `Voice for ${q}: ${v} (bank ${m}/${l}, program ${pc}).`,
      enviando: (n) => `Sending ${n} messages to the QY100…`,
      enviado: (n) => `Sent: ${n} messages, everything the app knows about the 24 strips and the effects.`,
      nadaQueEnviar: 'Nothing to send: no value has been read or set yet.',
      salida: (n) => `MIDI output: ${n}.`, entrada: (n) => `MIDI input: ${n}.`, sinSalidaElegida: 'No MIDI output.', sinEntradaElegida: 'No MIDI input.',
      sinMidi: (e) => `MIDI could not be opened: ${e}`,
      error: (e) => `Error sending: ${e}`,
      fxTipo: (fx, t) => `${fx}: ${t}.`, fxRet: (fx, v) => `${fx} return: ${v}.`, general: (v) => `Master volume: ${v}.`,
    },
  },
};
const L = I18N[lang];

// ---- placing, as in the emulator: centres and sizes in faceplate units (1700 x 1000) ----
const FW = 1700, FH = 1000;
const face = document.getElementById('face');
const place = (e, cx, cy, w, h) => {
  Object.assign(e.style, { left: cx / FW * 100 + '%', top: cy / FH * 100 + '%', width: w / FW * 100 + '%', height: h / FH * 100 + '%', transform: 'translate(-50%, -50%)' });
  face.appendChild(e);
  return e;
};
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const deco = (cls, cx, cy, w, h) => place(el('div', cls), cx, cy, w, h);
const text = (t, cx, cy, size, cls = '') => {
  const s = el('span', 'fl ' + cls, t);
  s.style.left = cx / FW * 100 + '%'; s.style.top = cy / FH * 100 + '%';
  if (size) s.style.fontSize = 'max(5px, ' + size / FW * 100 + 'cqw)';
  face.appendChild(s);
  return s;
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Each control's help goes to the screen while the mouse or the focus is on it.
let helpTimer = 0;
const explain = (e, msg) => {
  const show = () => { clearTimeout(helpTimer); helpTimer = setTimeout(() => setHelp(typeof msg === 'function' ? msg() : msg), 80); };
  const hide = () => { clearTimeout(helpTimer); helpTimer = setTimeout(() => setHelp(''), 120); };
  e.addEventListener('pointerenter', show); e.addEventListener('pointerleave', hide);
  e.addEventListener('focus', show); e.addEventListener('blur', hide);
  return e;
};
const flashKey = (b) => { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); };
const key = (label, cx, cy, w, h, cls, onClick, help, shortcut) => {
  const b = el('button', 'fk ' + (cls || ''), label + (shortcut ? `<span class="kb">${shortcut}</span>` : ''));
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  if (help) explain(b, help);
  return place(b, cx, cy, w, h);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo = 0, hi = 127) => Math.max(lo, Math.min(hi, Math.round(v)));

// ---- the data ----
let VOCES = { familias: [], familias_en: [], voces: [] };
try { VOCES = await (await fetch('voces.json')).json(); } catch { /* no voices: the mixer still works */ }
const V = VOCES.voces;                      // [family, name, msb, lsb, pc]
const FAMILIAS = (lang === 'en' ? VOCES.familias_en : VOCES.familias) || VOCES.familias;
const PARTS = [[0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15], [16, 17, 18, 19, 20, 21, 22, 23]];
const PAGES = L.pages.map(([label, sub], i) => ({ label, sub, parts: PARTS[i], lcd: label }));
const PATT = ['D1', 'D2', 'PC', 'BA', 'C1', 'C2', 'C3', 'C4'];
const ROL = L.rol;
const DEFAULTS = { pan: 64, rev: 40, cho: 0, vari: 0, dry: 127, vol: 100 };
// The Multi Part addresses (08 <part> <param>) of each field.
const ADDR = { vol: 0x0b, pan: 0x0e, dry: 0x11, cho: 0x12, rev: 0x13, vari: 0x14 };
const RCV = 0x04, RCV_OFF = 0x7f;
const CAMPOS = ['vol', 'pan', 'rev', 'cho', 'vari', 'dry'];

// Effect Type List of the Data List: [name, MSB, LSB]; the same lists as m4l_qy100.py.
const REVERBS = [['NO EFFECT', 0x00, 0x00], ['HALL1', 0x01, 0x00], ['HALL2', 0x01, 0x01], ['ROOM1', 0x02, 0x00], ['ROOM2', 0x02, 0x01],
  ['ROOM3', 0x02, 0x02], ['STAGE1', 0x03, 0x00], ['STAGE2', 0x03, 0x01], ['PLATE', 0x04, 0x00], ['WHITE ROOM', 0x10, 0x00],
  ['TUNNEL', 0x11, 0x00], ['BASEMENT', 0x13, 0x00]];
const CHORUSES = [['NO EFFECT', 0x00, 0x00], ['CHORUS1', 0x41, 0x00], ['CHORUS2', 0x41, 0x01], ['CHORUS3', 0x41, 0x02], ['CHORUS4', 0x41, 0x08],
  ['CELESTE1', 0x42, 0x00], ['CELESTE2', 0x42, 0x01], ['CELESTE3', 0x42, 0x02], ['CELESTE4', 0x42, 0x08], ['FLANGER1', 0x43, 0x00],
  ['FLANGER2', 0x43, 0x01], ['FLANGER3', 0x43, 0x08]];
const VARIACIONES = [...REVERBS.slice(0, 9), ['DELAY L,C,R', 0x05, 0x00], ['DELAY L,R', 0x06, 0x00], ['ECHO', 0x07, 0x00],
  ['CROSS DELAY', 0x08, 0x00], ['EARLY REF1', 0x09, 0x00], ['EARLY REF2', 0x09, 0x01], ['GATE REVERB', 0x0a, 0x00],
  ['REVERSE GATE', 0x0b, 0x00], ['KARAOKE 1', 0x14, 0x00], ['KARAOKE 2', 0x14, 0x01], ['KARAOKE 3', 0x14, 0x02],
  ...CHORUSES.slice(1), ['SYMPHONIC', 0x44, 0x00], ['ROTARY SPEAKER', 0x45, 0x00], ['TREMOLO', 0x46, 0x00], ['AUTO PAN', 0x47, 0x00],
  ['PHASER1', 0x48, 0x00], ['PHASER2', 0x48, 0x08], ['DISTORTION', 0x49, 0x00], ['OVER DRIVE', 0x4a, 0x00],
  ['AMP SIMULATOR', 0x4b, 0x00], ['3BAND EQ (MONO)', 0x4c, 0x00], ['2BAND EQ (STEREO)', 0x4d, 0x00],
  ['AUTO WAH (LFO)', 0x4e, 0x00], ['THRU', 0x40, 0x00]];
// [type list, type address, return address] in block 02 01 xx
const FX = { rev: [REVERBS, 0x00, 0x0c], cho: [CHORUSES, 0x20, 0x2c], vari: [VARIACIONES, 0x40, 0x56] };
const FX_RET_DEF = 64, GENERAL_DEF = 127;

// ---- the state: null = neither read nor sent («—») ----
const parteVacia = () => ({ voz: null, vol: null, pan: null, rev: null, cho: null, vari: null, dry: null, rcv: null, vol0: false, volAntes: null });
const okNum = (v) => (Number.isInteger(v) && v >= 0 && v <= 127 ? v : null);
const state = Array.from({ length: 24 }, (_, p) => {
  const g = guardado.partes?.[p] || {};
  const st = parteVacia();
  for (const f of [...CAMPOS, 'rcv', 'volAntes']) st[f] = okNum(g[f]);
  if (Array.isArray(g.voz) && g.voz.length === 3 && g.voz.every((x) => okNum(x) !== null)) st.voz = g.voz;
  st.vol0 = p >= 16 && g.vol0 === true;
  return st;
});
const maestro = { vol: okNum(guardado.maestro?.vol) };
for (const fx of Object.keys(FX)) {
  const g = guardado.maestro?.[fx] || {};
  maestro[fx] = { tipo: Array.isArray(g.tipo) && g.tipo.length === 2 ? g.tipo : null, ret: okNum(g.ret) };
}
const conocidos = () => state.reduce((n, st) => n + CAMPOS.filter((f) => st[f] !== null).length + (st.voz ? 1 : 0) + (st.rcv !== null ? 1 : 0), 0)
  + Object.keys(FX).reduce((n, fx) => n + (maestro[fx].tipo ? 1 : 0) + (maestro[fx].ret !== null ? 1 : 0), 0) + (maestro.vol !== null ? 1 : 0);

// the tapes, by MIDI channel
let cintas = guardado.cintas && typeof guardado.cintas === 'object' ? guardado.cintas
  : { 1: 'DRUMBRUTE', 3: 'RIDDIM', 4: 'MINITAUR', 5: 'VOLCA KEYS', 6: 'LEMONDROP' };   // the rig's: editable
const GIROS = [-1.6, 1.1, -0.7, 1.8, -1.2, 0.6, -1.9, 1.3];
let mode = guardado.vista?.mode === 1 ? 1 : 0, bank = guardado.vista?.bank === 1 ? 1 : 0;   // mode 0 Song, 1 Pattern; group 0 = 1–8, 1 = 9–16
let page = mode === 1 ? 2 : bank, sel = 0, help = '', primera = true;
const puertos = { salida: guardado.puerto?.salida || '', entrada: guardado.puerto?.entrada || '' };

let guardarT = 0;
function guardar() {
  clearTimeout(guardarT);
  guardarT = setTimeout(() => {
    const estado = { version: 1, idioma: lang, cintas, puerto: puertos, vista: { mode, bank }, partes: state, maestro };
    if (disco) disco.guardar(JSON.parse(JSON.stringify(estado)));
    else try { localStorage.setItem('qy100-mixer.estado', JSON.stringify(estado)); } catch { /* not kept */ }
  }, 250);
}

const channelOf = (p) => (p < 16 ? p + 1 : p - 15);   // pattern tracks: PATT OUT CH 1~8
const sinte = (p) => cintas[channelOf(p)] || '';
const partName = (p) => (p < 16 ? L.parte(p + 1) : L.pista(PATT[p - 16]));
const panText = (v) => (v === null ? '—' : v === 0 ? 'RND' : v === 64 ? 'C' : v < 64 ? 'L' + (64 - v) : 'R' + (v - 64));
const num = (v) => (v === null ? '—' : String(v));
const vozIndex = (t) => (t ? V.findIndex((v) => v[2] === t[0] && v[3] === t[1] && v[4] === t[2]) : -1);
const vozTxt = (t) => { if (!t) return '—'; const i = vozIndex(t); return i >= 0 ? V[i][1] : `${t[0]}/${t[1]}/${t[2] + 1}`; };
const tipoIndex = (fx) => { const t = maestro[fx].tipo; return t ? FX[fx][0].findIndex((x) => x[1] === t[0] && x[2] === t[1]) : -1; };
const tipoTxt = (fx) => { const t = maestro[fx].tipo; if (!t) return '—'; const i = tipoIndex(fx); return i >= 0 ? FX[fx][0][i][0] : `${t[0].toString(16)}/${t[1].toString(16)}`.toUpperCase(); };
const qyOn = (p) => state[p].rcv !== RCV_OFF;        // unknown counts as on: the QY100's own default
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

// ---- MIDI: one queue, never more than ~60 messages a second ----
// Each entry has a key (what it sets). A new value for a key still waiting replaces the old one
// in its place, so dragging a fader sends its latest position, not every pixel. ENVIAR TODO uses the
// same queue: the gap between messages is the same ~16 ms.
const DEV = 0;            // device number 1 (F0 43 10 …)
const GAP_MS = 16;
const QY_REPLY_GAP_MS = 80;   // a QY drops what arrives while it is still finishing its reply (Doffu)
const link = new MidiLink();
const cola = [];
const enCola = new Map();
let bombeando = false, pausa = null, lastQyIncomingAt = 0;
const registro = [];
function registrar(dir, bytes) {
  const linea = `${new Date().toISOString().slice(11, 23)} ${dir} ${hex(bytes)}`;
  registro.push(linea);
  if (registro.length > 5000) registro.shift();
  disco?.registrar(linea);
}
async function enviarCrudo(bytes) {
  const wait = lastQyIncomingAt + QY_REPLY_GAP_MS - performance.now();
  if (wait > 0) await sleep(wait);
  link.send(bytes);
  registrar('>', bytes);
  pulseSend();
}
function mandar(clave, ...mensajes) {
  if (!link.output) { say(L.s.sinSalida); return false; }
  const prev = enCola.get(clave);
  if (prev) { prev.mensajes = mensajes; return true; }
  const it = { clave, mensajes };
  enCola.set(clave, it);
  cola.push(it);
  bombear();
  return true;
}
async function bombear() {
  if (bombeando) return;
  bombeando = true;
  try {
    while (cola.length) {
      if (pausa) await pausa;
      const it = cola.shift();
      enCola.delete(it.clave);
      for (const m of it.mensajes) {
        if (!link.output) break;
        try { await enviarCrudo(m); } catch (e) { say(L.s.error(e.message)); }
        await sleep(GAP_MS);
      }
    }
  } finally { bombeando = false; }
  vacia.forEach((r) => r()); vacia.length = 0;
}
const vacia = [];
const colaVacia = () => (bombeando || cola.length ? new Promise((r) => vacia.push(r)) : Promise.resolve());
const pc = (part, param, value) => buildParameterChange(DEV, [0x08, part, param], [value]);

// What each control sends.
function mandarCampo(p, f) { const v = f === 'vol' && state[p].vol0 ? 0 : state[p][f]; if (v !== null) mandar(`${p}:${f}`, pc(p, ADDR[f], v)); }
function mandarVoz(p) { const t = state[p].voz; if (t) mandar(`${p}:voz`, pc(p, 0x01, t[0]), pc(p, 0x02, t[1]), pc(p, 0x03, t[2])); }
function mandarRcv(p) { if (state[p].rcv !== null) mandar(`${p}:rcv`, pc(p, RCV, state[p].rcv)); }
function mandarFxTipo(fx) { const t = maestro[fx].tipo; if (t) mandar(`fx:${fx}:tipo`, buildParameterChange(DEV, [0x02, 0x01, FX[fx][1]], t)); }
function mandarFxRet(fx) { const v = maestro[fx].ret; if (v !== null) mandar(`fx:${fx}:ret`, buildParameterChange(DEV, [0x02, 0x01, FX[fx][2]], [v])); }
function mandarGeneral() { if (maestro.vol !== null) mandar('general', buildParameterChange(DEV, [0x00, 0x00, 0x04], [maestro.vol])); }

// Replies. With ECHO BACK on RecMontr the request bounces back first: matching on the reply's
// own sub-status (0n dump, 1n parameter change) skips it, as the console does.
const esperas = new Set();
function esperar(pred, ms) {
  return new Promise((resolve) => {
    const w = { pred, resolve: (b) => { clearTimeout(w.t); esperas.delete(w); resolve(b); } };
    w.t = setTimeout(() => w.resolve(null), ms);
    esperas.add(w);
  });
}
link.onMessage = (bytes) => {
  if (bytes[0] === 0xf8 || bytes[0] === 0xfe) return;
  lastQyIncomingAt = performance.now();
  if (bytes[0] === 0xf0) registrar('<', bytes);
  for (const w of [...esperas]) if (w.pred(bytes)) w.resolve(bytes);
};
const mismaDir = (b, at, [h, m, l]) => b[at] === h && b[at + 1] === m && b[at + 2] === l;
async function pedirBloque(dir) {
  const r = esperar((b) => b.length > 11 && b[0] === 0xf0 && b[1] === 0x43 && (b[2] & 0xf0) === 0x00 && b[3] === 0x4c && mismaDir(b, 6, dir), 600);
  await enviarCrudo(buildBulkDumpRequest(DEV, dir));
  const b = await r;
  if (!b) return null;
  const n = (b[4] << 7) | b[5];
  if (Array.from(b.slice(4, b.length - 1)).reduce((a, x) => a + x, 0) & 0x7f) return null;   // bad checksum
  return Array.from(b.slice(9, 9 + n));
}
async function pedirParam(dir, size = 1) {
  const r = esperar((b) => b.length >= 9 && b[0] === 0xf0 && b[1] === 0x43 && (b[2] & 0xf0) === 0x10 && b[3] === 0x4c && mismaDir(b, 4, dir), 300);
  await enviarCrudo(buildParameterRequest(DEV, dir));
  const b = await r;
  return b && b.length >= 8 + size ? Array.from(b.slice(7, 7 + size)) : null;
}
// Reads a block: one dump if it answers, otherwise one parameter at a time (two unanswered in a
// row: the device has nothing there, stop asking). want = [[offset, size], …]; returns offset -> bytes.
async function leerBloque(base, want) {
  const datos = await pedirBloque(base);
  const out = new Map();
  let sinRespuesta = datos ? 0 : 1;
  for (const [off, size] of want) {
    let v = datos && datos.length >= off + size ? datos.slice(off, off + size) : null;
    if (!v && sinRespuesta < 2) {
      v = await pedirParam([base[0], base[1], base[2] + off], size);
      sinRespuesta = v ? 0 : sinRespuesta + 1;
    }
    if (v) out.set(off, v);
  }
  return out;
}

let leyendo = false;
async function leerPagina() {
  if (leyendo) return;
  if (!link.output) { say(L.s.leerSinSalida); return; }
  if (!link.input) { say(L.s.leerSinEntrada); return; }
  leyendo = true; readKey.disabled = true; readKey.innerHTML = `${L.leyendo}<span class="sub">${L.leerSub}</span>`;
  await colaVacia();
  let soltar; pausa = new Promise((r) => { soltar = r; });
  let got = 0, faltan = 0;
  try {
    for (const p of PAGES[page].parts) {
      const want = [[0x01, 1], [0x02, 1], [0x03, 1], [RCV, 1], ...CAMPOS.map((f) => [ADDR[f], 1])];
      const m = await leerBloque([0x08, p, 0x00], want);
      const st = state[p];
      const b = (o) => (m.has(o) ? m.get(o)[0] : null);
      if (b(1) !== null && b(2) !== null && b(3) !== null) st.voz = [b(1), b(2), b(3)];
      if (b(RCV) !== null) st.rcv = b(RCV);
      for (const f of CAMPOS) if (b(ADDR[f]) !== null) {
        if (f === 'vol' && st.vol0) { if (b(ADDR.vol) !== 0) { st.vol0 = false; st.vol = b(ADDR.vol); } }
        else st[f] = b(ADDR[f]);
      }
      got += m.size; faltan += want.length - m.size;
      render();
      if (!m.size && p === PAGES[page].parts[0]) { faltan += (want.length) * 7; break; }   // nobody there
    }
    if (got) {
      for (const fx of Object.keys(FX)) {
        const [, tAddr, rAddr] = FX[fx];
        const m = await leerBloque([0x02, 0x01, tAddr], [[0, 2], [rAddr - tAddr, 1]]);
        if (m.has(0)) maestro[fx].tipo = m.get(0);
        if (m.has(rAddr - tAddr)) maestro[fx].ret = m.get(rAddr - tAddr)[0];
        got += m.size; faltan += 2 - m.size;
      }
      const s = await leerBloque([0x00, 0x00, 0x00], [[0x04, 1]]);
      if (s.has(4)) maestro.vol = s.get(4)[0];
      got += s.size; faltan += 1 - s.size;
    }
  } finally {
    pausa = null; soltar();
    leyendo = false; readKey.disabled = false; readKey.innerHTML = `${L.leer}<span class="sub">${L.leerSub}</span><span class="kb">L</span>`;
  }
  pintaFx.forEach((f) => f()); render(); guardar();
  say(got ? L.s.leido(PAGES[page].label, got, faltan) : /TO HOST/i.test(link.input?.name || '') ? L.s.nadaLeidoHost : L.s.nadaLeido);
}

let enviandoTodo = false;
async function sendAll() {
  flashKey(sendKey);
  if (!link.output) { say(L.s.sinSalida); return; }
  if (enviandoTodo) return;
  const antes = cola.reduce((n, it) => n + it.mensajes.length, 0);
  for (const fx of Object.keys(FX)) { mandarFxTipo(fx); mandarFxRet(fx); }
  mandarGeneral();
  for (let p = 0; p < 24; p++) {
    mandarVoz(p);
    if (p < 16) mandarRcv(p);
    for (const f of ['vol', 'pan', 'dry', 'cho', 'rev', 'vari']) mandarCampo(p, f);
  }
  const n = cola.reduce((k, it) => k + it.mensajes.length, 0) - antes;
  if (!n) { say(L.s.nadaQueEnviar); return; }
  enviandoTodo = true; sendKey.disabled = true;
  say(L.s.enviando(n));
  await colaVacia();
  enviandoTodo = false; sendKey.disabled = false;
  say(L.s.enviado(n));
}

// ---- the moulded body ----
deco('cap l', 22, 500, 44, 1000);
deco('cap r', 1678, 500, 44, 1000);
deco('lip', 850, 975, 1700, 50);
deco('groove', 850, 282, 1612, 3);
deco('well', 850, 626, 1612, 668);
place(document.getElementById('bezel'), 850, 112, 1000, 196);
place(document.getElementById('lcdwin'), 850, 104, 950, 150);
text('<b>QY</b> MIXER', 180, 44, 34);
text('<span class="xg">QY100</span>', 1290, 195, 22, 'marca');
// the window has no frame: this key closes it
key('✕', 68, 44, 38, 38, 'round cerrar-app', () => window.close(), L.h.cerrar);

// ---- lights: port and send ----
const ledPuerto = deco('fled ambar', 86, 140, 26, 26);
text(L.puerto, 86 + 18, 140, 19, 'izq');
const ledEnvio = deco('fled green', 86, 184, 26, 26);
text(L.envio, 86 + 18, 184, 19, 'izq');
explain(ledPuerto, L.h.ledPuerto);
explain(ledEnvio, L.h.ledEnvio);
function pulseSend() { ledEnvio.classList.add('on'); clearTimeout(pulseSend.t); pulseSend.t = setTimeout(() => ledEnvio.classList.remove('on'), 160); }

// ---- language: two small keys, ES and EN ----
text(L.idioma, 280, 128, 15);
['es', 'en'].forEach((code, i) => {
  key(code.toUpperCase(), 254 + i * 54, 168, 50, 40, 'idioma sm' + (code === lang ? ' on' : ''), () => {
    if (code === lang) return;
    lang = code; guardar();
    setTimeout(() => location.reload(), 400);
  }, L.h.idioma);
});

// ---- SEND ALL ----
deco('ring', 1530, 112, 205, 205);
const sendKey = key(`${L.sendAll}<span class="sub">${L.sendAllSub}</span>`, 1530, 112, 150, 150, 'round azul', () => sendAll(), L.h.sendAll, 'E');

// ---- mode and group, apart as on the QY100 ----
const setView = (m, b) => { mode = m; if (b !== undefined) bank = b; page = mode === 1 ? 2 : bank; sel = 0; render(); guardar(); };
const modeKeys = [
  key(`<i></i>${L.cancion}`, 128, 245, 168, 54, 'modo azul wide', () => setView(0), L.h.modoCancion, '1'),
  key(`<i></i>${L.patron}`, 304, 245, 168, 54, 'modo azul wide', () => setView(1), L.h.modoPatron, '3'),
];
const bankKeys = ['1–8', '9–16'].map((r, b) => key(`${r}<span class="sub">${L.canalesSub}</span>`, 470 + b * 104, 245, 100, 54, 'banco',
  () => { if (mode === 0) setView(0, b); }, () => (mode === 0 ? L.h.banco(r) : L.h.bancoOff), b === 1 ? '2' : ''));
const readKey = key(`${L.leer}<span class="sub">${L.leerSub}</span>`, 1110, 245, 200, 54, 'wide', () => leerPagina(), L.h.leer, 'L');
const portKey = key('', 1350, 245, 250, 54, 'oscura wide', () => abrirPuertos(), L.h.puerto);

// ---- the strips ----
const tirasBox = place(el('div'), 704, 626, 1320, 668);
tirasBox.id = 'tiras';
const strips = [];
const SCALE = [127, 100, 64, 32, 0];

function pintaPerilla(k, val, box, v, fmt) {
  box.classList.toggle('sin-valor', v === null);
  const x = v ?? 0;
  k.style.setProperty('--a', (x / 127 * 270 - 135) + 'deg'); k.style.setProperty('--v', v === null ? 0 : x / 127);
  val.textContent = fmt(v); box.setAttribute('aria-valuetext', fmt(v));
}
// A knob: get() / put(v) read and write the value (null = «—»), def is its factory value.
function perillaBase({ label, get, put, def, fmt = num, min = 0, centro = false, onSet, onSay, ayuda }) {
  const box = el('div', 'perilla'); box.tabIndex = 0; box.setAttribute('role', 'slider'); box.setAttribute('aria-label', label);
  const k = el('div', 'ring mk' + (centro ? ' centro' : ''));
  const val = el('span', 'fl val');
  box.append(k, el('span', 'fl p-nom', label), val);
  const paint = () => pintaPerilla(k, val, box, get(), fmt);
  const set = (v) => { put(clamp(v, min)); paint(); onSet(); };
  const now = () => get() ?? def;
  let y0 = 0, v0 = 0, moved = false;
  box.addEventListener('pointerdown', (e) => { y0 = e.clientY; v0 = now(); moved = false; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (box.hasPointerCapture(e.pointerId)) { moved = true; set(v0 + (y0 - e.clientY) * (e.shiftKey ? 0.2 : 0.8)); } });
  box.addEventListener('pointerup', () => { if (moved) onSay(false); });
  box.addEventListener('wheel', (e) => { e.preventDefault(); set(now() - Math.sign(e.deltaY)); }, { passive: false });
  box.addEventListener('keydown', (e) => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d) { e.preventDefault(); e.stopPropagation(); set(now() + d); } });
  box.addEventListener('dblclick', () => { set(def); onSay(true); });
  explain(box, ayuda);
  return { box, paint };
}

function perilla(i, label, field, helpText, fmt = num, opts = {}) {
  const P = () => PAGES[page].parts[i];
  return perillaBase({
    label, fmt, def: DEFAULTS[field], min: opts.min ?? 0, centro: opts.centro,
    get: () => state[P()][field], put: (v) => { state[P()][field] = v; },
    onSet: () => { sel = i; paintSel(); mandarCampo(P(), field); guardar(); setHelp(`${helpText(partName(P()))} → ${fmt(state[P()][field])}`); },
    onSay: (fab) => say((fab ? L.s.fabrica : L.s.valor)(label, partName(P()), fmt(state[P()][field]))),
    ayuda: () => L.h.perilla(helpText(partName(P())), fmt(DEFAULTS[field])),
  });
}

// A fader: the same for the strips and for the master volume.
function faderBase({ def, get, put, onSet, onSay, ayuda, guia = true, defMarca = def }) {
  const fader = el('div', 'fader');
  const escala = el('div', 'fader-escala');
  SCALE.forEach((v) => { const m = el('span', v === defMarca ? 'def' : '', String(v)); m.style.top = (100 - v / 127 * 100) + '%'; escala.append(m); });
  const pista = el('div', 'fader-pista'); pista.tabIndex = 0; pista.setAttribute('role', 'slider'); pista.setAttribute('aria-label', 'VOL');
  const tapa = el('div', 'fader-tapa');
  if (guia) { const g = el('div', 'fader-guia'); g.style.top = (100 - def / 127 * 100) + '%'; pista.append(g); }
  pista.append(tapa);
  const valor = el('span', 'fader-valor');
  fader.append(escala, pista, valor);
  const set = (v) => { put(clamp(v)); onSet(); };
  let y0 = 0, v0 = 0, moved = false;
  pista.addEventListener('pointerdown', (e) => {
    if (e.target !== tapa) { const r = pista.getBoundingClientRect(); set((1 - (e.clientY - r.top) / r.height) * 127); }
    y0 = e.clientY; v0 = get() ?? def; moved = e.target !== tapa; pista.setPointerCapture(e.pointerId);
  });
  pista.addEventListener('pointermove', (e) => { if (!pista.hasPointerCapture(e.pointerId)) return; moved = true;
    const h = pista.getBoundingClientRect().height || 1; set(v0 + (y0 - e.clientY) / h * 127 * (e.shiftKey ? 0.25 : 1)); });
  pista.addEventListener('pointerup', () => { if (moved) onSay(false); });
  pista.addEventListener('wheel', (e) => { e.preventDefault(); set((get() ?? def) - Math.sign(e.deltaY)); }, { passive: false });
  pista.addEventListener('keydown', (e) => { const d = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); set((get() ?? def) + d); } });
  pista.addEventListener('dblclick', () => { set(def); onSay(true); });
  explain(pista, ayuda);
  const paint = (v, texto) => { tapa.classList.toggle('sin-valor', v === null); tapa.style.top = (100 - (v ?? def) / 127 * 100) + '%'; valor.textContent = texto ?? num(v); };
  return { fader, paint };
}

for (let i = 0; i < 8; i++) {
  const P = () => PAGES[page].parts[i];
  const s = {};
  const tira = el('article', 'tira');
  tira.addEventListener('pointerdown', () => { if (sel !== i) { sel = i; paintSel(); } });
  const cab = el('div', 'tira-cab');
  s.num = el('span', 'fl tira-num'); s.rol = el('span', 'fl tira-rol');
  cab.append(s.num, s.rol);
  explain(cab, () => (P() < 16 ? L.h.cabCancion(P() + 1) : L.h.cabPatron(PATT[P() - 16], ROL[P() - 16].toLowerCase(), channelOf(P()))));
  s.voz = el('button', 'voz'); s.voz.type = 'button';
  s.voz.addEventListener('click', () => { sel = i; paintSel(); abrirVoces(i); });
  explain(s.voz, () => L.h.voz(partName(P()), vozTxt(state[P()].voz)));
  const efectos = el('div', 'perillas tres');
  const ks = [perilla(i, 'REV', 'rev', L.h.rev), perilla(i, 'CHO', 'cho', L.h.cho), perilla(i, 'VAR', 'vari', L.h.vari)];
  ks.forEach((k) => efectos.append(k.box));
  const fila = el('div', 'perillas dos');
  const pan = perilla(i, 'PAN', 'pan', L.h.pan, panText, { centro: true, min: 1 });
  const dry = perilla(i, 'DRY', 'dry', L.h.dry);
  fila.append(pan.box, dry.box);
  // the QY button (Song) or VOL 0 (Pattern)
  s.qy = el('button', 'fk qy'); s.qy.type = 'button';
  s.qy.addEventListener('click', () => {
    const p = P(), st = state[p]; sel = i;
    if (p < 16) {
      st.rcv = qyOn(p) ? RCV_OFF : p;
      mandarRcv(p);
      say(qyOn(p) ? L.s.qyOn(channelOf(p)) : L.s.qyOff(channelOf(p), sinte(p)));
    } else {
      if (!st.vol0) { st.vol0 = true; st.volAntes = st.vol; say(L.s.vol0On(PATT[p - 16], num(st.vol))); }
      else { st.vol0 = false; st.vol = st.volAntes ?? DEFAULTS.vol; st.volAntes = null; say(L.s.vol0Off(PATT[p - 16], st.vol)); }
      mandarCampo(p, 'vol');
    }
    guardar(); render();
  });
  explain(s.qy, () => (P() < 16 ? L.h.qy(channelOf(P()), sinte(P())) : L.h.vol0(PATT[P() - 16], sinte(P()))));
  // the fader
  const f = faderBase({
    def: DEFAULTS.vol,
    get: () => state[P()].vol,
    put: (v) => { const st = state[P()]; st.vol = v; st.vol0 = false; st.volAntes = null; },
    onSet: () => { sel = i; paintStrip(i); paintSel(); mandarCampo(P(), 'vol'); guardar(); setHelp(`${L.h.volumen(partName(P()))} → ${state[P()].vol}`); },
    onSay: (fab) => say(fab ? L.s.volFabrica(partName(P())) : L.s.volumen(partName(P()), state[P()].vol)),
    ayuda: () => L.h.fader(partName(P())),
  });
  s.fader = f;
  // the tape: by MIDI channel
  const zona = el('div', 'cinta-zona');
  const c = el('input', 'cinta'); c.type = 'text'; c.maxLength = 12; c.placeholder = L.cinta; c.spellcheck = false; c.autocomplete = 'off';
  c.style.setProperty('--giro', GIROS[i] + 'deg');
  zona.append(c);
  const fitCinta = () => { c.style.fontSize = ''; if (!c.value) return; for (let t = 1.2; t >= 0.6; t -= 0.05) { c.style.fontSize = t + 'cqw'; if (c.scrollWidth <= c.clientWidth) break; } };
  c.addEventListener('focus', () => { sel = i; paintSel(); });
  c.addEventListener('input', fitCinta);
  c.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') c.blur(); if (e.key === 'Escape') { c.value = sinte(P()); c.blur(); } });
  c.addEventListener('blur', () => {
    const t = c.value.trim().toUpperCase(), ch = channelOf(P());
    if (t === sinte(P())) { render(); return; }
    if (t) cintas[ch] = t; else delete cintas[ch];
    guardar(); render(); say(t ? L.s.cinta(ch, t) : L.s.cintaFuera(ch));
  });
  explain(c, () => L.h.cinta(channelOf(P())));

  tira.append(cab, s.voz, el('span', 'fl grp', L.efectos), efectos, el('span', 'fl grp', 'PAN · DRY'), fila, s.qy, f.fader, zona);
  tirasBox.append(tira);
  Object.assign(s, { tira, cinta: c, fitCinta, knobs: [...ks, pan, dry] });
  strips.push(s);
}

// ---- the effects of the whole QY100: type and return of reverb, chorus and variation ----
const colFx = place(el('div', 'maestro'), 1512, 626, 272, 668);
colFx.append(el('span', 'fl grp', L.maestro));
const pintaFx = [];
for (const fx of Object.keys(FX)) {
  const nombre = L.fx[fx];
  const lista = FX[fx][0];
  const bloque = el('div', 'fx');
  const tipo = el('button', 'voz'); tipo.type = 'button';
  tipo.addEventListener('click', () => abrirLista(L.tipoDe(nombre), lista.map((x) => x[0]), tipoIndex(fx), (ti) => {
    maestro[fx].tipo = [lista[ti][1], lista[ti][2]]; mandarFxTipo(fx); guardar(); pintaFx.forEach((f) => f()); say(L.s.fxTipo(nombre, lista[ti][0]));
  }));
  explain(tipo, () => L.h.fxTipo(nombre, tipoTxt(fx)) + (fx === 'vari' ? L.h.fxVari : ''));
  const ret = perillaBase({
    label: L.retorno, def: FX_RET_DEF,
    get: () => maestro[fx].ret, put: (v) => { maestro[fx].ret = v; },
    onSet: () => { mandarFxRet(fx); guardar(); setHelp(`${L.h.fxRet(nombre)} → ${maestro[fx].ret}`); },
    onSay: () => say(L.s.fxRet(nombre, maestro[fx].ret)),
    ayuda: () => L.h.perilla(L.h.fxRet(nombre), FX_RET_DEF),
  });
  const fila = el('div', 'fx-fila'); fila.append(tipo, ret.box);
  bloque.append(el('span', 'fl fx-nom', nombre), fila);
  colFx.append(bloque);
  pintaFx.push(() => { tipo.innerHTML = `<span>${esc(tipoTxt(fx))}</span><span>▾</span>`; ret.paint(); });
}
// the QY100's master volume (XG Master Volume): the desk's master
const general = el('div', 'fx general');
const gf = faderBase({
  def: GENERAL_DEF, guia: false,
  get: () => maestro.vol, put: (v) => { maestro.vol = v; },
  onSet: () => { pintaGeneral(); mandarGeneral(); guardar(); setHelp(`${L.h.general} → ${maestro.vol}`); },
  onSay: () => say(L.s.general(maestro.vol)),
  ayuda: () => `${L.h.general}. ${L.h.faderGeneral}`,
});
general.append(el('span', 'fl fx-nom', L.general), gf.fader);
colFx.append(general);
const pintaGeneral = () => gf.paint(maestro.vol);
pintaFx.push(pintaGeneral);

// ---- one panel over the top band: voices, effect types, MIDI ports ----
const voces = place(el('div'), 850, 150, 1560, 270);
voces.id = 'voces'; voces.hidden = true;
const cabecera = (titulo, ahora) => {
  const cab = el('div', 'cab', `<span>${titulo}</span><span class="grow"></span>${ahora !== undefined ? `<small>${L.ahora}: ${esc(ahora)}</small>` : ''}`);
  const cerrar = el('button', 'cerrar', L.cerrar); cerrar.type = 'button'; cerrar.addEventListener('click', cerrarVoces);
  cab.append(cerrar);
  return cab;
};
function abrirLista(titulo, items, actual, onPick) {
  voces.innerHTML = '';
  const lista = el('div', 'lista voces-l tipos');
  items.forEach((t, ti) => {
    const b = el('button', 'it' + (ti === actual ? ' on' : ''), esc(t)); b.type = 'button';
    b.addEventListener('click', () => { cerrarVoces(); onPick(ti); });
    lista.append(b);
  });
  const cols = el('div', 'cols uno'); cols.append(lista);
  voces.append(cabecera(titulo, actual >= 0 ? items[actual] : '—'), cols);
  voces.hidden = false;
  (lista.querySelector('.on') || lista.querySelector('button'))?.focus();
}
let vocesParte = 0, vocesFam = 0;
function abrirVoces(i) {
  vocesParte = PAGES[page].parts[i];
  vocesFam = V[vozIndex(state[vocesParte].voz)]?.[0] ?? 0;
  pintarVoces();
  voces.hidden = false;
  (voces.querySelector('.voces-l button.on') || voces.querySelector('.voces-l button'))?.focus();
}
function cerrarVoces() { voces.hidden = true; }
function pintarVoces() {
  const p = vocesParte, actual = vozIndex(state[p].voz);
  voces.innerHTML = '';
  const fams = el('div', 'lista');
  FAMILIAS.forEach((f, fi) => {
    const b = el('button', 'it' + (fi === vocesFam ? ' on' : ''), esc(f)); b.type = 'button';
    b.addEventListener('click', () => { vocesFam = fi; pintarVoces(); });
    fams.append(b);
  });
  const lista = el('div', 'lista voces-l');
  V.forEach((v, vi) => {
    if (v[0] !== vocesFam) return;
    const b = el('button', 'it' + (vi === actual ? ' on' : ''), esc(v[1])); b.type = 'button';
    b.addEventListener('click', () => {
      state[p].voz = [v[2], v[3], v[4]]; mandarVoz(p); guardar(); cerrarVoces(); render();
      say(L.s.voz(partName(p), v[1], v[2], v[3], v[4] + 1));
    });
    lista.append(b);
  });
  const cols = el('div', 'cols'); cols.append(fams, lista);
  voces.append(cabecera(`${esc(L.vozDe(partName(p)))} <small>· ${L.canal} ${channelOf(p)}${sinte(p) ? ' · ' + esc(L.cintaDe(sinte(p))) : ''}</small>`, vozTxt(state[p].voz)), cols);
}
voces.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrarVoces(); } });

// ---- MIDI ports: chosen by name, remembered, reopened when they come back ----
function abrirPuertos() {
  voces.innerHTML = '';
  const columna = (titulo, lista, actual, conNinguna, elegir) => {
    const c = el('div', 'lista');
    c.append(el('div', 'tit', titulo));
    const nombres = lista.map((p) => p.name);
    if (actual && !nombres.includes(actual)) nombres.push(actual);   // remembered, not plugged in
    if (conNinguna || !nombres.length) nombres.unshift('');
    for (const n of nombres) {
      const ausente = n && !lista.some((p) => p.name === n);
      const b = el('button', 'it' + (n === actual ? ' on' : ''), n ? esc(n) + (ausente ? ' ✕' : '') : L.sinEntrada); b.type = 'button';
      b.addEventListener('click', () => { elegir(n); abrirPuertos(); });
      c.append(b);
    }
    return c;
  };
  const cols = el('div', 'cols puertos');
  cols.append(
    columna(L.salida, link.listOutputs(), puertos.salida, true, (n) => { puertos.salida = n; abrirSalida(); guardar(); say(n ? L.s.salida(n) : L.s.sinSalidaElegida); }),
    columna(L.entrada, link.listInputs(), puertos.entrada, true, (n) => { puertos.entrada = n; abrirEntrada(); guardar(); say(n ? L.s.entrada(n) : L.s.sinEntradaElegida); }),
  );
  voces.append(cabecera(L.puertoMidi.replace(' ▾', '')), cols);
  voces.hidden = false;
  voces.querySelector('.it.on, .it')?.focus();
}
function abrirSalida() {
  const p = link.listOutputs().find((o) => o.name === puertos.salida);
  link.output = p || null;
  pintaPuerto();
}
function abrirEntrada() {
  const p = link.listInputs().find((o) => o.name === puertos.entrada);
  if (p) link.selectInput(p.id);
  else { if (link.input) link.input.onmidimessage = null; link.input = null; }
}
function pintaPuerto() {
  ledPuerto.className = 'fled ' + (link.output ? 'green on' : 'ambar');
  const sub = link.output ? link.output.name : puertos.salida ? L.noEsta(puertos.salida) : L.ninguno;
  portKey.innerHTML = `${L.puertoMidi}<span class="sub nombre-puerto">${esc(sub)}</span>`;
}
let midiError = '';
try {
  await link.requestAccess();
  link.onDevicesChanged = () => {
    const antes = link.output?.name;
    abrirSalida(); if (!link.input || !link.listInputs().includes(link.input)) abrirEntrada();
    if (!voces.hidden && voces.querySelector('.puertos')) abrirPuertos();
    if (antes !== link.output?.name) say(link.output ? L.s.salida(link.output.name) : L.s.sinSalidaElegida);
  };
  abrirSalida(); abrirEntrada();
} catch (e) { midiError = e.message || String(e); }
pintaPuerto();

// ---- painting ----
let last = midiError ? L.s.sinMidi(midiError) : conocidos() ? L.inicioMezcla(conocidos()) : L.inicioSinPuerto;
function setHelp(t) { help = t; if (t) primera = false; drawLcd(); }
function say(t) { last = t; primera = false; drawLcd(); }
function drawLcd() {
  const pg = PAGES[page], p = pg.parts[sel], st = state[p];
  const quien = p < 16 ? `CH ${p + 1}` : `${PATT[p - 16]} · CH ${channelOf(p)}`;
  const estado = p < 16 ? (qyOn(p) ? L.qySuena : L.qyCallado) : (st.vol0 ? 'VOL 0' : `vol ${num(st.vol)}`);
  const ctx = `${quien} · ${vozTxt(st.voz).replace(/^\d+ /, '')}${sinte(p) ? ' · ' + sinte(p) : ''} · ${estado}`;
  document.getElementById('mixlcd').innerHTML =
    `<div class="top"><span class="pill">QY100</span><span>${pg.lcd}</span><span>›</span><span class="ctx">${esc(ctx)}</span></div>`
    + `<div class="help">${esc(help || (primera ? L.bienvenida : ''))}</div>`
    + `<div class="last">${esc(last)}</div>`;
  const h = document.querySelector('#mixlcd .help');
  for (let t = 1.2; t >= 0.7; t -= 0.05) { h.style.fontSize = t + 'cqw'; if (h.scrollHeight <= h.clientHeight + 1) break; }
}
function paintStrip(i) {
  const p = PAGES[page].parts[i], s = strips[i], st = state[p];
  s.num.textContent = p < 16 ? String(p + 1) : PATT[p - 16];
  s.rol.textContent = p < 16 ? '' : ROL[p - 16];
  s.voz.innerHTML = `<span>${esc(vozTxt(st.voz).replace(/^\d+ /, ''))}</span><span>▾</span>`;
  s.voz.title = vozTxt(st.voz);
  encoge(s.voz.firstChild, 0.88, 0.55);
  encoge(s.rol, 0.78, 0.5, s.rol.parentElement);
  if (p >= 16 && st.vol0) s.fader.paint(0, `0 (${num(st.vol)})`);
  else s.fader.paint(st.vol);
  s.knobs.forEach((k) => k.paint());
  if (p < 16) {
    s.qy.className = 'fk qy' + (qyOn(p) ? ' on' : '');
    s.qy.innerHTML = `<i></i>QY<span class="sub">${st.rcv === null ? '—' : qyOn(p) ? L.suena : L.callado}</span>`;
  } else {
    s.qy.className = 'fk qy vol0' + (st.vol0 ? ' on' : '');
    s.qy.innerHTML = st.vol0 ? 'VOL 0 ⚠' : 'VOL 0';
  }
  s.tira.classList.toggle('callada', p < 16 ? !qyOn(p) : st.vol0);
  if (document.activeElement !== s.cinta) { s.cinta.value = sinte(p); s.fitCinta(); }
}
// shrinks a text's lettering until it fits whole (never cut with «…»)
function encoge(e, max, min, caja) {
  if (!e) return;
  e.style.fontSize = '';
  const cabe = () => (caja ? e.getBoundingClientRect().right <= caja.getBoundingClientRect().right + 0.5 : e.scrollWidth <= e.clientWidth + 1);
  for (let t = max; t >= min; t -= 0.03) { e.style.setProperty('font-size', t + 'cqw', 'important'); if (cabe()) break; }
}
function paintSel() { strips.forEach((s, i) => s.tira.classList.toggle('sel', i === sel)); drawLcd(); }
function render() {
  modeKeys.forEach((k, i) => k.classList.toggle('on', i === mode));
  bankKeys.forEach((k, b) => { k.classList.toggle('on', mode === 0 && b === bank); k.classList.toggle('apagada', mode === 1); });
  strips.forEach((_, i) => paintStrip(i));
  paintSel();
}
// shortcuts: 1-3 pages, E send all, L read
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || !voces.hidden) return;
  const k = e.key.toLowerCase();
  if (k === '1') setView(0, 0); else if (k === '2') setView(0, 1); else if (k === '3') setView(1);
  else if (k === 'e') sendKey.click();
  else if (k === 'l') { flashKey(readKey); readKey.click(); }
});
await document.fonts.ready;
pintaFx.forEach((f) => f());
render();

// For the scripted checks (pruebas/): read-only views of what the page holds.
window.__mixer = { voces: V.length, registro, state, maestro, puertos, colaVacia, link };
