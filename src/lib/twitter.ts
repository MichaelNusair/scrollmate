import { Tweet, FeedData } from "@/types";

const TWITTER_API_BASE = "https://api.twitter.com/2";

export async function fetchUserTimeline(
  accessToken: string,
  twitterUserId: string,
  maxResults = 50
): Promise<FeedData> {
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "text,author_id,created_at,public_metrics",
    expansions: "author_id",
    "user.fields": "name,username",
  });

  const res = await fetch(
    `${TWITTER_API_BASE}/users/${twitterUserId}/timelines/reverse_chronological?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter API error ${res.status}: ${body}`);
  }

  const json = await res.json();

  const usersMap = new Map<string, { name: string; username: string }>();
  if (json.includes?.users) {
    for (const u of json.includes.users) {
      usersMap.set(u.id, { name: u.name, username: u.username });
    }
  }

  const tweets: Tweet[] = (json.data || []).map(
    (t: Record<string, unknown>) => ({
      id: t.id as string,
      text: t.text as string,
      author_id: t.author_id as string,
      created_at: t.created_at as string,
      public_metrics: t.public_metrics as Tweet["public_metrics"],
      author: usersMap.get(t.author_id as string),
    })
  );

  return { tweets, fetchedAt: new Date().toISOString() };
}

export function formatTweetsForPrompt(tweets: Tweet[]): string {
  return tweets
    .map((t, i) => {
      const author = t.author
        ? `@${t.author.username} (${t.author.name})`
        : `user:${t.author_id}`;
      const metrics = t.public_metrics
        ? ` [♥${t.public_metrics.like_count} 🔁${t.public_metrics.retweet_count}]`
        : "";
      return `${i + 1}. ${author}${metrics}\n   ${t.text}`;
    })
    .join("\n\n");
}
