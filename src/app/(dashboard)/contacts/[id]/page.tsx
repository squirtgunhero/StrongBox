"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const TABS = ["Info", "Loans", "Documents", "Communications"] as const;
type Tab = (typeof TABS)[number];

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("Info");

  const { data, isLoading, error } = useQuery({
    queryKey: ["contacts", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch contact");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !data?.contact) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-red-500">Contact not found</p>
        <Link href="/contacts" className="text-sm text-[#1E3A5F] mt-2 inline-block">
          Back to contacts
        </Link>
      </div>
    );
  }

  const contact = data.contact;

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
            {contact.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {contact.companyName}
              </span>
            )}
            {contact.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {contact.email}
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {contact.phone}
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-2">
            {contact.isBorrower && (
              <span className="rounded-full bg-[#EFF4F9] px-2 py-0.5 text-xs text-[#162D4A]">
                Borrower
              </span>
            )}
            {contact.isInvestor && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700950400">
                Investor
              </span>
            )}
            {contact.isReferralPartner && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700950400">
                Referral
              </span>
            )}
          </div>
        </div>
        {contact.naughtyLevel > 0 && (
          <div className="flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Risk Level {contact.naughtyLevel} | {contact.nsfCount} NSFs
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-[#1E3A5F] text-[#1E3A5F]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "Info" && <ContactInfoTab contact={contact} />}
      {activeTab === "Loans" && <ContactLoansTab loans={contact.loans} />}
      {activeTab === "Documents" && <ContactDocsTab documents={contact.documents} />}
      {activeTab === "Communications" && (
        <ContactCommsTab communications={contact.communications} />
      )}
    </div>
  );
}

function ContactInfoTab({ contact }: { contact: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-stone-500 mb-4">Contact Information</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Email</dt>
            <dd>{contact.email || "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Phone</dt>
            <dd>{contact.phone || "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Entity Type</dt>
            <dd>{contact.entityType || "-"}</dd>
          </div>
          {contact.address && (
            <div className="flex justify-between">
              <dt className="text-stone-500">Address</dt>
              <dd className="text-right">
                {contact.address}
                <br />
                {contact.city}, {contact.state} {contact.zip}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-stone-500 mb-4">Financial Profile</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Credit Score</dt>
            <dd>{contact.creditScore || "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Experience Level</dt>
            <dd>{contact.experienceLevel || "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Risk Score</dt>
            <dd>{contact.riskScore}/100</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">NSF Count</dt>
            <dd>{contact.nsfCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Bankruptcy History</dt>
            <dd>{contact.bankruptcyHistory ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Foreclosure History</dt>
            <dd>{contact.foreclosureHistory ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ContactLoansTab({ loans }: { loans: any[] }) {
  if (!loans?.length) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <FileText className="h-8 w-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-500">No loans found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">Loan #</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Type</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Created</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan: any) => (
            <tr key={loan.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/loans/${loan.id}`}
                  className="font-medium text-[#1E3A5F] hover:text-[#162D4A]"
                >
                  {loan.loanNumber}
                </Link>
              </td>
              <td className="px-4 py-3 text-stone-500">
                {loan.type.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3">{formatCurrency(loan.loanAmount)}</td>
              <td className="px-4 py-3">
                <LoanStatusBadge status={loan.status as LoanStatus} />
              </td>
              <td className="px-4 py-3 text-stone-500">{formatDate(loan.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactDocsTab({ documents }: { documents: any[] }) {
  if (!documents?.length) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <CreditCard className="h-8 w-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-500">No documents found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">File</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Category</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc: any) => (
            <tr key={doc.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{doc.fileName}</td>
              <td className="px-4 py-3 text-stone-500">{doc.category}</td>
              <td className="px-4 py-3 text-stone-500">{formatDate(doc.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactCommsTab({ communications }: { communications: any[] }) {
  if (!communications?.length) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <MessageSquare className="h-8 w-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-500">No communications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {communications.map((comm: any) => (
        <div
          key={comm.id}
          className="rounded-lg border bg-white p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium rounded-full bg-stone-100 px-2 py-0.5800">
              {comm.type.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-stone-400">{formatDate(comm.createdAt)}</span>
          </div>
          {comm.subject && <p className="text-sm font-medium">{comm.subject}</p>}
          <p className="text-sm text-stone-500 mt-1">{comm.body}</p>
        </div>
      ))}
    </div>
  );
}
