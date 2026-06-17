import { getFamilyMemberLink } from '../db/queries/family.js';
import { getCurrentPlan, getSavingsThisWeek } from '../db/queries/landing.js';
import { throwForbidden, throwNotFound } from '../middleware/errorHandler.js';

export interface FamilyPlanServiceResponse {
  holder_display_name: string | null;
  holder_savings_this_week: number;
  plan: Record<string, unknown>;
}

export async function getFamilyPlan(userId: string): Promise<FamilyPlanServiceResponse> {
  const link = await getFamilyMemberLink(userId);

  if (!link?.accountHolderId) {
    throwForbidden('NOT_A_FAMILY_MEMBER', "You're not linked to an account holder.");
  }

  const holderId = link.accountHolderId;

  const [plan, savingsThisWeek] = await Promise.all([
    getCurrentPlan(holderId),
    getSavingsThisWeek(holderId),
  ]);

  if (!plan) {
    throwNotFound('NO_PLAN', "The account holder doesn't have a plan for this week yet.");
  }

  return {
    holder_display_name: link.holderDisplayName,
    holder_savings_this_week: savingsThisWeek,
    plan,
  };
}
