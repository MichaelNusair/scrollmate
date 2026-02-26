import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { FeedAnalysis } from "@scrollmate/shared";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const MODEL_ID = "us.anthropic.claude-sonnet-4-6-v1-20250514";

export async function analyzeFeed(
  tweetsText: string
): Promise<FeedAnalysis> {
  const prompt = `You are an expert media analyst. Analyze the following Twitter/X feed and provide a structured analysis.

Return your analysis as JSON matching this exact structure:
{
  "summary": "2-3 sentence overview of the feed's main themes",
  "topStories": [
    {
      "title": "Story headline",
      "description": "Brief description",
      "sentiment": "positive/negative/neutral/mixed",
      "relatedTweets": ["relevant tweet excerpts"]
    }
  ],
  "trends": ["trending topics or hashtags"],
  "breakingNews": ["anything that appears to be breaking or urgent"],
  "claudeOpinion": "Your analytical take on the most interesting patterns and discussions in this feed. Be insightful and opinionated."
}

Here are the tweets:

${tweetsText}`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));

  const text =
    result.content?.[0]?.type === "text" ? result.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      summary: text.slice(0, 500),
      topStories: [],
      trends: [],
      breakingNews: [],
      claudeOpinion: text,
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as FeedAnalysis;
  } catch {
    return {
      summary: text.slice(0, 500),
      topStories: [],
      trends: [],
      breakingNews: [],
      claudeOpinion: text,
    };
  }
}

export function buildSystemPrompt(
  tweetsText: string,
  analysis: FeedAnalysis,
  durationMinutes: number
): string {
  return `You are ScrollMate, a conversational daily news briefer that summarizes what's happening on the user's Twitter/X feed. You speak naturally and conversationally, like a knowledgeable friend catching them up on the day.

## Your Feed Context

Here are the tweets from the user's timeline today:

${tweetsText}

## Claude's Analysis

Claude (another AI) analyzed this feed and provided these insights:

**Summary:** ${analysis.summary}

**Top Stories:**
${analysis.topStories.map((s) => `- ${s.title}: ${s.description} (sentiment: ${s.sentiment})`).join("\n")}

**Trends:** ${analysis.trends.join(", ")}

**Breaking News:** ${analysis.breakingNews.length > 0 ? analysis.breakingNews.join(", ") : "None detected"}

**Claude's Take:** ${analysis.claudeOpinion}

## Your Instructions

1. Start by greeting the user and giving a quick 60-second overview of the biggest stories on their feed today.
2. Reference "Claude's analysis" naturally when sharing multi-model insights — e.g., "Claude flagged this as particularly interesting because..."
3. After the overview, pause and let the user ask questions or drill into specific topics.
4. If the user asks about specific tweets, quote them accurately.
5. Keep it conversational, engaging, and opinionated when appropriate.
6. This call has a ${durationMinutes}-minute limit. Be mindful of time — when you're about 80% through, start wrapping up and ask if there's anything else they want to cover.
7. End the call gracefully when time is almost up with a brief recap.

Speak as if you're on a phone call — natural, warm, concise. No bullet points or structured formats in speech.`;
}
