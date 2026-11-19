import fs from 'node:fs';
import AdmZip from 'adm-zip';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) throw new Error('Informe um arquivo Word existente.');
const xml = new AdmZip(fs.readFileSync(file)).readAsText('word/document.xml');
const plain = value => value.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const rooms = new Set();
const result = { records: 0, morning: 0, afternoon: 0 };

for (const table of xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || []) {
  let hasHeader = false;
  let shift = 'MANHA';
  for (const tr of table.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []) {
    const cells = (tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).map(plain);
    const joined = cells.join(' ').toUpperCase();
    if (/\bTARDE\b/.test(joined)) shift = 'TARDE';
    else if (/MANH[ÃAÂ]/.test(joined)) shift = 'MANHA';
    if (cells.some(cell => /SEGUNDA/i.test(cell))) { shift = hasHeader ? 'TARDE' : 'MANHA'; hasHeader = true; continue; }
    const room = Number((cells.find(cell => /SALA\s*\d+/i.test(cell)) || '').match(/\d+/)?.[0]);
    if (!hasHeader || !Number.isInteger(room) || room < 1 || room > 17) continue;
    rooms.add(room);
    for (let index = 2; index < Math.min(cells.length, 8); index += 1) {
      if (!cells[index]) continue;
      result.records += 1;
      if (shift === 'MANHA') result.morning += 1;
      else result.afternoon += 1;
    }
  }
}

console.log(JSON.stringify({ ...result, rooms: [...rooms].sort((a, b) => a - b) }, null, 2));
if (rooms.size !== 17) process.exitCode = 1;
