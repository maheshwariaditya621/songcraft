import {
  AudioOperation,
  AudioTrack,
  DEFAULT_ENGINE_LIMITS,
  AudioEngineLimits,
  ProcessingError,
} from '../types/audio';

export interface ValidationSuccess {
  valid: true;
}

export interface ValidationFailure {
  valid: false;
  error: ProcessingError;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates audio operations against track metadata and engine limits.
 * Guarantees zero out-of-bounds, invalid timestamps, or unsafe values.
 */
export class AudioValidator {
  private limits: AudioEngineLimits;

  constructor(limits: AudioEngineLimits = DEFAULT_ENGINE_LIMITS) {
    this.limits = limits;
  }

  public validateTrack(track: AudioTrack): ValidationResult {
    if (!track.id) {
      return {
        valid: false,
        error: { code: 'INVALID_PARAMS', message: 'Track ID is required' },
      };
    }

    if (track.duration <= 0) {
      return {
        valid: false,
        error: {
          code: 'INVALID_PARAMS',
          message: `Track "${track.filename}" has invalid duration (${track.duration}s)`,
        },
      };
    }

    if (track.duration > this.limits.maxDurationSeconds) {
      return {
        valid: false,
        error: {
          code: 'OUT_OF_BOUNDS',
          message: `Track "${track.filename}" duration exceeds maximum allowed (${this.limits.maxDurationSeconds}s)`,
        },
      };
    }

    const fileSizeMb = track.size / (1024 * 1024);
    if (fileSizeMb > this.limits.maxFileSizeMb) {
      return {
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size (${fileSizeMb.toFixed(1)}MB) exceeds limit of ${this.limits.maxFileSizeMb}MB`,
        },
      };
    }

    if (!this.limits.supportedInputFormats.includes(track.format)) {
      return {
        valid: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: `Format "${track.format}" is not supported. Supported: ${this.limits.supportedInputFormats.join(', ')}`,
        },
      };
    }

    return { valid: true };
  }

  public validateOperation(
    op: AudioOperation,
    tracksMap: Map<string, AudioTrack>
  ): ValidationResult {
    switch (op.type) {
      case 'trim': {
        const track = tracksMap.get(op.trackId);
        if (!track) {
          return {
            valid: false,
            error: { code: 'TRACK_NOT_FOUND', message: `Track ${op.trackId} not found` },
          };
        }

        if (op.start < 0) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Trim start time cannot be negative (${op.start}s)`,
            },
          };
        }

        if (op.end <= op.start) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `End time (${op.end}s) must be greater than start time (${op.start}s)`,
            },
          };
        }

        // Allow a tiny margin (0.1s) for floating point duration discrepancies
        if (op.end > track.duration + 0.1) {
          return {
            valid: false,
            error: {
              code: 'OUT_OF_BOUNDS',
              message: `That ending time (${op.end}s) is longer than the song (${track.duration.toFixed(1)}s)`,
            },
          };
        }
        return { valid: true };
      }

      case 'fade_in': {
        const track = tracksMap.get(op.trackId);
        if (!track) {
          return {
            valid: false,
            error: { code: 'TRACK_NOT_FOUND', message: `Track ${op.trackId} not found` },
          };
        }

        if (op.duration <= 0) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Fade in duration must be greater than 0 (${op.duration}s)`,
            },
          };
        }

        if (op.duration > track.duration) {
          return {
            valid: false,
            error: {
              code: 'OUT_OF_BOUNDS',
              message: `Fade in duration (${op.duration}s) cannot be longer than track (${track.duration}s)`,
            },
          };
        }
        return { valid: true };
      }

      case 'fade_out': {
        const track = tracksMap.get(op.trackId);
        if (!track) {
          return {
            valid: false,
            error: { code: 'TRACK_NOT_FOUND', message: `Track ${op.trackId} not found` },
          };
        }

        if (op.duration <= 0) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Fade out duration must be greater than 0 (${op.duration}s)`,
            },
          };
        }

        if (op.duration > track.duration) {
          return {
            valid: false,
            error: {
              code: 'OUT_OF_BOUNDS',
              message: `Fade out duration (${op.duration}s) cannot be longer than track (${track.duration}s)`,
            },
          };
        }
        return { valid: true };
      }

      case 'volume': {
        const track = tracksMap.get(op.trackId);
        if (!track) {
          return {
            valid: false,
            error: { code: 'TRACK_NOT_FOUND', message: `Track ${op.trackId} not found` },
          };
        }

        if (op.value < 0 || op.value > 5.0) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Volume value must be between 0.0 and 5.0 (received ${op.value})`,
            },
          };
        }
        return { valid: true };
      }

      case 'normalize': {
        const track = tracksMap.get(op.trackId);
        if (!track) {
          return {
            valid: false,
            error: { code: 'TRACK_NOT_FOUND', message: `Track ${op.trackId} not found` },
          };
        }
        return { valid: true };
      }

      case 'merge': {
        if (!op.tracks || op.tracks.length < 2) {
          return {
            valid: false,
            error: {
              code: 'INVALID_PARAMS',
              message: 'Merge requires at least two tracks',
            },
          };
        }

        for (const tId of op.tracks) {
          if (!tracksMap.has(tId)) {
            return {
              valid: false,
              error: {
                code: 'TRACK_NOT_FOUND',
                message: `Track "${tId}" specified in merge was not found`,
              },
            };
          }
        }
        return { valid: true };
      }

      default:
        return {
          valid: false,
          error: {
            code: 'INVALID_PARAMS',
            message: `Unknown operation: ${JSON.stringify(op)}`,
          },
        };
    }
  }

  public validatePipeline(tracks: AudioTrack[], operations: AudioOperation[]): ValidationResult {
    if (!tracks || tracks.length === 0) {
      return {
        valid: false,
        error: { code: 'INVALID_PARAMS', message: 'No audio tracks provided' },
      };
    }

    if (!operations || operations.length === 0) {
      return {
        valid: false,
        error: { code: 'EMPTY_OPERATIONS', message: 'No operations requested to process' },
      };
    }

    for (const track of tracks) {
      const res = this.validateTrack(track);
      if (!res.valid) return res;
    }

    const tracksMap = new Map<string, AudioTrack>(tracks.map((t) => [t.id, t]));

    for (const op of operations) {
      const res = this.validateOperation(op, tracksMap);
      if (!res.valid) return res;
    }

    return { valid: true };
  }
}
