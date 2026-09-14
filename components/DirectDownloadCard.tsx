'use client';

import React, { useState, useEffect } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { ProcessingResult } from '@/lib/types/audio';
import { downloadAudioBlob } from '@/lib/audio/download-helper';

interface DirectDownloadCardProps {
  result: ProcessingResult;
  title?: string;
  subtitle?: string;
  sourceType?: 'video' | 'whatsapp' | 'recording' | 'cut' | 'merge';
  autoDownload?: boolean;
  onReset?: () => void;
  onEditFurther?: () => void;
}

export function DirectDownloadCard({
  result,
  title = 'Your Audio is Ready!',
  subtitle = 'Zero loss processing complete. Download directly below:',
  sourceType,
  autoDownload = true,
  onReset,
  onEditFurther,
}: DirectDownloadCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [canShare, setCanShare] = useState<boolean>(false);

  const output = result.output;

  // Create and manage object URL
  useEffect(() => {
    if (!output) return;

    let url = output.blobUrl;
    if (output.blob) {
      url = URL.createObjectURL(output.blob);
      setBlobUrl(url);
    } else if (output.blobUrl) {
      setBlobUrl(output.blobUrl);
    }

    // Check if Web Share API is available (especially on mobile iOS/Android)
    if (typeof navigator !== 'undefined' && 'share' in navigator && output.blob) {
      setCanShare(true);
    }

    // Automatically initiate download when ready if requested
    if (autoDownload && output.blob) {
      const filename = output.filename || `songcraft-audio.${output.format || 'mp3'}`;
      downloadAudioBlob(output.blob, filename);
    }

    return () => {
      if (url && url.startsWith('blob:')) {
        // Keep active for user download
      }
    };
  }, [output, autoDownload]);

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

  const [isEditingName, setIsEditingName] = useState(false);
  const [customFilename, setCustomFilename] = useState(output.filename || `songcraft-audio.${output.format || 'mp3'}`);

  useEffect(() => {
    if (output.filename) {
      setCustomFilename(output.filename);
    }
  }, [output.filename]);

  const filename = customFilename.trim() || `songcraft-audio.${output.format || 'mp3'}`;
  const effectiveUrl = blobUrl || output.blobUrl;

  const togglePlay = () => {
    if (!effectiveUrl) return;

    if (!audioEl) {
      const audio = new Audio(effectiveUrl);
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

  const handleManualDownload = (e: React.MouseEvent) => {
    if (output.blob) {
      downloadAudioBlob(output.blob, filename);
    }
  };

  const handleNativeShare = async () => {
    if (!output.blob) return;
    try {
      const file = new File([output.blob], filename, {
        type: output.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });
      await navigator.share({
        files: [file],
        title: filename,
        text: 'Edited with SongCraft',
      });
    } catch {
      // User cancelled or share failed, fallback to direct download
      downloadAudioBlob(output.blob, filename);
    }
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
        <div className="download-file-left" style={{ flex: 1 }}>
          <FileAudio size={28} color="var(--accent-coral)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingName(false);
                  }}
                  autoFocus
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1.5px solid var(--accent-coral)',
                    background: '#ffffff',
                    width: '100%',
                    maxWidth: '320px',
                    outline: 'none',
                    color: 'var(--text-main)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  style={{
                    background: 'var(--accent-coral)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="download-file-name" style={{ wordBreak: 'break-all' }}>{filename}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  title="Rename file"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: 'rgba(249, 115, 22, 0.1)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    color: 'var(--accent-coral)',
                    borderRadius: '6px',
                    padding: '0.15rem 0.45rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Rename
                </button>
              </div>
            )}
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

      {/* Main Direct Download CTA - REAL <a> tag for 100% browser compatibility */}
      <div className="download-cta-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <a
          href={effectiveUrl}
          download={filename}
          className="btn-direct-download"
          onClick={handleManualDownload}
          style={{ textDecoration: 'none' }}
        >
          <Download size={24} />
          <span>Download {output.format.toUpperCase()} Now</span>
        </a>

        {canShare && (
          <button
            className="btn-action-outline"
            onClick={handleNativeShare}
            style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
          >
            <Share2 size={18} color="#25d366" />
            <span>Save to Phone / Send to WhatsApp</span>
          </button>
        )}

        {/* Fallback open link for browsers that block direct downloads */}
        <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
          <a
            href={effectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>Having trouble downloading? Tap here to open in new tab</span>
            <ExternalLink size={12} />
          </a>
        </div>
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
