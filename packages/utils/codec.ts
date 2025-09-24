/* Minimal varint + ZigZag + columnar time-series codec */

type Row = {
  ts: number;       // epoch ms
  lastprice: number;
  vol: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};

const MAGIC = 0x5453; // 'TS'
const VER = 1;

// ---------- Varint & ZigZag ----------
function zigzagEncode(n: number): number {
  // JS numbers are 53-bit; we keep values small via scaling/deltas.
  const signed = BigInt(Math.trunc(n));
  return Number((signed << 1n) ^ (signed >> 63n));
}
function zigzagDecode(u: number): number {
  const v = BigInt(u);
  return Number((v >> 1n) ^ -(v & 1n));
}
function writeVarint(buf: Uint8Array, off: number, v: number): number {
  let x = v >>> 0; // assume fits 32-bit after scaling/deltas
  while (x >= 0x80) { buf[off++] = (x & 0x7f) | 0x80; x >>>= 7; }
  buf[off++] = x;
  return off;
}
function readVarint(buf: Uint8Array, off: number): [value: number, next: number] {
  let x = 0, s = 0, b;
  do { b = buf[off++]; x |= (b & 0x7f) << s; s += 7; } while (b & 0x80);
  return [x >>> 0, off];
}

// ---------- Buffer builder ----------
class W {
  buf: Uint8Array; off = 0;
  constructor(cap = 1024) { this.buf = new Uint8Array(cap); }
  ensure(n: number) {
    if (this.off + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.off + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf); this.buf = nb;
  }
  u8(v: number) { this.ensure(1); this.buf[this.off++] = v & 0xff; }
  u16(v: number) { this.ensure(2); this.buf[this.off++] = v & 0xff; this.buf[this.off++] = (v >>> 8) & 0xff; }
  u32(v: number) { this.ensure(4); for (let i = 0; i < 4; i++) this.buf[this.off++] = (v >>> (8 * i)) & 0xff; }
  varint(v: number) { this.ensure(5); this.off = writeVarint(this.buf, this.off, v); }
  bytes(): Uint8Array { return this.buf.subarray(0, this.off); }
}

// ---------- Encoder ----------
/**
 * @param rows sorted by ts ascending
 * @param scaleExp array length 6, e.g. [-2,-2,-2,-2,-2,-2] for 2 decimals
 */
export function encode(rows: Row[], scaleExp: number[]): Uint8Array {
  if (rows.length === 0) return new Uint8Array([0x54, 0x53, VER, 0]); // degenerate
  if (scaleExp.length !== 6) throw new Error("scaleExp length must be 6");

  const w = new W(rows.length * 6); // rough guess; grows as needed

  // Header
  w.u16(MAGIC);
  w.u8(VER);
  // rows (varint)
  w.varint(rows.length);

  // baseTs split: seconds + ms remainder fits 32+16
  const baseTs = rows[0].ts;
  const baseSec = Math.floor(baseTs / 1000);
  const baseMs = baseTs - baseSec * 1000;
  w.u32(baseSec >>> 0);
  w.u16(baseMs & 0xffff);

  // per-column scales
  for (let i = 0; i < 6; i++) w.u8((scaleExp[i] & 0xff) >>> 0);

  // ---- timestamps: delta-of-delta (ms)
  let prevTs = baseTs;
  // first delta
  let d0 = rows[0].ts - baseTs;
  w.varint(zigzagEncode(d0));
  let prevDelta = d0;

  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].ts - prevTs;
    const dod = d - prevDelta;
    w.varint(zigzagEncode(dod));
    prevTs = rows[i].ts;
    prevDelta = d;
  }

  // Helper to scale a value per column
  const scale = (v: number, exp: number) => {
    const f = Math.pow(10, -exp); // exp=-2 => 10^2
    return Math.round(v * f);
  };

  // ---- columns 1..6 (columnar)
  for (let col = 1; col <= 6; col++) {
    let prev = scale((rows[0] as any)[`c${col}`], scaleExp[col - 1]);
    // first absolute
    w.varint(zigzagEncode(prev));
    for (let i = 1; i < rows.length; i++) {
      const cur = scale((rows[i] as any)[`c${col}`], scaleExp[col - 1]);
      const delta = cur - prev;
      w.varint(zigzagEncode(delta));
      prev = cur;
    }
  }

  return w.bytes();
}

// ---------- Decoder ----------
export function decode(buf: Uint8Array): Row[] {
  let off = 0;
  const rdU16 = () => buf[off++] | (buf[off++] << 8);
  const rdU8 = () => buf[off++];
  const rdU32 = () => { let v = 0; for (let i = 0; i < 4; i++) v |= buf[off++] << (8 * i); return v >>> 0; };
  const rdVar = (): number => { const [v, n] = readVarint(buf, off); off = n; return v; };

  if (rdU16() !== MAGIC) throw new Error("Bad magic");
  const ver = rdU8(); if (ver !== VER) throw new Error("Bad version");
  const rowsN = rdVar();
  if (rowsN === 0) return [];

  const baseSec = rdU32();
  const baseMs = rdU16();
  const baseTs = baseSec * 1000 + baseMs;

  const scaleExp = new Array<number>(6);
  for (let i = 0; i < 6; i++) scaleExp[i] = (rdU8() << 24) >> 24; // sign-extend int8

  // timestamps
  const ts: number[] = new Array(rowsN);
  const firstDelta = zigzagDecode(rdVar());
  ts[0] = baseTs + firstDelta;

  let prevTs = ts[0];
  let prevDelta = firstDelta;
  for (let i = 1; i < rowsN; i++) {
    const dod = zigzagDecode(rdVar());
    const d = prevDelta + dod;
    ts[i] = prevTs + d;
    prevTs = ts[i];
    prevDelta = d;
  }

  // columns
  const cols: number[][] = Array.from({ length: 6 }, () => new Array(rowsN));
  const unscale = (v: number, exp: number) => v / Math.pow(10, -exp);

  for (let c = 0; c < 6; c++) {
    let v = zigzagDecode(rdVar());
    cols[c][0] = v;
    for (let i = 1; i < rowsN; i++) {
      const d = zigzagDecode(rdVar());
      v = v + d;
      cols[c][i] = v;
    }
    // unscale in-place
    for (let i = 0; i < rowsN; i++) cols[c][i] = unscale(cols[c][i], scaleExp[c]);
  }

  const out: Row[] = new Array(rowsN);
  for (let i = 0; i < rowsN; i++) {
    out[i] = {
      ts: ts[i],
      c1: cols[0][i], c2: cols[1][i], c3: cols[2][i],
      c4: cols[3][i], c5: cols[4][i], c6: cols[5][i],
    };
  }
  return out;
}
