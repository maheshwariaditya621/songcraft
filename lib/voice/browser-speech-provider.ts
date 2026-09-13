import {
  SpeechToTextProvider,
  SpeechOptions,
  SpeechCallbacks,
  SpeechError,
  SpeechLanguage,
} from './speech-types';

// Browser Web Speech API type shims
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => ISpeechRecognitionInstance;
}

interface ISpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
}

interface ISpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

/**
 * BrowserSpeechProvider
 * Zero-cost speech-to-text implementation using the browser's native Web Speech API.
 */
export class BrowserSpeechProvider implements SpeechToTextProvider {
  public readonly name = 'BrowserSpeechProvider';
  private recognition: ISpeechRecognitionInstance | null = null;
  private currentTranscript = '';
  private callbacks?: SpeechCallbacks;
  private isListening = false;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public async start(options?: SpeechOptions, callbacks?: SpeechCallbacks): Promise<void> {
    if (!this.isSupported()) {
      throw new Error(
        'Voice input is not supported in this browser. Please type your instruction instead.'
      );
    }

    this.callbacks = callbacks;
    this.currentTranscript = '';

    const win = window as unknown as IWindowWithSpeech;
    const SpeechRecClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecClass) {
      throw new Error('Speech recognition class unavailable');
    }

    this.recognition = new SpeechRecClass();
    this.recognition.continuous = options?.continuous ?? true;
    this.recognition.interimResults = options?.interimResults ?? true;
    this.recognition.lang = this.resolveLanguage(options?.language);
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks?.onStateChange?.('listening');
    };

    this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      let finalPiece = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalPiece += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalPiece) {
        this.currentTranscript += finalPiece;
        this.callbacks?.onFinalTranscript?.(this.currentTranscript.trim());
      }

      const totalInterim = (this.currentTranscript + interim).trim();
      this.callbacks?.onInterimTranscript?.(totalInterim);
    };

    this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      let code: SpeechError['code'] = 'unknown';
      let message = 'An error occurred during voice recognition.';

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          code = 'not-allowed';
          message =
            'Microphone access is needed. Please allow microphone access in your browser or type instead.';
          break;
        case 'no-speech':
          code = 'no-speech';
          message = 'No speech was detected. Please try speaking again.';
          break;
        case 'network':
          code = 'network';
          message =
            'Network problem communicating with speech service. Please check your connection or type instead.';
          break;
        default:
          message = event.message || `Speech recognition error: ${event.error}`;
      }

      this.callbacks?.onError?.({ code, message, originalError: event });
      this.callbacks?.onStateChange?.('error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks?.onStateChange?.('idle');
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.callbacks?.onError?.({
        code: 'unknown',
        message: 'Could not start microphone recording.',
        originalError: err,
      });
    }
  }

  public stop(): Promise<string> {
    return new Promise((resolve) => {
      if (this.recognition && this.isListening) {
        const prevOnEnd = this.recognition.onend;
        this.recognition.onend = () => {
          if (prevOnEnd) prevOnEnd();
          resolve(this.currentTranscript.trim());
        };
        try {
          this.recognition.stop();
        } catch {
          resolve(this.currentTranscript.trim());
        }
      } else {
        resolve(this.currentTranscript.trim());
      }
    });
  }

  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.isListening = false;
      this.currentTranscript = '';
    }
  }

  private resolveLanguage(lang?: SpeechLanguage): string {
    switch (lang) {
      case 'hi-IN':
        return 'hi-IN';
      case 'mr-IN':
        return 'mr-IN';
      case 'en-IN':
        return 'en-IN';
      case 'en-US':
        return 'en-US';
      case 'auto':
      default:
        // Indian English / Hindi combination works best for Indian bilingual speech
        return 'hi-IN';
    }
  }
}
