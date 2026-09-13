'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Check, X, AlertCircle } from 'lucide-react';

interface LiveVoiceRecorderProps {
  onSave: (file: File) => void;
  onCancel: () => void;
}

export function LiveVoiceRecorder({ onSave, onCancel }: LiveVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevels, setVolumeLevels] = useState<number[]>(new Array(20).fill(10));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startCapture();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const startCapture = async () => {
    setError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Web Audio API for live volume visualizer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVisualizer = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          const bars: number[] = [];
          const step = Math.floor(dataArray.length / 20) || 1;
          for (let i = 0; i < 20; i++) {
            const val = dataArray[i * step] || 0;
            // Scale between 10% and 100% height
            bars.push(Math.max(10, Math.min(100, Math.round((val / 255) * 100))));
          }
          setVolumeLevels(bars);
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();
      }

      // Determine best audio mime type
      let mimeType = 'audio/webm;codecs=opus';
      let extension = 'webm';

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
          extension = 'webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          extension = 'mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
          extension = 'ogg';
        } else {
          mimeType = '';
          extension = 'webm';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // 200ms slices
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      if (errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone access in your browser.');
      } else {
        setError('Could not access microphone: ' + (errObj.message || 'Unknown error'));
      }
      setIsRecording(false);
    }
  };

  const handleFinish = () => {
    if (!mediaRecorderRef.current) return;

    if (duration < 1 && audioChunksRef.current.length === 0) {
      setError('Recording too short! Please record at least 1 second.');
      return;
    }

    const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
    let ext = 'webm';
    if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('ogg')) ext = 'ogg';

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const filename = `Voice_Recording_${Date.now().toString().slice(-4)}.${ext}`;
      const file = new File([blob], filename, { type: mimeType });
      cleanup();
      onSave(file);
    };

    mediaRecorderRef.current.stop();
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff1f2, #fdf2f8)',
        border: '2px solid #fecdd3',
        borderRadius: '24px',
        padding: '1.75rem 1.25rem',
        boxShadow: '0 12px 32px -8px rgba(225, 29, 72, 0.15)',
        textAlign: 'center',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isRecording ? '#ef4444' : '#94a3b8',
            display: 'inline-block',
            animation: isRecording ? 'pulse 1.2s infinite ease-in-out' : 'none',
          }}
        />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#881337', margin: 0 }}>
          {isRecording ? 'Recording Live Voice...' : 'Microphone Ready'}
        </h3>
      </div>

      <div
        style={{
          fontSize: '2.4rem',
          fontWeight: 800,
          color: '#e11d48',
          fontFamily: 'monospace',
          letterSpacing: '1px',
          margin: '0.5rem 0',
        }}
      >
        {formatSeconds(duration)}
      </div>

      {/* Live Voice Waves Visualizer */}
      {isRecording && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            height: '48px',
            margin: '1rem 0 1.25rem',
          }}
        >
          {volumeLevels.map((lvl, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: `${lvl}%`,
                background: 'linear-gradient(to top, #fb7185, #e11d48)',
                borderRadius: '4px',
                transition: 'height 0.08s ease-out',
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            borderRadius: '12px',
            padding: '0.65rem 1rem',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {isRecording && (
          <button
            type="button"
            className="btn-big btn-big-success"
            style={{
              minHeight: '48px',
              padding: '0.6rem 1.4rem',
              fontSize: '0.96rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981, #059669)',
            }}
            onClick={handleFinish}
          >
            <Check size={18} />
            Done & Add to Songs
          </button>
        )}

        <button
          type="button"
          className="btn-big btn-big-secondary"
          style={{
            minHeight: '48px',
            padding: '0.6rem 1.2rem',
            fontSize: '0.92rem',
            background: '#ffffff',
            borderColor: '#fecdd3',
            color: '#9f1239',
          }}
          onClick={() => {
            cleanup();
            onCancel();
          }}
        >
          <X size={16} />
          Cancel
        </button>
      </div>

      <p style={{ fontSize: '0.76rem', color: '#9f1239', opacity: 0.8, marginTop: '0.75rem', marginBottom: 0 }}>
        🎙️ Speak into your mic or phone — you can cut, trim, or blend this recording with other songs!
      </p>
    </div>
  );
}
