import { Tweet } from "../types/index.js";

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
