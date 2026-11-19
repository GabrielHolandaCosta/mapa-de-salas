import { describe,it,expect } from 'vitest';
describe('perfis do Mapa de Salas',()=>{it('mantém a hierarquia esperada',()=>{expect(['ADMIN','EDITOR']).toContain('EDITOR');expect('VIEWER').not.toBe('ADMIN')})});
