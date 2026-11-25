import { describe, expect, it } from 'vitest';
import { PresenceTracker } from '../src/presence.js';

describe('presença', () => {
  it('mantém usuários online enquanto uma sessão estiver ativa e expira sessões antigas', () => {
    let now=0;
    const presence=new PresenceTracker(120_000,()=>now);
    presence.touch('pessoa','primeiro navegador');
    now=60_000;
    presence.touch('pessoa','outro navegador');
    presence.remove('primeiro navegador');
    expect(presence.onlineUsers().has('pessoa')).toBe(true);
    now=180_000;
    expect(presence.onlineUsers().has('pessoa')).toBe(false);
  });
  it('mantém os usuários independentes e reconhece a saída', () => {
    const presence=new PresenceTracker();
    presence.touch('um','sessao-um');presence.touch('dois','sessao-dois');
    presence.remove('sessao-um');
    expect([...presence.onlineUsers()]).toEqual(['dois']);
  });
});
