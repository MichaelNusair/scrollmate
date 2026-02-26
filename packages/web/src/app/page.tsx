"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoginButton from "@/components/LoginButton";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute left-1/3 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight">ScrollMate</span>
        </div>

        <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Your feed,{" "}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            out loud
          </span>
        </h1>

        <p className="mb-10 max-w-md text-lg text-white/50">
          Connect your X account and get a conversational voice briefing of
          your timeline — powered by Claude&apos;s analysis and GPT-4o&apos;s voice.
        </p>

        <LoginButton />

        <div className="mt-16 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="mb-2 text-3xl font-bold text-violet-400">1</div>
            <p className="text-sm text-white/40">Connect your X account</p>
          </div>
          <div>
            <div className="mb-2 text-3xl font-bold text-violet-400">2</div>
            <p className="text-sm text-white/40">
              Claude analyzes your feed
            </p>
          </div>
          <div>
            <div className="mb-2 text-3xl font-bold text-violet-400">3</div>
            <p className="text-sm text-white/40">
              Talk through your briefing
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
