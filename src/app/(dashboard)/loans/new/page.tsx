"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Borrower", "Property", "Loan Terms", "Review"];
const LOAN_TYPES = [
  { value: "PURCHASE_PLUS_REHAB", label: "Purchase + Rehab" },
  { value: "PURCHASE_ONLY", label: "Purchase Only" },
  { value: "BRIDGE_FUNDING", label: "Bridge Funding" },
  { value: "REHAB_ONLY", label: "Rehab Only" },
  { value: "COMMERCIAL_BRIDGE", label: "Commercial Bridge" },
  { value: "MULTIFAMILY_BRIDGE", label: "Multifamily Bridge" },
  { value: "FIX_AND_FLIP", label: "Fix & Flip" },
  { value: "BRRRR", label: "BRRRR" },
];
const EXIT_STRATEGIES = [
  { value: "FIX_AND_FLIP", label: "Fix & Flip" },
  { value: "BRRRR", label: "BRRRR" },
  { value: "REFINANCE", label: "Refinance" },
  { value: "SALE", label: "Sale" },
  { value: "WHOLETAIL", label: "Wholetail" },
  { value: "HOLD", label: "Hold" },
  { value: "OTHER", label: "Other" },
];
const PROPERTY_TYPES = [
  "SFR", "CONDO", "TOWNHOUSE", "DUPLEX", "TRIPLEX", "FOURPLEX",
  "MULTIFAMILY_5_PLUS", "MIXED_USE", "COMMERCIAL_RETAIL",
];

interface FormData {
  borrowerId: string;
  type: string;
  exitStrategy: string;
  loanAmount: string;
  interestRate: string;
  termMonths: string;
  purchasePrice: string;
  rehabBudget: string;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyType: string;
    yearBuilt: string;
    squareFeet: string;
    bedrooms: string;
    bathrooms: string;
  };
}

const initialForm: FormData = {
  borrowerId: "",
  type: "PURCHASE_PLUS_REHAB",
  exitStrategy: "FIX_AND_FLIP",
  loanAmount: "",
  interestRate: "12",
  termMonths: "12",
  purchasePrice: "",
  rehabBudget: "",
  property: {
    address: "",
    city: "",
    state: "",
    zip: "",
    propertyType: "SFR",
    yearBuilt: "",
    squareFeet: "",
    bedrooms: "",
    bathrooms: "",
  },
};

export default function NewLoanPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);

  const { data: contactsData } = useQuery({
    queryKey: ["contacts", { type: "borrower" }],
    queryFn: async () => {
      const res = await fetch("/api/contacts?type=borrower&limit=200");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const createLoan = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: Record<string, unknown> = {
        borrowerId: data.borrowerId,
        type: data.type,
        exitStrategy: data.exitStrategy || undefined,
        loanAmount: data.loanAmount,
        interestRate: data.interestRate,
        termMonths: parseInt(data.termMonths),
        purchasePrice: data.purchasePrice || undefined,
        rehabBudget: data.rehabBudget || undefined,
      };
      if (data.property.address) {
        payload.property = {
          ...data.property,
          yearBuilt: data.property.yearBuilt ? parseInt(data.property.yearBuilt) : undefined,
          squareFeet: data.property.squareFeet ? parseInt(data.property.squareFeet) : undefined,
          bedrooms: data.property.bedrooms ? parseInt(data.property.bedrooms) : undefined,
          bathrooms: data.property.bathrooms ? parseFloat(data.property.bathrooms) : undefined,
        };
      }
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create loan");
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/loans/${data.loan.id}`);
    },
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const updateProp = (field: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      property: { ...prev.property, [field]: value },
    }));

  const canProceed =
    (step === 0 && form.borrowerId) ||
    step === 1 ||
    (step === 2 && form.loanAmount && form.interestRate && form.termMonths) ||
    step === 3;

  const inputClass =
    "w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#3B82F6]";

  return (
    <div>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to loans
      </Link>

      <h1 className="text-2xl font-semibold mb-6">Create New Loan</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                i < step
                  ? "bg-[#3B82F6] text-white"
                  : i === step
                  ? "bg-blue-500/10 text-[#162D4A] border-2 border-[#1E3A5F]"
                  : "bg-white/10 text-zinc-500"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-sm", i === step ? "font-medium" : "text-zinc-500")}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-8", i < step ? "bg-[#3B82F6]" : "bg-stone-200")} />
            )}
          </div>
        ))}
      </div>

      {createLoan.error && (
        <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {createLoan.error.message}
        </div>
      )}

      <div className="rounded-xl p-6">
        {/* Step 1: Borrower */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Select Borrower</h2>
            <select
              value={form.borrowerId}
              onChange={(e) => update("borrowerId", e.target.value)}
              className={inputClass}
            >
              <option value="">Select a borrower...</option>
              {contactsData?.contacts?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.lastName}, {c.firstName}
                  {c.companyName ? ` (${c.companyName})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Don&apos;t see the borrower?{" "}
              <Link href="/contacts" className="text-[#3B82F6]">
                Create a new contact first
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Property */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Property Information</h2>
            <p className="text-sm text-zinc-500">Optional — you can add this later.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Address</label>
                <input value={form.property.address} onChange={(e) => updateProp("address", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input value={form.property.city} onChange={(e) => updateProp("city", e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input value={form.property.state} onChange={(e) => updateProp("state", e.target.value)} maxLength={2} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP</label>
                  <input value={form.property.zip} onChange={(e) => updateProp("zip", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Property Type</label>
                <select value={form.property.propertyType} onChange={(e) => updateProp("propertyType", e.target.value)} className={inputClass}>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year Built</label>
                <input type="number" value={form.property.yearBuilt} onChange={(e) => updateProp("yearBuilt", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sq Ft</label>
                <input type="number" value={form.property.squareFeet} onChange={(e) => updateProp("squareFeet", e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Beds</label>
                  <input type="number" value={form.property.bedrooms} onChange={(e) => updateProp("bedrooms", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Baths</label>
                  <input type="number" step="0.5" value={form.property.bathrooms} onChange={(e) => updateProp("bathrooms", e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Loan Terms */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Loan Terms</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Loan Type *</label>
                <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputClass}>
                  {LOAN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Exit Strategy</label>
                <select value={form.exitStrategy} onChange={(e) => update("exitStrategy", e.target.value)} className={inputClass}>
                  {EXIT_STRATEGIES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Amount *</label>
                <input type="number" required value={form.loanAmount} onChange={(e) => update("loanAmount", e.target.value)} placeholder="250000" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Interest Rate (%) *</label>
                <input type="number" step="0.1" required value={form.interestRate} onChange={(e) => update("interestRate", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Term (months) *</label>
                <input type="number" required value={form.termMonths} onChange={(e) => update("termMonths", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Price</label>
                <input type="number" value={form.purchasePrice} onChange={(e) => update("purchasePrice", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rehab Budget</label>
                <input type="number" value={form.rehabBudget} onChange={(e) => update("rehabBudget", e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Review & Create</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Borrower</dt>
                <dd className="font-medium">
                  {contactsData?.contacts?.find((c: any) => c.id === form.borrowerId)
                    ? `${contactsData.contacts.find((c: any) => c.id === form.borrowerId).firstName} ${contactsData.contacts.find((c: any) => c.id === form.borrowerId).lastName}`
                    : form.borrowerId}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Loan Type</dt>
                <dd className="font-medium">{LOAN_TYPES.find((t) => t.value === form.type)?.label}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Amount</dt>
                <dd className="font-medium">${Number(form.loanAmount).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Rate</dt>
                <dd className="font-medium">{form.interestRate}%</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Term</dt>
                <dd className="font-medium">{form.termMonths} months</dd>
              </div>
              {form.property.address && (
                <div>
                  <dt className="text-zinc-500">Property</dt>
                  <dd className="font-medium">
                    {form.property.address}, {form.property.city} {form.property.state}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-30700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed}
            className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => createLoan.mutate(form)}
            disabled={createLoan.isPending}
            className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {createLoan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Loan
          </button>
        )}
      </div>
    </div>
  );
}
