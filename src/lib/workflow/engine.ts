import { prisma } from "@/lib/prisma";
import { executeAction } from "./actions";

/**
 * Evaluate and execute workflow rules for a given trigger
 */
export async function evaluateWorkflowRules(params: {
  organizationId: string;
  triggerEntity: string;
  triggerEvent: string;
  entityData: Record<string, unknown>;
}) {
  const rules = await prisma.workflowRule.findMany({
    where: {
      organizationId: params.organizationId,
      triggerEntity: params.triggerEntity,
      triggerEvent: params.triggerEvent,
      isActive: true,
    },
  });

  for (const rule of rules) {
    const conditions = rule.conditions as Record<string, unknown>;
    if (matchesConditions(params.entityData, conditions)) {
      const actions = rule.actions as Array<{
        type: string;
        config: Record<string, unknown>;
      }>;
      for (const action of actions) {
        await executeAction(action.type, action.config, params.entityData);
      }
    }
  }
}

function matchesConditions(
  data: Record<string, unknown>,
  conditions: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    if (data[key] !== value) return false;
  }
  return true;
}
