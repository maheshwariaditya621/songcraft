import {
  SpeechToTextProvider,
  SpeechOptions,
  SpeechState,
  SpeechError,
  SpeechLanguage,
} from './speech-types';
import { BrowserSpeechProvider } from './browser-speech-provider';

export interface VoiceControllerListener {
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onStateChange?: (state: SpeechState) => void;
  onTimeUpdate?: (secondsElapsed: number, formattedTime: string) => void;
  onError?: (error: SpeechError) => void;
}

/**
 * VoiceController
 * Coordinates voice input, recording timers, and live transcription.
 * Isolates the UI completely from browser-specific voice APIs.
 */
export class VoiceController {
  private provider: SpeechToTextProvider;
  private state: SpeechState = 'idle';
  private timerInterval: NodeJS.Timeout | null = null;
  private secondsElapsed = 0;
  private listener?: VoiceControllerListener;

  constructor(provider?: SpeechToTextProvider) {
    this.provider = provider || new BrowserSpeechProvider();
  }

  public setProvider(provider: SpeechToTextProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public isSupported(): boolean {
    return this.provider.isSupported();
  }

  public getState(): SpeechState {
    return this.state;
  }

  public setListener(listener: VoiceControllerListener): void {
    this.listener = listener;
  }

  public async startListening(options?: SpeechOptions): Promise<void> {
    if (!this.provider.isSupported()) {
      const err: SpeechError = {
        code: 'unsupported',
        message: 'Your browser does not support voice input. You can type instead.',
      };
      this.listener?.onError?.(err);
      this.updateState('error');
      return;
    }

    this.resetTimer();
    this.updateState('listening');
    this.startTimer();

    try {
      await this.provider.start(options, {
        onInterimTranscript: (text) => {
          this.listener?.onTranscriptUpdate?.(text, false);
        },
        onFinalTranscript: (text) => {
          this.listener?.onTranscriptUpdate?.(text, true);
        },
        onError: (error) => {
          this.stopTimer();
          this.updateState('error');
          this.listener?.onError?.(error);
        },
        onStateChange: (state) => {
          if (state !== this.state) {
            this.updateState(state);
          }
        },
      });
    } catch (err) {
      this.stopTimer();
      this.updateState('error');
      const msg = err instanceof Error ? err.message : String(err);
      this.listener?.onError?.({ code: 'unknown', message: msg });
    }
  }

  public async stopListening(): Promise<string> {
    this.stopTimer();
    this.updateState('processing');

    try {
      const transcript = await this.provider.stop();
      this.updateState('idle');
      return transcript;
    } catch (err) {
      this.updateState('error');
      const msg = err instanceof Error ? err.message : String(err);
      this.listener?.onError?.({ code: 'unknown', message: msg });
      return '';
    }
  }

  public cancel(): void {
    this.stopTimer();
    this.provider.abort();
    this.updateState('idle');
  }

  private updateState(newState: SpeechState): void {
    this.state = newState;
    this.listener?.onStateChange?.(newState);
  }

  private startTimer(): void {
    this.secondsElapsed = 0;
    this.notifyTimer();
    this.timerInterval = setInterval(() => {
      this.secondsElapsed += 1;
      this.notifyTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private resetTimer(): void {
    this.stopTimer();
    this.secondsElapsed = 0;
  }

  private notifyTimer(): void {
    const mins = Math.floor(this.secondsElapsed / 60);
    const secs = this.secondsElapsed % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.listener?.onTimeUpdate?.(this.secondsElapsed, formatted);
  }
}

// Global default singleton
export const defaultVoiceController = new VoiceController();
