import { AudioOperation, AudioTrack, OutputAudioFormat } from '../types/audio';

export interface FFmpegCommandPlan {
  inputs: { trackId: string; filename: string; inputIndex: number }[];
  filterComplex: string;
  outputArgs: string[];
  outputFilename: string;
}

/**
 * Compiles high-level AudioOperation[] into safe, optimized FFmpeg filtergraphs.
 * Avoids any shell injection, handles single-track processing and multi-track merges.
 */
export class FFmpegFilterBuilder {
  /**
   * Build complete execution plan for FFmpeg
   */
  public buildPlan(
    tracks: AudioTrack[],
    operations: AudioOperation[],
    outputFormat: OutputAudioFormat,
    outputFilename?: string
  ): FFmpegCommandPlan {
    const defaultExt = outputFormat === 'mp3' ? 'mp3' : 'wav';
    const finalFilename = outputFilename || `output_${Date.now()}.${defaultExt}`;

    // Map tracks to input indices [0, 1, 2...]
    const inputs = tracks.map((track, index) => ({
      trackId: track.id,
      filename: `input_${index}_${this.sanitizeFilename(track.filename)}`,
      inputIndex: index,
    }));

    const trackIndexMap = new Map<string, number>(
      inputs.map((inp) => [inp.trackId, inp.inputIndex])
    );
    const trackMetadataMap = new Map<string, AudioTrack>(tracks.map((t) => [t.id, t]));

    // Check if there is a merge operation
    const mergeOp = operations.find((op) => op.type === 'merge');

    let filterComplex = '';

    if (mergeOp && mergeOp.type === 'merge') {
      // Multi-track concatenation or crossfade flow
      filterComplex = this.buildMergeFilterGraph(
        mergeOp.tracks,
        operations.filter((op) => op.type !== 'merge'),
        trackIndexMap,
        trackMetadataMap,
        mergeOp.crossfade,
        mergeOp.crossfadeDuration || 3
      );
    } else {
      // Single track (or primary active track) processing flow
      const activeTrack = tracks[0];
      const activeOps = operations.filter(
        (op) => !('trackId' in op) || op.trackId === activeTrack.id
      );
      filterComplex = this.buildSingleTrackFilterGraph(
        0,
        activeTrack,
        activeOps
      );
    }

    // Determine output encoding arguments
    const outputArgs: string[] = [];

    if (filterComplex.length > 0) {
      outputArgs.push('-filter_complex', filterComplex, '-map', '[aout]');
    }

    if (outputFormat === 'mp3') {
      outputArgs.push('-c:a', 'libmp3lame', '-b:a', '192k');
    } else {
      outputArgs.push('-c:a', 'pcm_s16le');
    }

    outputArgs.push(finalFilename);

    return {
      inputs,
      filterComplex,
      outputArgs,
      outputFilename: finalFilename,
    };
  }

  private buildSingleTrackFilterGraph(
    inputIndex: number,
    track: AudioTrack,
    ops: AudioOperation[]
  ): string {
    const filters: string[] = [];

    // 1. Trim first (if present)
    const trimOp = ops.find((o) => o.type === 'trim');
    let effectiveDuration = track.duration;

    if (trimOp && trimOp.type === 'trim') {
      filters.push(`atrim=start=${trimOp.start}:end=${trimOp.end}`);
      filters.push('asetpts=PTS-STARTPTS');
      effectiveDuration = trimOp.end - trimOp.start;
    }

    // 2. Fade In
    const fadeInOp = ops.find((o) => o.type === 'fade_in');
    if (fadeInOp && fadeInOp.type === 'fade_in') {
      const dur = Math.min(fadeInOp.duration, effectiveDuration);
      filters.push(`afade=t=in:ss=0:d=${dur}`);
    }

    // 3. Fade Out
    const fadeOutOp = ops.find((o) => o.type === 'fade_out');
    if (fadeOutOp && fadeOutOp.type === 'fade_out') {
      const dur = Math.min(fadeOutOp.duration, effectiveDuration);
      const startTime = Math.max(0, effectiveDuration - dur);
      filters.push(`afade=t=out:st=${startTime.toFixed(3)}:d=${dur}`);
    }

    // 4. Volume adjustment
    const volumeOp = ops.find((o) => o.type === 'volume');
    if (volumeOp && volumeOp.type === 'volume') {
      filters.push(`volume=${volumeOp.value}`);
    }

    // 5. Audio normalization
    const normOp = ops.find((o) => o.type === 'normalize');
    if (normOp && normOp.type === 'normalize') {
      // Dynamic audio normalizer (very reliable single-pass audio filter)
      filters.push('dynaudnorm=f=150:g=15');
    }

    if (filters.length === 0) {
      return `[${inputIndex}:a]anull[aout]`;
    }

    return `[${inputIndex}:a]${filters.join(',')}[aout]`;
  }

  private buildMergeFilterGraph(
    mergeTrackIds: string[],
    otherOps: AudioOperation[],
    trackIndexMap: Map<string, number>,
    trackMap: Map<string, AudioTrack>,
    crossfade?: boolean,
    crossfadeDuration: number = 3
  ): string {
    const trackFilters: string[] = [];
    const streamLabels: string[] = [];

    mergeTrackIds.forEach((trackId, i) => {
      const inputIdx = trackIndexMap.get(trackId) ?? i;
      const track = trackMap.get(trackId);
      const opsForTrack = otherOps.filter(
        (op) => 'trackId' in op && op.trackId === trackId
      );

      const streamLabel = `[trk_${i}]`;
      streamLabels.push(streamLabel);

      const filters: string[] = [];
      let effectiveDuration = track ? track.duration : 0;

      const trimOp = opsForTrack.find((o) => o.type === 'trim');
      if (trimOp && trimOp.type === 'trim') {
        filters.push(`atrim=start=${trimOp.start}:end=${trimOp.end}`);
        filters.push('asetpts=PTS-STARTPTS');
        effectiveDuration = trimOp.end - trimOp.start;
      }

      const fadeInOp = opsForTrack.find((o) => o.type === 'fade_in');
      if (fadeInOp && fadeInOp.type === 'fade_in') {
        const dur = Math.min(fadeInOp.duration, effectiveDuration || fadeInOp.duration);
        filters.push(`afade=t=in:ss=0:d=${dur}`);
      }

      const fadeOutOp = opsForTrack.find((o) => o.type === 'fade_out');
      if (fadeOutOp && fadeOutOp.type === 'fade_out') {
        const dur = Math.min(fadeOutOp.duration, effectiveDuration || fadeOutOp.duration);
        const startTime = Math.max(0, effectiveDuration - dur);
        filters.push(`afade=t=out:st=${startTime.toFixed(3)}:d=${dur}`);
      }

      const volOp = opsForTrack.find((o) => o.type === 'volume');
      if (volOp && volOp.type === 'volume') {
        filters.push(`volume=${volOp.value}`);
      }

      if (filters.length > 0) {
        trackFilters.push(`[${inputIdx}:a]${filters.join(',')}${streamLabel}`);
      } else {
        trackFilters.push(`[${inputIdx}:a]anull${streamLabel}`);
      }
    });

    // Crossfade vs Standard Concat
    if (crossfade && streamLabels.length >= 2) {
      // Chain acrossfade filters sequentially
      let currentIn = streamLabels[0];
      for (let i = 1; i < streamLabels.length; i++) {
        const nextIn = streamLabels[i];
        const isLast = i === streamLabels.length - 1;
        const outLabel = isLast ? '[aout]' : `[cf_${i}]`;
        trackFilters.push(
          `${currentIn}${nextIn}acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri${outLabel}`
        );
        currentIn = outLabel;
      }
    } else {
      const concatFilter = `${streamLabels.join('')}concat=n=${mergeTrackIds.length}:v=0:a=1[aout]`;
      trackFilters.push(concatFilter);
    }

    return trackFilters.join(';');
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
