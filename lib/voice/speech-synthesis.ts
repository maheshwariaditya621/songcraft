/**
 * Speech Synthesis (Voice Feedback) Module
 * Consumer-friendly, conversational audio responses in Hindi & English.
 * 100% Client-side Web Speech API (₹0 cost, zero cloud dependencies).
 */

export type FeedbackLanguage = 'hi-IN' | 'en-IN' | 'mr-IN' | 'en-US';

export interface SynthesisOptions {
  language?: FeedbackLanguage;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export class SpeechSynthesizer {
  private muted: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
      }
    } catch {
      // Ignored in environments without speech synthesis
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe fail
      }
    }
  }

  public isSpeaking(): boolean {
    return this.isSupported() ? window.speechSynthesis.speaking : false;
  }

  /**
   * Find the best voice for the target language.
   * Prioritizes native Indian accent voices for Hindi & English.
   */
  private getBestVoice(lang: FeedbackLanguage): SpeechSynthesisVoice | null {
    if (!this.voicesLoaded) {
      this.loadVoices();
    }

    const langPrefix = lang.split('-')[0].toLowerCase();

    // 1. Exact match (e.g. hi-IN)
    let voice = this.voices.find(
      (v) => v.lang.toLowerCase() === lang.toLowerCase()
    );
    if (voice) return voice;

    // 2. Language prefix match (e.g. any Hindi voice)
    voice = this.voices.find((v) =>
      v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (voice) return voice;

    // 3. For Hindi/Marathi fallback: Indian English voice sounds natural and culturally aligned
    if (langPrefix === 'hi' || langPrefix === 'mr') {
      const indianEnglish = this.voices.find((v) =>
        v.lang.toLowerCase().includes('en-in')
      );
      if (indianEnglish) return indianEnglish;
    }

    // 4. Any English voice as universal fallback
    return (
      this.voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      this.voices[0] ||
      null
    );
  }

  private activeUtterance: SpeechSynthesisUtterance | null = null;

  /**
   * Speak a friendly message to the user.
   */
  public speak(text: string, options: SynthesisOptions = {}): boolean {
    if (!this.isSupported() || this.muted || !text.trim()) {
      return false;
    }

    try {
      // Cancel previous speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance; // Prevent V8 garbage collection

      const targetLang = options.language || 'hi-IN';
      utterance.lang = targetLang;
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = options.pitch ?? 1.0;

      const voice = this.getBestVoice(targetLang);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        this.activeUtterance = null;
        options.onEnd?.();
      };

      utterance.onerror = (err) => {
        this.activeUtterance = null;
        options.onError?.(err);
      };

      // Chrome requires a tiny delay after cancel() so it does not cancel the new utterance
      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('Delayed speak error:', e);
        }
      }, 50);

      return true;
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      return false;
    }
  }

  /**
   * Conversational phrasing generator based on operation and language
   */
  public static buildConfirmationMessage(
    explanation: string,
    isHindi: boolean
  ): string {
    if (isHindi) {
      // Warm, polite conversational Hindi
      return `समझ गया! ${explanation}। क्या मैं इसे शुरू करूँ?`;
    }
    return `Got it! ${explanation}. Shall I start?`;
  }

  public static buildCompletionMessage(isHindi: boolean): string {
    if (isHindi) {
      return 'आपका गाना तैयार है! आप इसे सुन सकते हैं या डाउनलोड कर सकते हैं।';
    }
    return 'Your song is ready! You can play it or download it now.';
  }

  public static buildClarificationMessage(isHindi: boolean): string {
    if (isHindi) {
      return 'मुझे थोड़ा और बताएं कि आप गाने में क्या करना चाहते हैं? नीचे दिए विकल्पों में से चुन सकते हैं।';
    }
    return 'Could you tell me a little more about what you want to do? You can also pick an option below.';
  }
}

export const speechSynthesizer = new SpeechSynthesizer();
