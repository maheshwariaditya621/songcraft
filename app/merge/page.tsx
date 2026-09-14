'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Upload,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Music,
  Loader2,
  CheckCircle,
  Scissors,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { AudioTrack, AudioOperation, ProcessingResult } from '@/lib/types/audio';
import { extractAudioMetadata } from '@/lib/audio/metadata';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { DirectDownloadCard } from '@/components/DirectDownloadCard';
import { VoiceAssistantBar } from '@/components/VoiceAssistantBar';
import { saveTrackToCache, getAllCachedTracks, CachedTrackRecord } from '@/lib/storage/audio-cache';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { downloadAudioBlob } from '@/lib/audio/download-helper';
import { FolderArchive } from 'lucide-react';
import { SavedSongsModal } from '@/components/SavedSongsModal';

export interface MergeTrackItem extends AudioTrack {
  trimStart: number;
  trimEnd: number;
  isExpandedTrim?: boolean;
}

export default function MergeSongsPage() {
  const [tracks, setTracks] = useState<MergeTrackItem[]>([]);
  const [crossfade, setCrossfade] = useState<boolean>(true);
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(3);
  const [fadeInFirst, setFadeInFirst] = useState<boolean>(false);
  const [fadeOutLast, setFadeOutLast] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audition preview for individual track cuts
  const [auditionTrackId, setAuditionTrackId] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Saved Songs Integration & Custom Naming
  const [savedTracks, setSavedTracks] = useState<CachedTrackRecord[]>([]);
  const [showSavedPicker, setShowSavedPicker] = useState<boolean>(false);
  const [customOutputName, setCustomOutputName] = useState<string>('My_Merged_Medley.mp3');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useBeforeUnload(isProcessing, 'Merging audio tracks is in progress. Are you sure you want to leave?');

  // Stop auditioning when unmounting
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  // Check cached tracks on mount
  useEffect(() => {
    async function loadRecent() {
      try {
        const cached = await getAllCachedTracks();
        setSavedTracks(cached);
        if (cached.length >= 2 && tracks.length === 0) {
          const restored: MergeTrackItem[] = cached.slice(0, 3).map((c) => ({
            id: c.id,
            filename: c.name,
            duration: c.duration,
            format: c.format as any,
            size: c.size,
            blobUrl: URL.createObjectURL(c.blob),
            file: c.blob,
            metadata: { duration: c.duration, format: c.format as any, size: c.size },
            trimStart: 0,
            trimEnd: c.duration || 60,
            isExpandedTrim: false,
          }));
          setTracks(restored);
        }
      } catch {
        // ignore
      }
    }
    loadRecent();
  }, []);

  const handleAddSavedTrack = (st: CachedTrackRecord) => {
    const blobUrl = URL.createObjectURL(st.blob);
    const newTrack: MergeTrackItem = {
      id: `saved_${st.id}_${Date.now()}`,
      filename: st.name,
      duration: st.duration || 60,
      format: st.format as any,
      size: st.size,
      metadata: { duration: st.duration, format: st.format as any, size: st.size },
      blobUrl,
      file: st.blob,
      trimStart: 0,
      trimEnd: st.duration || 60,
      isExpandedTrim: false,
    };
    setTracks((prev) => [...prev, newTrack]);
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    setErrorMsg(null);
    setResult(null);

    const newTracks: MergeTrackItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const metadata = await extractAudioMetadata(file, file.name);
        const trackId = `track_${Date.now()}_${i}`;
        const blobUrl = URL.createObjectURL(file);

        newTracks.push({
          id: trackId,
          filename: file.name,
          duration: metadata.duration || 60,
          format: metadata.format,
          size: file.size,
          metadata,
          blobUrl,
          file,
          trimStart: 0,
          trimEnd: metadata.duration || 60,
          isExpandedTrim: false,
        });

        // Cache in background
        saveTrackToCache({
          id: trackId,
          name: file.name,
          size: file.size,
          type: file.type || 'audio/mpeg',
          duration: metadata.duration || 60,
          format: metadata.format,
          blob: file,
          updatedAt: Date.now(),
        });
      } catch (err: any) {
        console.warn('Failed to parse file:', file.name, err);
      }
    }

    setTracks((prev) => [...prev, ...newTracks]);
  };

  const moveTrack = (from: number, to: number) => {
    if (to < 0 || to >= tracks.length) return;
    setTracks((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
  };

  const updateTrackTrim = (idx: number, start: number, end: number) => {
    setTracks((prev) => {
      const updated = [...prev];
      const t = updated[idx];
      const safeStart = Math.max(0, Math.min(start, t.duration - 0.5));
      const safeEnd = Math.max(safeStart + 0.5, Math.min(end, t.duration));
      updated[idx] = {
        ...t,
        trimStart: Math.round(safeStart * 10) / 10,
        trimEnd: Math.round(safeEnd * 10) / 10,
      };
      return updated;
    });
  };

  const toggleExpandTrim = (idx: number) => {
    setTracks((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        isExpandedTrim: !updated[idx].isExpandedTrim,
      };
      return updated;
    });
  };

  const applyTrackPreset = (idx: number, preset: 'full' | 'first30' | 'first60' | 'last30') => {
    setTracks((prev) => {
      const updated = [...prev];
      const t = updated[idx];
      let start = 0;
      let end = t.duration;
      if (preset === 'first30') {
        end = Math.min(30, t.duration);
      } else if (preset === 'first60') {
        end = Math.min(60, t.duration);
      } else if (preset === 'last30') {
        start = Math.max(0, t.duration - 30);
      }
      updated[idx] = {
        ...t,
        trimStart: Math.round(start),
        trimEnd: Math.round(end),
      };
      return updated;
    });
  };

  const toggleAudition = (trk: MergeTrackItem) => {
    if (auditionTrackId === trk.id) {
      if (auditionAudioRef.current) auditionAudioRef.current.pause();
      setAuditionTrackId(null);
      return;
    }

    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current = null;
    }

    if (!trk.blobUrl) return;
    const audio = new Audio(trk.blobUrl);
    auditionAudioRef.current = audio;
    audio.currentTime = trk.trimStart;

    audio.ontimeupdate = () => {
      if (audio.currentTime >= trk.trimEnd) {
        audio.pause();
        setAuditionTrackId(null);
      }
    };

    audio.onended = () => {
      setAuditionTrackId(null);
    };

    audio.play().then(() => {
      setAuditionTrackId(trk.id);
    }).catch(() => setAuditionTrackId(null));
  };

  const removeTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteMerge = async () => {
    if (tracks.length < 2) {
      setErrorMsg('Please add at least 2 songs to merge.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setProgress(15);

    const operations: AudioOperation[] = [];

    // 1. Add per-track trim operations for any tracks where the user selected a custom portion
    tracks.forEach((t) => {
      if (t.trimStart > 0 || t.trimEnd < t.duration) {
        operations.push({
          type: 'trim',
          trackId: t.id,
          start: Math.max(0, t.trimStart),
          end: Math.min(t.duration, Math.max(t.trimStart + 0.5, t.trimEnd)),
        });
      }
    });

    // 2. Add the merge operation
    operations.push({
      type: 'merge',
      tracks: tracks.map((t) => t.id),
      crossfade,
      crossfadeDuration,
    });

    if (fadeInFirst && tracks.length > 0) {
      operations.push({
        type: 'fade_in',
        trackId: tracks[0].id,
        duration: 2,
      });
    }

    if (fadeOutLast && tracks.length > 0) {
      const lastTrack = tracks[tracks.length - 1];
      operations.push({
        type: 'fade_out',
        trackId: lastTrack.id,
        duration: 3,
      });
    }

    try {
      const finalOutName = customOutputName.trim() || `merged_medley_${Date.now()}.mp3`;
      const res = await defaultAudioEngine.processAudio(
        {
          tracks,
          operations,
          outputFormat: 'mp3',
          outputFilename: finalOutName.endsWith('.mp3') ? finalOutName : `${finalOutName}.mp3`,
        },
        (p: number) => {
          setProgress(Math.min(95, Math.max(15, Math.round(p * 100))));
        },
        (_log: string) => {}
      );

      if (res.success && res.output) {
        setProgress(100);
        setResult(res);

        // Directly trigger browser download immediately
        downloadAudioBlob(res.output.blob, res.output.filename);

        // Cache result (safe background cache)
        saveTrackToCache({
          id: `merged_${Date.now()}`,
          name: res.output.filename,
          size: res.output.size,
          type: 'audio/mpeg',
          duration: res.output.duration,
          format: 'mp3',
          blob: res.output.blob,
          updatedAt: Date.now(),
        }).catch(() => {});
      } else {
        setErrorMsg(res.error?.message || 'Failed to merge audio files.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing merge.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalLength = tracks.reduce((acc, t) => acc + Math.max(0, t.trimEnd - t.trimStart), 0);
  const effectiveLength = crossfade && tracks.length > 1
    ? Math.max(1, totalLength - (tracks.length - 1) * crossfadeDuration)
    : totalLength;

  return (
    <main className="app-container">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.aac,.opus,.ogg"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleFilesUpload(e.target.files);
        }}
      />

      {/* Header */}
      <div className="hub-hero" style={{ padding: '0.5rem 0 1rem' }}>
        <div className="hub-hero-badge">
          <Layers size={15} />
          <span>Multi-Track Merger</span>
        </div>
        <h1 className="hub-hero-title" style={{ fontSize: '2rem' }}>
          Merge & Join Songs
        </h1>
        <p className="hub-hero-subtitle">
          Combine 2 or more songs or voice recordings into one smooth continuous track or medley.
        </p>
      </div>

      {/* Track List Workspace */}
      <div className="aesthetic-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Tracks to Join ({tracks.length})
            </h2>
            {tracks.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Combined Duration: ~{formatDuration(effectiveLength)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn-action-outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={16} />
              <span>Add Songs</span>
            </button>

            {savedTracks.length > 0 && (
              <button
                type="button"
                className="btn-action-outline"
                onClick={() => setShowSavedPicker(true)}
                style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}
              >
                <FolderArchive size={16} />
                <span>⚡ Pick from Saved ({savedTracks.length})</span>
              </button>
            )}
          </div>
        </div>

        {tracks.length === 0 ? (
          <div
            style={{
              border: '2px dashed var(--border-strong)',
              borderRadius: '16px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} color="var(--accent-coral)" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontWeight: 800, marginBottom: '0.25rem' }}>Select 2 or more songs to join</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Supports MP3, WAV, AAC, M4A, OGG • <strong>Up to 10 songs & 250MB</strong>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-big"
                style={{ maxWidth: '220px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Plus size={18} />
                <span>Browse Songs</span>
              </button>

              {savedTracks.length > 0 && (
                <button
                  type="button"
                  className="btn-action-outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSavedPicker(true);
                  }}
                  style={{ borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}
                >
                  <FolderArchive size={16} />
                  <span>⚡ Pick from Saved Songs ({savedTracks.length})</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tracks.map((track, idx) => {
              const isTrimmed = track.trimStart > 0 || track.trimEnd < track.duration;
              const isAuditioning = auditionTrackId === track.id;
              const keptSeconds = Math.max(0, track.trimEnd - track.trimStart);

              return (
                <div
                  key={track.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-card-subtle)',
                    border: isTrimmed ? '1.5px solid #f97316' : '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    padding: '0.85rem 1rem',
                    gap: '0.75rem',
                    boxShadow: isTrimmed ? '0 4px 12px rgba(249, 115, 22, 0.08)' : 'none',
                    transition: 'border 0.2s',
                  }}
                >
                  {/* Track Summary Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isTrimmed ? '#ea580c' : 'var(--text-main)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {track.filename}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>{formatDuration(track.duration)} total</span>
                          <span>•</span>
                          <span
                            style={{
                              color: isTrimmed ? '#c2410c' : '#059669',
                              fontWeight: 700,
                              background: isTrimmed ? '#ffedd5' : '#ecfdf5',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            {isTrimmed
                              ? `✂️ Kept: ${formatDuration(track.trimStart)} - ${formatDuration(track.trimEnd)} (${formatDuration(keptSeconds)})`
                              : `Full Song (${formatDuration(track.duration)})`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {/* Trim Section Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpandTrim(idx)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: track.isExpandedTrim ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                          background: track.isExpandedTrim ? '#fff7ed' : '#ffffff',
                          color: track.isExpandedTrim ? '#ea580c' : '#334155',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Scissors size={13} />
                        <span>{track.isExpandedTrim ? 'Done' : 'Select Part'}</span>
                        {track.isExpandedTrim ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {/* Move Up */}
                      <button
                        className="btn-action-ghost"
                        disabled={idx === 0}
                        onClick={() => moveTrack(idx, idx - 1)}
                        title="Move earlier in mix"
                        style={{ opacity: idx === 0 ? 0.3 : 1, padding: '0.3rem' }}
                      >
                        <ArrowUp size={16} />
                      </button>

                      {/* Move Down */}
                      <button
                        className="btn-action-ghost"
                        disabled={idx === tracks.length - 1}
                        onClick={() => moveTrack(idx, idx + 1)}
                        title="Move later in mix"
                        style={{ opacity: idx === tracks.length - 1 ? 0.3 : 1, padding: '0.3rem' }}
                      >
                        <ArrowDown size={16} />
                      </button>

                      {/* Remove */}
                      <button
                        className="btn-action-ghost"
                        onClick={() => removeTrack(idx)}
                        title="Remove from merge"
                        style={{ color: 'var(--accent-red)', padding: '0.3rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Per-Track Trim Section */}
                  {track.isExpandedTrim && (
                    <div
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.9rem',
                        background: '#ffffff',
                        border: '1.5px dashed #fed7aa',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#9a3412' }}>
                          ✂️ Select Part to Join ({formatDuration(track.trimStart)} to {formatDuration(track.trimEnd)})
                        </div>

                        {/* Audition Trimmed Segment Button */}
                        <button
                          type="button"
                          onClick={() => toggleAudition(track)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '8px',
                            background: isAuditioning ? '#ea580c' : '#fff7ed',
                            border: '1.5px solid #ea580c',
                            color: isAuditioning ? '#ffffff' : '#c2410c',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {isAuditioning ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                          <span>{isAuditioning ? 'Pause Preview' : 'Audition Cut'}</span>
                        </button>
                      </div>

                      {/* Range Sliders */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                        {/* Start Controller */}
                        <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#059669' }}>🚩 Start Time</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'monospace' }}>{formatDuration(track.trimStart)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, track.trimEnd - 1)}
                            value={track.trimStart}
                            onChange={(e) => updateTrackTrim(idx, Number(e.target.value), track.trimEnd)}
                            style={{ width: '100%', accentColor: '#10b981' }}
                          />
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => updateTrackTrim(idx, track.trimStart - 1, track.trimEnd)}
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.74rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                            >
                              -1s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTrackTrim(idx, track.trimStart + 1, track.trimEnd)}
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.74rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                            >
                              +1s
                            </button>
                          </div>
                        </div>

                        {/* End Controller */}
                        <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#dc2626' }}>🏁 End Time</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'monospace' }}>{formatDuration(track.trimEnd)}</span>
                          </div>
                          <input
                            type="range"
                            min={track.trimStart + 1}
                            max={track.duration}
                            value={track.trimEnd}
                            onChange={(e) => updateTrackTrim(idx, track.trimStart, Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#ef4444' }}
                          />
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => updateTrackTrim(idx, track.trimStart, track.trimEnd - 1)}
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.74rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                            >
                              -1s
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTrackTrim(idx, track.trimStart, track.trimEnd + 1)}
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.74rem', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                            >
                              +1s
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick presets */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Quick:</span>
                        <button
                          type="button"
                          onClick={() => applyTrackPreset(idx, 'full')}
                          style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                        >
                          Full Song
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTrackPreset(idx, 'first30')}
                          style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                        >
                          First 30s
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTrackPreset(idx, 'first60')}
                          style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                        >
                          First 60s
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTrackPreset(idx, 'last30')}
                          style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                        >
                          Last 30s
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Transition Options */}
        {tracks.length >= 2 && (
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Transition & Fade Settings</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={crossfade}
                onChange={(e) => setCrossfade(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Smooth Musical Crossfade between songs</span>
            </label>

            {crossfade && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration:</span>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={crossfadeDuration}
                  onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                  style={{ flex: 1, maxWidth: '180px' }}
                />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  {crossfadeDuration}s
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={fadeInFirst}
                  onChange={(e) => setFadeInFirst(e.target.checked)}
                />
                <span>Fade In First Song</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={fadeOutLast}
                  onChange={(e) => setFadeOutLast(e.target.checked)}
                />
                <span>Fade Out Final Song</span>
              </label>
            </div>
          </div>
        )}

        {/* Custom Output Name Input */}
        {tracks.length >= 2 && (
          <div style={{ background: 'var(--bg-card-subtle)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Save Merged Medley As:
            </label>
            <input
              type="text"
              value={customOutputName}
              onChange={(e) => setCustomOutputName(e.target.value)}
              placeholder="My_Merged_Medley.mp3"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-strong)',
                fontSize: '0.9rem',
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Action Button */}
        <button
          className="btn-big"
          disabled={tracks.length < 2 || isProcessing}
          onClick={handleExecuteMerge}
          style={{ width: '100%', minHeight: '56px', fontSize: '1.15rem' }}
        >
          {isProcessing ? (
            <>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Joining Tracks ({progress}%)...</span>
            </>
          ) : (
            <>
              <Layers size={22} />
              <span>Merge {tracks.length} Songs & Download</span>
            </>
          )}
        </button>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '16px',
            padding: '0.85rem 1.25rem',
            fontSize: '0.92rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Result: Direct Download */}
      {result && (
        <DirectDownloadCard
          result={result}
          title="Songs Merged Successfully!"
          subtitle={`Your ${tracks.length}-song medley is ready for direct download:`}
          sourceType="merge"
          onReset={() => setResult(null)}
        />
      )}

      {/* Saved Songs Selection Modal with Audio Preview */}
      <SavedSongsModal
        isOpen={showSavedPicker}
        onClose={() => setShowSavedPicker(false)}
        onSelectTrack={(st) => handleAddSavedTrack(st)}
        actionLabel="+ Add to Merge"
        title="Choose from Saved Songs"
      />

      {/* Repositioned Bottom Contextual AI Assistant */}
      {tracks.length > 0 && (
        <VoiceAssistantBar
          tracks={tracks}
          onOperationsSuggested={(_ops, explanation) => {
            alert(`Voice command understood: ${explanation}`);
          }}
          contextHint='Say e.g.: "Donon gaane jod do aur 3 second crossfade lagao"'
        />
      )}
    </main>
  );
}
