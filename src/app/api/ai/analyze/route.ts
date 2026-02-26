import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeFeed } from "@/lib/claude";
import { formatTweetsForPrompt } from "@/lib/twitter";
import { Tweet } from "@/types";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const today = new Date().toISOString().split("T")[0];

  const cached = await prisma.cachedFeed.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!cached) {
    return NextResponse.json(
      { error: "No feed data found. Fetch your feed first." },
      { status: 400 }
    );
  }

  if (cached.analysis) {
    return NextResponse.json({
      analysis: JSON.parse(cached.analysis),
      cached: true,
    });
  }

  try {
    const tweets = JSON.parse(cached.tweets) as Tweet[];
    const formatted = formatTweetsForPrompt(tweets);
    const analysis = await analyzeFeed(formatted);

    await prisma.cachedFeed.update({
      where: { userId_date: { userId, date: today } },
      data: { analysis: JSON.stringify(analysis) },
    });

    return NextResponse.json({ analysis, cached: false });
  } catch (error) {
    console.error("Claude analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze feed", details: String(error) },
      { status: 500 }
    );
  }
}
