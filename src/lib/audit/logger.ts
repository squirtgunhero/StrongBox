import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface AuditLogEntry {
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Write an entry to the immutable audit log
 */
export async function writeAuditLog(entry: AuditLogEntry) {
  const diff =
    entry.before && entry.after
      ? computeDiff(entry.before, entry.after)
      : undefined;

  const data: Prisma.AuditLogUncheckedCreateInput = {
    organizationId: entry.organizationId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    description: entry.description,
    userId: entry.userId,
    userEmail: entry.userEmail,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    before: entry.before as Prisma.InputJsonValue | undefined,
    after: entry.after as Prisma.InputJsonValue | undefined,
    diff: diff as Prisma.InputJsonValue | undefined,
    metadata: entry.metadata as Prisma.InputJsonValue | undefined,
  };

  return prisma.auditLog.create({ data });
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { from: before[key], to: after[key] };
    }
  }

  return diff;
}
