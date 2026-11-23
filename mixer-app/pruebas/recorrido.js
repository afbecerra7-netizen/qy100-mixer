// Drives every control of the mixer through its own event handlers and checks the SysEx that
// comes out. Run with the pretend QY100 (qy_falso.py) up:
//   QY_MIXER_DATOS=$(mktemp -d) QY_MIXER_PRUEBA=pruebas/recorrido.js npx electron .
// (a fresh data folder: the checks expect every value to start at «—»)
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
(async () => {
  const M = window.__mixer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hecho = async () => { await sleep(40); await M.colaVacia(); await sleep(40); };
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const boton = (txt, r = document) => $$('button', r).find((b) => b.textContent.trim().startsWith(txt));
  const rueda = (e, n = 1) => { for (let k = 0; k < Math.abs(n); k++) e.dispatchEvent(new WheelEvent('wheel', { deltaY: n > 0 ? -1 : 1, bubbles: true, cancelable: true })); };
  const tecla = (e, key) => e.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const casos = [];
  const marca = () => M.registro.length;
  const salidas = (desde) => M.registro.slice(desde).filter((l) => l.includes(' > ')).map((l) => l.split(' > ')[1]);
  async function caso(nombre, accion, esperado) {
    const i = marca();
    await accion();
    await hecho();
    const got = salidas(i);
    casos.push({ nombre, ok: JSON.stringify(got) === JSON.stringify(esperado), got, esperado });
  }

  // the ports, chosen in the port panel as a person would
  boton('PUERTO MIDI').click(); await sleep(100);
  const cols = $$('#voces .puertos .lista');
  $$('.it', cols[0]).find((b) => b.textContent === 'QY falso')?.click(); await sleep(100);
  $$('.it', document.querySelectorAll('#voces .puertos .lista')[1]).find((b) => b.textContent === 'QY falso respuesta')?.click(); await sleep(100);
  boton('CERRAR').click();
  const puertoOk = M.puertos.salida === 'QY falso' && M.puertos.entrada === 'QY falso respuesta' && !!M.link.output && !!M.link.input;
  const luzVerde = document.querySelector('.fled.green.on') !== null;

  const tira = (i) => $$('#tiras .tira')[i];
  const per = (i, k) => $$('.perilla', tira(i))[k];

  boton('CANCIÓN').click(); boton('1–8').click(); await sleep(50);
  // the part is unknown («—»): the first step starts from the factory value
  await caso('REV parte 1 (40+1)', () => rueda(per(0, 0)), ['F0 43 10 4C 08 00 13 29 F7']);
  await caso('CHO parte 1', () => rueda(per(0, 1)), ['F0 43 10 4C 08 00 12 01 F7']);
  await caso('VAR parte 1', () => rueda(per(0, 2)), ['F0 43 10 4C 08 00 14 01 F7']);
  await caso('PAN parte 1 (64+1)', () => rueda(per(0, 3)), ['F0 43 10 4C 08 00 0E 41 F7']);
  await caso('DRY parte 1 (127-1)', () => rueda(per(0, 4), -1), ['F0 43 10 4C 08 00 11 7E F7']);
  await caso('PAN doble clic = C', () => per(0, 3).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), ['F0 43 10 4C 08 00 0E 40 F7']);
  await caso('VOL parte 1 (100+1)', () => tecla($$('.fader-pista', tira(0))[0], 'ArrowUp'), ['F0 43 10 4C 08 00 0B 65 F7']);
  await caso('VOL parte 8 (100-10)', () => tecla($$('.fader-pista', tira(7))[0], 'PageDown'), ['F0 43 10 4C 08 07 0B 5A F7']);
  await caso('QY parte 4: callar', () => $$('.fk.qy', tira(3))[0].click(), ['F0 43 10 4C 08 03 04 7F F7']);
  await caso('QY parte 4: vuelve', () => $$('.fk.qy', tira(3))[0].click(), ['F0 43 10 4C 08 03 04 03 F7']);
  boton('9–16').click(); await sleep(50);
  await caso('QY parte 16: callar', () => $$('.fk.qy', tira(7))[0].click(), ['F0 43 10 4C 08 0F 04 7F F7']);
  // three steps at once: the first goes out at once, the other two join into the last value
  await caso('REV parte 10 (3 pasos)', () => rueda(per(1, 0), 3), ['F0 43 10 4C 08 09 13 29 F7', 'F0 43 10 4C 08 09 13 2B F7']);
  // a voice: the first Bass of the list, on part 2
  boton('1–8').click(); await sleep(50);
  $$('.voz', tira(1))[0].click(); await sleep(50);
  $$('#voces .cols > .lista:first-child .it')[4].click(); await sleep(50);   // family 4: Bass
  const bajo = $$('#voces .voces-l .it')[0];
  const nombreBajo = bajo.textContent;
  await caso(`voz parte 2: ${nombreBajo}`, () => bajo.click(), ['F0 43 10 4C 08 01 01 00 F7', 'F0 43 10 4C 08 01 02 00 F7', 'F0 43 10 4C 08 01 03 20 F7']);
  // a drum kit on part 10
  boton('9–16').click(); await sleep(50);
  $$('.voz', tira(1))[0].click(); await sleep(50);
  $$('#voces .cols > .lista:first-child .it').at(-1).click(); await sleep(50);   // Kits de batería
  const kit = $$('#voces .voces-l .it')[0];
  const nombreKit = kit.textContent;
  await caso(`voz parte 10: ${nombreKit}`, () => kit.click(), ['F0 43 10 4C 08 09 01 7E F7', 'F0 43 10 4C 08 09 02 00 F7', 'F0 43 10 4C 08 09 03 00 F7']);

  // Pattern mode: tracks are parts 16-23; BA = part 19 (0x13)
  boton('PATRÓN').click(); await sleep(50);
  await caso('VOL pista BA (100+1)', () => tecla($$('.fader-pista', tira(3))[0], 'ArrowUp'), ['F0 43 10 4C 08 13 0B 65 F7']);
  await caso('VOL 0 pista BA', () => $$('.fk.qy', tira(3))[0].click(), ['F0 43 10 4C 08 13 0B 00 F7']);
  await caso('VOL 0 pista BA: vuelve a 101', () => $$('.fk.qy', tira(3))[0].click(), ['F0 43 10 4C 08 13 0B 65 F7']);
  await caso('REV pista D1', () => rueda(per(0, 0)), ['F0 43 10 4C 08 10 13 29 F7']);

  // the QY100's effects
  const fx = document.querySelector('.maestro');
  const tipo = (k, nombre) => async () => { $$('.voz', fx)[k].click(); await sleep(50); $$('#voces .it').find((b) => b.textContent === nombre).click(); };
  await caso('tipo de reverb ROOM1', tipo(0, 'ROOM1'), ['F0 43 10 4C 02 01 00 02 00 F7']);
  await caso('tipo de chorus FLANGER1', tipo(1, 'FLANGER1'), ['F0 43 10 4C 02 01 20 43 00 F7']);
  await caso('tipo de variación ECHO', tipo(2, 'ECHO'), ['F0 43 10 4C 02 01 40 07 00 F7']);
  await caso('tipo de variación PHASER2', tipo(2, 'PHASER2'), ['F0 43 10 4C 02 01 40 48 08 F7']);
  await caso('retorno de reverb (64+1)', () => rueda($$('.perilla', fx)[0]), ['F0 43 10 4C 02 01 0C 41 F7']);
  await caso('retorno de chorus (64-1)', () => rueda($$('.perilla', fx)[1], -1), ['F0 43 10 4C 02 01 2C 3F F7']);
  await caso('retorno de variación (64+1)', () => rueda($$('.perilla', fx)[2]), ['F0 43 10 4C 02 01 56 41 F7']);
  await caso('volumen general (127-1)', () => tecla($$('.fader-pista', fx)[0], 'ArrowDown'), ['F0 43 10 4C 00 00 04 7E F7']);

  // cadence: 60 wheel steps on one knob at once go out as far fewer messages, the last one last
  boton('CANCIÓN').click(); boton('1–8').click(); await sleep(50);
  let i0 = marca();
  rueda(per(2, 0), 60);
  await hecho();
  const rafaga = salidas(i0);
  casos.push({ nombre: 'arrastre: 60 pasos se juntan', ok: rafaga.length < 10 && rafaga.at(-1) === 'F0 43 10 4C 08 02 13 64 F7', got: rafaga, esperado: '< 10 mensajes, el último 40+60 = 100 (64)' });
  // 40 different controls at once: at most ~60 messages a second
  i0 = marca();
  for (let t = 0; t < 8; t++) for (let k = 0; k < 5; k++) rueda(per(t, k));
  await hecho();
  const tiempos = M.registro.slice(i0).filter((l) => l.includes(' > ')).map((l) => { const [h, m, s] = l.split(' ')[0].split(':'); return (+h * 3600 + +m * 60 + +s) * 1000; });
  const gaps = tiempos.slice(1).map((t, k) => t - tiempos[k]);
  const porSeg = (tiempos.length - 1) / ((tiempos.at(-1) - tiempos[0]) / 1000);
  casos.push({ nombre: '40 controles: cadencia', ok: tiempos.length === 40 && porSeg <= 63, got: { mensajes: tiempos.length, porSegundo: +porSeg.toFixed(1), huecoMin: Math.min(...gaps) }, esperado: '40 mensajes, ≤ ~60/s' });

  // READ FROM QY: the pretend QY answers dumps (or, with --sin-bloques, single parameters)
  // Part 3's REV was set through the app to 101 just above; part 5's voice was never touched.
  i0 = marca();
  boton('LEER DEL QY').click();
  await sleep(200);
  while (document.querySelector('.fk[disabled]')) await sleep(100);
  const peticiones = M.registro.slice(i0).filter((l) => l.includes(' > ')).length;
  const st = M.state;
  casos.push({ nombre: 'leer: valores de la página', ok: st[4].voz?.join() === '0,0,0' && st[4].vol === 100 && st[4].rcv === 4 && st[2].rev === 101 && st[3].rcv === 3,
    got: { parte5: st[4], parte3rev: st[2].rev, parte4rcv: st[3].rcv, peticiones }, esperado: 'parte 5 = 0/0/0, vol 100, rcv 4; parte 3 rev 101' });
  casos.push({ nombre: 'leer: efectos y general', ok: M.maestro.rev.tipo?.join() === '2,0' && M.maestro.vari.tipo?.join() === '72,8' && M.maestro.rev.ret === 65 && M.maestro.vol === 126,
    got: M.maestro, esperado: 'ROOM1, PHASER2, retorno 65, general 126' });
  const pantalla = document.getElementById('mixlcd').innerText;

  // SEND ALL: everything known, ~16 ms apart
  i0 = marca();
  document.querySelector('.fk.round.azul').click();
  await sleep(100); await M.colaVacia(); await sleep(50);
  const todo = M.registro.slice(i0).filter((l) => l.includes(' > '));
  const tt = todo.map((l) => { const [h, m, s] = l.split(' ')[0].split(':'); return (+h * 3600 + +m * 60 + +s) * 1000; });
  const gapsTodo = tt.slice(1).map((t, k) => t - tt[k]);
  casos.push({ nombre: 'ENVIAR TODO', ok: todo.length > 0 && Math.min(...gapsTodo) >= 15,
    got: { mensajes: todo.length, huecoMin: Math.min(...gapsTodo), huecoMedio: +(gapsTodo.reduce((a, b) => a + b, 0) / gapsTodo.length).toFixed(1), primero: todo[0].split(' > ')[1], ultimo: todo.at(-1).split(' > ')[1] }, esperado: 'lo conocido, ≥ 15 ms entre mensajes' });

  return { puertoOk, luzVerde, pasan: casos.filter((c) => c.ok).length, de: casos.length, fallan: casos.filter((c) => !c.ok), casos: casos.map((c) => `${c.ok ? 'OK ' : 'MAL'} ${c.nombre}: ${typeof c.got[0] === 'string' ? c.got.join(' | ') : JSON.stringify(c.got)}`), pantalla };
})();
