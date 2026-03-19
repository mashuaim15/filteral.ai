import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#191919]">
      {/* Navigation */}
      <nav className="border-b border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white font-[family-name:var(--font-logo)] tracking-tight">
            <Image src="/logo.svg" alt="Filteral" width={24} height={24} className="dark:invert" />
            <span>Filteral<span className="text-gray-400 dark:text-gray-500">.app</span></span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/welcome" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              Guide
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              Profile
            </Link>
            <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              Settings
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
