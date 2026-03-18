"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Landmark, Loader2, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<"password" | "magic-link">("password");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  }

  if (magicLinkSent) {
    return (
      <div className="rounded-lg rounded-xl p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-6 w-6 text-[#3B82F6]" />
          </div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-zinc-500 text-center">
            We sent a sign-in link to <strong>{email}</strong>. Click the link
            in the email to sign in.
          </p>
          <button
            onClick={() => setMagicLinkSent(false)}
            className="text-sm text-[#3B82F6] hover:text-blue-400"
          >
            Try a different method
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg rounded-xl p-8 shadow-sm">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-2">
          <Landmark className="h-7 w-7 text-[#3B82F6]" />
          <span className="text-xl font-bold">StrongBox</span>
        </div>
        <p className="text-sm text-zinc-500">Sign in to your account</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
        className="space-y-4"
      >
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
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-1 focus:ring-[#3B82F6]"
          />
        </div>

        {mode === "password" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#3B82F6] hover:text-blue-400"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "password" ? "Sign in" : "Send magic link"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => setMode(mode === "password" ? "magic-link" : "password")}
          className="text-sm text-zinc-500 hover:text-white"
        >
          {mode === "password"
            ? "Sign in with magic link instead"
            : "Sign in with password instead"}
        </button>
      </div>
    </div>
  );
}
