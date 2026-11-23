// QY100 Mixer: the TO HOST cable, over Web Serial, shaped like the console's MidiLink.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
//
// The QY100's TO HOST connector speaks plain MIDI bytes over a serial line: 38,400 baud on
// HOST SELECT = PC-2, 31,250 on PC-1, 8N1 ([M], docs/qy100-protocolo.md in the Yamaha repo). A
// USB-serial adapter (an FTDI) is enough. This opens it directly, with no puente_host.py and no
// virtual MIDI port in between; while the mixer has it, nothing else can use the cable.
//
// [M] 2026-11-23 on PC-2: over TO HOST the QY100 takes XG Parameter Changes but answers no XG
// request, so this link sends; replies (its own sequencer's, model 5F) are still assembled.

export const VELOCIDADES = { 'PC-2': 38400, 'PC-1': 31250 };

export class SerieLink {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.modo = '';
    this.onMessage = null;   // (Uint8Array) => void, one whole message each (SysEx or realtime)
    this.onClose = null;     // () => void, when the cable goes away
    this.sysex = null;
  }

  get disponible() { return 'serial' in navigator; }
  get abierto() { return !!this.writer; }

  // conGesto: called from a click, so the chooser may be asked; otherwise only ports already
  // granted (at start-up, to reopen the remembered cable).
  async abrir(modo, conGesto) {
    await this.cerrar();
    const baudRate = VELOCIDADES[modo];
    if (!baudRate) throw new Error(`HOST SELECT desconocido: ${modo}`);
    const puertos = await navigator.serial.getPorts();
    let port = puertos.find((p) => p.getInfo().usbVendorId) || puertos[0];
    if (!port && conGesto) port = await navigator.serial.requestPort();
    if (!port) throw new Error('no hay cable USB-serie');
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', bufferSize: 8192 });
    this.port = port;
    this.modo = modo;
    this.writer = port.writable.getWriter();
    this.leer();
  }

  async leer() {
    const port = this.port;
    while (port === this.port && port.readable) {
      this.reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          for (const b of value) this.byte(b);
        }
      } catch { /* the cable went away, or cerrar() cancelled the read */ }
      finally { try { this.reader.releaseLock(); } catch { /* already released */ } }
      if (!this.writer) return;   // closed on purpose
      break;
    }
    if (port === this.port) { await this.cerrar(); this.onClose?.(); }
  }

  // MIDI bytes into whole messages: SysEx from F0 to F7; realtime (F8-FF) passes on its own,
  // even in the middle of a SysEx; anything else is not needed by the mixer and is dropped.
  byte(b) {
    if (b >= 0xf8) { this.onMessage?.(new Uint8Array([b])); return; }
    if (b === 0xf0) { this.sysex = [b]; return; }
    if (b === 0xf7) { if (this.sysex) { this.sysex.push(b); this.onMessage?.(new Uint8Array(this.sysex)); } this.sysex = null; return; }
    if (b & 0x80) { this.sysex = null; return; }   // a status byte ends any SysEx in progress
    if (this.sysex) this.sysex.push(b);
  }

  async send(bytes) {
    if (!this.writer) throw new Error('el cable TO HOST no está abierto');
    await this.writer.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  async cerrar() {
    const { port, reader, writer } = this;
    this.writer = null;
    this.port = null;
    this.sysex = null;
    try { await reader?.cancel(); } catch { /* nothing to cancel */ }
    try { writer?.releaseLock(); } catch { /* not locked */ }
    try { await port?.close(); } catch { /* already closed */ }
  }
}
