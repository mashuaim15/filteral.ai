"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const steps = [
  {
    number: 1,
    title: "Connect your platforms",
    description:
      "Link your Bilibili, YouTube, Reddit, or X accounts to let Filteral pull content for you.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    action: {
      label: "Connect Platforms",
      href: "/connect",
    },
  },
  {
    number: 2,
    title: "Set up your profile",
    description:
      "Tell us about yourself - your interests, profession, and what you want to discover.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
    action: {
      label: "Set Up Profile",
      href: "/profile",
    },
  },
  {
    number: 3,
    title: "Customize settings",
    description:
      "Choose how many recommendations you want, set up daily emails, and configure your preferences.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    action: {
      label: "Open Settings",
      href: "/settings",
    },
  },
  {
    number: 4,
    title: "Generate recommendations",
    description:
      "Hit generate and let our AI curate the best content from across your connected platforms.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    action: {
      label: "Go to Dashboard",
      href: "/dashboard",
    },
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/dashboard");
    }
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-semibold text-gray-900 dark:text-white mb-3">
          Welcome to Filteral
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md">
          Your personal AI-powered content filter. Let&apos;s get you set up in
          a few simple steps.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-12">
        {steps.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentStep
                ? "w-8 bg-gray-900 dark:bg-white"
                : index < currentStep
                ? "bg-gray-400 dark:bg-gray-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Step card */}
      <div className="w-full max-w-lg">
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentStep * 100}%)` }}
          >
            {steps.map((step, index) => (
              <div key={index} className="w-full flex-shrink-0 px-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 text-center">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-6 text-gray-700 dark:text-gray-300">
                    {step.icon}
                  </div>

                  {/* Step number */}
                  <div className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-2">
                    Step {step.number} of {steps.length}
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                    {step.title}
                  </h2>

                  {/* Description */}
                  <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Action button */}
                  <Link
                    href={step.action.href}
                    className="inline-flex items-center px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                  >
                    {step.action.label}
                    <svg
                      className="w-4 h-4 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 px-4">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className={`text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors ${
              currentStep === 0 ? "invisible" : ""
            }`}
          >
            ← Back
          </button>

          <button
            onClick={handleNext}
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            {currentStep === steps.length - 1 ? "Finish" : "Next →"}
          </button>
        </div>
      </div>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        className="mt-12 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
      >
        Skip introduction
      </button>

      {/* Go to Dashboard - centered prominent button */}
      <div className="mt-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 text-white dark:text-gray-900 font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
