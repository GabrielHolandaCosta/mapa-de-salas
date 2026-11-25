const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const services = {18:'ECO', 19:'MAPA / HOLTER', 20:'ECG', 21:'T. ERGO / ESPIRO', 22:'EEG'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function printCell(row) {
  if (!row) return '<span class="print-status">Livre</span>';
  const status = ({LIVRE:'Livre', OCUPADA:'Ocupada', RESERVADA:'Reservada', FECHADA:'Fechada'})[row.status] || row.status || 'Livre';
  const source = [row.operator, row.notes, row.rawText].filter(Boolean).join(' ');
  const secretary = /secret[áa]ria/i.test(source);
  const fortnightly = /\b15\s*dias?\b/i.test(source);
  const operator = String(row.operator || '').replace(/\s*[·|\-]?\s*\[?secret[áa]ria\]?/ig, '').trim();
  const notes = String(row.notes || '').replace(/\s*[·|\-]?\s*\[?15\s*dias?\]?/ig, '').trim();
  const identity = [row.professional, row.code ? `(${row.code})` : ''].filter(Boolean).join(' ');
  const raw = !identity && !row.specialty && !operator && !notes ? row.rawText : '';
  return `<span class="print-status">${escape(status)}</span>${identity?`<strong>${escape(identity)}</strong>`:''}${row.specialty?`<span>(${escape(row.specialty)})</span>`:''}${operator?`<span>${escape(operator)}</span>`:''}${secretary?'<span class="print-tag">Secretária</span>':''}${fortnightly?'<span class="print-tag">15 dias</span>':''}${notes?`<span class="print-note">${escape(notes)}</span>`:''}${raw?`<span class="print-note">${escape(raw)}</span>`:''}`;
}

export function preparePrintMap({unit, area, rows, selection}) {
  const report = document.createElement('main');
  report.className = 'print-report';
  const unitName = unit === 'GRUTA' ? 'Gruta' : 'Mangabeiras · 3º piso';
  const choice = selection || (area === 'SERVICES' ? 'services' : 'rooms_both');
  const choices = {
    rooms_morning: [{special:false,shift:'MANHA'}],
    rooms_afternoon: [{special:false,shift:'TARDE'}],
    rooms_both: [{special:false,shift:'MANHA'},{special:false,shift:'TARDE'}],
    services: [{special:true,shift:'MANHA'},{special:true,shift:'TARDE'}],
    all: [{special:false,shift:'MANHA'},{special:false,shift:'TARDE'},{special:true,shift:'MANHA'},{special:true,shift:'TARDE'}],
  };
  if (!Object.hasOwn(choices, choice)) throw new Error('Opção de impressão inválida.');
  report.innerHTML = choices[choice].map(({special, shift}) => {
    const items = special ? Object.keys(services).map(Number) : Array.from({length:17}, (_, index) => index + 1);
    const shiftName = shift === 'MANHA' ? 'Manhã' : 'Tarde';
    const title = special ? 'Serviços especiais' : 'Mapa dos consultórios';
    return `<section class="print-section"><table class="print-table"><thead><tr class="print-heading"><th colspan="7"><span>MAPA DE SALAS · ${escape(unitName.toUpperCase())}</span><strong>${escape(title)} <span aria-hidden="true">—</span> ${shiftName}</strong><small>Organização semanal · Segunda a sábado</small></th></tr><tr class="print-columns"><th scope="col">${special?'Serviço':'Sala'}</th>${days.map(day=>`<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${items.map(room=>`<tr><th scope="row">${escape(services[room] || `Sala ${String(room).padStart(2,'0')}`)}</th>${days.map((_,day)=>{const row=rows.get(`${room}-${day}-${shift}`);return `<td class="print-cell print-${escape(String(row?.status||'LIVRE').toLowerCase())}">${printCell(row)}</td>`}).join('')}</tr>`).join('')}</tbody></table></section>`;
  }).join('');
  return report;
}

export function printMap(state) {
  const report = preparePrintMap(state);
  document.body.append(report);
  document.body.classList.add('printing-report');
  const cleanup = () => { report.remove(); document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  try { window.print(); } catch (error) { cleanup(); throw error; }
}
