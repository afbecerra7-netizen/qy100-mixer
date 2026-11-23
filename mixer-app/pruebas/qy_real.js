// On the REAL QY100, only when its owner asks for it in that session: reads Song parts 1–8 and the
// effects, changes part 1 (REV, VOL, PAN, QY, voice) and the three returns and master volume, reads
// back to see whether the device took each one, then sends back exactly what it had and reads again.
// Effect TYPES are never touched: rewriting a type resets that effect's parameters (XG).
//   QY_MIXER_DATOS=$(mktemp -d) QY_MIXER_PRUEBA=pruebas/qy_real.js npx electron .
// It needs a port the QY100 answers XG reads on: MIDI. Over TO HOST it stops at the first read
// ([M] 2026-11-23: there the QY100 takes XG changes but answers no XG request). Set PUERTO below.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
(async () => {
  const PUERTO = 'L6max MIDI I/O';   // the Zoom; «QY100 TO HOST» cannot read
  const M = window.__mixer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const boton = (txt) => $$('button').find((b) => b.textContent.trim().startsWith(txt));
  const rueda = (e, n) => { for (let k = 0; k < Math.abs(n); k++) e.dispatchEvent(new WheelEvent('wheel', { deltaY: n > 0 ? -1 : 1, bubbles: true, cancelable: true })); };
  const tecla = (e, key, n = 1) => { for (let k = 0; k < n; k++) e.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); };
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const lcd = () => document.getElementById('mixlcd').innerText.split('\n').at(-1);
  async function leer() {
    boton('LEER DEL QY').click(); await sleep(200);
    while (boton('LEYENDO')) await sleep(100);
    return { partes: copia(M.state.slice(0, 8)), maestro: copia(M.maestro), pantalla: lcd() };
  }

  boton('PUERTO MIDI').click(); await sleep(100);
  $$('.it', $$('#voces .puertos .lista')[0]).find((b) => b.textContent === PUERTO)?.click(); await sleep(100);
  $$('.it', $$('#voces .puertos .lista')[1]).find((b) => b.textContent === PUERTO)?.click(); await sleep(100);
  boton('CERRAR').click();
  if (!M.link.output || !M.link.input) return { error: `no está el puerto ${PUERTO}` };
  boton('CANCIÓN').click(); boton('1–8').click(); await sleep(50);

  const antes = await leer();
  const p1 = antes.partes[0], mx = antes.maestro;
  if (p1.rev === null || p1.vol === null) return { error: 'el QY100 no contestó', antes };

  // the changes, made through the controls
  const t = $$('#tiras .tira')[0], per = $$('.perilla', t), fx = document.querySelector('.maestro');
  const d = (v, n) => (v + n > 127 || v + n < 1 ? -n : n);
  const dRev = d(p1.rev, 5), dPan = d(p1.pan, 6), dVol = p1.vol >= 10 ? -10 : 10;
  rueda(per[0], dRev);
  rueda(per[3], dPan);
  tecla($$('.fader-pista', t)[0], dVol < 0 ? 'PageDown' : 'PageUp');
  $$('.fk.qy', t)[0].click();
  // a voice from the Piano family other than the current one
  $$('.voz', t)[0].click(); await sleep(50);
  $$('#voces .cols > .lista:first-child .it')[0].click(); await sleep(50);
  const vozNueva = $$('#voces .voces-l .it').find((b) => !b.classList.contains('on'));
  const vozNombre = vozNueva.textContent;
  vozNueva.click();
  const dRet = ['rev', 'cho', 'vari'].map((f) => (mx[f].ret === null ? 0 : d(mx[f].ret, 5)));
  dRet.forEach((n, k) => n && rueda($$('.perilla', fx)[k], n));
  const dGen = mx.vol !== null && mx.vol >= 5 ? -5 : 0;
  if (dGen) tecla($$('.fader-pista', fx)[0], 'ArrowDown', 5);
  const puesto = { partes: copia(M.state.slice(0, 8)), maestro: copia(M.maestro) };
  await sleep(50); await M.colaVacia(); await sleep(300);

  const despues = await leer();
  const cmp = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const q = despues.partes[0], w = puesto.partes[0];
  const tomo = {
    REV: [w.rev, q.rev], PAN: [w.pan, q.pan], VOL: [w.vol, q.vol], 'QY (rcv)': [w.rcv, q.rcv], [`voz ${vozNombre}`]: [w.voz, q.voz],
    'retorno reverb': [puesto.maestro.rev.ret, despues.maestro.rev.ret], 'retorno chorus': [puesto.maestro.cho.ret, despues.maestro.cho.ret],
    'retorno variación': [puesto.maestro.vari.ret, despues.maestro.vari.ret], general: [puesto.maestro.vol, despues.maestro.vol],
  };

  // back to what it had: the snapshot, sent with SEND ALL (types left out)
  for (let p = 0; p < 8; p++) Object.assign(M.state[p], copia(antes.partes[p]));
  for (const f of ['rev', 'cho', 'vari']) { M.maestro[f].ret = mx[f].ret; M.maestro[f].tipo = null; }
  M.maestro.vol = mx.vol;
  document.querySelector('.fk.round.azul').click();
  await sleep(100); await M.colaVacia(); await sleep(300);
  const final = await leer();
  const restaurado = cmp(final.partes, antes.partes) && ['rev', 'cho', 'vari'].every((f) => final.maestro[f].ret === mx[f].ret && cmp(final.maestro[f].tipo, mx[f].tipo)) && final.maestro.vol === mx.vol;

  return {
    leido: { pantalla: antes.pantalla, partes: antes.partes.map((s, i) => `${i + 1}: voz ${s.voz?.join('/')} vol ${s.vol} pan ${s.pan} rev ${s.rev} cho ${s.cho} var ${s.vari} dry ${s.dry} rcv ${s.rcv}`), maestro: mx },
    tomo: Object.fromEntries(Object.entries(tomo).map(([k, [puso, leyo]]) => [k, `${cmp(puso, leyo) ? 'OK ' : 'NO '} puso ${JSON.stringify(puso)} leyó ${JSON.stringify(leyo)}`])),
    restaurado, final: final.pantalla, enviados: M.registro.filter((l) => l.includes(' > ')).length, recibidos: M.registro.filter((l) => l.includes(' < ')).length,
  };
})();
