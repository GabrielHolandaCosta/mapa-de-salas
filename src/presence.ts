import crypto from 'node:crypto';

// Presence is a short-lived indication of an open, authenticated session.
export class PresenceTracker {
  private sessions = new Map<string, { userId: string; seenAt: number }>();
  constructor(private readonly timeoutMs = 120_000, private readonly now = () => Date.now()) {}
  private key(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
  private prune() { const cutoff = this.now() - this.timeoutMs; for (const [key, session] of this.sessions) if (session.seenAt <= cutoff) this.sessions.delete(key); }
  touch(userId: string, token: string) { this.prune(); this.sessions.set(this.key(token), { userId, seenAt: this.now() }); }
  remove(token: string) { this.sessions.delete(this.key(token)); }
  onlineUsers() { this.prune(); return new Set([...this.sessions.values()].map(session => session.userId)); }
}
