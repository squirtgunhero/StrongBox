"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-xl p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-6 w-6 text-[#3B82F6]" />
          </div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-zinc-500 text-center">
            We sent a password reset link to <strong>{email}</strong>.
          </p>
          <Link
            href="/login"
            className="text-sm text-[#3B82F6] hover:text-blue-400"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-8 shadow-sm">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#3B82F6]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>
    </div>
  );
}
