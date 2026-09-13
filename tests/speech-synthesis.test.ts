import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechSynthesizer } from '../lib/voice/speech-synthesis';

describe('SpeechSynthesizer Unit Tests', () => {
  it('builds natural Hindi confirmation message', () => {
    const msg = SpeechSynthesizer.buildConfirmationMessage('पहले 30 सेकंड हटा रहा हूँ', true);
    expect(msg).toContain('समझ गया!');
    expect(msg).toContain('क्या मैं इसे शुरू करूँ?');
    expect(msg).toContain('पहले 30 सेकंड हटा रहा हूँ');
  });

  it('builds natural English confirmation message', () => {
    const msg = SpeechSynthesizer.buildConfirmationMessage('Trimming first 30 seconds', false);
    expect(msg).toContain('Got it!');
    expect(msg).toContain('Shall I start?');
    expect(msg).toContain('Trimming first 30 seconds');
  });

  it('builds Hindi and English completion messages', () => {
    const hindi = SpeechSynthesizer.buildCompletionMessage(true);
    expect(hindi).toContain('आपका गाना तैयार है');

    const english = SpeechSynthesizer.buildCompletionMessage(false);
    expect(english).toContain('Your song is ready');
  });

  it('builds clarification messages correctly', () => {
    const hindi = SpeechSynthesizer.buildClarificationMessage(true);
    expect(hindi).toContain('मुझे थोड़ा और बताएं');

    const english = SpeechSynthesizer.buildClarificationMessage(false);
    expect(english).toContain('Could you tell me a little more');
  });

  it('handles muted state gracefully', () => {
    const synth = new SpeechSynthesizer();
    synth.setMuted(true);
    expect(synth.isMuted()).toBe(true);

    // In node/vitest environment, speaking when muted returns false
    const spoken = synth.speak('Hello', { language: 'en-IN' });
    expect(spoken).toBe(false);
  });
});
