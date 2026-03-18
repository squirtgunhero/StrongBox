import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// Email/SMS templates stored as JSON in organization settings
// For now, we use a simple in-memory template system

const DEFAULT_TEMPLATES = [
  {
    id: "payment_reminder",
    name: "Payment Reminder",
    type: "EMAIL",
    subject: "Payment Reminder — {{loanNumber}}",
    body: `<p>Dear {{borrowerName}},</p>
<p>This is a reminder that your payment of <strong>{{paymentAmount}}</strong> for loan <strong>{{loanNumber}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
<p>Please ensure timely payment to avoid late fees.</p>
<p>Thank you,<br/>Strong Investor Loans</p>`,
    variables: ["borrowerName", "loanNumber", "paymentAmount", "dueDate"],
  },
  {
    id: "document_request",
    name: "Document Request",
    type: "EMAIL",
    subject: "Documents Needed — {{loanNumber}}",
    body: `<p>Dear {{borrowerName}},</p>
<p>We need the following documents for your loan <strong>{{loanNumber}}</strong>:</p>
<p>{{documentList}}</p>
<p>Please upload them through your borrower portal or reply to this email.</p>
<p>Thank you,<br/>Strong Investor Loans</p>`,
    variables: ["borrowerName", "loanNumber", "documentList"],
  },
  {
    id: "loan_approval",
    name: "Loan Approval Notice",
    type: "EMAIL",
    subject: "Loan Approved — {{loanNumber}}",
    body: `<p>Dear {{borrowerName}},</p>
<p>We are pleased to inform you that your loan <strong>{{loanNumber}}</strong> has been approved.</p>
<p><strong>Loan Amount:</strong> {{loanAmount}}<br/>
<strong>Interest Rate:</strong> {{interestRate}}%<br/>
<strong>Term:</strong> {{termMonths}} months</p>
<p>Our closing team will be in touch shortly with next steps.</p>
<p>Congratulations,<br/>Strong Investor Loans</p>`,
    variables: ["borrowerName", "loanNumber", "loanAmount", "interestRate", "termMonths"],
  },
  {
    id: "maturity_warning",
    name: "Maturity Warning",
    type: "EMAIL",
    subject: "Loan Maturity Notice — {{loanNumber}}",
    body: `<p>Dear {{borrowerName}},</p>
<p>Your loan <strong>{{loanNumber}}</strong> is approaching maturity on <strong>{{maturityDate}}</strong>.</p>
<p>Please contact us to discuss your exit strategy or extension options.</p>
<p>Best regards,<br/>Strong Investor Loans</p>`,
    variables: ["borrowerName", "loanNumber", "maturityDate"],
  },
  {
    id: "payment_late",
    name: "Late Payment Notice",
    type: "EMAIL",
    subject: "Late Payment Notice — {{loanNumber}}",
    body: `<p>Dear {{borrowerName}},</p>
<p>Our records indicate that your payment of <strong>{{paymentAmount}}</strong> for loan <strong>{{loanNumber}}</strong> was due on <strong>{{dueDate}}</strong> and has not yet been received.</p>
<p>A late fee of <strong>{{lateFee}}</strong> has been assessed. Please remit payment immediately.</p>
<p>Strong Investor Loans</p>`,
    variables: ["borrowerName", "loanNumber", "paymentAmount", "dueDate", "lateFee"],
  },
  {
    id: "sms_payment_reminder",
    name: "SMS Payment Reminder",
    type: "SMS",
    subject: "",
    body: "Reminder: Your payment of {{paymentAmount}} for loan {{loanNumber}} is due {{dueDate}}. Please ensure timely payment. - Strong Investor Loans",
    variables: ["paymentAmount", "loanNumber", "dueDate"],
  },
  {
    id: "sms_maturity_warning",
    name: "SMS Maturity Warning",
    type: "SMS",
    subject: "",
    body: "Your loan {{loanNumber}} matures on {{maturityDate}}. Please contact us to discuss your exit strategy. - Strong Investor Loans",
    variables: ["loanNumber", "maturityDate"],
  },
];

// GET /api/communications/templates
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");

  let templates = DEFAULT_TEMPLATES;
  if (type) {
    templates = templates.filter((t) => t.type === type);
  }

  return NextResponse.json({ templates });
}, "manage_org_settings");
