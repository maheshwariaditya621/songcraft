'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';

interface WaveformVisualizerProps {
  audioFile: File | Blob | null;
  duration: number;
  selection: { start: number; end: number };
  onSelectionChange?: (sel: { start: number; end: number }) => void;
  externalPlayheadTime?: number;
  onSeek?: (seconds: number) => void;
  disabled?: boolean;
}

export function WaveformVisualizer({
  audioFile,
  duration,
  selection,
  onSelectionChange,
  externalPlayheadTime,
  onSeek,
  disabled = false,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(selection.start);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // 1. Create Audio URL and element for preview
  useEffect(() => {
    if (!audioFile) {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPeaks([]);
      return;
    }

    const url = URL.createObjectURL(audioFile);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    // Decode peaks using Web Audio API
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuf = e.target?.result as ArrayBuffer;
        if (!arrayBuf) return;
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        const rawData = decoded.getChannelData(0);
        const sampleBars = 120;
        const blockSize = Math.floor(rawData.length / sampleBars);
        const extractedPeaks: number[] = [];

        for (let i = 0; i < sampleBars; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          extractedPeaks.push(sum / blockSize);
        }

        // Normalize peaks between 0.15 and 1.0 for aesthetic display
        const max = Math.max(...extractedPeaks, 0.01);
        const normalized = extractedPeaks.map((p) =>
          Math.max(0.12, Math.min(1.0, (p / max) * 0.95))
        );
        setPeaks(normalized);
      } catch (err) {
        console.warn('Could not decode audio data for waveform:', err);
        // Fallback smooth synthetic peaks so the user still has a visual representation
        const fallback = Array.from({ length: 120 }, (_, i) =>
          0.2 + 0.6 * Math.abs(Math.sin((i / 120) * Math.PI * 4))
        );
        setPeaks(fallback);
      }
    };

    reader.readAsArrayBuffer(audioFile);

    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioCtx.state !== 'closed') {
        audioCtx.close();
      }
    };
  }, [audioFile]);

  // 1b. Sync external playhead time from parent audio player
  useEffect(() => {
    if (externalPlayheadTime !== undefined) {
      setCurrentTime(externalPlayheadTime);
    }
  }, [externalPlayheadTime]);

  // 2. Playback animation loop
  const updatePlayback = useCallback(() => {
    if (!audioRef.current || !isPlaying) return;

    const cur = audioRef.current.currentTime;
    setCurrentTime(cur);

    // Stop if reached the end of selection
    if (cur >= selection.end || cur >= duration) {
      audioRef.current.pause();
      setIsPlaying(false);
      audioRef.current.currentTime = selection.start;
      setCurrentTime(selection.start);
      return;
    }

    animFrameRef.current = requestAnimationFrame(updatePlayback);
  }, [isPlaying, selection.end, selection.start, duration]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updatePlayback);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, updatePlayback]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If current time is outside selection, jump to start
      if (currentTime < selection.start || currentTime >= selection.end) {
        audioRef.current.currentTime = selection.start;
        setCurrentTime(selection.start);
      } else {
        audioRef.current.currentTime = currentTime;
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.warn('Audio play error:', e));
    }
  };

  const resetToStart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = selection.start;
    }
    setCurrentTime(selection.start);
  };

  // 3. Draw Waveform on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (peaks.length === 0 || duration <= 0) {
      // Draw placeholder bars
      ctx.fillStyle = '#E2E8F0';
      const numBars = 80;
      const barW = width / numBars - 2;
      for (let i = 0; i < numBars; i++) {
        const barH = 15 + Math.sin(i * 0.3) * 10;
        ctx.fillRect(i * (barW + 2), (height - barH) / 2, barW, barH);
      }
      return;
    }

    const startRatio = Math.max(0, Math.min(1, selection.start / duration));
    const endRatio = Math.max(0, Math.min(1, selection.end / duration));
    const playRatio = Math.max(0, Math.min(1, currentTime / duration));

    const barCount = peaks.length;
    const barWidth = width / barCount;
    const gap = 2;
    const activeBarWidth = Math.max(1, barWidth - gap);

    // Draw bars
    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const ratio = i / barCount;
      const isSelected = ratio >= startRatio && ratio <= endRatio;
      const isPassedPlayhead = ratio <= playRatio;

      const barHeight = Math.max(6, peak * (height - 12));
      const y = (height - barHeight) / 2;

      if (isSelected) {
        if (isPassedPlayhead) {
          ctx.fillStyle = '#EA580C'; // Active passed audio in selection
        } else {
          ctx.fillStyle = '#FF6B4A'; // Warm sunset coral for selected range
        }
      } else {
        if (isPassedPlayhead) {
          ctx.fillStyle = '#94A3B8'; // Slate for passed audio outside selection
        } else {
          ctx.fillStyle = '#E2E8F0'; // Soft muted gray for unselected audio
        }
      }

      // Rounded bar
      ctx.beginPath();
      ctx.roundRect(x, y, activeBarWidth, barHeight, 2);
      ctx.fill();
    });

    // Start Boundary Marker Line (Green)
    const startX = startRatio * width;
    ctx.fillStyle = '#10B981';
    ctx.fillRect(startX - 1, 0, 2, height);

    // End Boundary Marker Line (Red)
    const endX = endRatio * width;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(endX - 1, 0, 2, height);

    // Draw playhead line across waveform
    if (currentTime >= 0 && currentTime <= duration) {
      const playheadX = playRatio * width;
      const isInSelection = currentTime >= selection.start && currentTime <= selection.end;
      ctx.fillStyle = isInSelection ? '#0F172A' : '#EA580C';
      ctx.fillRect(playheadX - 1.5, 0, 3, height);

      // Top indicator knob
      ctx.beginPath();
      ctx.arc(playheadX, 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [peaks, duration, selection, currentTime]);

  // 4. Drag interaction for handles
  const getTimeFromEvent = (clientX: number): number => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (x / rect.width) * duration;
  };

  const handlePointerDown = (type: 'start' | 'end', e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(type);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled || !onSelectionChange) return;
    const newTime = Math.round(getTimeFromEvent(e.clientX) * 10) / 10;

    if (isDragging === 'start') {
      const clamped = Math.max(0, Math.min(selection.end - 1, newTime));
      onSelectionChange({ start: clamped, end: selection.end });
      setCurrentTime(clamped);
      if (onSeek) onSeek(clamped);
      if (audioRef.current) audioRef.current.currentTime = clamped;
    } else if (isDragging === 'end') {
      const clamped = Math.max(selection.start + 1, Math.min(duration, newTime));
      onSelectionChange({ start: selection.start, end: clamped });
      setCurrentTime(clamped);
      if (onSeek) onSeek(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(null);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isDragging) return;
    const clickedTime = getTimeFromEvent(e.clientX);
    const clampedTime = Math.max(0, Math.min(duration, Math.round(clickedTime * 10) / 10));
    setCurrentTime(clampedTime);
    if (onSeek) {
      onSeek(clampedTime);
    }
  };

  const startPercent = duration > 0 ? (selection.start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (selection.end / duration) * 100 : 100;
  const selectedDuration = Math.max(0, selection.end - selection.start);

  return (
    <div className="waveform-container">
      {/* Waveform Canvas & Touch Track */}
      <div
        ref={containerRef}
        className="waveform-track"
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
        title="Tap or drag anywhere along the waveform to seek"
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={90}
          className="waveform-canvas"
        />

        {/* Start Drag Handle */}
        <div
          className={`waveform-handle waveform-handle-start ${isDragging === 'start' ? 'dragging' : ''}`}
          style={{ left: `${startPercent}%` }}
          onPointerDown={(e) => handlePointerDown('start', e)}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Start Time Handle"
          aria-valuenow={selection.start}
        >
          <div className="handle-line" />
          <div className="handle-pill">
            <span>{formatSeconds(selection.start)}</span>
          </div>
        </div>

        {/* End Drag Handle */}
        <div
          className={`waveform-handle waveform-handle-end ${isDragging === 'end' ? 'dragging' : ''}`}
          style={{ left: `${endPercent}%` }}
          onPointerDown={(e) => handlePointerDown('end', e)}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="End Time Handle"
          aria-valuenow={selection.end}
        >
          <div className="handle-line" />
          <div className="handle-pill">
            <span>{formatSeconds(selection.end)}</span>
          </div>
        </div>
      </div>

      {/* Control Bar Below Waveform */}
      <div className="waveform-controls">
        <div className="waveform-preview-actions">
          <button
            type="button"
            className="waveform-play-btn"
            onClick={togglePlay}
            disabled={disabled}
            title={isPlaying ? 'Pause Preview' : 'Audition Cut'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Listen to Cut
              </>
            )}
          </button>

          <button
            type="button"
            className="waveform-reset-btn"
            onClick={resetToStart}
            disabled={disabled || isPlaying}
            title="Jump back to start of cut"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="waveform-meta">
          <span className="waveform-time-label">
            <strong>{formatSeconds(selection.start)}</strong> →{' '}
            <strong>{formatSeconds(selection.end)}</strong>
          </span>
          <span className="waveform-duration-badge">
            {Math.round(selectedDuration)}s kept
          </span>
        </div>
      </div>
    </div>
  );
}
