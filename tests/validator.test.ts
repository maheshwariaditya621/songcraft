import { describe, it, expect } from 'vitest';
import { AudioValidator } from '../lib/audio/validator';
import { AudioTrack } from '../lib/types/audio';

describe('AudioValidator', () => {
  const validator = new AudioValidator({
    maxFileSizeMb: 50,
    maxDurationSeconds: 600,
    maxTracksCount: 5,
    supportedInputFormats: ['mp3', 'wav'],
    supportedOutputFormats: ['mp3', 'wav'],
  });

  const validTrack: AudioTrack = {
    id: 'track_1',
    filename: 'song.mp3',
    duration: 180, // 3 minutes
    format: 'mp3',
    size: 5 * 1024 * 1024,
    metadata: {
      duration: 180,
      format: 'mp3',
      size: 5 * 1024 * 1024,
    },
  };

  it('validates a healthy track and trim operation', () => {
    const res = validator.validatePipeline([validTrack], [
      { type: 'trim', trackId: 'track_1', start: 30, end: 90 },
    ]);
    expect(res.valid).toBe(true);
  });

  it('rejects trim with start >= end', () => {
    const res = validator.validatePipeline([validTrack], [
      { type: 'trim', trackId: 'track_1', start: 60, end: 30 },
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('INVALID_PARAMS');
      expect(res.error.message).toContain('greater than start time');
    }
  });

  it('rejects trim when end exceeds track duration', () => {
    const res = validator.validatePipeline([validTrack], [
      { type: 'trim', trackId: 'track_1', start: 30, end: 250 },
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('OUT_OF_BOUNDS');
      expect(res.error.message).toContain('longer than the song');
    }
  });

  it('rejects fade in duration exceeding track duration', () => {
    const res = validator.validatePipeline([validTrack], [
      { type: 'fade_in', trackId: 'track_1', duration: 200 },
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('OUT_OF_BOUNDS');
    }
  });

  it('rejects merge with non-existent track ID', () => {
    const res = validator.validatePipeline([validTrack], [
      { type: 'merge', tracks: ['track_1', 'non_existent'] },
    ]);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('TRACK_NOT_FOUND');
    }
  });

  it('rejects empty operations array', () => {
    const res = validator.validatePipeline([validTrack], []);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe('EMPTY_OPERATIONS');
    }
  });

  it('validates video container formats (mp4, mov, webm, mkv) with default validator', () => {
    const defaultValidator = new AudioValidator();
    const videoTrack: AudioTrack = {
      id: 'track_video',
      filename: 'video.mp4',
      duration: 120,
      format: 'mp4',
      size: 15 * 1024 * 1024,
      metadata: { duration: 120, format: 'mp4', size: 15 * 1024 * 1024 },
      isVideo: true,
    };

    const res = defaultValidator.validatePipeline(
      [videoTrack, validTrack],
      [
        { type: 'trim', trackId: 'track_video', start: 10, end: 40 },
        { type: 'merge', tracks: ['track_video', 'track_1'], crossfade: true, crossfadeDuration: 3 },
      ]
    );

    expect(res.valid).toBe(true);
  });
});
