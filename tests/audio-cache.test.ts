import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveTrackToCache,
  getAllCachedTracks,
  deleteCachedTrack,
  clearAllCachedTracks,
  CachedTrackRecord,
} from '../lib/storage/audio-cache';

describe('Audio Cache / Session Persistence', () => {
  it('handles environment without indexedDB gracefully without crashing', async () => {
    // In Node / Vitest without indexedDB mock, it should resolve cleanly or return empty array
    const tracks = await getAllCachedTracks();
    expect(Array.isArray(tracks)).toBe(true);
  });

  it('safely handles clearAllCachedTracks without throwing error in Node', async () => {
    await expect(clearAllCachedTracks()).resolves.toBeUndefined();
  });

  it('safely handles deleteCachedTrack without throwing error in Node', async () => {
    await expect(deleteCachedTrack('test_id')).resolves.toBeUndefined();
  });
});
