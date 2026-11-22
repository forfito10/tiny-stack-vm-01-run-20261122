import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const immediate: Record<number, number> = { 1: 1, 2: 4, 48: 2, 49: 2, 50: 2, 51: 2 };
const pops: Record<number, number> = {
  0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3,
  16: 2, 17: 2, 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 1,
  24: 2, 25: 2, 26: 2, 27: 1, 28: 2, 29: 2, 30: 2,
  32: 2, 33: 2, 34: 2, 48: 0, 49: 1, 50: 1, 51: 0, 52: 0,
  64: 1, 65: 2, 80: 1, 81: 1, 82: 0, 83: 1,
};
const pushes: Record<number, number> = {
  1: 1, 2: 1, 4: 2, 6: 3, 7: 3,
  16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1,
  24: 1, 25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1,
  32: 1, 33: 1, 34: 1, 52: 1, 64: 1, 82: 1,
};

function execute(program: Buffer, input: Buffer): [Buffer, number] {
  const stack = new Int32Array(256);
  const calls = new Int32Array(64);
  const memory = new Int32Array(256);
  const output = Buffer.alloc(65536);
  let sp = 0, cp = 0, out = 0, inputAt = 0, pc = 0, steps = 0;
  const finish = (code: number): [Buffer, number] => [output.subarray(0, out), code];

  for (;;) {
    if (steps === 1_000_000) return finish(10);
    if (pc < 0 || pc >= program.length) return finish(9);
    const op = program[pc];
    if (!(op in pops)) return finish(5);
    const size = immediate[op] ?? 0;
    if (pc + size >= program.length) return finish(9);
    steps++;
    const next = pc + size + 1;
    const need = pops[op];
    if (sp < need) return finish(2);
    if (sp - need + (pushes[op] ?? 0) > 256) return finish(3);
    pc = next;

    let a: number, b: number, value: number;
    switch (op) {
      case 0: return finish(0);
      case 1: stack[sp++] = (program[next - 1] << 24) >> 24; break;
      case 2:
        stack[sp++] = program[next - 4] | (program[next - 3] << 8) |
          (program[next - 2] << 16) | (program[next - 1] << 24);
        break;
      case 3: sp--; break;
      case 4: stack[sp] = stack[sp - 1]; sp++; break;
      case 5: a = stack[sp - 1]; stack[sp - 1] = stack[sp - 2]; stack[sp - 2] = a; break;
      case 6: stack[sp] = stack[sp - 2]; sp++; break;
      case 7:
        a = stack[sp - 3]; stack[sp - 3] = stack[sp - 2];
        stack[sp - 2] = stack[sp - 1]; stack[sp - 1] = a;
        break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34:
        b = stack[--sp]; a = stack[--sp];
        if (op >= 19 && op <= 22 && b === 0) return finish(4);
        switch (op) {
          case 16: value = (a + b) | 0; break;
          case 17: value = (a - b) | 0; break;
          case 18: value = Math.imul(a, b); break;
          case 19: value = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
          case 20: value = b === -1 ? 0 : (a % b) | 0; break;
          case 21: value = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 22: value = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 24: value = a & b; break;
          case 25: value = a | b; break;
          case 26: value = a ^ b; break;
          case 28: value = a << (b & 31); break;
          case 29: value = a >> (b & 31); break;
          case 30: value = (a >>> (b & 31)) | 0; break;
          case 32: value = a === b ? 1 : 0; break;
          case 33: value = a < b ? 1 : 0; break;
          default: value = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        stack[sp++] = value;
        break;
      case 23: stack[sp - 1] = -stack[sp - 1] | 0; break;
      case 27: stack[sp - 1] = ~stack[sp - 1]; break;
      case 48: case 49: case 50: {
        const offset = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
        const take = op === 48 || (op === 49 ? stack[--sp] === 0 : stack[--sp] !== 0);
        if (take) pc = next + offset;
        break;
      }
      case 51:
        if (cp === 64) return finish(7);
        calls[cp++] = next;
        pc = program[next - 2] | (program[next - 1] << 8);
        break;
      case 52:
        if (cp === 0) return finish(8);
        pc = calls[--cp];
        break;
      case 64:
        a = stack[sp - 1];
        if (a < 0 || a > 255) return finish(6);
        stack[sp - 1] = memory[a];
        break;
      case 65:
        a = stack[sp - 1]; b = stack[sp - 2];
        if (a < 0 || a > 255) return finish(6);
        sp -= 2; memory[a] = b;
        break;
      case 80: {
        const bytes = Buffer.from(String(stack[sp - 1]));
        if (out + bytes.length > output.length) return finish(11);
        sp--; bytes.copy(output, out); out += bytes.length;
        break;
      }
      case 81:
        if (out === output.length) return finish(11);
        output[out++] = stack[--sp] & 255;
        break;
      case 82: stack[sp++] = inputAt < input.length ? input[inputAt++] : -1; break;
      case 83: return finish(stack[--sp] & 255);
    }
  }
}

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(inputDir).sort()) {
  const dest = join(outputDir, id);
  mkdirSync(dest, { recursive: true });
  const [stdout, code] = execute(
    readFileSync(join(inputDir, id, 'program.bin')),
    readFileSync(join(inputDir, id, 'input.bin')),
  );
  writeFileSync(join(dest, 'stdout.bin'), stdout);
  writeFileSync(join(dest, 'exit.txt'), `${code}\n`);
}
