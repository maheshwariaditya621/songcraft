import { describe, it, expect } from 'vitest';
import { parseTimeToSeconds } from '../lib/instructions/time-parser';
import { RuleBasedInstructionInterpreter } from '../lib/instructions/rule-parser';
import { InstructionContext } from '../lib/types/instructions';
import { AudioTrack } from '../lib/types/audio';
import { VoiceController } from '../lib/voice/voice-controller';
import { SpeechToTextProvider, SpeechCallbacks } from '../lib/voice/speech-types';

describe('Voice and Conversational Instruction Enhancements', () => {
  const track1: AudioTrack = {
    id: 'track_1',
    filename: 'song1.mp3',
    duration: 180,
    format: 'mp3',
    size: 4000000,
    metadata: { duration: 180, format: 'mp3', size: 4000000 },
  };

  const context: InstructionContext = {
    tracks: [track1],
    activeTrackId: 'track_1',
  };

  const interpreter = new RuleBasedInstructionInterpreter();

  describe('Spoken Hindi & English Number Parsing', () => {
    it('parses Hindi word numbers accurately', () => {
      expect(parseTimeToSeconds('tees second')).toBe(30);
      expect(parseTimeToSeconds('chalis second')).toBe(40);
      expect(parseTimeToSeconds('bees second')).toBe(20);
      expect(parseTimeToSeconds('pandrah second')).toBe(15);
      expect(parseTimeToSeconds('das second')).toBe(10);
      expect(parseTimeToSeconds('pachaas second')).toBe(50);
      expect(parseTimeToSeconds('paanch second')).toBe(5);
    });

    it('parses English word numbers', () => {
      expect(parseTimeToSeconds('thirty seconds')).toBe(30);
      expect(parseTimeToSeconds('forty seconds')).toBe(40);
      expect(parseTimeToSeconds('twenty seconds')).toBe(20);
    });
  });

  describe('Conversational Hindi Phrases & Corrections', () => {
    it('parses "Is gaane ka pehle 30 second hata do aur end mein 5 second fade kar do"', () => {
      const res = interpreter.interpret(
        'Is gaane ka pehle 30 second hata do aur end mein 5 second fade kar do',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
          { type: 'fade_out', trackId: 'track_1', duration: 5 },
        ]);
      }
    });

    it('parses conversational correction "Nahi, 40 second se 1 minute tak"', () => {
      const res = interpreter.interpret(
        'Nahi, 40 second se 1 minute tak',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 40, end: 60 },
        ]);
      }
    });

    it('provides friendly clarification options for ambiguous "Isko accha bana do"', () => {
      const res = interpreter.interpret('Isko accha bana do', context);
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.question).toContain('What would you like to change');
        expect(res.possibleOptions?.length).toBeGreaterThanOrEqual(3);
        expect(res.possibleOptions?.[0].label).toContain('Make it louder');
      }
    });
  });

  describe('Voice Controller with Pluggable Provider', () => {
    class MockSpeechProvider implements SpeechToTextProvider {
      public readonly name = 'MockSpeechProvider';
      public isSupported() {
        return true;
      }
      public async start(_opts?: unknown, callbacks?: SpeechCallbacks) {
        callbacks?.onInterimTranscript?.('Pehle tees second');
        callbacks?.onFinalTranscript?.('Pehle tees second hata do');
      }
      public async stop() {
        return 'Pehle tees second hata do';
      }
      public abort() {}
    }

    it('coordinates speech events and delivers transcripts', async () => {
      const mock = new MockSpeechProvider();
      const controller = new VoiceController(mock);
      let received = '';

      controller.setListener({
        onTranscriptUpdate: (t) => {
          received = t;
        },
      });

      await controller.startListening();
      expect(received).toBe('Pehle tees second hata do');

      const finalTranscript = await controller.stopListening();
      expect(finalTranscript).toBe('Pehle tees second hata do');
    });
  });
});
