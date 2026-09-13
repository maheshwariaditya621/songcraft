import { describe, it, expect } from 'vitest';
import { isWhatsAppAudioFile } from '../lib/audio/metadata';
import { AudioValidator } from '../lib/audio/validator';
import { FFmpegFilterBuilder } from '../lib/audio/filter-builder';
import { AudioTrack, DEFAULT_ENGINE_LIMITS } from '../lib/types/audio';

describe('WhatsApp Audio & Format Detection', () => {
  it('detects WhatsApp push-to-talk voice notes (.opus)', () => {
    expect(isWhatsAppAudioFile('PTT-20240914-WA0001.opus')).toBe(true);
    expect(isWhatsAppAudioFile('ptt-20230815-wa0004.opus')).toBe(true);
  });

  it('detects WhatsApp audio recordings with AUD prefix or WhatsApp in name', () => {
    expect(isWhatsAppAudioFile('AUD-20240914-WA0002.opus')).toBe(true);
    expect(isWhatsAppAudioFile('WhatsApp Audio 2024-09-14 at 10.30.00.opus')).toBe(true);
    expect(isWhatsAppAudioFile('WhatsApp Voice Note 1.ogg')).toBe(true);
  });

  it('detects .opus and .ogg extensions regardless of prefix', () => {
    expect(isWhatsAppAudioFile('recording.opus')).toBe(true);
    expect(isWhatsAppAudioFile('voice_message.ogg')).toBe(true);
    expect(isWhatsAppAudioFile('note.oga')).toBe(true);
  });

  it('detects WhatsApp audio via mimeType', () => {
    expect(isWhatsAppAudioFile('unnamed', 'audio/ogg; codecs=opus')).toBe(true);
    expect(isWhatsAppAudioFile('unnamed', 'audio/opus')).toBe(true);
  });

  it('does not falsely flag standard MP3 or WAV files', () => {
    expect(isWhatsAppAudioFile('my_favorite_song.mp3', 'audio/mpeg')).toBe(false);
    expect(isWhatsAppAudioFile('guitar_solo.wav', 'audio/wav')).toBe(false);
  });

  it('supports opus and ogg in default engine limits and validator', () => {
    expect(DEFAULT_ENGINE_LIMITS.supportedInputFormats).toContain('opus');
    expect(DEFAULT_ENGINE_LIMITS.supportedInputFormats).toContain('ogg');

    const validator = new AudioValidator();
    const opusTrack: AudioTrack = {
      id: 'track_opus_1',
      filename: 'PTT-20240914-WA0001.opus',
      duration: 45,
      format: 'opus',
      size: 500 * 1024,
      metadata: {
        duration: 45,
        format: 'opus',
        size: 500 * 1024,
      },
    };

    const res = validator.validateTrack(opusTrack);
    expect(res.valid).toBe(true);
  });

  it('generates correct FFmpeg plan for WhatsApp audio trimming and merging', () => {
    const builder = new FFmpegFilterBuilder();
    const track1: AudioTrack = {
      id: 't1',
      filename: 'PTT-20240914-WA0001.opus',
      duration: 30,
      format: 'opus',
      size: 300 * 1024,
      metadata: { duration: 30, format: 'opus', size: 300 * 1024 },
    };

    const plan = builder.buildPlan(
      [track1],
      [{ type: 'trim', trackId: 't1', start: 5, end: 25 }],
      'mp3',
      'whatsapp_trimmed.mp3'
    );

    expect(plan.inputs.length).toBe(1);
    expect(plan.inputs[0].filename).toContain('.opus');
    expect(plan.filterComplex).toContain('atrim=start=5:end=25');
    expect(plan.outputFilename).toBe('whatsapp_trimmed.mp3');
  });
});
