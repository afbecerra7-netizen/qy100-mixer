// On the REAL QY100, only when its owner asks for it in that session, with HOST SELECT = PC-2
// and the TO HOST cable free (no puente_host.py running): opens the cable from the app and checks
// both directions without changing the mix.
//   out:  XG Display Data, a line of text on the QY100's screen (look at it);
//   back: the QY100's own `dump setup` (model 5F, inside bulk mode ON/OFF, as syx.py asks for it),
//         which it does answer over TO HOST: the reply must arrive whole, with a valid checksum;
//   READ: must say that over TO HOST the QY100 answers no XG read.
//   QY_MIXER_DATOS=$(mktemp -d) QY_MIXER_PRUEBA=pruebas/to_host.js npx electron .
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
(async () => {
  const M = window.__mixer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lcd = () => document.getElementById('mixlcd').innerText.split('\n').at(-1);
  await M.elegirSerie('PC-2', true);
  const abierto = M.serie.abierto, alAbrir = lcd();
  if (!abierto) return { abierto, alAbrir };

  const txt = 'QY100 MIXER     CABLE DIRECTO   ';
  await M.serie.send([0xf0, 0x43, 0x10, 0x4c, 0x06, 0x00, 0x00, ...[...txt].map((c) => c.charCodeAt(0)), 0xf7]);

  const llegan = [];
  const antes = M.serie.onMessage;
  M.serie.onMessage = (b) => { if (b[0] === 0xf0) llegan.push(b); antes(b); };
  await M.serie.send([0xf0, 0x43, 0x10, 0x5f, 0x10, 0x00, 0x00, 0x01, 0xf7]); await sleep(150);   // bulk mode ON
  await M.serie.send([0xf0, 0x43, 0x20, 0x5f, 0x13, 0x00, 0x00, 0xf7]);                            // setup, please
  for (let t = 0; t < 30 && !llegan.some((b) => b[3] === 0x5f && (b[2] & 0xf0) === 0x00); t++) await sleep(100);
  await M.serie.send([0xf0, 0x43, 0x10, 0x5f, 0x10, 0x00, 0x00, 0x00, 0xf7]); await sleep(200);   // bulk mode OFF
  M.serie.onMessage = antes;
  const dump = llegan.find((b) => b[3] === 0x5f && (b[2] & 0xf0) === 0x00);
  const n = dump ? (dump[4] << 7) | dump[5] : 0;
  const suma = dump ? Array.from(dump.slice(4, dump.length - 1)).reduce((a, x) => a + x, 0) & 0x7f : null;

  [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('LEER DEL QY')).click();
  await sleep(300);
  while ([...document.querySelectorAll('button')].some((b) => b.textContent.startsWith('LEYENDO'))) await sleep(100);
  const trasLeer = lcd();
  await M.elegirSerie('', false);

  return {
    abierto, alAbrir, texto: txt.trim().replace(/\s+/g, ' / '),
    vuelta: dump ? { direccion: Array.from(dump.slice(6, 9), (x) => x.toString(16).padStart(2, '0')).join(' '), bytes: dump.length, datos: n, checksum: suma === 0 ? 'ok' : 'MAL' } : 'nada',
    otrosMensajes: llegan.length - (dump ? 1 : 0), trasLeer, cerrado: !M.serie.abierto,
  };
})();
