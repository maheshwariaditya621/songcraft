import {
  ProcessingRequest,
  ProcessingResult,
  AudioEngineLimits,
  DEFAULT_ENGINE_LIMITS,
} from '../types/audio';
import { AudioValidator } from './validator';
import { FFmpegFilterBuilder } from './filter-builder';
import { FFmpegClient, LogCallback, ProgressCallback, ffmpegClient } from './ffmpeg-client';

export interface AudioEngineOptions {
  limits?: AudioEngineLimits;
  client?: FFmpegClient;
}

/**
 * AudioEngine
 *
 * Core coordinator for validating, planning, and executing audio operations.
 * Completely decoupled from UI, voice, WhatsApp, and AI.
 */
export class AudioEngine {
  private validator: AudioValidator;
  private filterBuilder: FFmpegFilterBuilder;
  private client: FFmpegClient;

  constructor(options?: AudioEngineOptions) {
    this.validator = new AudioValidator(options?.limits || DEFAULT_ENGINE_LIMITS);
    this.filterBuilder = new FFmpegFilterBuilder();
    this.client = options?.client || ffmpegClient;
  }

  /**
   * Process an audio request containing one or more tracks and operations
   */
  public async processAudio(
    request: ProcessingRequest,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ProcessingResult> {
    const startTime = performance.now();

    // 1. Validation
    const validation = this.validator.validatePipeline(request.tracks, request.operations);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        logs: [`[Validation Error] ${validation.error.message}`],
      };
    }

    try {
      // 2. Build FFmpeg execution plan
      const plan = this.filterBuilder.buildPlan(
        request.tracks,
        request.operations,
        request.outputFormat,
        request.outputFilename
      );

      if (onLog) {
        onLog(`[Planner] Filter Graph: ${plan.filterComplex || 'Pass-through'}`);
      }

      // 3. Execute via FFmpeg.wasm
      const { data, logs } = await this.client.executePlan(
        plan,
        request.tracks,
        onLog,
        onProgress
      );

      // 4. Construct Output Blob & URL
      const mimeType = request.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      // Copy to standard ArrayBuffer if backed by SharedArrayBuffer from WASM
      const safeBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
      const blob = new Blob([safeBuffer as ArrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      // Calculate approximate output duration
      const duration = this.calculateEstimatedDuration(request);

      const processingTimeMs = Math.round(performance.now() - startTime);

      return {
        success: true,
        output: {
          filename: plan.outputFilename,
          format: request.outputFormat,
          duration,
          size: blob.size,
          blob,
          blobUrl,
        },
        metrics: {
          processingTimeMs,
          operationsCount: request.operations.length,
          inputTracksCount: request.tracks.length,
        },
        logs,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'ENGINE_ERROR',
          message: errorMsg,
        },
        logs: [`[Engine Failure] ${errorMsg}`],
      };
    }
  }

  private calculateEstimatedDuration(request: ProcessingRequest): number {
    const mergeOp = request.operations.find((o) => o.type === 'merge');
    if (mergeOp && mergeOp.type === 'merge') {
      return mergeOp.tracks.reduce((acc, tId) => {
        const track = request.tracks.find((t) => t.id === tId);
        return acc + (track?.duration || 0);
      }, 0);
    }

    const activeTrack = request.tracks[0];
    const trimOp = request.operations.find((o) => o.type === 'trim');
    if (trimOp && trimOp.type === 'trim') {
      return Math.round((trimOp.end - trimOp.start) * 100) / 100;
    }

    return activeTrack ? activeTrack.duration : 0;
  }
}

// Global default instance
export const defaultAudioEngine = new AudioEngine();
