export interface Tweet {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics?: {
        retweet_count: number;
        reply_count: number;
        like_count: number;
        quote_count: number;
    };
    author?: {
        id: string;
        name: string;
        username: string;
    };
}
export interface FeedData {
    tweets: Tweet[];
    fetchedAt: string;
}
export interface FeedAnalysis {
    summary: string;
    topStories: {
        title: string;
        description: string;
        sentiment: string;
        relatedTweets: string[];
    }[];
    trends: string[];
    breakingNews: string[];
    claudeOpinion: string;
}
export interface VoiceSession {
    id: string;
    userId: string;
    durationMinutes: number;
    startedAt: string;
    endedAt?: string;
}
export type CallDuration = 5 | 10 | 15 | 20;
//# sourceMappingURL=index.d.ts.map