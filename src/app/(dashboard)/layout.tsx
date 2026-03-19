import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#070b12] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_12%_18%,rgba(40,96,194,0.28),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(20,74,155,0.2),transparent_26%),linear-gradient(180deg,#090f1b_0%,#070b12_100%)]" />
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
