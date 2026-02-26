const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "";
const AZURE_OPENAI_DEPLOYMENT =
  process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-realtime";
const AZURE_OPENAI_API_VERSION = "2024-12-17";

export function getRealtimeWebSocketUrl(): string {
  const base = AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  return `${base.replace("https://", "wss://")}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/realtime?api-version=${AZURE_OPENAI_API_VERSION}`;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export function createSessionUpdateEvent(systemPrompt: string): RealtimeEvent {
  return {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: systemPrompt,
      voice: "alloy",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    },
  };
}

export function createResponseEvent(): RealtimeEvent {
  return {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
    },
  };
}
