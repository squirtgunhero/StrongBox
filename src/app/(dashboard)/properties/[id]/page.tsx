"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Loader2,
  Save,
  MapPin,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const PROPERTY_TYPES = [
  "SFR", "CONDO", "TOWNHOUSE", "DUPLEX", "TRIPLEX", "FOURPLEX",
  "MULTIFAMILY_5_PLUS", "MIXED_USE", "COMMERCIAL_RETAIL",
  "COMMERCIAL_OFFICE", "INDUSTRIAL", "LAND", "MOBILE_HOME",
];

const TABS = ["Details", "Valuation", "Loan", "Documents"];

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["property", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch property");
      return res.json();
    },
  });

  const updateProperty = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await fetch(`/api/properties/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update property");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", params.id] });
      setEditing(false);
    },
  });

  const property = data?.property;
  const inputClass =
    "w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#C33732]";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center p-12">
        <p className="text-zinc-500">Property not found</p>
      </div>
    );
  }

  const startEditing = () => {
    setForm({
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      county: property.county || "",
      parcelNumber: property.parcelNumber || "",
      propertyType: property.propertyType,
      yearBuilt: property.yearBuilt || "",
      squareFeet: property.squareFeet || "",
      bedrooms: property.bedrooms || "",
      bathrooms: property.bathrooms ? Number(property.bathrooms) : "",
      stories: property.stories || "",
      units: property.units || "",
      condition: property.condition || "",
      occupancyStatus: property.occupancyStatus || "",
      purchasePrice: property.purchasePrice ? Number(property.purchasePrice) : "",
      currentValue: property.currentValue ? Number(property.currentValue) : "",
      appraisedValue: property.appraisedValue ? Number(property.appraisedValue) : "",
      arv: property.arv ? Number(property.arv) : "",
      insuranceValue: property.insuranceValue ? Number(property.insuranceValue) : "",
      notes: property.notes || "",
    });
    setEditing(true);
  };

  const saveEdits = () => {
    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(form)) {
      if (val !== "" && val !== null && val !== undefined) {
        updates[key] = val;
      }
    }
    updateProperty.mutate(updates);
  };

  return (
    <div>
      <Link
        href="/properties"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-black mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to properties
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C33732]/10">
            <Home className="h-5 w-5 text-[#C33732]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{property.address}</h1>
            <p className="text-sm text-zinc-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {property.city}, {property.state} {property.zip}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={updateProperty.isPending}
                className="flex items-center gap-1.5 rounded-md bg-[#C33732] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#A52F2B] disabled:opacity-50"
              >
                {updateProperty.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/5"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-zinc-500">Type</p>
          <p className="text-sm font-medium mt-0.5">
            {property.propertyType?.replace(/_/g, " ")}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-zinc-500">Bed / Bath</p>
          <p className="text-sm font-medium mt-0.5">
            {property.bedrooms ?? "-"} / {property.bathrooms ? Number(property.bathrooms) : "-"}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-zinc-500">Sq Ft</p>
          <p className="text-sm font-medium mt-0.5">
            {property.squareFeet?.toLocaleString() ?? "-"}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-zinc-500">Year Built</p>
          <p className="text-sm font-medium mt-0.5">{property.yearBuilt ?? "-"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-4">
        <div className="flex gap-6">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={cn(
                "pb-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                i === tab
                  ? "border-[#1E3A5F] text-[#C33732]"
                  : "border-transparent text-zinc-500 hover:text-black"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-6">
        {/* Details Tab */}
        {tab === 0 && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-zinc-700">
              Property Details
            </h3>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP</label>
                    <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">County</label>
                  <input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Parcel Number</label>
                  <input value={form.parcelNumber} onChange={(e) => setForm({ ...form, parcelNumber: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Property Type</label>
                  <select value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} className={inputClass}>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year Built</label>
                  <input type="number" value={form.yearBuilt} onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sq Ft</label>
                  <input type="number" value={form.squareFeet} onChange={(e) => setForm({ ...form, squareFeet: e.target.value })} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Beds</label>
                    <input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Baths</label>
                    <input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Stories</label>
                    <input type="number" value={form.stories} onChange={(e) => setForm({ ...form, stories: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Units</label>
                    <input type="number" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Condition</label>
                  <input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g. Fair, Good, Excellent" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Occupancy</label>
                  <input value={form.occupancyStatus} onChange={(e) => setForm({ ...form, occupancyStatus: e.target.value })} placeholder="e.g. Vacant, Occupied" className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass} />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Field label="Address" value={property.address} />
                <Field label="City" value={property.city} />
                <Field label="State" value={property.state} />
                <Field label="ZIP" value={property.zip} />
                <Field label="County" value={property.county} />
                <Field label="Parcel Number" value={property.parcelNumber} />
                <Field label="Property Type" value={property.propertyType?.replace(/_/g, " ")} />
                <Field label="Year Built" value={property.yearBuilt} />
                <Field label="Sq Ft" value={property.squareFeet?.toLocaleString()} />
                <Field label="Bedrooms" value={property.bedrooms} />
                <Field label="Bathrooms" value={property.bathrooms ? Number(property.bathrooms) : null} />
                <Field label="Stories" value={property.stories} />
                <Field label="Units" value={property.units} />
                <Field label="Condition" value={property.condition} />
                <Field label="Occupancy" value={property.occupancyStatus} />
                {property.notes && (
                  <div className="col-span-full">
                    <dt className="text-zinc-500">Notes</dt>
                    <dd className="font-medium mt-0.5 whitespace-pre-wrap">{property.notes}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}

        {/* Valuation Tab */}
        {tab === 1 && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-zinc-700">
              Valuation & Financials
            </h3>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Price</label>
                  <input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Value</label>
                  <input type="number" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Appraised Value</label>
                  <input type="number" value={form.appraisedValue} onChange={(e) => setForm({ ...form, appraisedValue: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ARV</label>
                  <input type="number" value={form.arv} onChange={(e) => setForm({ ...form, arv: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Insurance Value</label>
                  <input type="number" value={form.insuranceValue} onChange={(e) => setForm({ ...form, insuranceValue: e.target.value })} className={inputClass} />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <CurrencyField label="Purchase Price" value={property.purchasePrice} />
                <CurrencyField label="Current Value" value={property.currentValue} />
                <CurrencyField label="Appraised Value" value={property.appraisedValue} />
                <CurrencyField label="ARV" value={property.arv} />
                <CurrencyField label="Insurance Value" value={property.insuranceValue} />
                <CurrencyField label="Tax Assessment" value={property.taxAssessment} />
                <CurrencyField label="Annual Taxes" value={property.annualTaxes} />
                <CurrencyField label="HOA Monthly" value={property.hoaMonthly} />
              </dl>
            )}
          </div>
        )}

        {/* Loan Tab */}
        {tab === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">
              Associated Loan
            </h3>
            {property.loan ? (
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/loans/${property.loan.id}`}
                    className="text-[#C33732] font-medium hover:text-[#A52F2B]"
                  >
                    {property.loan.loanNumber}
                  </Link>
                  <LoanStatusBadge status={property.loan.status as LoanStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Borrower</p>
                    <p className="font-medium">
                      {property.loan.borrower?.firstName} {property.loan.borrower?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Amount</p>
                    <p className="font-medium">
                      {formatCurrency(property.loan.loanAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Rate</p>
                    <p className="font-medium">
                      {Number(property.loan.interestRate).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Term</p>
                    <p className="font-medium">{property.loan.termMonths} mo</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No loan associated</p>
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {tab === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">
              Documents
            </h3>
            {property.documents?.length ? (
              <div className="space-y-2">
                {property.documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium">{doc.fileName}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8">
                <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No documents yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium mt-0.5">{value ?? "-"}</dd>
    </div>
  );
}

function CurrencyField({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium mt-0.5">
        {value ? formatCurrency(Number(value)) : "-"}
      </dd>
    </div>
  );
}
