import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FFmpegCommandPlan } from './filter-builder';
import { AudioTrack } from '../types/audio';

export type LogCallback = (message: string) => void;
export type ProgressCallback = (progress: number) => void;

/**
 * Singleton wrapper around browser-side FFmpeg.wasm (v0.12.x)
 * Handles loading, virtual file system lifecycle, progress reporting, and memory management.
 */
export class FFmpegClient {
  private static instance: FFmpegClient;
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;
  private logs: string[] = [];

  private constructor() {}

  public static getInstance(): FFmpegClient {
    if (!FFmpegClient.instance) {
      FFmpegClient.instance = new FFmpegClient();
    }
    return FFmpegClient.instance;
  }

  /**
   * Loads the FFmpeg WASM binary into the browser.
   * Loads once and caches for subsequent operations.
   */
  public async load(onLog?: LogCallback, onProgress?: ProgressCallback): Promise<void> {
    if (this.isLoaded) return;
    if (this.isLoading) {
      // Wait if already loading
      while (this.isLoading) {
        await new Promise((res) => setTimeout(res, 100));
      }
      return;
    }

    this.isLoading = true;
    try {
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }) => {
        this.logs.push(message);
        if (onLog) onLog(message);
      });

      this.ffmpeg.on('progress', ({ progress }) => {
        if (onProgress) onProgress(Math.round(progress * 100));
      });

      // Load FFmpeg core scripts
      // Using unpkg CDN with toBlobURL ensures zero CORS/worker restrictions
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
    } catch (err) {
      this.isLoaded = false;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to initialize FFmpeg in browser: ${msg}`);
    } finally {
      this.isLoading = false;
    }
  }

  public getLogs(): string[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Executes an audio editing command plan via FFmpeg.wasm
   */
  public async executePlan(
    plan: FFmpegCommandPlan,
    tracks: AudioTrack[],
    onLog?: LogCallback,
    onProgress?: ProgressCallback
  ): Promise<{ data: Uint8Array; logs: string[] }> {
    if (!this.isLoaded || !this.ffmpeg) {
      await this.load(onLog, onProgress);
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg engine is not available');
    }

    this.clearLogs();
    const createdFiles: string[] = [];

    try {
      // 1. Write each input audio file to FFmpeg's virtual in-memory file system
      for (const input of plan.inputs) {
        const track = tracks.find((t) => t.id === input.trackId);
        if (!track || !track.file) {
          throw new Error(`Audio file missing for track "${input.trackId}"`);
        }

        const fileData = await fetchFile(track.file);
        await this.ffmpeg.writeFile(input.filename, fileData);
        createdFiles.push(input.filename);
      }

      // 2. Assemble the full command arguments
      const args: string[] = [];
      for (const input of plan.inputs) {
        args.push('-i', input.filename);
      }
      args.push(...plan.outputArgs);

      if (onLog) {
        onLog(`[Engine] Running: ffmpeg ${args.join(' ')}`);
      }

      // 3. Run execution
      const exitCode = await this.ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg processing failed with exit code ${exitCode}. Check logs for details.`
        );
      }

      // 4. Read output file from virtual FS
      const outputData = await this.ffmpeg.readFile(plan.outputFilename);
      createdFiles.push(plan.outputFilename);

      const uint8 =
        outputData instanceof Uint8Array
          ? outputData
          : new TextEncoder().encode(outputData as string);

      return {
        data: uint8,
        logs: this.getLogs(),
      };
    } finally {
      // 5. Cleanup virtual memory files to prevent browser memory leaks
      for (const file of createdFiles) {
        try {
          await this.ffmpeg.deleteFile(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}

export const ffmpegClient = FFmpegClient.getInstance();
