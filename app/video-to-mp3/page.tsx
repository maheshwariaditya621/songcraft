'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Video,
  Upload,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Scissors,
  Loader2,
} from 'lucide-react';
import { AudioTrack, ProcessingResult } from '@/lib/types/audio';
import { extractAudioMetadata, isVideoFile } from '@/lib/audio/metadata';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { DirectDownloadCard } from '@/components/DirectDownloadCard';
import { VoiceAssistantBar } from '@/components/VoiceAssistantBar';
import { saveTrackToCache } from '@/lib/storage/audio-cache';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { downloadAudioBlob } from '@/lib/audio/download-helper';

export default function VideoToMp3Page() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extractedTrack, setExtractedTrack] = useState<AudioTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent leaving while converting
  useBeforeUnload(isProcessing, 'Video audio extraction is in progress. Are you sure you want to leave?');

  const processVideoFile = async (file: File) => {
    setErrorMsg(null);
    setResult(null);
    setExtractedTrack(null);
    setVideoFile(file);

    try {
      setIsProcessing(true);
      setProgress(15);
      setProgressStatus('Reading video and analyzing audio stream...');

      const metadata = await extractAudioMetadata(file, file.name);
      const isVideo = isVideoFile(file.name, file.type);
      const trackId = `track_video_${Date.now()}`;
      const blobUrl = URL.createObjectURL(file);

      const track: AudioTrack = {
        id: trackId,
        filename: file.name,
        duration: metadata.duration || 60,
        format: metadata.format,
        size: file.size,
        metadata,
        blobUrl,
        file,
        isVideo: true,
      };

      setExtractedTrack(track);
      setProgress(35);
      setProgressStatus('Extracting audio with FFmpeg (in-browser, zero upload)...');

      // Execute audio extraction to MP3 (pass-through volume 1.0)
      const res = await defaultAudioEngine.processAudio(
        {
          tracks: [track],
          operations: [{ type: 'volume', trackId: track.id, value: 1.0 }],
          outputFormat: 'mp3',
          outputFilename: `${file.name.replace(/\.[^/.]+$/, '')}-audio.mp3`,
        },
        (p: number) => {
          setProgress(Math.min(95, Math.max(35, Math.round(p * 100))));
        },
        (_log: string) => {}
      );

      if (res.success && res.output) {
        setProgress(100);
        setResult(res);

        // Directly trigger browser download immediately
        downloadAudioBlob(res.output.blob, res.output.filename);

        // Cache in IndexedDB for session persistence (safe background cache)
        saveTrackToCache({
          id: trackId,
          name: res.output.filename,
          size: res.output.size,
          type: 'audio/mpeg',
          duration: res.output.duration,
          format: 'mp3',
          isFromVideo: true,
          blob: res.output.blob,
          updatedAt: Date.now(),
        }).catch(() => {});
      } else {
        setErrorMsg(res.error?.message || 'Could not extract audio from this video.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing video file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setExtractedTrack(null);
    setResult(null);
    setProgress(0);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="app-container">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header Banner */}
      <div className="hub-hero" style={{ padding: '0.5rem 0 1.25rem' }}>
        <div className="hub-hero-badge">
          <Video size={15} />
          <span>Instant Video to MP3</span>
        </div>
        <h1 className="hub-hero-title" style={{ fontSize: '2rem' }}>
          Extract Audio from Video
        </h1>
        <p className="hub-hero-subtitle">
          Upload any MP4, MOV, MKV, or WebM video. Get a clean, crisp MP3 with direct 1-click download.
        </p>
      </div>

      {/* Main Upload / Conversion Area */}
      {!result && !isProcessing && (
        <div
          className="aesthetic-card"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: '2px dashed var(--border-strong)',
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            cursor: 'pointer',
            background: 'var(--bg-card)',
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
            Choose or Drop Video File Here
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Supports MP4, MKV, MOV, WebM, AVI • <strong>Up to 500MB</strong>
          </p>

          <button
            className="btn-big"
            style={{ maxWidth: '300px', margin: '0 auto' }}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Video size={20} />
            <span>Select Video</span>
          </button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="aesthetic-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Loader2
            size={42}
            color="var(--accent-coral)"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1.25rem' }}
          />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Extracting Audio from &ldquo;{videoFile?.name}&rdquo;...
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {progressStatus || 'Running in-browser...'}
          </p>

          {/* Progress bar */}
          <div
            style={{
              height: '10px',
              background: '#e2e8f0',
              borderRadius: '9999px',
              overflow: 'hidden',
              maxWidth: '400px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #f97316, #ea580c)',
                width: `${progress}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.5rem', display: 'inline-block' }}>
            {progress}%
          </span>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
          }}
        >
          {errorMsg}
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn-action-ghost" onClick={handleReset}>
              Try another file
            </button>
          </div>
        </div>
      )}

      {/* Result: Direct Download Card */}
      {result && (
        <DirectDownloadCard
          result={result}
          title="Audio Extracted Successfully!"
          subtitle={`Extracted from "${videoFile?.name}". Click below for instant download:`}
          sourceType="video"
          onReset={handleReset}
        />
      )}

      {/* Contextual AI Assistant Bar */}
      {extractedTrack && (
        <VoiceAssistantBar
          tracks={[extractedTrack]}
          onOperationsSuggested={(_ops, explanation) => {
            alert(`Voice suggestion: ${explanation}`);
          }}
          contextHint='Say e.g. "Pehle 30s cut kar do" or "Fade out add kar do"'
        />
      )}

      {/* 3 Steps Guide */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '2rem',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1.5rem',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
            1. Select Video
          </strong>
          Choose any MP4, MKV or MOV recording from your phone or PC.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
            2. Instant In-Browser Conversion
          </strong>
          Extracted locally inside your browser at high 192kbps audio quality.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
            3. Direct Download
          </strong>
          Hit Download MP3. No extra steps or sign-ups required.
        </div>
      </div>
    </main>
  );
}
