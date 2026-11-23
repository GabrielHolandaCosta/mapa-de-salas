import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRoomDocx } from '../src/docx-parser.js';

const source = path.resolve(process.cwd(), '..', 'MAPA DE SALAS 3 PISO -NOVO - 2026 - para mesclagem.docx');

describe('importação do mapa original', () => {
  it.skipIf(!fs.existsSync(source))('lê as 17 salas, os serviços especiais e os dois turnos', () => {
    const rows = parseRoomDocx(fs.readFileSync(source));
    expect(new Set(rows.map(row => row.room)).size).toBe(22);
    expect(rows).toHaveLength(219);
    expect(rows.filter(row => row.room <= 17)).toHaveLength(170);
    expect(rows.filter(row => row.room >= 18)).toHaveLength(49);
    expect(rows.every(row => row.room >= 1 && row.room <= 22)).toBe(true);
    const klayne = rows.find(row => row.room === 15 && row.weekday === 4 && row.shift === 'MANHA');
    expect(klayne).toMatchObject({ professional:'Klayne Martins', code:'8934', specialty:'Medico Clinico' });
    expect(klayne?.rawText).toContain('8934 15 dias');
    const reserved = rows.find(row => row.room === 1 && row.weekday === 0 && row.shift === 'MANHA');
    expect(reserved).toMatchObject({ status:'RESERVADA', notes:null });
    const flavia = rows.find(row => row.room === 5 && row.weekday === 2 && row.shift === 'MANHA');
    expect(flavia).toMatchObject({ professional:'Flavia Motta', code:'5334', specialty:'Oncologista' });
    expect(rows.filter(row => row.status === 'OCUPADA' && !row.professional)).toHaveLength(0);
  });
});
