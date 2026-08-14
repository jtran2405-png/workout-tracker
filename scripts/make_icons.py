#!/usr/bin/env python3
"""Generate PWA icons (barbell on dark) with stdlib only — no Pillow."""
import struct, zlib, os

BG = (13, 13, 13)        # #0d0d0d
BAR = (57, 135, 229)     # #3987e5
PLATE = (28, 92, 171)    # #1c5cab


def make_png(size, path):
    px = bytearray()
    s = size / 512.0  # design in 512-space

    def inside(x, y):
        # bar: x 96..416, y 236..276
        if 96 * s <= x < 416 * s and 236 * s <= y < 276 * s:
            return BAR
        # outer plates: x 116..160 / 352..396, y 150..362
        for x0, x1 in ((116, 160), (352, 396)):
            if x0 * s <= x < x1 * s and 150 * s <= y < 362 * s:
                return PLATE
        # inner plates: x 170..206 / 306..342, y 186..326
        for x0, x1 in ((170, 206), (306, 342)):
            if x0 * s <= x < x1 * s and 186 * s <= y < 326 * s:
                return PLATE
        return BG

    for y in range(size):
        px.append(0)  # filter: none
        for x in range(size):
            px.extend(inside(x, y))

    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(bytes(px), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(f'{path} ({size}x{size}, {len(png)} bytes)')


out = os.path.join(os.path.dirname(__file__), '..', 'public')
make_png(512, os.path.join(out, 'icon-512.png'))
make_png(192, os.path.join(out, 'icon-192.png'))
make_png(180, os.path.join(out, 'apple-touch-icon.png'))
