export const exportOptions = ['all', 'rooms_morning', 'rooms_afternoon', 'rooms_both', 'services'] as const;
export type ExportOption = typeof exportOptions[number];

export function exportSelection(value: unknown) {
  if (value !== undefined && (typeof value !== 'string' || !exportOptions.includes(value as ExportOption))) return null;
  const option = (value || 'all') as ExportOption;
  return {
    option,
    rooms: option !== 'services',
    services: option === 'all' || option === 'services',
    shifts: option === 'rooms_morning' ? ['MANHA'] as const : option === 'rooms_afternoon' ? ['TARDE'] as const : ['MANHA', 'TARDE'] as const,
    roomRange: option === 'services' ? {gte:18,lte:22} : option === 'all' ? {gte:1,lte:22} : {gte:1,lte:17},
  };
}
