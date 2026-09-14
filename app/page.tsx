'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scissors,
  Layers,
  Video,
  MessageCircle,
  Mic,
  Music,
  Sparkles,
  ArrowRight,
  Upload,
  ShieldCheck,
  FolderArchive,
  Play,
  Trash2,
  Clock,
  Download,
} from 'lucide-react';
import {
  getAllCachedTracks,
  deleteCachedTrack,
  clearAllCachedTracks,
  CachedTrackRecord,
  saveTrackToCache,
} from '@/lib/storage/audio-cache';
import { isVideoFile, isWhatsAppAudioFile, extractAudioMetadata } from '@/lib/audio/metadata';

export default function HomePage() {
  const router = useRouter();
  const [cachedTracks, setCachedTracks] = useState<CachedTrackRecord[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCache = async () => {
    try {
      const tracks = await getAllCachedTracks();
      setCachedTracks(tracks);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCache();
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await handleRouteFile(file);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleRouteFile(file);
  };

  const handleRouteFile = async (file: File) => {
    try {
      const metadata = await extractAudioMetadata(file, file.name);
      const isVideo = isVideoFile(file.name, file.type);
      const isWhatsApp = isWhatsAppAudioFile(file.name, file.type);

      // Save to cache so target page can pick it up immediately
      await saveTrackToCache({
        id: `track_hub_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        duration: metadata.duration || 60,
        format: metadata.format,
        isFromVideo: isVideo,
        isWhatsAppAudio: isWhatsApp,
        blob: file,
        updatedAt: Date.now(),
      });

      if (isVideo) {
        router.push('/video-to-mp3');
      } else if (isWhatsApp) {
        router.push('/whatsapp');
      } else {
        router.push('/cut');
      }
    } catch {
      router.push('/cut');
    }
  };

  const handleDeleteCached = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteCachedTrack(id);
    await loadCache();
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="app-container">
      {/* Hidden universal file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.mp4,.mkv,.mov,.webm,.opus,.ogg"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* Hero Section */}
      <section className="hub-hero">
        <div className="hub-hero-badge">
          <Sparkles size={15} />
          <span>Free Studio Audio Tools • 100% In-Browser</span>
        </div>

        <h1 className="hub-hero-title">
          What would you like to do?
        </h1>

        <p className="hub-hero-subtitle">
          Choose a tool below to get started immediately. Zero confusing menus, zero wait times.
        </p>
      </section>

      {/* Feature-First Tool Selection Grid */}
      <section className="tools-grid" aria-label="Audio editing tools">
        {/* Tool 1: Cut / Trim */}
        <Link href="/cut" className="tool-card">
          <div>
            <div className="tool-card-header">
              <div
                className="tool-card-icon"
                style={{ background: 'var(--accent-coral-subtle)', color: 'var(--accent-coral)' }}
              >
                <Scissors size={26} />
              </div>
              <span
                className="tool-badge"
                style={{ background: 'var(--accent-coral)', color: '#ffffff' }}
              >
                Popular
              </span>
            </div>

            <h2 className="tool-card-title">Cut / Trim Song</h2>
            <p className="tool-card-desc">
              Make ringtones, trim intros or choruses, and add smooth fade effects with visual waveform.
            </p>
          </div>

          <div className="tool-card-footer">
            <span>Open Trimmer</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        {/* Tool 2: Video to MP3 */}
        <Link href="/video-to-mp3" className="tool-card">
          <div>
            <div className="tool-card-header">
              <div
                className="tool-card-icon"
                style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}
              >
                <Video size={26} />
              </div>
              <span
                className="tool-badge"
                style={{ background: '#10b981', color: '#ffffff' }}
              >
                Direct Download
              </span>
            </div>

            <h2 className="tool-card-title">Video to MP3</h2>
            <p className="tool-card-desc">
              Extract high quality MP3 audio from any MP4, MKV, MOV, or WebM video with 1-click download.
            </p>
          </div>

          <div className="tool-card-footer" style={{ color: '#10b981' }}>
            <span>Extract Audio</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        {/* Tool 3: Merge Songs */}
        <Link href="/merge" className="tool-card">
          <div>
            <div className="tool-card-header">
              <div
                className="tool-card-icon"
                style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}
              >
                <Layers size={26} />
              </div>
              <span
                className="tool-badge"
                style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' }}
              >
                Medley Maker
              </span>
            </div>

            <h2 className="tool-card-title">Merge Songs</h2>
            <p className="tool-card-desc">
              Join multiple songs or voice recordings into one seamless continuous track with crossfade.
            </p>
          </div>

          <div className="tool-card-footer" style={{ color: '#3b82f6' }}>
            <span>Join Audio</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        {/* Tool 4: WhatsApp Audio */}
        <Link href="/whatsapp" className="tool-card">
          <div>
            <div className="tool-card-header">
              <div
                className="tool-card-icon"
                style={{ background: 'rgba(37, 211, 102, 0.12)', color: '#25d366' }}
              >
                <MessageCircle size={26} />
              </div>
              <span
                className="tool-badge"
                style={{ background: '#25d366', color: '#ffffff' }}
              >
                .opus to MP3
              </span>
            </div>

            <h2 className="tool-card-title">WhatsApp Audio</h2>
            <p className="tool-card-desc">
              Convert WhatsApp voice notes into universally playable MP3s with instant download or trim.
            </p>
          </div>

          <div className="tool-card-footer" style={{ color: '#059669' }}>
            <span>Convert Voice Note</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        {/* Tool 5: Live Voice Recorder */}
        <Link href="/recorder" className="tool-card">
          <div>
            <div className="tool-card-header">
              <div
                className="tool-card-icon"
                style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}
              >
                <Mic size={26} />
              </div>
              <span
                className="tool-badge"
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}
              >
                Live Studio
              </span>
            </div>

            <h2 className="tool-card-title">Voice Recorder</h2>
            <p className="tool-card-desc">
              Record voice, vocals, or commentary live with real-time waveform visualizer & direct MP3 export.
            </p>
          </div>

          <div className="tool-card-footer" style={{ color: '#ef4444' }}>
            <span>Record Voice</span>
            <ArrowRight size={16} />
          </div>
        </Link>
      </section>

      {/* Universal Quick Drop Area */}
      <section
        className={`aesthetic-card ${isDragging ? 'dragging' : ''}`}
        style={{
          border: isDragging ? '2px dashed var(--accent-coral)' : '2px dashed var(--border-strong)',
          textAlign: 'center',
          padding: '2.5rem 1.5rem',
          cursor: 'pointer',
          background: isDragging ? 'var(--accent-coral-subtle)' : 'var(--bg-card)',
          transition: 'all 0.2s ease',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'var(--accent-coral-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <Upload size={28} color="var(--accent-coral)" />
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          Or Drop Any Audio / Video File Here
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          We will automatically detect the format and open the right tool for you
        </p>

        <button
          className="btn-action-outline"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <Upload size={16} />
          <span>Browse From Device</span>
        </button>
      </section>

      {/* Recent Saved Files / Cache Shelf */}
      {cachedTracks.length > 0 && (
        <section className="aesthetic-card" style={{ marginTop: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderArchive size={20} color="var(--accent-coral)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Recent Files in Browser ({cachedTracks.length})
              </h3>
            </div>

            <button
              onClick={async () => {
                if (confirm('Clear all cached files from browser?')) {
                  await clearAllCachedTracks();
                  setCachedTracks([]);
                }
              }}
              className="btn-action-ghost"
              style={{ fontSize: '0.8rem', color: 'var(--accent-red)' }}
            >
              Clear All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {cachedTracks.slice(0, 4).map((track) => (
              <div
                key={track.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-card-subtle)',
                  padding: '0.75rem 1rem',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  gap: '0.75rem',
                }}
              >
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
                    {track.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDuration(track.duration)} • {(track.size / (1024 * 1024)).toFixed(1)} MB •{' '}
                    {track.format.toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link
                    href="/cut"
                    className="btn-action-outline"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                  >
                    <Scissors size={13} />
                    <span>Cut</span>
                  </Link>

                  <button
                    className="btn-action-ghost"
                    onClick={(e) => handleDeleteCached(track.id, e)}
                    title="Remove from cache"
                    style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 100% Privacy Guarantee Callout */}
      <footer
        style={{
          marginTop: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
          <ShieldCheck size={18} color="#10b981" />
          <span>Zero Server Uploads • 100% Private In-Browser Audio Processing</span>
        </div>
        <div>
          SongCraft runs entirely on your device using WebAssembly. Your files never leave your computer or phone.
        </div>
      </footer>
    </main>
  );
}
