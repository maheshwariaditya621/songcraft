/**
 * IndexedDB Audio Cache & Session Persistence
 *
 * Provides client-side persistence for audio Blobs and track metadata.
 * Enables zero-data-loss page refreshes, fast multi-page transitions,
 * and session restoration without exceeding localStorage's 5MB limit.
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
 * Save or update a track in IndexedDB
 */
export async function saveTrackToCache(track: CachedTrackRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.put(track);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AudioCache] Failed to save track:', err);
  }
}

/**
 * Retrieve all cached tracks sorted by most recent
 */
export async function getAllCachedTracks(): Promise<CachedTrackRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: CachedTrackRecord[] = req.result || [];
        records.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AudioCache] Failed to clear tracks:', err);
  }
}
