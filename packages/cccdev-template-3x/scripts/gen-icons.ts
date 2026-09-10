import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function rgbaAt(size: number, x: number, y: number): [number, number, number, number] {
  const n = (v: number) => v / (size - 1);
  const px = n(x);
  const py = n(y);
  const cx = px - 0.5;
  const cy = py - 0.5;

  const bg: [number, number, number, number] = [22, 22, 30, 255];
  const accent: [number, number, number, number] = [108, 99, 255, 255];
  const light: [number, number, number, number] = [208, 208, 240, 255];

  const inRoundRect = (l: number, t: number, r: number, b: number, rad: number) => {
    const dx = Math.max(l + rad - px, 0, px - (r - rad));
    const dy = Math.max(t + rad - py, 0, py - (b - rad));
    if (px >= l + rad && px <= r - rad && py >= t && py <= b) return true;
    if (py >= t + rad && py <= b - rad && px >= l && px <= r) return true;
    return dx * dx + dy * dy <= rad * rad;
  };

  if (cx * cx + cy * cy > 0.48 * 0.48) return [0, 0, 0, 0];
  if (cx * cx + cy * cy > 0.42 * 0.42) return accent;
  if (!inRoundRect(0.18, 0.18, 0.82, 0.82, 0.1)) return bg;

  // right inspector strip
  if (px > 0.58 && px < 0.78 && py > 0.28 && py < 0.72) return accent;
  // tree rows
  if (px > 0.26 && px < 0.52) {
    const row = Math.floor((py - 0.3) / 0.1);
    if (row >= 0 && row < 4 && py > 0.3 + row * 0.1 && py < 0.3 + row * 0.1 + 0.045) {
      return light;
    }
  }
  return bg;
}

function encodePng(size: number): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgbaAt(size, x, y);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(import.meta.dir, '../extension/icons');
mkdirSync(out, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(out, `icon${size}.png`), encodePng(size));
}
console.log('wrote icons to', out);
