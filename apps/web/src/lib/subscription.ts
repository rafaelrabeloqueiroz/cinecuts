import { prisma } from "@cinecuts/db";

const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: Array.from(ACTIVE_STATUSES) as never },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });

  if (!subscription) return false;
  if (ACTIVE_STATUSES.has(subscription.status) === false) return false;

  return subscription.currentPeriodEnd.getTime() > Date.now();
}
