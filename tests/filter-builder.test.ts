import { describe, it, expect } from 'vitest';
import { FFmpegFilterBuilder } from '../lib/audio/filter-builder';
import { AudioTrack } from '../lib/types/audio';

describe('FFmpegFilterBuilder', () => {
  const builder = new FFmpegFilterBuilder();

  const track1: AudioTrack = {
    id: 'track_1',
    filename: 'track1.mp3',
    duration: 120,
    format: 'mp3',
    size: 2000000,
    metadata: { duration: 120, format: 'mp3', size: 2000000 },
  };

  const track2: AudioTrack = {
    id: 'track_2',
    filename: 'track2.mp3',
    duration: 90,
    format: 'mp3',
    size: 1500000,
    metadata: { duration: 90, format: 'mp3', size: 1500000 },
  };

  it('builds correct filter for trim operation', () => {
    const plan = builder.buildPlan(
      [track1],
      [{ type: 'trim', trackId: 'track_1', start: 30, end: 60 }],
      'mp3'
    );
    expect(plan.filterComplex).toBe('[0:a]atrim=start=30:end=60,asetpts=PTS-STARTPTS[aout]');
    expect(plan.outputArgs).toContain('-filter_complex');
    expect(plan.outputArgs).toContain('libmp3lame');
  });

  it('builds correct compound filter for trim and fade out', () => {
    const plan = builder.buildPlan(
      [track1],
      [
        { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
        { type: 'fade_out', trackId: 'track_1', duration: 5 },
      ],
      'mp3'
    );
    // 60 - 30 = 30s effective duration; fade out start time = 30 - 5 = 25s
    expect(plan.filterComplex).toContain('atrim=start=30:end=60,asetpts=PTS-STARTPTS');
    expect(plan.filterComplex).toContain('afade=t=out:st=25.000:d=5');
  });

  it('builds correct filter for multi-track merge', () => {
    const plan = builder.buildPlan(
      [track1, track2],
      [{ type: 'merge', tracks: ['track_1', 'track_2'] }],
      'mp3'
    );
    expect(plan.filterComplex).toContain('concat=n=2:v=0:a=1[aout]');
    expect(plan.inputs.length).toBe(2);
  });

  it('builds correct acrossfade filter for 2 tracks', () => {
    const plan = builder.buildPlan(
      [track1, track2],
      [{ type: 'merge', tracks: ['track_1', 'track_2'], crossfade: true, crossfadeDuration: 3 }],
      'mp3'
    );
    expect(plan.filterComplex).toContain('acrossfade=d=3:c1=tri:c2=tri[aout]');
    expect(plan.inputs.length).toBe(2);
  });

  it('builds correct chained acrossfade filter for 3 tracks', () => {
    const track3: AudioTrack = {
      id: 'track_3',
      filename: 'track3.mp3',
      duration: 80,
      format: 'mp3',
      size: 1200000,
      metadata: { duration: 80, format: 'mp3', size: 1200000 },
    };
    const plan = builder.buildPlan(
      [track1, track2, track3],
      [{ type: 'merge', tracks: ['track_1', 'track_2', 'track_3'], crossfade: true, crossfadeDuration: 4 }],
      'mp3'
    );
    expect(plan.filterComplex).toContain('[cf_1]');
    expect(plan.filterComplex).toContain('acrossfade=d=4:c1=tri:c2=tri[aout]');
    expect(plan.inputs.length).toBe(3);
  });

  it('builds correct filter for per-track trim combined with crossfade merge', () => {
    const plan = builder.buildPlan(
      [track1, track2],
      [
        { type: 'trim', trackId: 'track_1', start: 15, end: 45 },
        { type: 'trim', trackId: 'track_2', start: 10, end: 40 },
        { type: 'merge', tracks: ['track_1', 'track_2'], crossfade: true, crossfadeDuration: 3 },
      ],
      'mp3'
    );
    expect(plan.filterComplex).toContain('[0:a]atrim=start=15:end=45,asetpts=PTS-STARTPTS[trk_0]');
    expect(plan.filterComplex).toContain('[1:a]atrim=start=10:end=40,asetpts=PTS-STARTPTS[trk_1]');
    expect(plan.filterComplex).toContain('[trk_0][trk_1]acrossfade=d=3:c1=tri:c2=tri[aout]');
  });

  it('builds correct filter for crossfade merge with ending fade out and intro fade in', () => {
    const plan = builder.buildPlan(
      [track1, track2],
      [
        { type: 'trim', trackId: 'track_1', start: 10, end: 40 },
        { type: 'fade_in', trackId: 'track_1', duration: 2 },
        { type: 'trim', trackId: 'track_2', start: 10, end: 40 },
        { type: 'fade_out', trackId: 'track_2', duration: 3 },
        { type: 'merge', tracks: ['track_1', 'track_2'], crossfade: true, crossfadeDuration: 3 },
      ],
      'mp3'
    );
    // Track 1 should have fade_in (2s)
    expect(plan.filterComplex).toContain('afade=t=in:ss=0:d=2');
    // Track 2 has 30s effective duration, so fade out starts at 27s (3s duration)
    expect(plan.filterComplex).toContain('afade=t=out:st=27.000:d=3');
    // And acrossfade joins them
    expect(plan.filterComplex).toContain('acrossfade=d=3:c1=tri:c2=tri[aout]');
  });
});
