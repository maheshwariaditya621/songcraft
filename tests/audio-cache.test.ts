import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveTrackToCache,
  getAllCachedTracks,
  deleteCachedTrack,
  clearAllCachedTracks,
  renameCachedTrack,
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

  it('safely handles renameCachedTrack without throwing error in Node', async () => {
    await expect(renameCachedTrack('test_id', 'new_name.mp3')).resolves.toBeUndefined();
  });

  it('safely handles saveTrackToCache with Blob without throwing error in Node', async () => {
    const dummyBlob = new Blob(['dummy audio content'], { type: 'audio/mpeg' });
    const record: CachedTrackRecord = {
      id: 'test_track_1',
      name: 'test.mp3',
      size: dummyBlob.size,
      type: 'audio/mpeg',
      duration: 30,
      format: 'mp3',
      blob: dummyBlob,
      updatedAt: Date.now(),
    };

    await expect(saveTrackToCache(record)).resolves.toBeUndefined();
  });
});
