import { prisma } from '../prisma.js';
import type { Prisma } from '@prisma/client';

export interface CascadeLine {
  track: string;
  text: string;
}

export interface WriteAuditInput {
  actor: string;
  actorRole?: string;
  verb: string;
  target?: string;
  track: string;
  kind?: string;
  icon?: string;
  isSystem?: boolean;
  day?: string;
  time?: string;
  cascades?: CascadeLine[];
}

function nowParts() {
  const d = new Date();
  const day = `Today · ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { day, time };
}

export async function writeAudit(input: WriteAuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const { day, time } = nowParts();
  return client.auditEntry.create({
    data: {
      day: input.day ?? day,
      time: input.time ?? time,
      actor: input.actor,
      actorRole: input.actorRole,
      verb: input.verb,
      target: input.target,
      track: input.track,
      kind: input.kind ?? 'normal',
      icon: input.icon,
      isSystem: input.isSystem ?? false,
      cascades: input.cascades
        ? { create: input.cascades.map((c, i) => ({ order: i, track: c.track, text: c.text })) }
        : undefined,
    },
    include: { cascades: { orderBy: { order: 'asc' } } },
  });
}

// filter ∈ all | cascades | system | sales | operations | workshop | finance
export async function listAudit(filter = 'all') {
  const entries = await prisma.auditEntry.findMany({
    include: { cascades: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  if (filter === 'all') return entries;
  if (filter === 'cascades') return entries.filter((e) => e.cascades.length > 0);
  if (filter === 'system') return entries.filter((e) => e.isSystem);
  return entries.filter((e) => e.track === filter);
}
