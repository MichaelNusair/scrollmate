"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Timer from "./Timer";
import { CallDuration, FeedAnalysis } from "@/types";
import {
  createSessionUpdateEvent,
  createResponseEvent,
} from "@/lib/realtime";
import { buildSystemPrompt } from "@/lib/claude";

interface VoiceCallProps {
  feedText: string;
  analysis: FeedAnalysis;
  duration: CallDuration;
  onEnd: () => void;
}

type CallState = "connecting" | "active" | "ending" | "ended";

export default function VoiceCall({
  feedText,
  analysis,
  duration,
  onEnd,
}: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    setCallState("ending");
    cleanup();
    setTimeout(() => {
      setCallState("ended");
      onEnd();
    }, 1000);
  }, [cleanup, onEnd]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const tokenRes = await fetch("/api/realtime");
        if (!tokenRes.ok) throw new Error("Failed to get realtime token");
        const { token, url } = await tokenRes.json();

        if (cancelled) return;

        const ws = new WebSocket(url, [
          "realtime",
          `openai-insecure-api-key.${token}`,
          "openai-beta.realtime-v1",
        ]);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          const systemPrompt = buildSystemPrompt(feedText, analysis, duration);
          ws.send(JSON.stringify(createSessionUpdateEvent(systemPrompt)));

          setTimeout(() => {
            if (!cancelled && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(createResponseEvent()));
            }
          }, 500);

          setCallState("active");
          startMicrophone(ws);
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        };

        ws.onerror = (err) => {
          console.error("WebSocket error:", err);
          if (!cancelled) endCall();
        };

        ws.onclose = () => {
          if (!cancelled && callState !== "ending" && callState !== "ended") {
            endCall();
          }
        };
      } catch (err) {
        console.error("Failed to start voice call:", err);
        if (!cancelled) endCall();
      }
    }

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startMicrophone(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      processor.onaudioprocess = (e) => {
        if (isMuted || ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = bufferToBase64(pcm16.buffer);
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64,
          })
        );

        analyser.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        setAudioLevel(avg / 255);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  }

  function handleRealtimeEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case "response.audio.delta": {
        const audioData = event.delta as string;
        playAudio(audioData);
        break;
      }
      case "response.audio_transcript.delta": {
        const delta = event.delta as string;
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + delta },
            ];
          }
          return [...prev, { role: "assistant", text: delta }];
        });
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const text = event.transcript as string;
        if (text?.trim()) {
          setTranscript((prev) => [...prev, { role: "user", text }]);
        }
        break;
      }
      case "error": {
        console.error("Realtime API error:", event.error);
        break;
      }
    }
  }

  function playAudio(base64Audio: string) {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    const raw = atob(base64Audio);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x8000;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const waveformBars = 24;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-1 h-20">
          {Array.from({ length: waveformBars }).map((_, i) => {
            const distance = Math.abs(i - waveformBars / 2) / (waveformBars / 2);
            const height =
              callState === "active"
                ? 8 + audioLevel * 60 * (1 - distance * 0.6) * (0.5 + Math.random() * 0.5)
                : 4;
            return (
              <div
                key={i}
                className="w-1.5 rounded-full bg-violet-500 transition-all duration-75"
                style={{ height: `${Math.max(4, height)}px` }}
              />
            );
          })}
        </div>

        {/* Timer */}
        <Timer
          durationMinutes={duration}
          isActive={callState === "active"}
          onTimeUp={endCall}
        />

        {/* Status */}
        <p className="text-center text-sm text-white/40">
          {callState === "connecting" && "Connecting..."}
          {callState === "active" && "ScrollMate is listening"}
          {callState === "ending" && "Ending call..."}
          {callState === "ended" && "Call ended"}
        </p>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="mx-auto max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4">
            {transcript.map((entry, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <span
                  className={`text-xs font-medium ${
                    entry.role === "user"
                      ? "text-blue-400"
                      : "text-violet-400"
                  }`}
                >
                  {entry.role === "user" ? "You" : "ScrollMate"}
                </span>
                <p className="text-sm text-white/70">{entry.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
              isMuted
                ? "bg-red-500/20 text-red-400"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            onClick={endCall}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-all hover:bg-red-500 hover:scale-105 active:scale-95"
            title="End call"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
