import AdmZip from 'adm-zip';
type RoomStatus = 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'FECHADA';
type Shift = 'MANHA' | 'TARDE';

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
    let serviceRoom: number | null = null;
    for (const tr of table.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []) {
      const cells = (tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).map(text);
      const joined = cells.join(' ').toUpperCase();
      if (/\bTARDE\b/.test(joined)) shift = 'TARDE';
      else if (/MANH[ÃAÂ]/.test(joined)) shift = 'MANHA';
      if (cells.some(cell => /SEGUNDA/i.test(cell))) { shift = isRoomTable ? 'TARDE' : 'MANHA'; isRoomTable = true; continue; }
      const roomIndex = cells.findIndex(cell => /SALA\s*\d+/i.test(cell));
      const serviceIndex=cells.findIndex(cell=>/^(ECO|MAPA\s*\/?\s*HOLTER|MAPAHOLTER|E[CG]{2}|T\.?\s*ERGO(?:\s*\/?\s*ESPIRO)?|EEG)$/i.test(cell.replace(/\s+/g,' ').trim()));
      if(serviceIndex>=0){const label=cells[serviceIndex].replace(/\s+/g,'').toUpperCase();serviceRoom=label==='ECO'?18:label.includes('MAPA')?19:label==='ECG'||label==='EGC'?20:label.includes('ERGO')?21:22;isRoomTable=true}
      if (!isRoomTable || roomIndex < 0 && !serviceRoom) continue;
      const room = roomIndex>=0?Number(cells[roomIndex].match(/\d+/)?.[0]):serviceRoom!;
      if (!Number.isInteger(room) || room < 1 || room > 22) continue;
      const shiftIndex=cells.findIndex(cell=>/^(MANH[ÃAÂ]|TARDE)$/i.test(cell.trim()));
      const dataStart=room<=17?roomIndex+1:shiftIndex>=0?shiftIndex+1:(serviceIndex>=0?serviceIndex+1:1);

      for (let weekday = 0; weekday < 6; weekday += 1) {
        const source = cells[dataStart + weekday]?.trim();
        if (!source) continue;
        const raw = source
          .replace(/(\d{4})(15\s*dias?)/gi, '$1 $2')
          .replace(/([A-Za-zÀ-ÿ])(15\s*dias?)/gi, '$1 $2')
          .replace(/\s+/g, ' ')
          .trim();
        const upper = raw.toUpperCase();
        const status: RoomStatus = /\bLIVRE\b/.test(upper) ? 'LIVRE' : /RESERV/.test(upper) ? 'RESERVADA' : /FECHAD/.test(upper) ? 'FECHADA' : 'OCUPADA';
        const code = raw.match(/\(\s*(\d{4})\s*\)/)?.[1] || raw.match(/\b(\d{4})\b/)?.[1] || null;
        const specialties = [...raw.matchAll(/\(([^()]{3,80})\)/g)].map(match => match[1].trim()).filter(value => !/^\d+$/.test(value));
        const specialty = specialties.at(-1) || null;
        const operator = /SECRET[ÁA]RIA/i.test(raw) ? 'Secretária' : null;
        const professionalSource = raw.replace(/^\(\s*/,'');
        const professional = status === 'OCUPADA' ? professionalSource.split(/\(|\b15\s*dias\b|Secret[áa]ria/i)[0].replace(/\b\d{4}\s*$/,'').trim() || null : null;
        parsed.push({ room, weekday, scope: 'PADRAO', shift, status, professional, code, specialty, operator, notes: null, rawText: raw, needsReview: true });
      }
    }
  }
  return parsed;
}
