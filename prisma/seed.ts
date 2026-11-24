import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function defaultAssignments() {
  const source = await readFile(path.join(process.cwd(), 'prisma', 'default-assignments.json'), 'utf8');
  return JSON.parse(source) as Array<Record<string, unknown>>;
}

async function main() {
  const username = (process.env.ADMIN_USER || 'admin').toLowerCase();
  const email = `${username}@local`;
  const existing = await db.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing && !existing.username) await db.user.update({ where: { id: existing.id }, data: { username } });
  if (!existing) await db.user.create({ data: { name: process.env.ADMIN_NAME || 'Administrador', username, email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || '123456', 12), role: 'ADMIN' } });

  for (const assignment of await defaultAssignments()) {
    const row = assignment as any;
    // Só preenche células criadas vazias pelo sistema, sem histórico de edição.
    const current = await db.assignment.findUnique({ where: { unit_room_weekday_scope_shift: { unit: 'MANGABEIRAS', room: row.room, weekday: row.weekday, scope: 'PADRAO', shift: row.shift } } });
    if (current && current.status === 'LIVRE' && current.version === 1 && !current.updatedById && !current.professional && !current.code && !current.specialty && !current.operator && !current.notes && !current.rawText && !current.needsReview) {
      const history = await db.audit.count({ where: { assignmentId: current.id } });
      if (history === 0) await db.assignment.updateMany({ where: { id: current.id, version: 1, updatedById: null, status: 'LIVRE', professional: null, code: null, specialty: null, operator: null, notes: null, rawText: null, needsReview: false }, data: row });
    }
    await db.assignment.upsert({
      where: { unit_room_weekday_scope_shift: { unit: 'MANGABEIRAS', room: row.room, weekday: row.weekday, scope: 'PADRAO', shift: row.shift } },
      update: {},
      create: row
    });
  }
}

main().finally(() => db.$disconnect());
