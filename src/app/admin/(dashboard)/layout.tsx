import AdminNav from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-4 py-2 sm:py-4 print:hidden">
        <AdminNav />
      </header>
      <main className="p-6 print:p-0">{children}</main>
    </div>
  );
}
