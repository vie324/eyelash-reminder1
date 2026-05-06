import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { webhookEvents, type WebhookEvent } from "@/db/schema";

export async function insertWebhookEvent(input: {
  eventType: string;
  tenantId?: string | null;
  lineUserId?: string | null;
  rawPayload: unknown;
}): Promise<WebhookEvent> {
  const [row] = await db
    .insert(webhookEvents)
    .values({
      eventType: input.eventType,
      tenantId: input.tenantId ?? null,
      lineUserId: input.lineUserId ?? null,
      rawPayload: input.rawPayload as object,
    })
    .returning();
  return row;
}

export async function markWebhookEventProcessed(
  id: string,
  errorMessage?: string,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      processed: errorMessage === undefined,
      processedAt: new Date(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(webhookEvents.id, id));
}
