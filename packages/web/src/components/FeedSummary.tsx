"use client";

import { FeedAnalysis } from "@scrollmate/shared";

interface FeedSummaryProps {
  analysis: FeedAnalysis | null;
  loading: boolean;
  onAnalyze: () => void;
}

export default function FeedSummary({
  analysis,
  loading,
  onAnalyze,
}: FeedSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-white/60">Claude is analyzing your feed...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="mb-4 text-white/60">
          Your feed is loaded. Analyze it with Claude to get insights before
          your voice briefing.
        </p>
        <button
          onClick={onAnalyze}
          className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          Analyze with Claude
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">
          Feed Summary
        </h3>
        <p className="text-white/70">{analysis.summary}</p>
      </div>

      {analysis.topStories.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Top Stories
          </h3>
          <div className="space-y-3">
            {analysis.topStories.map((story, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/5 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-white">{story.title}</h4>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      story.sentiment === "positive"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : story.sentiment === "negative"
                          ? "bg-red-500/20 text-red-400"
                          : story.sentiment === "mixed"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-white/10 text-white/60"
                    }`}
                  >
                    {story.sentiment}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/60">
                  {story.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.trends.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Trending Topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.trends.map((trend, i) => (
              <span
                key={i}
                className="rounded-full bg-violet-500/20 px-3 py-1 text-sm text-violet-300"
              >
                {trend}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.claudeOpinion && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <h3 className="mb-2 text-lg font-semibold text-violet-300">
            Claude&apos;s Take
          </h3>
          <p className="text-white/70">{analysis.claudeOpinion}</p>
        </div>
      )}
    </div>
  );
}
