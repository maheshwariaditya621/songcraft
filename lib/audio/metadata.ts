import { AudioFormat, AudioMetadata } from '../types/audio';

/**
 * Extracts accurate audio metadata in the browser using Web Audio API and HTMLAudioElement
 * with zero server communication (₹0 cost & 100% privacy).
 */
export async function extractAudioMetadata(file: File | Blob, filename: string): Promise<AudioMetadata> {
  const format = detectFormat(filename, file.type);
  const size = file.size;
  const isVideo = isVideoFile(filename, file.type);

  let duration = 0;
  let sampleRate: number | undefined;
  let channels: number | undefined;

  // For video files: HTMLVideoElement provides the fastest, most reliable container duration
  if (isVideo) {
    duration = await getDurationFromVideoElement(file);
  }

  // Attempt 1: Web Audio API (if not video or if video duration extraction yielded 0)
  if (!duration || duration <= 0) {
    try {
      const arrayBuffer = await file.slice(0, Math.min(file.size, 10 * 1024 * 1024)).arrayBuffer();
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        try {
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
          duration = audioBuffer.duration;
          sampleRate = audioBuffer.sampleRate;
          channels = audioBuffer.numberOfChannels;
        } finally {
          await audioCtx.close().catch(() => {});
        }
      }
    } catch {
      // If Web Audio API slice decoding fails on partial file, fall back to HTMLAudioElement
    }
  }

  // Attempt 2: HTMLAudioElement fallback
  if (!duration || duration <= 0) {
    duration = await getDurationFromAudioElement(file);
  }

  return {
    duration: Math.round(duration * 100) / 100,
    sampleRate,
    channels,
    format,
    size,
  };
}

export function isVideoFile(filename: string, mimeType?: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return (
    ext === 'mp4' ||
    ext === 'mov' ||
    ext === 'webm' ||
    ext === 'mkv' ||
    Boolean(mimeType?.startsWith('video/'))
  );
}

export function isWhatsAppAudioFile(filename: string, mimeType?: string): boolean {
  const lower = filename.toLowerCase();
  const ext = lower.split('.').pop()?.toLowerCase();

  if (ext === 'opus' || ext === 'ogg' || ext === 'oga') return true;

  if (
    lower.startsWith('ptt-') ||
    lower.startsWith('aud-') ||
    lower.includes('whatsapp') ||
    lower.includes('voice note')
  ) {
    return true;
  }

  if (mimeType?.includes('opus') || mimeType?.includes('audio/ogg')) {
    return true;
  }

  return false;
}

function detectFormat(filename: string, mimeType?: string): AudioFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'opus' || mimeType?.includes('opus')) return 'opus';
  if (ext === 'ogg' || ext === 'oga' || mimeType?.includes('ogg')) return 'ogg';
  if (ext === 'mp4' || mimeType?.includes('mp4')) return 'mp4';
  if (ext === 'mov' || mimeType?.includes('quicktime')) return 'mov';
  if (ext === 'webm' || mimeType?.includes('webm')) return 'webm';
  if (ext === 'mkv' || mimeType?.includes('matroska')) return 'mkv';
  if (ext === 'mp3' || mimeType?.includes('mpeg') || mimeType?.includes('mp3')) return 'mp3';
  if (ext === 'wav' || mimeType?.includes('wav')) return 'wav';
  if (ext === 'm4a' || mimeType?.includes('m4a')) return 'm4a';
  if (ext === 'aac' || mimeType?.includes('aac')) return 'aac';
  return 'mp3';
}

function getDurationFromVideoElement(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(0);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(url);
    };

    video.onloadedmetadata = () => {
      const d = isFinite(video.duration) ? video.duration : 0;
      cleanUp();
      resolve(d);
    };

    video.onerror = () => {
      cleanUp();
      resolve(0);
    };

    video.src = url;
  });
}

function getDurationFromAudioElement(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(url);
    };

    audio.onloadedmetadata = () => {
      const d = isFinite(audio.duration) ? audio.duration : 0;
      cleanUp();
      resolve(d);
    };

    audio.onerror = () => {
      cleanUp();
      resolve(0);
    };

    audio.src = url;
  });
}
