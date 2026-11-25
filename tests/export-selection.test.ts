import { describe, expect, it } from 'vitest';
import { exportSelection } from '../src/export-selection.js';

describe('opções de exportação', () => {
  it('seleciona salas, turnos e serviços de acordo com a escolha', () => {
    expect(exportSelection('rooms_morning')).toMatchObject({rooms:true,services:false,shifts:['MANHA'],roomRange:{gte:1,lte:17}});
    expect(exportSelection('rooms_afternoon')).toMatchObject({rooms:true,services:false,shifts:['TARDE']});
    expect(exportSelection('rooms_both')).toMatchObject({rooms:true,services:false,shifts:['MANHA','TARDE']});
    expect(exportSelection('services')).toMatchObject({rooms:false,services:true,roomRange:{gte:18,lte:22}});
    expect(exportSelection('all')).toMatchObject({rooms:true,services:true,roomRange:{gte:1,lte:22}});
  });
  it('rejeita opções desconhecidas e mantém o padrão completo', () => {
    expect(exportSelection('outro')).toBeNull();
    expect(exportSelection(['all'])).toBeNull();
    expect(exportSelection(undefined)?.option).toBe('all');
  });
});
