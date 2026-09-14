'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FolderArchive, Play, Pause, X, Music, Check, Clock, HardDrive } from 'lucide-react';
import { CachedTrackRecord, getAllCachedTracks } from '@/lib/storage/audio-cache';
import { Portal } from '@/components/Portal';

interface SavedSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: CachedTrackRecord) => void;
  actionLabel?: string;
  title?: string;
}

export function SavedSongsModal({
  isOpen,
  onClose,
  onSelectTrack,
  actionLabel = 'Select Song',
  title = 'Pick from Saved Songs',
}: SavedSongsModalProps) {
  const [tracks, setTracks] = useState<CachedTrackRecord[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load tracks when opened
  useEffect(() => {
    if (isOpen) {
      getAllCachedTracks().then((t) => setTracks(t)).catch(() => {});
    } else {
      // Stop preview when modal closes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
      setCurrentTime(0);
    }
  }, [isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleTogglePreview = (track: CachedTrackRecord, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const blobUrl = URL.createObjectURL(track.blob);
    const audio = new Audio(blobUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setPlayingId(null);
      setCurrentTime(0);
    };

    audio.play().then(() => {
      setPlayingId(track.id);
    }).catch((err) => {
      console.warn('Playback error:', err);
      setPlayingId(null);
    });
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Portal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            maxWidth: '580px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            position: 'relative',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #e2e8f0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(234, 88, 12, 0.2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderArchive size={20} color="var(--accent-coral)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {title}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Preview and select from your device&apos;s saved tracks ({tracks.length})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'background 0.15s',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* List Area */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              paddingRight: '0.25rem',
              marginBottom: '1rem',
            }}
          >
            {tracks.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: '#64748b',
                }}
              >
                <Music size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
                <h4 style={{ margin: '0 0 0.35rem', color: '#1e293b', fontWeight: 700 }}>
                  No saved songs yet
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Songs you cut, merge, or record will automatically appear here for instant reuse!
                </p>
              </div>
            ) : (
              tracks.map((track) => {
                const isPlaying = playingId === track.id;
                return (
                  <div
                    key={track.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.9rem 1rem',
                      background: isPlaying ? '#fff7ed' : '#f8fafc',
                      borderRadius: '16px',
                      border: isPlaying ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      transition: 'all 0.2s ease',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Play / Pause Preview Button */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePreview(track, e)}
                      title={isPlaying ? 'Pause preview' : 'Audition preview'}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: isPlaying ? '#ea580c' : '#ffffff',
                        border: isPlaying ? 'none' : '1.5px solid #cbd5e1',
                        color: isPlaying ? '#ffffff' : 'var(--accent-coral)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                        transition: 'transform 0.15s, background 0.15s',
                      }}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />}
                    </button>

                    {/* Track Title and Metadata Badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.96rem',
                          color: '#0f172a',
                          wordBreak: 'break-word',
                          lineHeight: 1.3,
                          marginBottom: '0.3rem',
                        }}
                      >
                        {track.name}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          flexWrap: 'wrap',
                          fontSize: '0.76rem',
                          color: '#475569',
                        }}
                      >
                        <span
                          style={{
                            background: isPlaying ? '#ffedd5' : '#e2e8f0',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            color: isPlaying ? '#9a3412' : '#334155',
                          }}
                        >
                          {isPlaying ? `${formatTime(currentTime)} / ${formatTime(track.duration)}` : formatTime(track.duration)}
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(track.size)}</span>
                        <span>•</span>
                        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{track.format}</span>
                      </div>
                    </div>

                    {/* Select / Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.pause();
                        }
                        onSelectTrack(track);
                        onClose();
                      }}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 10px rgba(234, 88, 12, 0.25)',
                        flexShrink: 0,
                      }}
                    >
                      {actionLabel}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div
            style={{
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              color: '#64748b',
            }}
          >
            <span>🎧 Tap ▶ to listen to any track before choosing.</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.3rem 0.6rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
