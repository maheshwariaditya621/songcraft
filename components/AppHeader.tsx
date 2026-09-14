'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Scissors,
  Layers,
  Video,
  MessageCircle,
  Mic,
  Music,
  Home,
  ShieldCheck,
  FolderArchive,
  Trash2,
  Download,
} from 'lucide-react';
import { getAllCachedTracks, clearAllCachedTracks, renameCachedTrack } from '@/lib/storage/audio-cache';
import { downloadAudioBlob } from '@/lib/audio/download-helper';
import { Info, Edit3 } from 'lucide-react';

export function AppHeader() {
  const pathname = usePathname();
  const [cachedCount, setCachedCount] = useState<number>(0);
  const [showRecentDropdown, setShowRecentDropdown] = useState<boolean>(false);
  const [showLimitsModal, setShowLimitsModal] = useState<boolean>(false);
  const [recentTracks, setRecentTracks] = useState<Array<{ id: string; name: string; duration: number; blob: Blob }>>([]);

  const refreshCacheCount = async () => {
    try {
      const tracks = await getAllCachedTracks();
      setCachedCount(tracks.length);
      setRecentTracks(tracks.map(t => ({ id: t.id, name: t.name, duration: t.duration, blob: t.blob })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshCacheCount();
    const interval = setInterval(refreshCacheCount, 5000);
    return () => clearInterval(interval);
  }, [pathname]);

  const handleClearCache = async () => {
    if (confirm('Clear all cached audio files from your browser?')) {
      await clearAllCachedTracks();
      await refreshCacheCount();
      setShowRecentDropdown(false);
    }
  };

  const handleRenameTrack = async (id: string, currentName: string) => {
    const newName = prompt('Enter new filename:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      await renameCachedTrack(id, newName.trim());
      await refreshCacheCount();
    }
  };

  const navItems = [
    { href: '/', label: 'All Tools', icon: Home },
    { href: '/cut', label: 'Cut Song', icon: Scissors, badge: 'Popular' },
    { href: '/merge', label: 'Merge Songs', icon: Layers },
    { href: '/video-to-mp3', label: 'Video to MP3', icon: Video, badge: 'Direct' },
    { href: '/whatsapp', label: 'WhatsApp Audio', icon: MessageCircle },
    { href: '/recorder', label: 'Voice Recorder', icon: Mic },
  ];

  return (
    <header className="site-header">
      <div className="header-top">
        {/* Clickable Brand Logo linking to Homepage */}
        <Link
          href="/"
          className="header-brand"
          aria-label="SongCraft Homepage"
          title="Return to SongCraft Home"
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-badge-icon">
            <Music size={22} color="#ffffff" />
          </div>
          <div>
            <div className="brand-title">SongCraft</div>
            <div className="brand-subtitle">Simple, Instant Audio Tools</div>
          </div>
        </Link>

        <div className="header-actions">
          {/* Tool Limits & Specs Trigger */}
          <button
            type="button"
            className="limits-pill-btn"
            onClick={() => setShowLimitsModal(true)}
            title="View Tool Limits & Technical Specs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <Info size={14} color="var(--accent-coral)" />
            <span>Tool Limits</span>
          </button>

          <div className="privacy-pill" title="All processing happens on your device. Zero audio uploaded to any server.">
            <ShieldCheck size={15} color="var(--accent-green)" />
            <span>100% In-Browser & Private</span>
          </div>

          {cachedCount > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className="cache-pill-btn"
                onClick={() => setShowRecentDropdown(!showRecentDropdown)}
                title="View your saved audio tracks"
              >
                <FolderArchive size={15} />
                <span>Saved Files ({cachedCount})</span>
              </button>

              {showRecentDropdown && (
                <div className="recent-dropdown-menu">
                  <div className="dropdown-header">
                    <strong>Recent Saved Tracks</strong>
                    <button onClick={handleClearCache} className="clear-btn" title="Clear all">
                      <Trash2 size={13} /> Clear
                    </button>
                  </div>
                  <div className="dropdown-list">
                    {recentTracks.slice(0, 6).map(track => (
                      <div key={track.id} className="dropdown-item">
                        <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                          <span className="dropdown-track-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {track.name}
                          </span>
                          <span className="dropdown-track-duration" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {Math.floor(track.duration / 60)}:
                            {Math.floor(track.duration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleRenameTrack(track.id, track.name)}
                            title="Rename this file"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0.2rem',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <Link
                            href="/cut"
                            title="Open in Trimmer / Cutter"
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '4px',
                              background: '#fef3c7',
                              color: '#92400e',
                              textDecoration: 'none',
                              fontWeight: 700,
                            }}
                          >
                            Cut
                          </Link>
                          <Link
                            href="/merge"
                            title="Open in Song Merger"
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '4px',
                              background: '#ede9fe',
                              color: '#6d28d9',
                              textDecoration: 'none',
                              fontWeight: 700,
                            }}
                          >
                            Merge
                          </Link>
                          <button
                            className="btn-action-ghost"
                            onClick={() => downloadAudioBlob(track.blob, track.name)}
                            title="Download this track"
                            style={{ padding: '0.2rem', color: 'var(--accent-coral)' }}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tool Limits & Specs Modal */}
      {showLimitsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setShowLimitsModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  SongCraft Tool Limits & Specs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLimitsModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '1rem',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              SongCraft runs <strong>100% on your device</strong> using high-performance Web Audio API & FFmpeg WebAssembly. Because no data is sent to servers, there are <strong>zero queues, zero subscriptions, and unlimited daily usage</strong>!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--accent-coral)', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                  ✂️ Cut / Trim Audio
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  • Max recommended file size: <strong>200 MB</strong><br />
                  • Max duration: <strong>Up to 30 minutes</strong> per track<br />
                  • Supported formats: <strong>MP3, WAV, AAC, M4A, OGG, OPUS, FLAC</strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                  🔀 Merge / Join Audio
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  • Max tracks per mix: <strong>Up to 10 songs</strong> simultaneously<br />
                  • Max combined size: <strong>250 MB</strong><br />
                  • Supported crossfade: <strong>0 to 10 seconds</strong> smooth blending
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                  🎬 Video to MP3
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  • Max video file size: <strong>Up to 500 MB</strong><br />
                  • Supported formats: <strong>MP4, MKV, MOV, WebM, AVI</strong><br />
                  • Output format: <strong>Clean 320kbps MP3</strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 800, color: '#059669', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                  💬 WhatsApp Voice Notes & 🎙️ Live Recorder
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  • WhatsApp size: <strong>Up to 100 MB</strong> (.opus / .ogg)<br />
                  • Microphone recording: <strong>Up to 60 minutes</strong> per session
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-big btn-big-primary"
              onClick={() => setShowLimitsModal(false)}
              style={{ width: '100%', minHeight: '44px', fontWeight: 700 }}
            >
              Got it, Continue Editing!
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="header-nav-scroll" aria-label="Audio tools navigation">
        <div className="nav-tabs-container">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-tab-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-tab-badge">{item.badge}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
