import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";

// GET /api/integrations — list available integrations and their status
export const GET = withAuth(async (request, ctx) => {
  const integrations = [
    {
      id: "resend",
      name: "Resend (Email)",
      category: "communications",
      description: "Send transactional and marketing emails",
      configured: !!process.env.RESEND_API_KEY,
      requiredEnvVars: ["RESEND_API_KEY", "EMAIL_FROM"],
    },
    {
      id: "twilio",
      name: "Twilio (SMS)",
      category: "communications",
      description: "Send SMS notifications and reminders",
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      requiredEnvVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    },
    {
      id: "docusign",
      name: "DocuSign (E-Signatures)",
      category: "documents",
      description: "Electronic document signing",
      configured: !!(process.env.DOCUSIGN_INTEGRATION_KEY && process.env.DOCUSIGN_ACCOUNT_ID),
      requiredEnvVars: ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_SECRET_KEY", "DOCUSIGN_ACCOUNT_ID"],
    },
    {
      id: "stripe",
      name: "Stripe (Payments)",
      category: "payments",
      description: "Process payments and handle payment links",
      configured: !!process.env.STRIPE_SECRET_KEY,
      requiredEnvVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    },
    {
      id: "plaid",
      name: "Plaid (ACH/Banking)",
      category: "payments",
      description: "ACH transfers and bank account verification",
      configured: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
      requiredEnvVars: ["PLAID_CLIENT_ID", "PLAID_SECRET"],
    },
    {
      id: "quickbooks",
      name: "QuickBooks Online",
      category: "accounting",
      description: "Sync transactions with QuickBooks",
      configured: !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET),
      requiredEnvVars: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_REALM_ID"],
    },
    {
      id: "propstream",
      name: "PropStream (Property Data)",
      category: "data",
      description: "Property data lookup and comps",
      configured: !!process.env.PROPSTREAM_API_KEY,
      requiredEnvVars: ["PROPSTREAM_API_KEY"],
    },
    {
      id: "google_places",
      name: "Google Places",
      category: "data",
      description: "Address autocomplete and verification",
      configured: !!process.env.GOOGLE_PLACES_API_KEY,
      requiredEnvVars: ["GOOGLE_PLACES_API_KEY"],
    },
  ];

  return NextResponse.json({ integrations });
}, "manage_org_settings");

// POST /api/integrations — test an integration connection
export const POST = withAuth(async (request, ctx) => {
  const { integrationId } = await request.json();

  const tests: Record<string, () => Promise<{ success: boolean; message: string }>> = {
    resend: async () => {
      if (!process.env.RESEND_API_KEY) return { success: false, message: "RESEND_API_KEY not configured" };
      try {
        const res = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        return { success: res.ok, message: res.ok ? "Connected successfully" : "Authentication failed" };
      } catch (err) {
        return { success: false, message: `Connection failed: ${err}` };
      }
    },
    twilio: async () => {
      if (!process.env.TWILIO_ACCOUNT_SID) return { success: false, message: "TWILIO_ACCOUNT_SID not configured" };
      try {
        const authString = Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
          { headers: { Authorization: `Basic ${authString}` } }
        );
        return { success: res.ok, message: res.ok ? "Connected successfully" : "Authentication failed" };
      } catch (err) {
        return { success: false, message: `Connection failed: ${err}` };
      }
    },
    stripe: async () => {
      if (!process.env.STRIPE_SECRET_KEY) return { success: false, message: "STRIPE_SECRET_KEY not configured" };
      try {
        const res = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        });
        return { success: res.ok, message: res.ok ? "Connected successfully" : "Authentication failed" };
      } catch (err) {
        return { success: false, message: `Connection failed: ${err}` };
      }
    },
  };

  const testFn = tests[integrationId];
  if (!testFn) {
    return NextResponse.json({ success: false, message: "No test available for this integration" });
  }

  const result = await testFn();
  return NextResponse.json(result);
}, "manage_org_settings");
