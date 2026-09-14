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
} from 'lucide-react';
import { getAllCachedTracks, clearAllCachedTracks } from '@/lib/storage/audio-cache';

export function AppHeader() {
  const pathname = usePathname();
  const [cachedCount, setCachedCount] = useState<number>(0);
  const [showRecentDropdown, setShowRecentDropdown] = useState<boolean>(false);
  const [recentTracks, setRecentTracks] = useState<Array<{ id: string; name: string; duration: number }>>([]);

  const refreshCacheCount = async () => {
    try {
      const tracks = await getAllCachedTracks();
      setCachedCount(tracks.length);
      setRecentTracks(tracks.map(t => ({ id: t.id, name: t.name, duration: t.duration })));
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
        <Link href="/" className="header-brand">
          <div className="brand-badge-icon">
            <Music size={22} color="#ffffff" />
          </div>
          <div>
            <div className="brand-title">SongCraft</div>
            <div className="brand-subtitle">Simple, Instant Audio Tools</div>
          </div>
        </Link>

        <div className="header-actions">
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
                    {recentTracks.slice(0, 5).map(track => (
                      <div key={track.id} className="dropdown-item">
                        <span className="dropdown-track-name">{track.name}</span>
                        <span className="dropdown-track-duration">
                          {Math.floor(track.duration / 60)}:
                          {Math.floor(track.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
