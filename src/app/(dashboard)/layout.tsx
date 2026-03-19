import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-white text-black">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_12%_18%,rgba(195,55,50,0.12),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.05),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8f8f8_100%)]" />
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
