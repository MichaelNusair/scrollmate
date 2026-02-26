export const REALTIME_API_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

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
