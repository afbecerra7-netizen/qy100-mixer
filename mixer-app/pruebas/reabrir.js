// After recorrido.js, with the same QY_MIXER_DATOS: the mix and the ports come back on their own.
// With qy_falso.py --mudo, READ must say that nothing answered.
// Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.
(async () => {
  const M = window.__mixer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lcd = () => document.getElementById('mixlcd').innerText.split('\n').at(-1);
  const alAbrir = lcd();
  const tira1 = document.querySelector('#tiras .tira').innerText.replace(/\s+/g, ' ');
  const salida = M.link.output?.name, entrada = M.link.input?.name;
  [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('LEER DEL QY')).click();
  await sleep(300);
  while (document.querySelector('.fk[disabled]')) await sleep(100);
  return { alAbrir, tira1, salida, entrada, trasLeer: lcd(), luz: document.querySelector('.fled.green.on') !== null };
})();
