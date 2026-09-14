'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Scissors,
  Upload,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  Volume2,
  Clock,
  Layers,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AudioTrack, AudioOperation, ProcessingResult } from '@/lib/types/audio';
import { extractAudioMetadata } from '@/lib/audio/metadata';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { DirectDownloadCard } from '@/components/DirectDownloadCard';
import { VoiceAssistantBar } from '@/components/VoiceAssistantBar';
import { saveTrackToCache, getAllCachedTracks } from '@/lib/storage/audio-cache';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';

export default function CutAudioPage() {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 30 });
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [fadeOut, setFadeOut] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useBeforeUnload(isProcessing, 'Audio cutting is in progress. Are you sure you want to leave?');

  // Load most recent cached track on mount if available
  useEffect(() => {
    async function loadRecent() {
      try {
        const cached = await getAllCachedTracks();
        if (cached.length > 0 && !track) {
          const latest = cached[0];
          const blobUrl = URL.createObjectURL(latest.blob);
          const restored: AudioTrack = {
            id: latest.id,
            filename: latest.name,
            duration: latest.duration,
            format: latest.format as any,
            size: latest.size,
            blobUrl,
            file: latest.blob,
            metadata: {
              duration: latest.duration,
              format: latest.format as any,
              size: latest.size,
            },
          };
          setTrack(restored);
          setSelection({ start: 0, end: Math.min(30, latest.duration) });
        }
      } catch {
        // ignore
      }
    }
    loadRecent();
  }, []);

  const handleAudioUpload = async (file: File | Blob, filename: string) => {
    setErrorMsg(null);
    setResult(null);

    try {
      const metadata = await extractAudioMetadata(file, filename);
      const trackId = `track_${Date.now()}`;
      const blobUrl = URL.createObjectURL(file);

      const newTrack: AudioTrack = {
        id: trackId,
        filename,
        duration: metadata.duration || 60,
        format: metadata.format,
        size: file.size,
        metadata,
        blobUrl,
        file,
      };

      setTrack(newTrack);
      const initialEnd = Math.min(30, metadata.duration || 30);
      setSelection({ start: 0, end: initialEnd });

      // Save to IndexedDB
      await saveTrackToCache({
        id: trackId,
        name: filename,
        size: file.size,
        type: file.type || 'audio/mpeg',
        duration: metadata.duration || 60,
        format: metadata.format,
        blob: file,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to read audio file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAudioUpload(file, file.name);
    }
  };

  const handleLoadSample = async () => {
    try {
      const sampleDuration = 45;
      const sampleRate = 44100;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(2, sampleRate * sampleDuration, sampleRate);

      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const bass = Math.sin(2 * Math.PI * 110 * t) * 0.25;
          const melody = Math.sin(2 * Math.PI * 440 * t) * 0.15;
          data[i] = bass + melody;
        }
      }

      // Convert buffer to wav blob
      const offlineCtx = new OfflineAudioContext(2, sampleRate * sampleDuration, sampleRate);
      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(offlineCtx.destination);
      src.start();
      const rendered = await offlineCtx.startRendering();

      // Encode WAV
      const wavBytes = encodeWAV(rendered);
      const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      await handleAudioUpload(blob, 'Acoustic-Sample.wav');
    } catch (err: any) {
      setErrorMsg('Could not generate sample: ' + err.message);
    }
  };

  const handleExecuteCut = async () => {
    if (!track) return;

    setErrorMsg(null);
    setIsProcessing(true);
    setProgress(20);

    const operations: AudioOperation[] = [
      {
        type: 'trim',
        trackId: track.id,
        start: selection.start,
        end: selection.end,
      },
    ];

    if (fadeIn) {
      operations.push({
        type: 'fade_in',
        trackId: track.id,
        duration: Math.min(2, (selection.end - selection.start) / 2),
      });
    }

    if (fadeOut) {
      operations.push({
        type: 'fade_out',
        trackId: track.id,
        duration: Math.min(3, (selection.end - selection.start) / 2),
      });
    }

    try {
      const res = await defaultAudioEngine.processAudio(
        {
          tracks: [track],
          operations,
          outputFormat: 'mp3',
          outputFilename: `${track.filename.replace(/\.[^/.]+$/, '')}-cut.mp3`,
        },
        (p: number) => {
          setProgress(Math.min(95, Math.max(20, Math.round(p * 100))));
        },
        (_log: string) => {}
      );

      if (res.success && res.output) {
        setProgress(100);
        setResult(res);

        // Cache result
        await saveTrackToCache({
          id: `cut_${Date.now()}`,
          name: res.output.filename,
          size: res.output.size,
          type: 'audio/mpeg',
          duration: res.output.duration,
          format: 'mp3',
          blob: res.output.blob,
          updatedAt: Date.now(),
        });
      } else {
        setErrorMsg(res.error?.message || 'Failed to cut audio.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing audio cut.');
    } finally {
      setIsProcessing(false);
    }
  };

  const applyPreset = (preset: 'ringtone' | 'first60' | 'last30') => {
    if (!track) return;
    const dur = track.duration;

    if (preset === 'ringtone') {
      setSelection({ start: 0, end: Math.min(30, dur) });
      setFadeOut(true);
    } else if (preset === 'first60') {
      setSelection({ start: 0, end: Math.min(60, dur) });
    } else if (preset === 'last30') {
      const start = Math.max(0, dur - 30);
      setSelection({ start, end: dur });
      setFadeIn(true);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="app-container">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.opus,.ogg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="hub-hero" style={{ padding: '0.5rem 0 1rem' }}>
        <div className="hub-hero-badge">
          <Scissors size={15} />
          <span>Instant Audio Trimmer</span>
        </div>
        <h1 className="hub-hero-title" style={{ fontSize: '2rem' }}>
          Cut & Trim Song
        </h1>
        <p className="hub-hero-subtitle">
          Select any part of your song with the visual waveform. Cut ringtones, intros, or choruses in seconds.
        </p>
      </div>

      {/* Upload Box if no track */}
      {!track && (
        <div
          className="aesthetic-card"
          style={{
            border: '2px dashed var(--border-strong)',
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'var(--accent-coral-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <Upload size={32} color="var(--accent-coral)" />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            Choose an Audio File to Cut
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Supports MP3, WAV, M4A, AAC, WhatsApp voice notes
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-big"
              style={{ maxWidth: '240px' }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={20} />
              <span>Select Song</span>
            </button>

            <button
              className="btn-action-outline"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
            >
              <Sparkles size={16} />
              <span>Use Sample Song</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Trimming Workspace — Right at the Top! */}
      {track && (
        <div className="aesthetic-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {track.filename}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Total Length: {formatTime(track.duration)} • Selected Duration: {formatTime(selection.end - selection.start)}
              </span>
            </div>

            <button
              className="btn-action-ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '0.3rem 0.6rem' }}
            >
              Change Song
            </button>
          </div>

          {/* Interactive Waveform Visualizer */}
          {track && (
            <WaveformVisualizer
              audioFile={track.file || null}
              duration={track.duration}
              selection={selection}
              onSelectionChange={(sel) => setSelection(sel)}
            />
          )}

          {/* Quick Presets Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Quick Presets:
            </span>
            <button className="mini-lang-pill" onClick={() => applyPreset('ringtone')}>
              🔔 30s Ringtone
            </button>
            <button className="mini-lang-pill" onClick={() => applyPreset('first60')}>
              ✂️ First 60s
            </button>
            <button className="mini-lang-pill" onClick={() => applyPreset('last30')}>
              🎵 Last 30s
            </button>
          </div>

          {/* Start & End Times + Fades */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              background: 'var(--bg-card-subtle)',
              padding: '1rem',
              borderRadius: '16px',
            }}
          >
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Start Time:
              </label>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
                {formatTime(selection.start)}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                End Time:
              </label>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
                {formatTime(selection.end)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={fadeIn}
                  onChange={(e) => setFadeIn(e.target.checked)}
                />
                <span>Smooth Fade In (2s)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={fadeOut}
                  onChange={(e) => setFadeOut(e.target.checked)}
                />
                <span>Smooth Fade Out (3s)</span>
              </label>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            className="btn-big"
            onClick={handleExecuteCut}
            disabled={isProcessing}
            style={{ width: '100%', minHeight: '56px', fontSize: '1.15rem' }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Cutting Audio ({progress}%)...</span>
              </>
            ) : (
              <>
                <Scissors size={22} />
                <span>Cut & Download MP3 Now</span>
              </>
            )}
          </button>
        </div>
      )}

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
          title="Cut Complete!"
          subtitle={`Your trimmed clip is ready to download (${formatTime(selection.end - selection.start)}):`}
          sourceType="cut"
          onReset={() => setResult(null)}
        />
      )}

      {/* Repositioned Bottom Contextual AI Assistant */}
      {track && (
        <VoiceAssistantBar
          tracks={[track]}
          onOperationsSuggested={(ops, explanation) => {
            const trimOp = ops.find((o) => o.type === 'trim');
            if (trimOp && trimOp.type === 'trim') {
              setSelection({ start: trimOp.start, end: trimOp.end });
            }
            const fIn = ops.some((o) => o.type === 'fade_in');
            const fOut = ops.some((o) => o.type === 'fade_out');
            if (fIn) setFadeIn(true);
            if (fOut) setFadeOut(true);
          }}
          contextHint='Say e.g.: "Cut from 0:15 to 1:00 with fade out"'
        />
      )}
    </main>
  );
}

// Simple helper to encode WAV from AudioBuffer
function encodeWAV(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}
