import AdmZip from 'adm-zip';
import type { RoomStatus, Shift } from '@prisma/client';

const text = (value: string) => value
  .replace(/<w:tab\/>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&#xA;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function parseRoomDocx(buffer: Buffer) {
  const xml = new AdmZip(buffer).readAsText('word/document.xml');
  const tables = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const parsed: any[] = [];

  for (const table of tables) {
    let isRoomTable = false;
    let shift: Shift = 'MANHA';
    for (const tr of table.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []) {
      const cells = (tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).map(text);
      const joined = cells.join(' ').toUpperCase();
      if (/\bTARDE\b/.test(joined)) shift = 'TARDE';
      else if (/MANH[ÃAÂ]/.test(joined)) shift = 'MANHA';
      if (cells.some(cell => /SEGUNDA/i.test(cell))) { shift = isRoomTable ? 'TARDE' : 'MANHA'; isRoomTable = true; continue; }
      const roomIndex = cells.findIndex(cell => /SALA\s*\d+/i.test(cell));
      if (!isRoomTable || roomIndex < 0) continue;
      const room = Number(cells[roomIndex].match(/\d+/)?.[0]);
      if (!Number.isInteger(room) || room < 1 || room > 17) continue;

      for (let weekday = 0; weekday < 6; weekday += 1) {
        const raw = cells[roomIndex + weekday + 1]?.trim();
        if (!raw) continue;
        const upper = raw.toUpperCase();
        const status: RoomStatus = /\bLIVRE\b/.test(upper) ? 'LIVRE' : /RESERV/.test(upper) ? 'RESERVADA' : /FECHAD/.test(upper) ? 'FECHADA' : 'OCUPADA';
        const code = raw.match(/\(?\s*(\d{4,})\s*\)?/)?.[1] || null;
        const specialties = [...raw.matchAll(/\(([^()]{3,80})\)/g)].map(match => match[1].trim()).filter(value => !/^\d+$/.test(value));
        const specialty = specialties.at(-1) || null;
        const operator = /SECRET[ÁA]RIA/i.test(raw) ? 'Secretária' : null;
        const professional = status === 'OCUPADA' ? raw.split(/\(|\b15\s*dias\b|Secret[áa]ria/i)[0].trim() || null : null;
        parsed.push({ room, weekday, scope: 'PADRAO', shift, status, professional, code, specialty, operator, notes: raw, rawText: raw, needsReview: true });
      }
    }
  }
  return parsed;
}
