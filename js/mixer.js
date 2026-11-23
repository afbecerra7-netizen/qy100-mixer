// QY70/QY100 Web Console - Mixer
// Copyright (C) 2026 Doffu <https://qy100.doffu.net/> and Felipe Becerra
// Licensed under the GNU General Public License v3.0 or later. See LICENSE.

// A channel-strip view of the Multi Part block: eight strips at a time, the
// way the QY100 shows its own tracks - Song parts 1-8, Song parts 9-16, and
// the eight Pattern-mode parts (17-24: D1 D2 PC BA C1-C4).
//
// Every write is Part-addressed SysEx (forceSysex), never a channel message:
// a CC sent on a channel can land on whichever track is highlighted on the
// QY rather than on the part it was meant for (see params.js).
//
// It shares paramState with the Parameters panel, so a value moved here shows
// there and the other way round.
//
// Measured on a QY100 (2026-11-22), and why MUTE is not a volume:
// - Setting a part's Volume to 0 also silenced the external synth on that
//   channel: the QY passed the change on as CC 7, and the synth (a Minitaur)
//   reads CC 7 as its output level.
// - Rcv Channel = Off (127) stops the part answering incoming MIDI on that
//   channel, so notes for an external synth no longer double on the QY, and
//   the synth is untouched. It does not survive a power cycle: SEND ALL after
//   switching on.
// So on Song parts, MUTE sets Rcv Channel to Off and back. On Pattern parts,
// which are played by the QY's own sequencer and not by incoming MIDI, there
// is nothing to stop receiving, so MUTE there is Volume 0 - and it may reach
// an external synth as CC 7, which the strip says.

import { sendParam, expandRows } from './params.js';
import { createKnob } from './knob.js';

const PAGES = [
  { label: 'Song 1-8', parts: [0, 1, 2, 3, 4, 5, 6, 7] },
  { label: 'Song 9-16', parts: [8, 9, 10, 11, 12, 13, 14, 15] },
  { label: 'Pattern', parts: [16, 17, 18, 19, 20, 21, 22, 23] },
];
const PATTERN_LABELS = ['D1', 'D2', 'PC', 'BA', 'C1', 'C2', 'C3', 'C4'];

// The knobs above the fader, top to bottom.
const KNOBS = [
  ['Pan', 'Pan'],
  ['Reverb Send', 'Rev'],
  ['Chorus Send', 'Cho'],
  ['Variation Send', 'Var'],
  ['Dry Level', 'Dry'],
];
const SEND_GAP_MS = 15; // between messages in SEND ALL: some interfaces garble back-to-back SysEx
const RCV_OFF = 127;

// What is plugged into each MIDI channel. Only a label, editable on the strip
// and remembered in this browser. These defaults are one rig's; clear them.
// Pattern tracks reach the same synths through PATT OUT CH 1~8 (D1 -> 1 ... C4 -> 8).
const DEFAULT_NAMES = {
  0: 'DrumBrute', 2: 'Riddim', 3: 'Minitaur', 4: 'Volca Keys', 5: 'lemondrop',
  16: 'DrumBrute', 18: 'Riddim', 19: 'Minitaur', 20: 'Volca Keys', 21: 'lemondrop',
};
const NAMES_KEY = 'qyMixerNames';
const PAGE_KEY = 'qyMixerPage';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadNames() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAMES_KEY) || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch { /* private window: defaults */ }
  return { ...DEFAULT_NAMES };
}

function saveNames(names) {
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch { /* not kept */ }
}

// deps, from app.js: link, getSection() -> parameters.multiPart,
// getStore(part) -> paramState's object for that part, onPartChanged(part)
// (refresh the Parameters panel), pull(parts) -> Promise<{got, missing}|null>,
// setStatus(text).
export function initMixer(root, deps) {
  const names = loadNames();
  let page = 0;
  try { page = Math.min(PAGES.length - 1, Math.max(0, Number(localStorage.getItem(PAGE_KEY)) || 0)); } catch { /* 0 */ }

  const rowsByName = () => {
    const rows = {};
    for (const r of expandRows(deps.getSection().params)) rows[r.name] = r;
    return rows;
  };

  function valueOf(part, name) {
    const store = deps.getStore(part);
    if (store[name] !== undefined) return store[name];
    if (name === 'Rcv Channel') return part < 16 ? part : RCV_OFF;
    const row = rowsByName()[name];
    return row ? row.default ?? 0 : 0;
  }

  function send(part, name, value) {
    const row = rowsByName()[name];
    if (!row) return;
    deps.getStore(part)[name] = value;
    try {
      sendParam(deps.link, 0, deps.getSection(), { part, forceSysex: true }, row, value);
    } catch (err) {
      deps.setStatus(`Error: ${err.message}`);
    }
    deps.onPartChanged(part);
  }

  // A pattern part's Volume before MUTE took it to 0, to put it back.
  const volumeBeforeMute = {};

  function isMuted(part) {
    return part < 16 ? valueOf(part, 'Rcv Channel') === RCV_OFF
      : volumeBeforeMute[part] !== undefined;
  }

  function setMute(part, on) {
    if (part < 16) {
      send(part, 'Rcv Channel', on ? RCV_OFF : part);
    } else if (on) {
      volumeBeforeMute[part] = valueOf(part, 'Volume');
      send(part, 'Volume', 0);
    } else {
      send(part, 'Volume', volumeBeforeMute[part] ?? 100);
      delete volumeBeforeMute[part];
    }
  }

  function strip(part) {
    const el = document.createElement('div');
    el.className = 'mixer-strip';
    el.dataset.part = part;

    const head = document.createElement('div');
    head.className = 'mixer-head';
    const num = document.createElement('span');
    num.className = 'mixer-part';
    num.textContent = part < 16 ? `${part + 1}` : PATTERN_LABELS[part - 16];
    num.title = part < 16 ? `Part ${part + 1}, MIDI channel ${part + 1}` : `Part ${part + 1}, pattern track ${PATTERN_LABELS[part - 16]}`;
    const name = document.createElement('input');
    name.className = 'mixer-name';
    name.type = 'text';
    name.maxLength = 12;
    name.placeholder = part < 16 ? 'QY100' : '';
    name.value = names[part] || '';
    name.title = 'What is on this channel. Only a label, kept in this browser.';
    name.addEventListener('change', () => {
      names[part] = name.value.trim();
      if (!names[part]) delete names[part];
      saveNames(names);
    });
    head.append(num, name);
    el.appendChild(head);

    for (const [param, caption] of KNOBS) {
      const row = rowsByName()[param];
      const knob = createKnob({
        min: row?.dataMin ?? 0,
        max: row?.dataMax ?? 127,
        value: valueOf(part, param),
        resetValue: row?.default,
        caption,
        continuousSend: true,
        onChange: (v) => send(part, param, Math.round(v)),
      });
      knob.element.classList.add('mixer-knob');
      // The strip hides the knob's Reset button to stay narrow: double-click the dial instead.
      if (row?.default !== undefined) {
        knob.element.querySelector('.knob-dial')?.addEventListener('dblclick', () => knob.setValue(row.default, true));
      }
      el.appendChild(knob.element);
    }

    const fader = document.createElement('input');
    fader.type = 'range';
    fader.className = 'mixer-fader';
    fader.min = 0;
    fader.max = 127;
    fader.value = valueOf(part, 'Volume');
    fader.setAttribute('aria-label', `Volume, part ${part + 1}`);
    const readout = document.createElement('span');
    readout.className = 'mixer-readout';
    readout.textContent = fader.value;
    let lastSent = 0;
    fader.addEventListener('input', () => {
      readout.textContent = fader.value;
      const now = performance.now();
      if (now - lastSent >= 20) { lastSent = now; send(part, 'Volume', Number(fader.value)); }
    });
    fader.addEventListener('change', () => send(part, 'Volume', Number(fader.value)));
    el.append(fader, readout);

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'mixer-mute';
    mute.textContent = 'MUTE';
    mute.title = part < 16
      ? 'Rcv Channel Off: the QY stops playing what comes in on this channel; the external synth keeps playing. Lost at power off - press SEND ALL.'
      : 'Volume 0. This part is played by the QY\'s own sequencer; the QY may pass Volume on as CC 7 and turn an external synth down too.';
    const paint = () => {
      mute.classList.toggle('on', isMuted(part));
      mute.setAttribute('aria-pressed', String(isMuted(part)));
    };
    mute.addEventListener('click', () => {
      setMute(part, !isMuted(part));
      paint();
      if (part >= 16) { fader.value = valueOf(part, 'Volume'); readout.textContent = fader.value; }
    });
    paint();
    el.appendChild(mute);
    return el;
  }

  const bar = document.createElement('div');
  bar.className = 'mixer-bar';
  const pageBtns = PAGES.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mixer-page';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      page = i;
      try { localStorage.setItem(PAGE_KEY, String(i)); } catch { /* not kept */ }
      render();
    });
    return b;
  });
  const sendAll = document.createElement('button');
  sendAll.type = 'button';
  sendAll.textContent = 'Send All';
  sendAll.title = 'Send every strip on every page to the QY: volume, pan, sends and mute. The QY forgets Rcv Channel at power off, and each pattern brings its own mixer.';
  const pullBtn = document.createElement('button');
  pullBtn.type = 'button';
  pullBtn.textContent = 'Pull Page';
  pullBtn.title = 'Read these eight parts from the QY. Needs MIDI In as well as Out.';
  const spacer = document.createElement('span');
  spacer.className = 'mixer-spacer';
  bar.append(...pageBtns, spacer, pullBtn, sendAll);

  const strips = document.createElement('div');
  strips.className = 'mixer-strips';
  root.append(bar, strips);

  function render() {
    pageBtns.forEach((b, i) => b.classList.toggle('active', i === page));
    strips.replaceChildren(...PAGES[page].parts.map(strip));
  }

  sendAll.addEventListener('click', async () => {
    sendAll.disabled = true;
    let n = 0;
    try {
      for (const p of PAGES) {
        for (const part of p.parts) {
          for (const name of ['Volume', 'Pan', 'Reverb Send', 'Chorus Send', 'Variation Send', 'Dry Level']) {
            send(part, name, valueOf(part, name));
            n++;
            await sleep(SEND_GAP_MS);
          }
          if (part < 16) {
            send(part, 'Rcv Channel', valueOf(part, 'Rcv Channel'));
            n++;
            await sleep(SEND_GAP_MS);
          }
        }
      }
      deps.setStatus(`Mixer: sent ${n} values to the QY.`);
    } finally {
      sendAll.disabled = false;
    }
  });

  pullBtn.addEventListener('click', async () => {
    pullBtn.disabled = true;
    try {
      const result = await deps.pull(PAGES[page].parts);
      if (result) deps.setStatus(`Mixer: pulled ${PAGES[page].label} (${result.got} values${result.missing ? `, ${result.missing} with no reply` : ''}).`);
      render();
    } finally {
      pullBtn.disabled = false;
    }
  });

  render();
  return { render };
}
