import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#191919] flex flex-col">
      <div className="container mx-auto px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white font-[family-name:var(--font-logo)] tracking-tight w-fit"
        >
          <Image src="/logo.svg" alt="Filteral" width={24} height={24} className="dark:invert" />
          <span>Filteral<span className="text-gray-400 dark:text-gray-500">.app</span></span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="max-w-sm w-full">
          {children}
        </div>
      </div>
      <footer className="container mx-auto px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms</Link>
          <Link href="/disclaimer" className="hover:text-gray-900 dark:hover:text-white">Disclaimer</Link>
        </div>
      </footer>
    </div>
  );
}
