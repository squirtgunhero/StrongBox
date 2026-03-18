"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  isBorrower: boolean;
  isInvestor: boolean;
  isReferralPartner: boolean;
  isVendor: boolean;
  isActive: boolean;
  naughtyLevel: number;
  createdAt: string;
  _count: { loans: number };
}

const TABS = [
  { key: "", label: "All" },
  { key: "borrower", label: "Borrowers" },
  { key: "investor", label: "Investors" },
  { key: "referral", label: "Referral Partners" },
  { key: "vendor", label: "Vendors" },
];

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", { search, type, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      params.set("page", page.toString());
      params.set("limit", "25");
      const res = await fetch(`/api/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json() as Promise<{
        contacts: ContactRecord[];
        total: number;
        page: number;
        limit: number;
      }>;
    },
  });

  const createContact = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setShowForm(false);
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Contact
        </button>
      </div>

      {showForm && (
        <ContactForm
          onSubmit={(d) => createContact.mutate(d)}
          onCancel={() => setShowForm(false)}
          isLoading={createContact.isPending}
          error={createContact.error?.message}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setType(tab.key);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                type === tab.key
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : !data?.contacts?.length ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No contacts found</p>
            <p className="text-xs text-zinc-400 mt-1">
              {search ? "Try a different search" : "Create your first contact"}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Loans</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {contact.lastName}, {contact.firstName}
                      </Link>
                      {contact.companyName && (
                        <p className="text-xs text-zinc-400">{contact.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{contact.email || "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">{contact.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {contact.isBorrower && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                            Borrower
                          </span>
                        )}
                        {contact.isInvestor && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
                            Investor
                          </span>
                        )}
                        {contact.isReferralPartner && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                            Referral
                          </span>
                        )}
                        {contact.isVendor && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Vendor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{contact._count.loans}</td>
                    <td className="px-4 py-3">
                      {contact.naughtyLevel > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
                          Level {contact.naughtyLevel}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">Good</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">
                  Showing {(page - 1) * data.limit + 1}-
                  {Math.min(page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ContactForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    entityType: "",
    isBorrower: true,
    isInvestor: false,
    isReferralPartner: false,
    isVendor: false,
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  const update = (field: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="mb-6 rounded-lg border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <h2 className="text-lg font-medium mb-4">New Contact</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(formData);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              First Name *
            </label>
            <input
              required
              value={formData.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Last Name *
            </label>
            <input
              required
              value={formData.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Company / Entity
            </label>
            <input
              value={formData.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Phone
            </label>
            <input
              value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Contact Type
          </label>
          <div className="flex gap-4">
            {[
              { key: "isBorrower", label: "Borrower" },
              { key: "isInvestor", label: "Investor" },
              { key: "isReferralPartner", label: "Referral Partner" },
              { key: "isVendor", label: "Vendor" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData[key as keyof typeof formData] as boolean}
                  onChange={(e) => update(key, e.target.checked)}
                  className="rounded border-zinc-300"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Address
            </label>
            <input
              value={formData.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              City
            </label>
            <input
              value={formData.city}
              onChange={(e) => update("city", e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                State
              </label>
              <input
                value={formData.state}
                onChange={(e) => update("state", e.target.value)}
                maxLength={2}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                ZIP
              </label>
              <input
                value={formData.zip}
                onChange={(e) => update("zip", e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Contact
          </button>
        </div>
      </form>
    </div>
  );
}
