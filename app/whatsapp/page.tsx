'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Upload,
  Sparkles,
  Download,
  Scissors,
  Layers,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { AudioTrack, ProcessingResult } from '@/lib/types/audio';
import { extractAudioMetadata, isWhatsAppAudioFile } from '@/lib/audio/metadata';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { DirectDownloadCard } from '@/components/DirectDownloadCard';
import { VoiceAssistantBar } from '@/components/VoiceAssistantBar';
import { saveTrackToCache } from '@/lib/storage/audio-cache';
import { useBeforeUnload } from '@/lib/hooks/useBeforeUnload';
import { downloadAudioBlob } from '@/lib/audio/download-helper';

export default function WhatsAppAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useBeforeUnload(isProcessing, 'Audio conversion is in progress. Are you sure you want to leave?');

  const processWhatsAppFile = async (uploadedFile: File) => {
    setErrorMsg(null);
    setResult(null);
    setTrack(null);
    setFile(uploadedFile);

    try {
      setIsProcessing(true);
      setProgress(25);

      const metadata = await extractAudioMetadata(uploadedFile, uploadedFile.name);
      const trackId = `track_wa_${Date.now()}`;
      const blobUrl = URL.createObjectURL(uploadedFile);

      const audioTrack: AudioTrack = {
        id: trackId,
        filename: uploadedFile.name,
        duration: metadata.duration || 30,
        format: metadata.format,
        size: uploadedFile.size,
        metadata,
        blobUrl,
        file: uploadedFile,
        isWhatsAppAudio: true,
      };

      setTrack(audioTrack);
      setProgress(50);

      // Convert to MP3
      const res = await defaultAudioEngine.processAudio(
        {
          tracks: [audioTrack],
          operations: [{ type: 'volume', trackId: audioTrack.id, value: 1.0 }],
          outputFormat: 'mp3',
          outputFilename: `${uploadedFile.name.replace(/\.[^/.]+$/, '')}-converted.mp3`,
        },
        (p: number) => {
          setProgress(Math.min(95, Math.max(50, Math.round(p * 100))));
        },
        (_log: string) => {}
      );

      if (res.success && res.output) {
        setProgress(100);
        setResult(res);

        // Directly trigger browser download immediately
        downloadAudioBlob(res.output.blob, res.output.filename);

        // Save to IndexedDB
        await saveTrackToCache({
          id: trackId,
          name: res.output.filename,
          size: res.output.size,
          type: 'audio/mpeg',
          duration: res.output.duration,
          format: 'mp3',
          isWhatsAppAudio: true,
          blob: res.output.blob,
          updatedAt: Date.now(),
        });
      } else {
        setErrorMsg(res.error?.message || 'Could not convert WhatsApp audio file.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing WhatsApp voice note.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTrack(null);
    setResult(null);
    setProgress(0);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="app-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".opus,.ogg,audio/ogg,audio/opus,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) processWhatsAppFile(f);
        }}
      />

      {/* Header */}
      <div className="hub-hero" style={{ padding: '0.5rem 0 1rem' }}>
        <div
          className="hub-hero-badge"
          style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#065f46' }}
        >
          <MessageCircle size={15} />
          <span>WhatsApp Audio Converter</span>
        </div>
        <h1 className="hub-hero-title" style={{ fontSize: '2rem' }}>
          Convert WhatsApp Voice Note
        </h1>
        <p className="hub-hero-subtitle">
          Turn unplayable WhatsApp voice messages (.opus / .ogg) into universally playable MP3 files instantly.
        </p>
      </div>

      {/* Upload Zone */}
      {!result && !isProcessing && (
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
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <MessageCircle size={32} color="#10b981" />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            Select WhatsApp Voice Note (.opus / .ogg)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Export voice note from WhatsApp and tap here to convert
          </p>

          <button
            className="btn-big"
            style={{
              maxWidth: '280px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Upload size={20} />
            <span>Select Voice Note</span>
          </button>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="aesthetic-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Loader2
            size={42}
            color="#10b981"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1.25rem' }}
          />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Converting Voice Note to Standard MP3...
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Processing locally with FFmpeg inside your browser...
          </p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '16px',
            padding: '1rem',
            fontSize: '0.92rem',
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

      {/* Result: Direct Download */}
      {result && (
        <DirectDownloadCard
          result={result}
          title="WhatsApp Voice Note Converted!"
          subtitle={`Converted to high quality MP3. Download directly below:`}
          sourceType="whatsapp"
          onReset={handleReset}
        />
      )}

      {/* Contextual Assistant */}
      {track && (
        <VoiceAssistantBar
          tracks={[track]}
          onOperationsSuggested={(_ops, explanation) => {
            alert(`Voice command: ${explanation}`);
          }}
          contextHint='Say e.g.: "Shuru ki aawaz hata do aur end mein fade out karo"'
        />
      )}
    </main>
  );
}
