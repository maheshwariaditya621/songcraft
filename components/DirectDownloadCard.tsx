'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  CheckCircle,
  Play,
  Pause,
  Scissors,
  Layers,
  Sparkles,
  Share2,
  FileAudio,
} from 'lucide-react';
import { ProcessingResult, OutputAudioFormat } from '@/lib/types/audio';

interface DirectDownloadCardProps {
  result: ProcessingResult;
  title?: string;
  subtitle?: string;
  sourceType?: 'video' | 'whatsapp' | 'recording' | 'cut' | 'merge';
  onReset?: () => void;
  onEditFurther?: () => void;
}

export function DirectDownloadCard({
  result,
  title = 'Your Audio is Ready!',
  subtitle = 'Zero loss processing complete. Download directly below:',
  sourceType,
  onReset,
  onEditFurther,
}: DirectDownloadCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const output = result.output;
  if (!output) {
    return (
      <div className="direct-download-card">
        <p style={{ color: 'var(--accent-red)' }}>
          {result.error?.message || 'Processing failed. Please try again.'}
        </p>
        {onReset && (
          <button className="btn-action-ghost" onClick={onReset}>
            Try Again
          </button>
        )}
      </div>
    );
  }

  const togglePlay = () => {
    if (!output.blobUrl) return;

    if (!audioEl) {
      const audio = new Audio(output.blobUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioEl(audio);
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioEl.pause();
        setIsPlaying(false);
      } else {
        audioEl.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = output.blobUrl;
    a.download = output.filename || `songcraft-audio.${output.format || 'mp3'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="direct-download-card">
      <div className="download-card-header">
        <div className="download-success-icon">
          <CheckCircle size={32} color="#10b981" />
        </div>
        <div>
          <h3 className="download-title">{title}</h3>
          <p className="download-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="download-file-info">
        <div className="download-file-left">
          <FileAudio size={28} color="var(--accent-coral)" />
          <div>
            <div className="download-file-name">{output.filename}</div>
            <div className="download-file-meta">
              <span>{output.format.toUpperCase()} Audio</span>
              {output.size > 0 && <span>• {formatSize(output.size)}</span>}
              {output.duration > 0 && (
                <span>
                  • {Math.floor(output.duration / 60)}:
                  {Math.floor(output.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          className="preview-play-btn"
          onClick={togglePlay}
          title={isPlaying ? 'Pause preview' : 'Play audio preview'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span>{isPlaying ? 'Pause' : 'Play Preview'}</span>
        </button>
      </div>

      {/* Main Direct Download CTA */}
      <div className="download-cta-section">
        <button className="btn-direct-download" onClick={handleDownload}>
          <Download size={24} />
          <span>Download {output.format.toUpperCase()} Now</span>
        </button>
      </div>

      {/* Secondary Actions / Next Steps */}
      <div className="download-secondary-actions">
        {onEditFurther ? (
          <button className="btn-action-outline" onClick={onEditFurther}>
            <Scissors size={16} />
            <span>Trim / Cut This Audio</span>
          </button>
        ) : (
          <Link href="/cut" className="btn-action-outline">
            <Scissors size={16} />
            <span>Cut / Trim in Trimmer</span>
          </Link>
        )}

        <Link href="/merge" className="btn-action-outline">
          <Layers size={16} />
          <span>Merge with Another Song</span>
        </Link>

        {onReset && (
          <button className="btn-action-ghost" onClick={onReset}>
            Convert Another File
          </button>
        )}
      </div>
    </div>
  );
}
