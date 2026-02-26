"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import FeedSummary from "@/components/FeedSummary";
import VoiceCall from "@/components/VoiceCall";
import { FeedAnalysis, CallDuration, Tweet, formatTweetsForPrompt } from "@scrollmate/shared";

type DashboardView = "summary" | "call";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [view, setView] = useState<DashboardView>("summary");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [analysis, setAnalysis] = useState<FeedAnalysis | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<CallDuration>(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/twitter/feed");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch feed");
      }
      const data = await res.json();
      setTweets(data.tweets);
      if (data.analysis) setAnalysis(data.analysis);
    } catch (err) {
      setError(String(err));
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchFeed();
  }, [session, fetchFeed]);

  async function handleAnalyze() {
    setAnalysisLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze feed");
      }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalysisLoading(false);
    }
  }

  function startCall() {
    if (!analysis) return;
    setView("call");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (view === "call" && analysis) {
    return (
      <VoiceCall
        feedText={formatTweetsForPrompt(tweets)}
        analysis={analysis}
        duration={selectedDuration}
        onEnd={() => setView("summary")}
      />
    );
  }

  const durations: CallDuration[] = [5, 10, 15, 20];

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
              <svg
                className="h-5 w-5 text-white"
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
            <span className="text-lg font-bold">ScrollMate</span>
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm text-white/60">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Your Daily Briefing</h1>
          <p className="mt-1 text-white/50">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Feed status */}
        {feedLoading ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-white/60">Fetching your timeline...</p>
            </div>
          </div>
        ) : tweets.length > 0 ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {tweets.length} tweets loaded from your timeline
          </div>
        ) : null}

        {/* Feed analysis */}
        <FeedSummary
          analysis={analysis}
          loading={analysisLoading}
          onAnalyze={handleAnalyze}
        />

        {/* Start briefing section */}
        {analysis && (
          <div className="mt-8 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-blue-500/10 p-8">
            <h2 className="mb-2 text-xl font-semibold">
              Ready for your briefing?
            </h2>
            <p className="mb-6 text-white/50">
              Start a voice conversation with ScrollMate. It&apos;ll walk you
              through today&apos;s highlights and answer your questions.
            </p>

            {/* Duration picker */}
            <div className="mb-6">
              <label className="mb-3 block text-sm text-white/40">
                Call duration
              </label>
              <div className="flex gap-2">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDuration(d)}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                      selectedDuration === d
                        ? "bg-violet-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startCall}
              className="group inline-flex items-center gap-3 rounded-full bg-violet-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-violet-500 hover:scale-105 active:scale-95"
            >
              <svg
                className="h-6 w-6"
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
              Start Voice Briefing
            </button>

            <p className="mt-3 text-xs text-white/30">
              ~${((selectedDuration * 0.175).toFixed(2))} estimated cost •{" "}
              Microphone access required
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
