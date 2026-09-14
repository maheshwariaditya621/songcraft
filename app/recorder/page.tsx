'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mic,
  Sparkles,
  Scissors,
  Layers,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import { extractAudioMetadata } from '@/lib/audio/metadata';
import { LiveVoiceRecorder } from '@/components/LiveVoiceRecorder';
import { DirectDownloadCard } from '@/components/DirectDownloadCard';
import { ProcessingResult } from '@/lib/types/audio';
import { saveTrackToCache } from '@/lib/storage/audio-cache';
import { downloadAudioBlob } from '@/lib/audio/download-helper';

export default function VoiceRecorderPage() {
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isRecordingDone, setIsRecordingDone] = useState<boolean>(false);

  const handleVoiceRecordingSaved = async (file: File) => {
    const filename = file.name;
    const blobUrl = URL.createObjectURL(file);
    let duration = 10;
    try {
      const meta = await extractAudioMetadata(file, file.name);
      duration = meta.duration || 10;
    } catch {
      // fallback
    }

    const procResult: ProcessingResult = {
      success: true,
      output: {
        filename,
        format: 'mp3',
        duration,
        size: file.size,
        blob: file,
        blobUrl,
      },
    };

    setResult(procResult);
    setIsRecordingDone(true);

    // Directly trigger browser download immediately
    downloadAudioBlob(file, filename);

    // Save to IndexedDB
    await saveTrackToCache({
      id: `record_${Date.now()}`,
      name: filename,
      size: file.size,
      type: file.type || 'audio/webm',
      duration,
      format: 'mp3',
      isRecordedVoice: true,
      blob: file,
      updatedAt: Date.now(),
    });
  };

  const handleReset = () => {
    setResult(null);
    setIsRecordingDone(false);
  };

  return (
    <main className="app-container">
      {/* Header */}
      <div className="hub-hero" style={{ padding: '0.5rem 0 1rem' }}>
        <div
          className="hub-hero-badge"
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c' }}
        >
          <Mic size={15} />
          <span>Live Studio Voice Recorder</span>
        </div>
        <h1 className="hub-hero-title" style={{ fontSize: '2rem' }}>
          Record Your Voice Live
        </h1>
        <p className="hub-hero-subtitle">
          Record singing, voice notes, or podcasts directly with real-time waveform visualization.
        </p>
      </div>

      {!isRecordingDone && (
        <div className="aesthetic-card" style={{ padding: '2rem 1.5rem' }}>
          <LiveVoiceRecorder
            onSave={handleVoiceRecordingSaved}
            onCancel={() => {}}
          />
        </div>
      )}

      {/* Direct Download */}
      {result && (
        <DirectDownloadCard
          result={result}
          title="Recording Saved Successfully!"
          subtitle="Your voice recording is ready. Download or edit below:"
          sourceType="recording"
          onReset={handleReset}
        />
      )}
    </main>
  );
}
