import { z } from "zod";

// Reusable Zod schemas for validation across client and server

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  entityType: z.string().optional(),
  isBorrower: z.boolean().default(false),
  isInvestor: z.boolean().default(false),
  isReferralPartner: z.boolean().default(false),
  isVendor: z.boolean().default(false),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export const loanCreateSchema = z.object({
  borrowerId: z.string().min(1, "Borrower is required"),
  type: z.enum([
    "PURCHASE_PLUS_REHAB",
    "PURCHASE_ONLY",
    "BRIDGE_FUNDING",
    "REHAB_ONLY",
    "COMMERCIAL_BRIDGE",
    "MULTIFAMILY_BRIDGE",
    "FIX_AND_FLIP",
    "BRRRR",
  ]),
  loanAmount: z.string().min(1, "Loan amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  termMonths: z.coerce.number().min(1, "Term is required"),
  purchasePrice: z.string().optional(),
  rehabBudget: z.string().optional(),
  exitStrategy: z
    .enum([
      "FIX_AND_FLIP",
      "BRRRR",
      "REFINANCE",
      "SALE",
      "WHOLETAIL",
      "HOLD",
      "OTHER",
    ])
    .optional(),
});

export const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  propertyType: z.enum([
    "SFR",
    "CONDO",
    "TOWNHOUSE",
    "DUPLEX",
    "TRIPLEX",
    "FOURPLEX",
    "MULTIFAMILY_5_PLUS",
    "MIXED_USE",
    "COMMERCIAL_RETAIL",
    "COMMERCIAL_OFFICE",
    "INDUSTRIAL",
    "LAND",
    "MOBILE_HOME",
  ]),
  yearBuilt: z.coerce.number().optional(),
  squareFeet: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
});

export const paymentSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;
export type LoanCreateFormData = z.infer<typeof loanCreateSchema>;
export type PropertyFormData = z.infer<typeof propertySchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
