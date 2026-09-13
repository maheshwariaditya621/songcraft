'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AudioTrack,
  AudioOperation,
  ProcessingResult,
} from '@/lib/types/audio';
import { InterpretationResult } from '@/lib/types/instructions';
import { defaultInstructionEngine } from '@/lib/instructions/instruction-engine';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { extractAudioMetadata, isVideoFile } from '@/lib/audio/metadata';
import { defaultVoiceController } from '@/lib/voice/voice-controller';
import { SpeechLanguage, SpeechError } from '@/lib/voice/speech-types';
import { speechSynthesizer, SpeechSynthesizer } from '@/lib/voice/speech-synthesis';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import {
  Mic,
  Square,
  Upload,
  Download,
  RotateCcw,
  Share2,
  CheckCircle,
  Scissors,
  Music,
  Plus,
  Trash2,
  Lock,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Edit3,
  Volume2,
  VolumeX,
  ChevronRight,
  Layers,
  Video,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

type FlowStage =
  | 'HOME'
  | 'RECORDING'
  | 'CONFIRMATION'
  | 'CLARIFICATION'
  | 'PROCESSING'
  | 'READY';

export default function CustomerHomepage() {
  // Tracks
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string>('');
  const [trackSelections, setTrackSelections] = useState<
    Record<string, { start: number; end: number; isCustomized: boolean }>
  >({});
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  // Medley Finishing Options
  const [medleyFadeOut, setMedleyFadeOut] = useState<boolean>(true);
  const [medleyFadeOutDuration, setMedleyFadeOutDuration] = useState<number>(3);
  const [medleyFadeIn, setMedleyFadeIn] = useState<boolean>(false);
  const [medleyBlendDuration, setMedleyBlendDuration] = useState<number>(3);

  // Flow & State
  const [stage, setStage] = useState<FlowStage>('HOME');
  const [language, setLanguage] = useState<SpeechLanguage>('auto');
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState<boolean>(true);
  const [inputSource, setInputSource] = useState<'voice' | 'typed' | 'preset'>('typed');
  const [waveformSelection, setWaveformSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 60,
  });
  const [recordingTime, setRecordingTime] = useState<string>('00:00');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [typedInput, setTypedInput] = useState<string>('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Stop any active spoken voice feedback immediately
  const stopVoiceFeedback = () => {
    speechSynthesizer.stop();
  };

  // Interpretation & Operations
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [pendingOperations, setPendingOperations] = useState<AudioOperation[]>([]);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Hook voice controller listeners
  useEffect(() => {
    defaultVoiceController.setListener({
      onTranscriptUpdate: (text, isFinal) => {
        setLiveTranscript(text);
        if (isFinal) {
          setFinalTranscript(text);
        }
      },
      onTimeUpdate: (_sec, formatted) => {
        setRecordingTime(formatted);
      },
      onError: (err: SpeechError) => {
        setSpeechError(err.message);
        setStage('HOME');
      },
    });
  }, []);

  // Primary Action: Tap Microphone
  const handleMicTap = async () => {
    stopVoiceFeedback();

    if (tracks.length === 0) {
      alert('🎵 Please choose or add a song first, then tap to speak!');
      fileInputRef.current?.click();
      return;
    }

    setSpeechError(null);
    setLiveTranscript('');
    setFinalTranscript('');
    setStage('RECORDING');

    await defaultVoiceController.startListening({ language });
  };

  // Stop Microphone
  const handleStopRecording = async () => {
    stopVoiceFeedback();
    const transcript = await defaultVoiceController.stopListening();
    const effective = transcript || liveTranscript;

    if (!effective.trim()) {
      setSpeechError("We didn't hear anything. Please tap to speak again or type below.");
      setStage('HOME');
      return;
    }

    setFinalTranscript(effective);
    setInputSource('voice');
    evaluateInstruction(effective, true);
  };

  // Evaluate instruction through deterministic engine
  const evaluateInstruction = async (text: string, isFromVoice = false) => {
    stopVoiceFeedback();
    if (!text.trim()) return;

    if (tracks.length === 0) {
      alert('🎵 Please add a song first!');
      fileInputRef.current?.click();
      return;
    }

    const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
    const res = await defaultInstructionEngine.interpret(text, {
      tracks,
      activeTrackId: activeTrack?.id,
    });

    setInterpretation(res);
    setFinalTranscript(text);

    const isHindi = language === 'hi-IN' || /[\u0900-\u097F]/.test(text);

    if (res.status === 'success') {
      setPendingOperations(res.operations);

      // Sync waveform selection if a trim operation was recognized
      const trimOp = res.operations.find((op) => op.type === 'trim') as
        | { type: 'trim'; start: number; end: number }
        | undefined;
      if (trimOp) {
        setWaveformSelection({ start: trimOp.start, end: trimOp.end });
      }

      setStage('CONFIRMATION');

      // Spoken Voice Feedback: ONLY speak if the user gave input via VOICE!
      if (voiceFeedbackEnabled && isFromVoice) {
        const msg = SpeechSynthesizer.buildConfirmationMessage(
          res.explanation || 'मैंने बदलाव तय कर लिए हैं',
          isHindi
        );
        speechSynthesizer.speak(msg, { language: isHindi ? 'hi-IN' : 'en-IN' });
      }
    } else if (res.status === 'needs_clarification') {
      setStage('CLARIFICATION');

      // Spoken Voice Feedback: ONLY speak if the user gave input via VOICE!
      if (voiceFeedbackEnabled && isFromVoice) {
        const msg = SpeechSynthesizer.buildClarificationMessage(isHindi);
        speechSynthesizer.speak(msg, { language: isHindi ? 'hi-IN' : 'en-IN' });
      }
    } else {
      setSpeechError("Sorry, we couldn't understand that instruction. Please try again.");
      setStage('HOME');
    }
  };

  // Execute processing in Audio Engine (FFmpeg.wasm)
  const executeProcessing = async (operations: AudioOperation[]) => {
    stopVoiceFeedback();
    setStage('PROCESSING');
    setProcessingProgress(20);
    setResult(null);

    try {
      const res = await defaultAudioEngine.processAudio(
        {
          tracks,
          operations,
          outputFormat: 'mp3',
        },
        (progress) => setProcessingProgress(Math.max(20, progress))
      );

      if (res.success && res.output) {
        setResult(res);
        setStage('READY');

        // Spoken Voice Feedback: Celebratory message when song is ready to download
        if (voiceFeedbackEnabled) {
          const isHindi =
            language === 'hi-IN' ||
            /[\u0900-\u097F]/.test(finalTranscript) ||
            /[\u0900-\u097F]/.test(typedInput);
          const msg = SpeechSynthesizer.buildCompletionMessage(isHindi);
          speechSynthesizer.speak(msg, {
            language: isHindi ? 'hi-IN' : 'en-IN',
          });
        }
      } else {
        alert(res.error?.message || "Sorry, we couldn't make that edit. Please try again.");
        setStage('HOME');
      }
    } catch {
      alert('An error occurred during editing. Please try again.');
      setStage('HOME');
    }
  };

  // Instant Sample Song Generator (<5ms)
  const addInstantSampleSong = () => {
    const blob = createFastSampleWav(60);
    const filename = `Sample_Song_${tracks.length + 1}.wav`;
    const file = new File([blob], filename, { type: 'audio/wav' });
    const blobUrl = URL.createObjectURL(file);
    const trackId = `track_${Date.now()}`;

    const newTrack: AudioTrack = {
      id: trackId,
      filename,
      duration: 60,
      format: 'wav',
      size: blob.size,
      metadata: {
        duration: 60,
        format: 'wav',
        size: blob.size,
        sampleRate: 22050,
        channels: 1,
      },
      blobUrl,
      file,
    };

    setTracks((prev) => [...prev, newTrack]);
    setTrackSelections((prev) => ({
      ...prev,
      [trackId]: { start: 0, end: 60, isCustomized: false },
    }));
    if (!activeTrackId) {
      setActiveTrackId(trackId);
      setWaveformSelection({ start: 0, end: 60 });
    }
  };

  // File Upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTracks: AudioTrack[] = [];
    const newSelections: Record<string, { start: number; end: number; isCustomized: boolean }> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = await extractAudioMetadata(file, file.name);
      const isVideo = isVideoFile(file.name, file.type);
      const trackId = `track_${Date.now()}_${i}`;
      const blobUrl = URL.createObjectURL(file);

      newTracks.push({
        id: trackId,
        filename: file.name,
        duration: metadata.duration,
        format: metadata.format,
        size: file.size,
        metadata,
        blobUrl,
        file,
        isVideo,
      });

      newSelections[trackId] = {
        start: 0,
        end: metadata.duration || 60,
        isCustomized: false,
      };
    }

    setTracks((prev) => {
      const updated = [...prev, ...newTracks];
      if (!activeTrackId && updated.length > 0) {
        setActiveTrackId(updated[0].id);
        setWaveformSelection({ start: 0, end: Math.min(60, updated[0].duration || 60) });
      }
      return updated;
    });

    setTrackSelections((prev) => ({ ...prev, ...newSelections }));
  };

  // Reorder Songs
  const moveTrack = (fromIdx: number, toIdx: number) => {
    stopVoiceFeedback();
    if (toIdx < 0 || toIdx >= tracks.length) return;
    setTracks((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
  };

  // Remove Song
  const removeTrack = (trackId: string) => {
    stopVoiceFeedback();
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    setTrackSelections((prev) => {
      const copy = { ...prev };
      delete copy[trackId];
      return copy;
    });
    if (expandedTrackId === trackId) {
      setExpandedTrackId(null);
    }
    if (activeTrackId === trackId) {
      const remaining = tracks.filter((t) => t.id !== trackId);
      setActiveTrackId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  // Instant Master Blend & Crossfade Action
  const handleBlendSelectedCuts = (crossfade: boolean) => {
    stopVoiceFeedback();
    if (tracks.length < 2) return;

    const ops: AudioOperation[] = [];

    // For each track, check if customized or cut from original duration
    tracks.forEach((track, idx) => {
      const sel = trackSelections[track.id];
      if (sel && (sel.isCustomized || sel.start > 0 || (track.duration && sel.end < track.duration))) {
        ops.push({
          type: 'trim',
          trackId: track.id,
          start: sel.start,
          end: sel.end,
        });
      }

      // Gentle intro fade-in on the first song
      if (idx === 0 && medleyFadeIn) {
        ops.push({
          type: 'fade_in',
          trackId: track.id,
          duration: 2,
        });
      }

      // Smooth ending fade-out on the last song
      if (idx === tracks.length - 1 && medleyFadeOut) {
        ops.push({
          type: 'fade_out',
          trackId: track.id,
          duration: medleyFadeOutDuration,
        });
      }
    });

    // Add merge operation
    ops.push({
      type: 'merge',
      tracks: tracks.map((t) => t.id),
      crossfade,
      crossfadeDuration: crossfade ? medleyBlendDuration : 0,
    });

    setPendingOperations(ops);
    setFinalTranscript(
      crossfade
        ? `Blend ${tracks.length} songs with a smooth ${medleyBlendDuration}-second crossfade (DJ Mix)`
        : `Join ${tracks.length} songs together seamlessly`
    );
    setInputSource('preset');
    setStage('CONFIRMATION');
  };

  // Friendly plain-English bullet points
  const renderFriendlyUnderstanding = () => {
    if (!pendingOperations || pendingOperations.length === 0) return null;

    return pendingOperations.map((op, idx) => {
      if (op.type === 'trim') {
        const startMin = Math.floor(op.start / 60);
        const startSec = Math.floor(op.start % 60);
        const endMin = Math.floor(op.end / 60);
        const endSec = Math.floor(op.end % 60);
        const formatTime = (m: number, s: number) =>
          `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        const matchedTrack = tracks.find((t) => t.id === op.trackId);
        const trackPrefix = matchedTrack && tracks.length > 1 ? `[${matchedTrack.filename}] ` : '';

        if (op.start === 0) {
          return (
            <div key={idx} className="understanding-item">
              <span>✂️</span>
              <span>{trackPrefix}Keep from start up to {formatTime(endMin, endSec)}</span>
            </div>
          );
        }

        return (
          <div key={idx} className="understanding-item">
            <span>✂️</span>
            <span>
              {trackPrefix}Keep part from {formatTime(startMin, startSec)} to {formatTime(endMin, endSec)}
            </span>
          </div>
        );
      }

      if (op.type === 'fade_out') {
        return (
          <div key={idx} className="understanding-item">
            <span>✨</span>
            <span>Smoothly fade out the ending ({op.duration} seconds)</span>
          </div>
        );
      }

      if (op.type === 'fade_in') {
        return (
          <div key={idx} className="understanding-item">
            <span>✨</span>
            <span>Gently fade in the start ({op.duration} seconds)</span>
          </div>
        );
      }

      if (op.type === 'volume') {
        return (
          <div key={idx} className="understanding-item">
            <span>🔊</span>
            <span>{op.value > 1 ? 'Make song louder (+30%)' : 'Make song softer'}</span>
          </div>
        );
      }

      if (op.type === 'merge') {
        return (
          <div key={idx} className="understanding-item">
            <span>🎶</span>
            <span>
              {op.crossfade
                ? `Blend all ${op.tracks.length} songs with a smooth 3-second crossfade (DJ Mix)`
                : `Join all ${op.tracks.length} songs together seamlessly`}
            </span>
          </div>
        );
      }

      return null;
    });
  };

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];

  return (
    <main className="app-container">
      {/* Brand Header */}
      <header className="nav-bar">
        <div className="brand-logo">
          <div className="brand-icon">
            <Music size={20} />
          </div>
          <span>SongCraft</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Spoken Voice Feedback Toggle */}
          <button
            type="button"
            className={`voice-feedback-toggle ${voiceFeedbackEnabled ? 'active' : ''}`}
            onClick={() => {
              const next = !voiceFeedbackEnabled;
              setVoiceFeedbackEnabled(next);
              speechSynthesizer.setMuted(!next);
            }}
            title={voiceFeedbackEnabled ? 'Voice feedback is On' : 'Voice feedback is Muted'}
            aria-label="Toggle spoken voice feedback"
          >
            {voiceFeedbackEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{voiceFeedbackEnabled ? 'Voice: On' : 'Voice: Muted'}</span>
          </button>

          <a
            href="https://wa.me/?text=Hi!%20I%20need%20help%20with%20my%20song"
            target="_blank"
            rel="noopener noreferrer"
            className="help-link"
          >
            <MessageCircle size={16} />
            <span>Need help?</span>
          </a>
        </div>
      </header>

      {/* STAGE: PROCESSING */}
      {stage === 'PROCESSING' && (
        <section className="aesthetic-card voice-card" style={{ padding: '3.5rem 1.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎵</div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Making your song...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
            Just a moment while we prepare your music.
          </p>

          <div className="friendly-progress-bar" style={{ maxWidth: '420px', height: '14px' }}>
            <div
              className="friendly-progress-fill"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </section>
      )}

      {/* STAGE: READY */}
      {stage === 'READY' && result?.output && (
        <section className="aesthetic-card" style={{ textAlign: 'center', padding: '2.5rem 1.75rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Your song is ready!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.3rem' }}>
            Tap below to listen and download:
          </p>

          <div className="audio-player-wrapper" style={{ margin: '1.5rem 0' }}>
            <audio controls src={result.output.blobUrl} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.5rem' }}>
            <a
              href={result.output.blobUrl}
              download={result.output.filename}
              className="btn-big btn-big-success"
              onClick={stopVoiceFeedback}
            >
              <Download size={20} />
              Download My Song (MP3)
            </a>

            {/* Native WhatsApp Share Button */}
            <button
              type="button"
              className="btn-share-whatsapp"
              onClick={async () => {
                stopVoiceFeedback();
                try {
                  if (typeof navigator !== 'undefined' && navigator.share && result.output?.blob) {
                    const shareFile = new File(
                      [result.output.blob],
                      result.output.filename || 'edited_song.mp3',
                      { type: 'audio/mp3' }
                    );
                    if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
                      await navigator.share({
                        title: 'My Edited Song',
                        text: 'Listen to my edited song made with SongCraft!',
                        files: [shareFile],
                      });
                      return;
                    }
                  }
                  window.open(
                    `https://api.whatsapp.com/send?text=${encodeURIComponent(
                      'Check out my edited song from SongCraft! ' + window.location.href
                    )}`,
                    '_blank'
                  );
                } catch (err) {
                  console.log('Share dismissed', err);
                }
              }}
            >
              <Share2 size={20} />
              Share to WhatsApp / Send
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-big btn-big-secondary"
                onClick={() => {
                  stopVoiceFeedback();
                  setStage('HOME');
                  setPendingOperations([]);
                }}
              >
                <RotateCcw size={18} />
                Make Another Version
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STAGE: CONFIRMATION */}
      {stage === 'CONFIRMATION' && (
        <section className="aesthetic-card">
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '2.75rem', marginBottom: '0.4rem' }}>👍</div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Here is what I understood:</h2>
            {finalTranscript && (
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '1rem',
                  fontStyle: 'italic',
                  marginTop: '0.4rem',
                  background: 'var(--bg-card-subtle)',
                  padding: '0.5rem 1rem',
                  borderRadius: '12px',
                  display: 'inline-block',
                }}
              >
                &ldquo;{finalTranscript}&rdquo;
              </p>
            )}
          </div>

          {/* Friendly Checklist */}
          <div className="understanding-box">
            <div className="understanding-title">Edits to be made:</div>
            {renderFriendlyUnderstanding()}
          </div>

          {/* Interactive Waveform Visualizer with Dual Drag Handles & Live Audition */}
          {tracks.length > 1 && pendingOperations.some((op) => op.type === 'merge') ? (
            <div style={{ margin: '1.25rem 0 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>Preview & Fine-Tune Song Cuts:</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>(Slide handles to adjust before making)</span>
              </div>
              {tracks.map((trk, i) => {
                const sel = trackSelections[trk.id] || {
                  start: 0,
                  end: trk.duration || 60,
                  isCustomized: false,
                };
                return (
                  <div
                    key={trk.id}
                    style={{
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '0.85rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Song #{i + 1}: {trk.filename}</span>
                      <span style={{ color: 'var(--accent-coral)', fontWeight: 600 }}>
                        {Math.floor(sel.start / 60)}:{String(Math.floor(sel.start % 60)).padStart(2, '0')} → {Math.floor(sel.end / 60)}:{String(Math.floor(sel.end % 60)).padStart(2, '0')}
                      </span>
                    </div>
                    <WaveformVisualizer
                      audioFile={trk.file || null}
                      duration={trk.duration || 60}
                      selection={{ start: sel.start, end: sel.end }}
                      onSelectionChange={(newSel) => {
                        stopVoiceFeedback();
                        setTrackSelections((prev) => ({
                          ...prev,
                          [trk.id]: { ...newSel, isCustomized: true },
                        }));
                        setPendingOperations((prev) => {
                          const existing = prev.some((op) => op.type === 'trim' && op.trackId === trk.id);
                          if (existing) {
                            return prev.map((op) =>
                              op.type === 'trim' && op.trackId === trk.id
                                ? { ...op, start: newSel.start, end: newSel.end }
                                : op
                            );
                          }
                          return [
                            { type: 'trim', trackId: trk.id, start: newSel.start, end: newSel.end },
                            ...prev,
                          ];
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : activeTrack ? (
            <div style={{ margin: '1.25rem 0 0.5rem' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>Visual Preview & Adjust:</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>(Drag handles to fine-tune)</span>
              </div>
              <WaveformVisualizer
                audioFile={activeTrack.file || null}
                duration={activeTrack.duration || 60}
                selection={waveformSelection}
                onSelectionChange={(newSel) => {
                  stopVoiceFeedback();
                  setWaveformSelection(newSel);
                  setTrackSelections((prev) => ({
                    ...prev,
                    [activeTrack.id]: { ...newSel, isCustomized: true },
                  }));
                  setPendingOperations((prev) => {
                    const hasTrim = prev.some((op) => op.type === 'trim');
                    if (hasTrim) {
                      return prev.map((op) =>
                        op.type === 'trim' ? { ...op, start: newSel.start, end: newSel.end } : op
                      );
                    }
                    return [
                      ...prev,
                      {
                        type: 'trim',
                        trackId: activeTrack?.id || 'track_1',
                        start: newSel.start,
                        end: newSel.end,
                      },
                    ];
                  });
                }}
              />
            </div>
          ) : null}

          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', margin: '1.25rem 0 0.85rem' }}>
            Is this correct?
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn-big btn-big-primary"
              onClick={() => {
                stopVoiceFeedback();
                executeProcessing(pendingOperations);
              }}
            >
              <CheckCircle size={22} />
              Yes, Make My Song
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-big btn-big-secondary"
                onClick={() => {
                  stopVoiceFeedback();
                  handleMicTap();
                }}
              >
                <Mic size={18} />
                Speak Again
              </button>

              <button
                className="btn-big btn-big-secondary"
                onClick={() => {
                  stopVoiceFeedback();
                  setStage('HOME');
                  setTypedInput(finalTranscript);
                }}
              >
                <Edit3 size={18} />
                Change
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STAGE: CLARIFICATION (Ambiguity Guardrail) */}
      {stage === 'CLARIFICATION' && interpretation?.status === 'needs_clarification' && (
        <section className="aesthetic-card">
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '2.75rem', marginBottom: '0.3rem' }}>🤔</div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              {interpretation.question || 'What would you like to change?'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
              Tap an option below:
            </p>
          </div>

          <div className="clarification-chips">
            {interpretation.possibleOptions?.map((opt, idx) => (
              <button
                key={idx}
                className="clarification-btn"
                onClick={() => {
                  stopVoiceFeedback();
                  setInputSource('preset');
                  setPendingOperations([opt.operationDraft]);
                  setStage('CONFIRMATION');
                }}
              >
                <span>{opt.label}</span>
                <ChevronRight size={20} color="var(--accent-coral)" />
              </button>
            ))}

            <button
              className="clarification-btn"
              style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
              onClick={() => {
                stopVoiceFeedback();
                handleMicTap();
              }}
            >
              <span>🎙️ Tell us in different words</span>
              <ChevronRight size={20} color="var(--accent-coral)" />
            </button>
          </div>

          <button
            className="btn-big btn-big-secondary"
            onClick={() => {
              stopVoiceFeedback();
              setStage('HOME');
            }}
          >
            Cancel
          </button>
        </section>
      )}

      {/* STAGE: HOME & RECORDING */}
      {(stage === 'HOME' || stage === 'RECORDING') && (
        <>
          {/* Hero Heading */}
          <div className="hero">
            <h1 className="hero-title">Make Your Song Perfect</h1>
            <p className="hero-subtitle">
              Cut, join or edit your song — just tell us what you want.
            </p>
          </div>

          {/* Big Voice Card */}
          <section className="aesthetic-card voice-card">
            {/* Language Selector */}
            <div className="lang-selector">
              <span style={{ color: 'var(--text-muted)', paddingLeft: '0.4rem' }}>
                🎙️ Speak in:
              </span>
              <button
                className={`lang-btn ${language === 'auto' ? 'active' : ''}`}
                onClick={() => setLanguage('auto')}
              >
                Auto Detect
              </button>
              <button
                className={`lang-btn ${language === 'en-IN' ? 'active' : ''}`}
                onClick={() => setLanguage('en-IN')}
              >
                English
              </button>
              <button
                className={`lang-btn ${language === 'hi-IN' ? 'active' : ''}`}
                onClick={() => setLanguage('hi-IN')}
              >
                हिन्दी
              </button>
              <button
                className={`lang-btn ${language === 'mr-IN' ? 'active' : ''}`}
                onClick={() => setLanguage('mr-IN')}
              >
                मराठी
              </button>
            </div>

            {/* Microphone Button */}
            <div className="mic-btn-container">
              {stage === 'RECORDING' ? (
                <button
                  className="mic-button recording"
                  onClick={handleStopRecording}
                  aria-label="Stop recording"
                >
                  <Square size={38} fill="#ffffff" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, marginTop: '2px' }}>
                    STOP
                  </span>
                </button>
              ) : (
                <button
                  className="mic-button"
                  onClick={handleMicTap}
                  aria-label="Tap to speak"
                >
                  <Mic size={48} />
                </button>
              )}
            </div>

            {/* Label & Status */}
            {stage === 'RECORDING' ? (
              <div>
                <div className="mic-label" style={{ color: '#ef4444' }}>
                  Listening to you...
                </div>
                <div className="timer-pill">
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      display: 'inline-block',
                    }}
                  />
                  {recordingTime}
                </div>
              </div>
            ) : (
              <div>
                <div className="mic-label">Tap to Speak</div>
                <div className="mic-hint">
                  Say: &ldquo;Pehle 30 second hata do aur end mein fade kar do&rdquo;
                </div>
              </div>
            )}

            {/* Live Transcript Bubble */}
            {stage === 'RECORDING' && (
              <div className="live-transcript-bubble">
                <div className="transcript-label">I am hearing:</div>
                <div>{liveTranscript || 'Listening for your voice...'}</div>
              </div>
            )}

            {/* Speech error notice */}
            {speechError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: '16px',
                  padding: '0.85rem 1.25rem',
                  fontSize: '0.92rem',
                  marginTop: '1.25rem',
                  width: '100%',
                }}
              >
                {speechError}
              </div>
            )}
          </section>

          {/* Song Card / Upload Section */}
          <section className="aesthetic-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Your Songs ({tracks.length})</h2>
              {tracks.length === 0 && (
                <button
                  onClick={addInstantSampleSong}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-coral)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Sparkles size={16} />
                  Use Sample Song
                </button>
              )}
            </div>

            {tracks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn-big btn-big-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={22} color="var(--accent-coral)" />
                  Choose a Song (MP3 / WAV)
                </button>

                <button
                  className="btn-big btn-big-secondary"
                  style={{
                    background: '#f5f3ff',
                    borderColor: '#ddd6fe',
                    color: '#6d28d9',
                  }}
                  onClick={() => videoFileInputRef.current?.click()}
                >
                  <Video size={22} color="#7c3aed" />
                  Extract Audio from Video (MP4 / MOV)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {tracks.map((track, idx) => {
                  const sel = trackSelections[track.id] || {
                    start: 0,
                    end: track.duration || 60,
                    isCustomized: false,
                  };
                  const isExpanded = expandedTrackId === track.id;
                  const durationSec = Math.max(1, Math.round(sel.end - sel.start));
                  const formatCutTime = (s: number) => {
                    const m = Math.floor(s / 60);
                    const sec = Math.floor(s % 60);
                    return `${m}:${String(sec).padStart(2, '0')}`;
                  };

                  return (
                    <div
                      key={track.id}
                      className={`song-card ${isExpanded ? 'expanded' : ''}`}
                    >
                      <div className="song-card-main">
                        {/* Order Controls if 2+ tracks */}
                        {tracks.length > 1 && (
                          <div className="song-order-col">
                            <button
                              type="button"
                              className="song-order-btn"
                              disabled={idx === 0}
                              onClick={() => moveTrack(idx, idx - 1)}
                              title="Move song up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <span className="song-badge-num">#{idx + 1}</span>
                            <button
                              type="button"
                              className="song-order-btn"
                              disabled={idx === tracks.length - 1}
                              onClick={() => moveTrack(idx, idx + 1)}
                              title="Move song down"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        )}

                        <div className="song-icon">
                          {track.isVideo ? <Video size={20} color="#7c3aed" /> : <Music size={20} />}
                        </div>

                        <div className="song-details">
                          <div
                            className="song-name"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{track.filename}</span>
                            {track.isVideo && (
                              <span
                                style={{
                                  background: '#ede9fe',
                                  color: '#6d28d9',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.5rem',
                                  borderRadius: '9999px',
                                }}
                              >
                                🎬 Audio from Video
                              </span>
                            )}
                          </div>

                          <div className="song-duration">
                            <span>
                              Full: {Math.floor(track.duration / 60)}:
                              {String(Math.floor(track.duration % 60)).padStart(2, '0')}m
                            </span>
                            {sel.isCustomized && (
                              <span className="song-cut-badge">
                                ✂️ Cut: {formatCutTime(sel.start)} → {formatCutTime(sel.end)} ({durationSec}s)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="song-actions-right">
                          <button
                            type="button"
                            className={`btn-choose-part ${isExpanded ? 'active' : ''}`}
                            onClick={() => {
                              stopVoiceFeedback();
                              setExpandedTrackId(isExpanded ? null : track.id);
                              setActiveTrackId(track.id);
                            }}
                            title="Choose part of this song"
                          >
                            <Scissors size={14} />
                            <span>{isExpanded ? 'Hide' : 'Choose Part'}</span>
                          </button>

                          <button
                            className="icon-btn"
                            onClick={() => removeTrack(track.id)}
                            title="Remove song"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Waveform Drawer */}
                      {isExpanded && (
                        <div className="song-waveform-drawer">
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.35rem',
                            }}
                          >
                            <span>✂️ Slide handles to choose which part to keep:</span>
                            <span style={{ color: 'var(--accent-coral)', fontWeight: 800 }}>
                              Selected: {durationSec}s ({formatCutTime(sel.start)} to {formatCutTime(sel.end)})
                            </span>
                          </div>

                          <WaveformVisualizer
                            audioFile={track.file || null}
                            duration={track.duration || 60}
                            selection={{ start: sel.start, end: sel.end }}
                            onSelectionChange={(newSel) => {
                              stopVoiceFeedback();
                              setTrackSelections((prev) => ({
                                ...prev,
                                [track.id]: { ...newSel, isCustomized: true },
                              }));
                            }}
                          />

                          {/* Quick Preset Buttons */}
                          <div className="preset-chips-row">
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Quick Cuts:
                            </span>
                            <button
                              type="button"
                              className="preset-chip-btn"
                              onClick={() => {
                                stopVoiceFeedback();
                                setTrackSelections((prev) => ({
                                  ...prev,
                                  [track.id]: { start: 0, end: track.duration || 60, isCustomized: false },
                                }));
                              }}
                            >
                              Full Song
                            </button>
                            <button
                              type="button"
                              className="preset-chip-btn"
                              onClick={() => {
                                stopVoiceFeedback();
                                setTrackSelections((prev) => ({
                                  ...prev,
                                  [track.id]: {
                                    start: 0,
                                    end: Math.min(30, track.duration || 60),
                                    isCustomized: true,
                                  },
                                }));
                              }}
                            >
                              First 30s
                            </button>
                            <button
                              type="button"
                              className="preset-chip-btn"
                              onClick={() => {
                                stopVoiceFeedback();
                                const dur = track.duration || 60;
                                const mid = Math.floor(dur / 2);
                                setTrackSelections((prev) => ({
                                  ...prev,
                                  [track.id]: {
                                    start: Math.max(0, mid - 15),
                                    end: Math.min(dur, mid + 15),
                                    isCustomized: true,
                                  },
                                }));
                              }}
                            >
                              Middle 30s
                            </button>
                            <button
                              type="button"
                              className="preset-chip-btn"
                              onClick={() => {
                                stopVoiceFeedback();
                                const dur = track.duration || 60;
                                setTrackSelections((prev) => ({
                                  ...prev,
                                  [track.id]: {
                                    start: Math.max(0, dur - 30),
                                    end: dur,
                                    isCustomized: true,
                                  },
                                }));
                              }}
                            >
                              Last 30s
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Master Blending & Crossfade Panel when 2+ songs are present */}
                {tracks.length >= 2 && (
                  <div className="medley-panel">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Sparkles size={18} color="var(--accent-coral)" />
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          Mix & Join {tracks.length} Songs:
                        </span>
                      </div>
                    </div>

                    {/* Simple & Clean Finishing Options */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {/* Ending Fade Out Toggle */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={medleyFadeOut}
                            onChange={(e) => setMedleyFadeOut(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)' }}
                          />
                          <span>✨ Smooth fade-out at ending</span>
                        </label>

                        {medleyFadeOut && (
                          <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                            {[1, 3, 5].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                className="preset-chip-btn"
                                style={{
                                  padding: '0.15rem 0.5rem',
                                  fontSize: '0.72rem',
                                  fontWeight: medleyFadeOutDuration === sec ? 700 : 500,
                                  background: medleyFadeOutDuration === sec ? '#ffedd5' : 'transparent',
                                  borderColor:
                                    medleyFadeOutDuration === sec ? 'var(--accent-coral)' : 'var(--border-subtle)',
                                  color: medleyFadeOutDuration === sec ? 'var(--accent-coral)' : 'var(--text-muted)',
                                }}
                                onClick={() => setMedleyFadeOutDuration(sec)}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Gentle Intro Fade-In Toggle */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={medleyFadeIn}
                            onChange={(e) => setMedleyFadeIn(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)' }}
                          />
                          <span>🎵 Gentle fade-in at start (2s)</span>
                        </label>
                      </div>

                      {/* Transition Crossfade Duration */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          borderTop: '1px dashed rgba(0, 0, 0, 0.08)',
                          paddingTop: '0.45rem',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Crossfade blend speed:
                        </span>
                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          {[
                            { sec: 2, label: '⚡ 2s (Quick)' },
                            { sec: 3, label: '🎶 3s (Standard)' },
                            { sec: 5, label: '🌊 5s (Long)' },
                          ].map((item) => (
                            <button
                              key={item.sec}
                              type="button"
                              className="preset-chip-btn"
                              style={{
                                padding: '0.16rem 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: medleyBlendDuration === item.sec ? 700 : 500,
                                background: medleyBlendDuration === item.sec ? '#ffedd5' : 'transparent',
                                borderColor:
                                  medleyBlendDuration === item.sec ? 'var(--accent-coral)' : 'var(--border-subtle)',
                                color:
                                  medleyBlendDuration === item.sec ? 'var(--accent-coral)' : 'var(--text-muted)',
                              }}
                              onClick={() => setMedleyBlendDuration(item.sec)}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-big btn-big-primary"
                      style={{
                        background: 'linear-gradient(135deg, #f97316, #ec4899)',
                        minHeight: '50px',
                        boxShadow: '0 8px 20px -4px rgba(236, 72, 153, 0.35)',
                      }}
                      onClick={() => handleBlendSelectedCuts(true)}
                    >
                      <Sparkles size={20} />
                      Blend Selected Cuts ({medleyBlendDuration}s Smooth Crossfade)
                    </button>

                    <button
                      type="button"
                      className="btn-big btn-big-secondary"
                      style={{
                        minHeight: '46px',
                        background: '#ffffff',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                      }}
                      onClick={() => handleBlendSelectedCuts(false)}
                    >
                      <span>🔗</span>
                      Join Selected Cuts (Standard Mix)
                    </button>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                      💡 Tip: Use &ldquo;Choose Part&rdquo; above to select the favorite part of each song before mixing!
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    className="btn-big btn-big-secondary"
                    style={{ minHeight: '48px', fontSize: '0.92rem', flex: 1 }}
                    onClick={() => multiFileInputRef.current?.click()}
                  >
                    <Plus size={18} />
                    Add Song
                  </button>

                  <button
                    className="btn-big btn-big-secondary"
                    style={{
                      minHeight: '48px',
                      fontSize: '0.92rem',
                      flex: 1,
                      background: '#f5f3ff',
                      borderColor: '#ddd6fe',
                      color: '#6d28d9',
                    }}
                    onClick={() => videoFileInputRef.current?.click()}
                  >
                    <Video size={18} color="#7c3aed" />
                    Add Video
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.mp4,.mov,.webm,.mkv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.webm,.mkv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <input
              ref={multiFileInputRef}
              type="file"
              multiple
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.mp4,.mov,.webm,.mkv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </section>

          {/* Typing Search Section (Always Accessible) */}
          <section className="aesthetic-card" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem', fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
              Or type your instruction:
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typedInput.trim()) {
                  stopVoiceFeedback();
                  setInputSource('typed');
                  evaluateInstruction(typedInput, false);
                }
              }}
              className="typed-input-wrapper"
            >
              <input
                type="text"
                className="typed-input"
                placeholder='e.g. "Pehle 30 second hata do", "Keep 30 seconds to 1 minute"'
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn-big btn-big-primary"
                style={{ width: 'auto', minWidth: '85px', minHeight: '52px' }}
              >
                Go
              </button>
            </form>

            {/* Quick Chips */}
            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.5rem',
                }}
              >
                Try saying or tapping:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('Pehle 30 second hata do aur end mein 5 second fade kar do', false);
                  }}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  ✂️ &ldquo;Pehle 30s hata do & fade end&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('पहले 30 सेकंड हटा दो', false);
                  }}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  ✂️ &ldquo;पहले 30 सेकंड हटा दो&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('30 सेकंड से 1 मिनट तक रखो', false);
                  }}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  ✨ &ldquo;30 सेकंड से 1 मिनट तक रखो&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('Pehle 30 second hata do aur end mein 5 second fade kar do', false);
                  }}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  🎵 &ldquo;Pehle 30s hata do & fade end&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('दोनों गाने जोड़ दो', false);
                  }}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    cursor: 'pointer',
                  }}
                >
                  🎶 &ldquo;दोनों गाने जोड़ दो&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('dono gane smoothly jod do crossfade', false);
                  }}
                  style={{
                    background: 'rgba(236, 72, 153, 0.08)',
                    border: '1px solid rgba(236, 72, 153, 0.25)',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#be185d',
                    cursor: 'pointer',
                  }}
                >
                  ✨ &ldquo;Smooth Crossfade DJ Mix&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopVoiceFeedback();
                    setInputSource('preset');
                    evaluateInstruction('इसको अच्छा बना दो', false);
                  }}
                  style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '9999px',
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#c2410c',
                    cursor: 'pointer',
                  }}
                >
                  ❓ &ldquo;इसको अच्छा बना दो&rdquo;
                </button>
              </div>
            </div>
          </section>

          {/* Quick Alternative Shortcuts (Visually Secondary) */}
          <div style={{ margin: '0.25rem 0' }}>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.5rem',
                textAlign: 'center',
              }}
            >
              Or choose what you want to do:
            </div>
            <div className="shortcuts-grid">
              <div
                className="shortcut-card"
                onClick={() => {
                  stopVoiceFeedback();
                  if (tracks.length === 0) {
                    alert('Please choose a song first!');
                    fileInputRef.current?.click();
                  } else {
                    setInputSource('preset');
                    evaluateInstruction('keep 30 seconds to 60 seconds', false);
                  }
                }}
              >
                <div className="shortcut-icon">✂️</div>
                <div className="shortcut-title">Cut a Song</div>
              </div>

              <div
                className="shortcut-card"
                onClick={() => {
                  stopVoiceFeedback();
                  if (tracks.length < 2) {
                    alert('Please add at least 2 songs to join them!');
                    multiFileInputRef.current?.click();
                  } else {
                    setInputSource('preset');
                    evaluateInstruction('merge these songs', false);
                  }
                }}
              >
                <div className="shortcut-icon">🎶</div>
                <div className="shortcut-title">Join Songs</div>
              </div>
            </div>
          </div>

          {/* Privacy Badge */}
          <div className="privacy-badge">
            <Lock size={18} />
            <span>Your song stays private · Edits are processed right on your device.</span>
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Ultra-fast pure PCM WAV generator (<5ms, zero async audio context delay)
 */
function createFastSampleWav(durationSeconds = 60): Blob {
  const sampleRate = 22050;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write pleasant musical tone
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample =
      0.22 * (Math.sin(2 * Math.PI * 261.63 * t) + Math.sin(2 * Math.PI * 329.63 * t) + Math.sin(2 * Math.PI * 392.0 * t));
    view.setInt16(offset, Math.floor(sample * 32767), true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
