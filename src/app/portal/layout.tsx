"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Wallet, ArrowRightLeft, LogOut, FileText, Hammer, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/portfolio", label: "Portfolio", icon: Building2 },
  { href: "/portal/account", label: "Account", icon: Wallet },
  { href: "/portal/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/draws", label: "Draws", icon: Hammer },
  { href: "/portal/payments", label: "Payments", icon: CreditCard },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="text-sm font-bold">
              StrongBox <span className="text-zinc-400 font-normal">Portal</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                        : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700">
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
