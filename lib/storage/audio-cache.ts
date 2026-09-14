/**
 * IndexedDB Audio Cache & Session Persistence
 *
 * Provides client-side persistence for audio Blobs and track metadata.
 * Uses ArrayBuffer serialization to bypass the known WebKit/iOS Safari
 * bug ("Error preparing Blob/File data to be stored in object store").
 * Enables zero-data-loss page refreshes and session restoration.
 */

export interface CachedTrackRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  duration: number;
  format: string;
  isRecordedVoice?: boolean;
  isWhatsAppAudio?: boolean;
  isFromVideo?: boolean;
  blob: Blob;
  updatedAt: number;
}

interface StoredDBRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  duration: number;
  format: string;
  isRecordedVoice?: boolean;
  isWhatsAppAudio?: boolean;
  isFromVideo?: boolean;
  buffer?: ArrayBuffer;
  blob?: Blob;
  updatedAt: number;
}

const DB_NAME = 'songcraft_cache_db';
const DB_VERSION = 1;
const STORE_TRACKS = 'cached_tracks';
const STORE_SETTINGS = 'user_settings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a track in IndexedDB.
 * Converts Blob to ArrayBuffer before storing to prevent iOS WebKit
 * "Error preparing Blob/File data to be stored in object store" exceptions.
 * Never throws to the caller — caching is safe and non-blocking.
 */
export async function saveTrackToCache(track: CachedTrackRecord): Promise<void> {
  try {
    let buffer: ArrayBuffer | undefined;

    // Convert Blob/File to ArrayBuffer for universal mobile compatibility
    if (track.blob && typeof track.blob.arrayBuffer === 'function') {
      try {
        buffer = await track.blob.arrayBuffer();
      } catch (e) {
        console.warn('[AudioCache] Could not convert blob to ArrayBuffer:', e);
      }
    }

    const recordToStore: StoredDBRecord = {
      id: track.id,
      name: track.name,
      size: track.size,
      type: track.type || 'audio/mpeg',
      duration: track.duration,
      format: track.format,
      isRecordedVoice: track.isRecordedVoice,
      isWhatsAppAudio: track.isWhatsAppAudio,
      isFromVideo: track.isFromVideo,
      buffer: buffer,
      updatedAt: track.updatedAt || Date.now(),
    };

    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction error'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

      store.put(recordToStore);
    });
  } catch (err) {
    console.warn('[AudioCache] Failed to save track (graceful fallback):', err);
  }
}

/**
 * Retrieve all cached tracks sorted by most recent.
 * Reconstructs Blobs from stored ArrayBuffers.
 */
export async function getAllCachedTracks(): Promise<CachedTrackRecord[]> {
  try {
    const db = await openDatabase();
    const rawRecords: StoredDBRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const records: CachedTrackRecord[] = [];
    for (const rec of rawRecords) {
      let blob: Blob;
      if (rec.buffer) {
        blob = new Blob([rec.buffer], { type: rec.type || 'audio/mpeg' });
      } else if (rec.blob instanceof Blob) {
        blob = rec.blob;
      } else {
        blob = new Blob([], { type: rec.type || 'audio/mpeg' });
      }

      records.push({
        id: rec.id,
        name: rec.name,
        size: rec.size,
        type: rec.type,
        duration: rec.duration,
        format: rec.format,
        isRecordedVoice: rec.isRecordedVoice,
        isWhatsAppAudio: rec.isWhatsAppAudio,
        isFromVideo: rec.isFromVideo,
        blob,
        updatedAt: rec.updatedAt,
      });
    }

    records.sort((a, b) => b.updatedAt - a.updatedAt);
    return records;
  } catch (err) {
    console.warn('[AudioCache] Failed to load tracks:', err);
    return [];
  }
}

/**
 * Delete a specific track by ID
 */
export async function deleteCachedTrack(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_TRACKS);
      store.delete(id);
    });
  } catch (err) {
    console.warn('[AudioCache] Failed to delete track:', err);
  }
}

/**
 * Clear all cached audio files
 */
export async function clearAllCachedTracks(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE_TRACKS);
      store.clear();
    });
  } catch (err) {
    console.warn('[AudioCache] Failed to clear tracks:', err);
  }
}

