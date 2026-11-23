# QY100 Mixer — the Mac app

A one-screen mixer for the Yamaha QY100's internal parts, over XG SysEx. The interface is the
mockup approved on 2026-11-22 (`../maqueta/index.html`), now talking to the device.
GPL-3.0-or-later, like the console it comes from.

```bash
npm install
npm run app            # opens the window
npm run package:mac    # leaves "release/QY100 Mixer-darwin-arm64/QY100 Mixer.app"
npm run icono          # after editing assets/icono/qy100-mixer.svg (needs rsvg-convert)
```

- `app/` — the page: `index.html` (the mockup's look), `mixer.js` (everything it does),
  `qy-look.css` (the QYΩ emulator's faceplate, by Doffu), `voces.json` (530 voices), `fuentes/`.
  `app/consola/` is filled by `scripts/copiar-consola.cjs` with the console's `js/sysex.js` and
  `js/midi.js`, unchanged; it is not committed.
- `electron/` — the window (transparent, frameless, 1700:1000, dragged by the faceplate) and the
  preload that saves the state to `~/Library/Application Support/qy100-mixer/estado.json` and
  logs every message sent and received to `midi.log` beside it.

## What it sends

All XG Parameter Change, device 1: `F0 43 10 4C aa bb cc dd F7`.

| Control | Address | Data |
| --- | --- | --- |
| Voice | `08 pp 01` / `02` / `03` | bank MSB, bank LSB, program, in that order |
| QY button (Song) | `08 pp 04` | `7F` silent, `pp` plays again |
| Volume · VOL 0 (Pattern) | `08 pp 0B` | 0–127 · `00`, then the kept value |
| PAN · DRY · CHO · REV · VAR | `08 pp 0E` · `11` · `12` · `13` · `14` | 0–127 (pan 1–127) |
| Reverb · chorus · variation type | `02 01 00` · `20` · `40` | MSB LSB |
| Their returns | `02 01 0C` · `2C` · `56` | 0–127 — untried on the device |
| Master volume | `00 00 04` | 0–127 — untried on the device |

`pp` = part: 00–0F Song parts 1–16, 10–17 Pattern tracks D1 D2 PC BA C1–C4.
One queue, never more than ~60 messages a second; a value still waiting is replaced by the
newest one for the same control. SEND ALL sends only what the app knows (read or set), 16 ms apart.
READ asks for each part's block (`F0 43 20 4C 08 pp 00 F7`), the three effect blocks and the
system block, and falls back to one XG Parameter Request (`F0 43 30 4C …`) per value.

**Over TO HOST it sends but cannot read** `[M]` (2026-11-23, `HOST SELECT = PC-2`, `puente_host.py`
at 38,400): XG Parameter Changes get in (XG Display Data showed on the QY100's screen), but no XG
request is answered — dump or parameter, with or without bulk mode — while the QY100's own
sequencer request (`dump setup`, model `5F`) answers inside bulk mode. READ says so. Reading
needs MIDI: the console reads XG over MIDI. And **one bridge per cable**: two `puente_host.py`
on the same serial port share out the incoming bytes, and replies go missing.

## Checking it without a device

`pruebas/qy_falso.py` is a pretend QY100 on two virtual CoreMIDI ports; `pruebas/recorrido.js`
drives every control through its own handlers and checks the bytes.

```bash
~/Proyectos/Yamaha/qy100-syx/.venv/bin/python pruebas/qy_falso.py &      # needs mido + python-rtmidi
QY_MIXER_DATOS=$(mktemp -d) QY_MIXER_PRUEBA=pruebas/recorrido.js npx electron .
```

It prints `PRUEBA {…"pasan":31,"de":31…}`. Run the pretend QY with `--sin-bloques` to try the
one-parameter-at-a-time read, and with `--mudo` plus `pruebas/reabrir.js` (same `QY_MIXER_DATOS`)
to check that the mix and the ports come back and that a silent device is reported.
