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
    await db.assignment.upsert({
      where: { room_weekday_scope_shift: { room: row.room, weekday: row.weekday, scope: 'PADRAO', shift: row.shift } },
      update: {},
      create: row
    });
  }
}

main().finally(() => db.$disconnect());
