import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import crypto from "crypto";

// GET /api/webhooks — list webhook endpoints for the org
export const GET = withAuth(async (request, ctx) => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ endpoints });
}, "manage_org_settings");

// POST /api/webhooks — register a new webhook endpoint or trigger delivery
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { action } = body;

  // Register new endpoint
  if (action === "register") {
    const { url, events, secret } = body;

    if (!url || !events?.length) {
      return NextResponse.json(
        { error: "url and events[] are required" },
        { status: 400 }
      );
    }

    const generatedSecret = secret || crypto.randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        url,
        events,
        secret: generatedSecret,
        isActive: true,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      action: "CREATE",
      entityType: "WebhookEndpoint",
      entityId: endpoint.id,
      description: `Registered webhook endpoint: ${url}`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });

    return NextResponse.json({ endpoint, secret: generatedSecret }, { status: 201 });
  }

  // Test an endpoint
  if (action === "test") {
    const { endpointId } = body;
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId: ctx.organizationId },
    });

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const testPayload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      data: { message: "Test webhook from StrongBox" },
    };

    const result = await deliverWebhook(endpoint, testPayload);
    return NextResponse.json({ result });
  }

  // Toggle active/inactive
  if (action === "toggle") {
    const { endpointId } = body;
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId: ctx.organizationId },
    });

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { isActive: !endpoint.isActive },
    });

    return NextResponse.json({ endpoint: updated });
  }

  // Delete
  if (action === "delete") {
    const { endpointId } = body;
    await prisma.webhookEndpoint.delete({
      where: { id: endpointId },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, "manage_org_settings");

// Webhook delivery helper
async function deliverWebhook(
  endpoint: { id: string; url: string; secret: string },
  payload: Record<string, unknown>
) {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");

  const startTime = Date.now();

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StrongBox-Signature": `sha256=${signature}`,
        "X-StrongBox-Event": (payload.event as string) || "unknown",
        "X-StrongBox-Delivery": crypto.randomUUID(),
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    // Log delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: endpoint.id,
        event: (payload.event as string) || "unknown",
        payload: payload as any,
        responseStatus: res.status,
        responseBody: await res.text().catch(() => ""),
        duration,
        success: res.ok,
      },
    });

    return { success: res.ok, status: res.status, duration };
  } catch (err) {
    const duration = Date.now() - startTime;

    await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: endpoint.id,
        event: (payload.event as string) || "unknown",
        payload: payload as any,
        responseStatus: 0,
        responseBody: String(err),
        duration,
        success: false,
      },
    });

    return { success: false, error: String(err), duration };
  }
}

// Export for use by other modules (e.g., event bus)
export { deliverWebhook };
