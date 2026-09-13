/**
 * Core Audio Domain Types
 * Independent of UI, AI, and processing engine
 */

export type AudioFormat =
  | 'mp3'
  | 'wav'
  | 'm4a'
  | 'aac'
  | 'mp4'
  | 'mov'
  | 'webm'
  | 'mkv'
  | 'opus'
  | 'ogg';
export type OutputAudioFormat = 'mp3' | 'wav';

export interface AudioMetadata {
  duration: number; // in seconds
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  format: AudioFormat;
  size: number; // in bytes
}

export interface AudioTrack {
  id: string;
  filename: string;
  duration: number; // in seconds
  format: AudioFormat;
  size: number; // in bytes
  metadata: AudioMetadata;
  blobUrl?: string;
  file?: File | Blob;
  isVideo?: boolean;
  isWhatsAppAudio?: boolean;
  isRecordedVoice?: boolean;
}

export interface TrimOperation {
  type: 'trim';
  trackId: string;
  start: number; // in seconds
  end: number; // in seconds
}

export interface FadeInOperation {
  type: 'fade_in';
  trackId: string;
  duration: number; // in seconds
}

export interface FadeOutOperation {
  type: 'fade_out';
  trackId: string;
  duration: number; // in seconds
  startOffset?: number; // optional: if not provided, calculated as track/trimmed end - duration
}

export interface VolumeOperation {
  type: 'volume';
  trackId: string;
  value: number; // multiplier e.g. 1.0 = 100%, 0.5 = 50%, 1.5 = 150%
}

export interface NormalizeOperation {
  type: 'normalize';
  trackId: string;
  targetLufs?: number; // default -14 LUFS
}

export interface MergeOperation {
  type: 'merge';
  tracks: string[]; // array of track IDs to concatenate sequentially
  crossfade?: boolean; // smooth musical blend between tracks
  crossfadeDuration?: number; // in seconds, default 3
}

export type AudioOperation =
  | TrimOperation
  | FadeInOperation
  | FadeOutOperation
  | VolumeOperation
  | NormalizeOperation
  | MergeOperation;

export interface AudioProject {
  id: string;
  name: string;
  tracks: AudioTrack[];
  operations: AudioOperation[];
  outputFormat: OutputAudioFormat;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessingRequest {
  projectId?: string;
  tracks: AudioTrack[];
  operations: AudioOperation[];
  outputFormat: OutputAudioFormat;
  outputFilename?: string;
}

export interface ProcessingOutput {
  filename: string;
  format: OutputAudioFormat;
  duration: number;
  size: number;
  blob: Blob;
  blobUrl: string;
}

export interface ProcessingError {
  code:
    | 'INVALID_PARAMS'
    | 'TRACK_NOT_FOUND'
    | 'FILE_TOO_LARGE'
    | 'UNSUPPORTED_FORMAT'
    | 'ENGINE_ERROR'
    | 'OUT_OF_BOUNDS'
    | 'EMPTY_OPERATIONS';
  message: string;
  details?: unknown;
}

export interface ProcessingMetrics {
  processingTimeMs: number;
  operationsCount: number;
  inputTracksCount: number;
}

export interface ProcessingResult {
  success: boolean;
  output?: ProcessingOutput;
  error?: ProcessingError;
  metrics?: ProcessingMetrics;
  logs?: string[];
}

export interface AudioEngineLimits {
  maxFileSizeMb: number;
  maxDurationSeconds: number;
  maxTracksCount: number;
  supportedInputFormats: AudioFormat[];
  supportedOutputFormats: OutputAudioFormat[];
}

export const DEFAULT_ENGINE_LIMITS: AudioEngineLimits = {
  maxFileSizeMb: 100,
  maxDurationSeconds: 1200, // 20 minutes
  maxTracksCount: 10,
  supportedInputFormats: ['mp3', 'wav', 'm4a', 'aac', 'mp4', 'mov', 'webm', 'mkv', 'opus', 'ogg'],
  supportedOutputFormats: ['mp3', 'wav'],
};
