/**
 * Google Cloud Text-to-Speech Client (Chirp 3: HD)
 *
 * Deterministic TTS engine that reads text exactly as written.
 * Replaces GPT Audio (chat LLM) which hallucinated conversational filler.
 *
 * USAGE:
 *   import { synthesizeSpeech, TTS_VOICES } from "../_shared/tts-client.ts";
 *
 *   const { wavBytes, durationSeconds } = await synthesizeSpeech(
 *     "Hello, welcome to the lecture.",
 *     "Charon",
 *     GOOGLE_CLOUD_API_KEY
 *   );
 */

const TTS_API_URL = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

// Max bytes per request (Google TTS limit is ~5000 bytes of input text)
const MAX_INPUT_BYTES = 4800;

// Retry config
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Voice mapping: short ID → full Google Chirp 3: HD voice name
 */
export const TTS_VOICES: Record<string, string> = {
  // Chirp 3: HD voices
  Charon: "en-US-Chirp3-HD-Charon",
  Leda: "en-US-Chirp3-HD-Leda",
  Fenrir: "en-US-Chirp3-HD-Fenrir",
  Kore: "en-US-Chirp3-HD-Kore",
  Puck: "en-US-Chirp3-HD-Puck",
  Aoede: "en-US-Chirp3-HD-Aoede",
};

/**
 * Legacy OpenAI voice ID → Chirp 3: HD mapping.
 * Ensures backward compatibility for existing lecture_slides rows.
 */
export const LEGACY_VOICE_MAP: Record<string, string> = {
  onyx: "Charon",
  nova: "Leda",
  echo: "Fenrir",
  alloy: "Kore",
  fable: "Puck",
  shimmer: "Aoede",
};

/**
 * Resolve a voice ID (legacy or current) to a Chirp 3: HD voice name.
 */
export function resolveVoiceId(voiceId: string): string {
  // If it's a legacy ID, map it first
  const mapped = LEGACY_VOICE_MAP[voiceId] || voiceId;
  return mapped;
}

export interface TTSResult {
  /** Complete WAV file bytes (LINEAR16 with header) */
  wavBytes: Uint8Array;
  /** Exact duration in seconds calculated from PCM data */
  durationSeconds: number;
  /** Number of text chunks processed */
  chunkCount: number;
}

/**
 * Synthesize speech using Google Cloud TTS (Chirp 3: HD).
 *
 * - Deterministic: reads text exactly as written
 * - Handles chunking for long text (>4800 bytes)
 * - Returns WAV audio with header included by Google
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
): Promise<TTSResult> {
  // Resolve legacy voice IDs before lookup
  const resolvedId = resolveVoiceId(voiceId);
  const voiceName = TTS_VOICES[resolvedId] || TTS_VOICES.Charon;
  const chunks = splitTextIntoChunks(text, MAX_INPUT_BYTES);

  console.log(
    `[TTS] Synthesizing ${text.length} chars in ${chunks.length} chunk(s) with voice ${voiceName}`,
  );

  const pcmChunks: Uint8Array[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const pcm = await callTTSWithRetry(chunks[i], voiceName, apiKey, i + 1, chunks.length);
    pcmChunks.push(pcm);
  }

  // Concatenate all PCM data
  const totalPcmLength = pcmChunks.reduce((sum, c) => sum + c.length, 0);
  const allPcm = new Uint8Array(totalPcmLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    allPcm.set(chunk, offset);
    offset += chunk.length;
  }

  // Build WAV file from concatenated PCM
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const wavBytes = buildWavFile(allPcm, sampleRate, numChannels, bitsPerSample);

  // Calculate exact duration from PCM data
  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationSeconds = Math.round((allPcm.length / bytesPerSecond) * 100) / 100;

  console.log(`[TTS] Done: ${durationSeconds}s, ${wavBytes.length} bytes WAV, ${chunks.length} chunks`);

  return { wavBytes, durationSeconds, chunkCount: chunks.length };
}

/**
 * Call Google TTS API with retry logic.
 * Returns raw PCM16 bytes (no WAV header — we strip it if present).
 */
async function callTTSWithRetry(
  text: string,
  voiceName: string,
  apiKey: string,
  chunkNum: number,
  totalChunks: number,
): Promise<Uint8Array> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[TTS] Retry ${attempt}/${MAX_RETRIES} for chunk ${chunkNum}/${totalChunks}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      const response = await fetch(`${TTS_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "en-US",
            name: voiceName,
          },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 24000,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new Error(`TTS API ${response.status}: ${errText}`);
          continue;
        }
        throw new Error(`Google TTS API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!data.audioContent) {
        throw new Error("Google TTS returned no audioContent");
      }

      // Decode base64 audio content
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      // Google LINEAR16 returns WAV with header — strip it to get raw PCM
      const pcm = stripWavHeader(bytes);
      return pcm;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES) break;
    }
  }

  throw lastError || new Error("TTS failed after retries");
}

/**
 * Strip WAV header (44 bytes) from audio data if present.
 * Google TTS LINEAR16 returns data with a WAV header.
 */
function stripWavHeader(data: Uint8Array): Uint8Array {
  // Check for RIFF header
  if (
    data.length > 44 &&
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46    // F
  ) {
    return data.slice(44);
  }
  return data;
}

/**
 * Build a WAV file from raw PCM data.
 */
function buildWavFile(
  pcmData: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Uint8Array {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let k = 0; k < str.length; k++) view.setUint8(offset + k, str.charCodeAt(k));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, headerSize).set(pcmData);

  return new Uint8Array(buffer);
}

/**
 * Split text into chunks at sentence boundaries, respecting byte limit.
 */
function splitTextIntoChunks(text: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const totalBytes = encoder.encode(text).length;

  if (totalBytes <= maxBytes) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const candidateChunk = currentChunk + sentence;
    const candidateBytes = encoder.encode(candidateChunk).length;

    if (candidateBytes > maxBytes && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = candidateChunk;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}
