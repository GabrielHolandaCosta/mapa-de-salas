const fields = [
  ['status', 'Status'], ['professional', 'Profissional'], ['code', 'Código / matrícula'],
  ['specialty', 'Especialidade'], ['operator', 'Responsável'], ['notes', 'Observações'],
  ['secretary', 'Tem secretária'], ['fortnightly', 'Atende a cada 15 dias'], ['rawText', 'Texto original importado']
];
const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const services = {18:'ECO',19:'MAPA / HOLTER',20:'ECG',21:'T. ERGO / ESPIRO',22:'EEG'};
const flag = (snapshot, expression) => expression.test([snapshot.operator, snapshot.notes, snapshot.rawText].filter(Boolean).join(' '));
function values(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const result = {...snapshot};
  result.operator = typeof snapshot.operator === 'string' ? snapshot.operator.replace(/\s*[·|\-]?\s*\[?secret[áa]ria\]?/ig, '').trim() : snapshot.operator;
  result.notes = typeof snapshot.notes === 'string' ? snapshot.notes.replace(/\s*[·|\-]?\s*\[?15\s*dias?\]?/ig, '').trim() : snapshot.notes;
  if (['operator','notes','rawText'].every(key => Object.hasOwn(snapshot,key))) {
    result.secretary = flag(snapshot, /secret[áa]ria/i) ? 'Sim' : 'Não';
    result.fortnightly = flag(snapshot, /\b15\s*dias?\b/i) ? 'Sim' : 'Não';
  }
  return result;
}
const display = (field, value) => {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (field === 'status') return ({LIVRE:'Livre',OCUPADA:'Ocupada',RESERVADA:'Reservada',FECHADA:'Fechada'})[value] || String(value);
  return String(value);
};
export function historyDetails(log) {
  const before = values(log.before), after = values(log.after);
  const changes = [];
  if (before && after) for (const [key,label] of fields) {
    if (!Object.hasOwn(before,key) || !Object.hasOwn(after,key)) continue;
    const oldValue = display(key,before[key]), newValue = display(key,after[key]);
    if (oldValue !== newValue) changes.push({label,before:oldValue,after:newValue});
  }
  const room = services[log.room] || (Number.isInteger(log.room) && log.room > 0 ? `Sala ${String(log.room).padStart(2,'0')}` : 'Local não informado');
  let day = Number.isInteger(log.weekday) ? weekdays[log.weekday] : null;
  if (log.scope === 'DATA' && log.date) { const date = new Date(log.date); if (!Number.isNaN(date.valueOf())) day = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'UTC'}).format(date); }
  const shift = log.shift === 'MANHA' ? 'Manhã' : log.shift === 'TARDE' ? 'Tarde' : 'Turno não informado';
  return {room, day:day || 'Dia não informado', shift, changes, complete:Boolean(before && after)};
}
