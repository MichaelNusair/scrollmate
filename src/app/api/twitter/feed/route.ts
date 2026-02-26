import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchUserTimeline, formatTweetsForPrompt } from "@/lib/twitter";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as unknown as Record<string, unknown>).id as string;
  const twitterId = (session.user as unknown as Record<string, unknown>)
    .twitterId as string;
  const accessToken = (session as unknown as Record<string, unknown>)
    .accessToken as string;

  if (!twitterId || !accessToken) {
    return NextResponse.json(
      { error: "Twitter account not linked" },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const cached = await prisma.cachedFeed.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (cached) {
    return NextResponse.json({
      tweets: JSON.parse(cached.tweets),
      analysis: cached.analysis ? JSON.parse(cached.analysis) : null,
      formatted: formatTweetsForPrompt(JSON.parse(cached.tweets)),
      cached: true,
    });
  }

  try {
    const feedData = await fetchUserTimeline(accessToken, twitterId);

    await prisma.cachedFeed.create({
      data: {
        userId,
        date: today,
        tweets: JSON.stringify(feedData.tweets),
      },
    });

    return NextResponse.json({
      tweets: feedData.tweets,
      analysis: null,
      formatted: formatTweetsForPrompt(feedData.tweets),
      cached: false,
    });
  } catch (error) {
    console.error("Twitter feed fetch error:", error);

    const force = req.nextUrl.searchParams.get("force");
    if (force) {
      return NextResponse.json(
        { error: "Failed to fetch Twitter feed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch Twitter feed", details: String(error) },
      { status: 502 }
    );
  }
}
