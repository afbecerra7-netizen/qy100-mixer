#!/usr/bin/env python3
"""A pretend QY100 on two virtual CoreMIDI ports, to check the mixer without any device.

    ~/Proyectos/Yamaha/qy100-syx/.venv/bin/python pruebas/qy_falso.py [--sin-bloques] [--mudo]

Copyright (C) 2026 Felipe Becerra. GNU General Public License v3.0 or later.

It opens «QY falso» (choose it as the mixer's OUTPUT) and «QY falso respuesta» (its INPUT),
prints every SysEx it receives, one line each, and answers like an XG device would:
- an XG Parameter Change (F0 43 1n 4C …) is written into its memory;
- an XG Bulk Dump Request (2n) at 08 pp 00, 02 01 00/20/40 or 00 00 00 gets a dump of that
  block (unless --sin-bloques, to try the one-parameter-at-a-time path);
- an XG Parameter Request (3n) gets a Parameter Change with the value in memory.
--mudo answers nothing. Nothing here talks to a real device: only virtual ports are opened.
"""
import argparse
import sys
import time

import mido

SALIDA_APP = 'QY falso'               # where the mixer sends
ENTRADA_APP = 'QY falso respuesta'    # where it listens

memoria = {}


def poner(dir3, datos):
    h, m, l = dir3
    for i, v in enumerate(datos):
        memoria[(h, m, l + i)] = v


for p in range(24):
    kit = p == 9 or p in (16, 17, 18)
    poner((0x08, p, 0x00), [0, 127 if kit else 0, 0, 0, p % 16])   # 00 element, 01 MSB, 02 LSB, 03 program, 04 rcv
    poner((0x08, p, 0x0b), [100, 0, 0, 64, 0, 0, 127, 0, 40, 0])    # 0B vol … 0E pan … 11 dry 12 cho 13 rev 14 var
poner((0x02, 0x01, 0x00), [0x01, 0x00]); poner((0x02, 0x01, 0x0c), [64])
poner((0x02, 0x01, 0x20), [0x41, 0x00]); poner((0x02, 0x01, 0x2c), [64])
poner((0x02, 0x01, 0x40), [0x05, 0x00]); poner((0x02, 0x01, 0x56), [64])
poner((0x00, 0x00, 0x00), [0, 4, 0, 0, 127, 0, 64])

BLOQUES = {(0x08, p, 0x00): 0x30 for p in range(24)}
BLOQUES.update({(0x02, 0x01, 0x00): 0x10, (0x02, 0x01, 0x20): 0x10, (0x02, 0x01, 0x40): 0x30, (0x00, 0x00, 0x00): 7})


def hexa(b):
    return ' '.join(f'{x:02X}' for x in b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sin-bloques', action='store_true')
    ap.add_argument('--mudo', action='store_true')
    a = ap.parse_args()
    sale = mido.open_output(ENTRADA_APP, virtual=True)
    t0 = time.monotonic()

    def recibir(msg):
        if msg.type != 'sysex':
            return
        b = [0xF0, *msg.data, 0xF7]
        print(f'{time.monotonic() - t0:9.3f} < {hexa(b)}', flush=True)
        if len(b) < 8 or b[1] != 0x43 or b[3] != 0x4C:
            return
        sub, d = b[2] & 0xF0, tuple(b[4:7])
        if sub == 0x10:
            poner(d, b[7:-1])
        elif a.mudo:
            return
        elif sub == 0x20 and d in BLOQUES and not a.sin_bloques:
            n = BLOQUES[d]
            datos = [memoria.get((d[0], d[1], d[2] + i), 0) for i in range(n)]
            cuerpo = [n >> 7, n & 0x7F, *d, *datos]
            suma = (128 - sum(cuerpo) % 128) % 128
            sale.send(mido.Message('sysex', data=[0x43, b[2] & 0x0F, 0x4C, *cuerpo, suma]))
            print(f'{time.monotonic() - t0:9.3f} > bloque {hexa(d)} ({n} bytes)', flush=True)
        elif sub == 0x30:
            if d not in memoria:
                return
            size = 2 if d in ((0x02, 0x01, 0x00), (0x02, 0x01, 0x20), (0x02, 0x01, 0x40)) else 1
            datos = [memoria.get((d[0], d[1], d[2] + i), 0) for i in range(size)]
            sale.send(mido.Message('sysex', data=[0x43, 0x10 | (b[2] & 0x0F), 0x4C, *d, *datos]))
            print(f'{time.monotonic() - t0:9.3f} > parámetro {hexa(d)} = {hexa(datos)}', flush=True)

    entra = mido.open_input(SALIDA_APP, virtual=True, callback=recibir)
    print(f'QY falso listo: «{SALIDA_APP}» (salida de la app) y «{ENTRADA_APP}» (entrada).', flush=True)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        entra.close()
        sale.close()


if __name__ == '__main__':
    sys.exit(main())
