import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/landing/pricing-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#191919]">
      {/* Header */}
      <header className="container mx-auto px-4 py-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white font-[family-name:var(--font-logo)] tracking-tight">
          <Image src="/logo.svg" alt="Filteral" width={28} height={28} className="dark:invert" />
          <span>Filteral<span className="text-gray-400 dark:text-gray-500">.app</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto py-24">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
            Your personal AI-powered information filter
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Connect your Bilibili, YouTube, Reddit, and more. Let AI filter through the noise and deliver the content that matters to you.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white px-6 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                Get started free
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <section className="py-16 border-t border-gray-100 dark:border-gray-800">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <FeatureCard
              emoji="🔗"
              title="Connect"
              description="Link your video platforms with a simple QR code scan."
            />
            <FeatureCard
              emoji="🤖"
              title="Analyze"
              description="AI learns from your watch history and subscriptions."
            />
            <FeatureCard
              emoji="✨"
              title="Discover"
              description="Get personalized recommendations delivered daily."
            />
          </div>
        </section>

        {/* Pricing Section */}
        <PricingSection />
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5 font-[family-name:var(--font-logo)] font-bold text-gray-900 dark:text-white">
            <Image src="/logo.svg" alt="Filteral" width={18} height={18} className="dark:invert" />
            <span>Filteral<span className="text-gray-400 dark:text-gray-500">.app</span></span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link>
            <Link href="/disclaimer" className="hover:text-gray-900 dark:hover:text-white">Disclaimer</Link>
          </div>
          <span>&copy; 2026 Filteral.app</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="text-center p-6">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

