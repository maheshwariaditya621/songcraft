/**
 * Speech-to-Text Domain Types & Abstractions
 * Agnostic of specific voice providers (Browser Web Speech, Whisper, Cloud Speech)
 */

export type SpeechLanguage = 'auto' | 'en-IN' | 'hi-IN' | 'mr-IN' | 'en-US';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export interface SpeechError {
  code: 'not-allowed' | 'no-speech' | 'network' | 'unsupported' | 'unknown';
  message: string;
  originalError?: unknown;
}

export interface SpeechOptions {
  language?: SpeechLanguage;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechCallbacks {
  onInterimTranscript?: (transcript: string) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: SpeechError) => void;
  onStateChange?: (state: SpeechState) => void;
}

/**
 * Universal Interface for Speech-to-Text Providers
 * Implemented by BrowserSpeechProvider in V1 (₹0 cost),
 * and swappable with WhisperProvider or CloudSpeechProvider later.
 */
export interface SpeechToTextProvider {
  readonly name: string;
  isSupported(): boolean;
  start(options?: SpeechOptions, callbacks?: SpeechCallbacks): Promise<void>;
  stop(): Promise<string>;
  abort(): void;
}
