import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRoomDocx } from '../src/docx-parser.js';

const source = path.resolve(process.cwd(), '..', 'MAPA DE SALAS 3 PISO -NOVO - 2026 - para mesclagem.docx');

describe('importação do mapa original', () => {
  it.skipIf(!fs.existsSync(source))('lê as 17 salas e os dois turnos sem incluir áreas especiais', () => {
    const rows = parseRoomDocx(fs.readFileSync(source));
    expect(new Set(rows.map(row => row.room)).size).toBe(17);
    expect(rows).toHaveLength(170);
    expect(rows.filter(row => row.shift === 'MANHA')).toHaveLength(85);
    expect(rows.filter(row => row.shift === 'TARDE')).toHaveLength(85);
    expect(rows.every(row => row.room >= 1 && row.room <= 17)).toBe(true);
  });
});
