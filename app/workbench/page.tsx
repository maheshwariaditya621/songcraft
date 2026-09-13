'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AudioTrack,
  AudioOperation,
  ProcessingResult,
  OutputAudioFormat,
} from '@/lib/types/audio';
import { InterpretationResult } from '@/lib/types/instructions';
import { defaultInstructionEngine } from '@/lib/instructions/instruction-engine';
import { defaultAudioEngine } from '@/lib/audio/audio-engine';
import { extractAudioMetadata } from '@/lib/audio/metadata';
import {
  Music,
  Upload,
  Play,
  Download,
  Terminal as TerminalIcon,
  Sparkles,
  Layers,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  Trash2,
  PlusCircle,
} from 'lucide-react';

export default function AudioWorkbench() {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string>('');
  const [instruction, setInstruction] = useState<string>('');
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputAudioFormat>('mp3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [engineLogs]);

  // Handle instruction input changes
  const handleInstructionChange = (text: string) => {
    setInstruction(text);
    if (!text.trim()) {
      setInterpretation(null);
      return;
    }

    const res = defaultInstructionEngine.interpret(text, {
      tracks,
      activeTrackId,
    });
    // Can be a Promise or synchronous result
    Promise.resolve(res).then((r) => setInterpretation(r));
  };

  // Re-interpret whenever tracks or active track changes
  useEffect(() => {
    if (instruction.trim()) {
      handleInstructionChange(instruction);
    }
  }, [tracks, activeTrackId]);

  // Handle File Upload
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTracks: AudioTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = await extractAudioMetadata(file, file.name);
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
      });
    }

    setTracks((prev) => {
      const updated = [...prev, ...newTracks];
      if (!activeTrackId && updated.length > 0) {
        setActiveTrackId(updated[0].id);
      }
      return updated;
    });
  };

  // Quick generator for synthetic test audio (e.g. 90-second test tones)
  const generateSyntheticAudio = async (name: string, durationSeconds = 90) => {
    const sampleRate = 44100;
    const numChannels = 2;
    const length = sampleRate * durationSeconds;

    const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, 0); // A4
    // Slight vibrato / frequency ramp so audio is clearly audible
    osc.frequency.linearRampToValueAtTime(880, durationSeconds);
    gain.gain.setValueAtTime(0.3, 0);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start();
    const audioBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV Blob
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    const file = new File([wavBlob], `${name}.wav`, { type: 'audio/wav' });

    const trackId = `track_${Date.now()}`;
    const blobUrl = URL.createObjectURL(file);

    const newTrack: AudioTrack = {
      id: trackId,
      filename: `${name}.wav`,
      duration: durationSeconds,
      format: 'wav',
      size: wavBlob.size,
      metadata: {
        duration: durationSeconds,
        format: 'wav',
        size: wavBlob.size,
        sampleRate,
        channels: numChannels,
      },
      blobUrl,
      file,
    };

    setTracks((prev) => {
      const updated = [...prev, newTrack];
      if (!activeTrackId) setActiveTrackId(trackId);
      return updated;
    });
  };

  // Run the Audio Engine
  const executeProcessing = async (operations: AudioOperation[]) => {
    if (tracks.length === 0) {
      alert('Please upload or generate at least one audio track first.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setEngineLogs([
      `[Workbench] Starting audio processing pipeline...`,
      `[Workbench] Active tracks: ${tracks.length}, Operations: ${operations.length}`,
    ]);

    try {
      const res = await defaultAudioEngine.processAudio(
        {
          tracks,
          operations,
          outputFormat,
        },
        (p) => setProgress(p),
        (msg) => setEngineLogs((prev) => [...prev, msg])
      );

      setResult(res);
      if (res.success) {
        setIsEngineReady(true);
        setEngineLogs((prev) => [
          ...prev,
          `[Workbench] Successfully generated: ${res.output?.filename} (${(res.output?.size! / 1024).toFixed(1)} KB)`,
        ]);
      } else {
        setEngineLogs((prev) => [
          ...prev,
          `[Workbench Error] ${res.error?.message}`,
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEngineLogs((prev) => [...prev, `[Fatal Error] ${msg}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      if (activeTrackId === id) {
        setActiveTrackId(updated.length > 0 ? updated[0].id : '');
      }
      return updated;
    });
  };

  return (
    <main className="container">
      {/* Top Header */}
      <header className="header">
        <div>
          <div className="title-badge">
            <Sparkles size={13} />
            Audio Engine Foundation (V1)
          </div>
          <h1 className="main-title">Audio Editing Engine</h1>
          <p className="subtitle">
            &ldquo;Don&apos;t learn audio editing. Just tell us what you want.&rdquo; — Browser-first
            FFmpeg.wasm audio engine with deterministic natural language parsing.
          </p>
        </div>

        <div className="cost-badge">
          <CheckCircle2 size={16} />
          ₹0 Infrastructure Cost · 100% In-Browser
        </div>
      </header>

      {/* Grid: Left Column = Tracks & Input; Right Column = Interpreter & Processing */}
      <div className="grid-2">
        {/* Left Column: Track Management */}
        <section>
          {/* Audio Tracks Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Music size={20} color="#38bdf8" />
                Audio Tracks ({tracks.length})
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => generateSyntheticAudio(`Test_Song_${tracks.length + 1}`, 90)}
                  title="Generate a 90-second test audio tone without uploading local files"
                >
                  <PlusCircle size={14} />
                  + Test Tone
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesAdded(e.dataTransfer.files);
              }}
            >
              <div className="dropzone-icon">
                <Upload size={22} />
              </div>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Click to select MP3 / WAV / M4A
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Files are processed locally in your browser. Nothing is uploaded to any server.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac"
                style={{ display: 'none' }}
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
            </div>

            {/* Track List */}
            {tracks.length > 0 && (
              <div className="track-list">
                {tracks.map((track) => {
                  const isActive = track.id === activeTrackId;
                  return (
                    <div
                      key={track.id}
                      className={`track-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveTrackId(track.id)}
                    >
                      <div className="track-info">
                        <span className="track-name">{track.filename}</span>
                        <div className="track-meta">
                          <span>⏱️ {track.duration}s</span>
                          <span>📦 {(track.size / (1024 * 1024)).toFixed(2)} MB</span>
                          <span style={{ textTransform: 'uppercase' }}>🎵 {track.format}</span>
                          {isActive && (
                            <span style={{ color: '#60a5fa', fontWeight: 600 }}>[Active]</span>
                          )}
                        </div>
                        {track.blobUrl && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <audio controls src={track.blobUrl} preload="metadata" />
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.4rem', border: 'none', color: '#f87171' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(track.id);
                        }}
                        title="Remove track"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Natural Language Instruction Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Sparkles size={20} color="#a78bfa" />
                Tell Us What You Want
              </h2>
            </div>

            <div className="instruction-input-wrapper">
              <input
                type="text"
                className="instruction-input"
                placeholder='e.g. "keep 30 seconds to 60 seconds", "pehle 30 second hata do"'
                value={instruction}
                onChange={(e) => handleInstructionChange(e.target.value)}
              />
            </div>

            {/* Quick Demo Instruction Chips */}
            <div className="quick-chips-wrapper">
              <div className="quick-chips-label">Quick Test Instructions:</div>
              <div className="quick-chips">
                <button
                  className="chip-btn"
                  onClick={() => handleInstructionChange('keep 30 seconds to 60 seconds')}
                >
                  &ldquo;keep 30 seconds to 60 seconds&rdquo;
                </button>
                <button
                  className="chip-btn"
                  onClick={() =>
                    handleInstructionChange('Remove first 30 seconds and fade out the ending')
                  }
                >
                  &ldquo;Remove first 30s & fade out ending&rdquo;
                </button>
                <button
                  className="chip-btn"
                  onClick={() => handleInstructionChange('Merge these two songs')}
                >
                  &ldquo;Merge these two songs&rdquo;
                </button>
                <button
                  className="chip-btn"
                  onClick={() => handleInstructionChange('fade in for 3 seconds')}
                >
                  &ldquo;fade in for 3 seconds&rdquo;
                </button>
                <button
                  className="chip-btn hinglish"
                  onClick={() => handleInstructionChange('pehle 30 second hata do')}
                >
                  🇮🇳 &ldquo;pehle 30 second hata do&rdquo;
                </button>
                <button
                  className="chip-btn hinglish"
                  onClick={() => handleInstructionChange('30 second se 1 minute tak rakho')}
                >
                  🇮🇳 &ldquo;30 second se 1 minute tak rakho&rdquo;
                </button>
                <button
                  className="chip-btn hinglish"
                  onClick={() => handleInstructionChange('last mein dheere dheere band karo')}
                >
                  🇮🇳 &ldquo;last mein dheere dheere band karo&rdquo;
                </button>
                <button
                  className="chip-btn"
                  style={{ color: '#f87171' }}
                  onClick={() => handleInstructionChange('make it sound like morning')}
                >
                  ❓ Test Ambiguity Guardrail
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Interpretation, Execution, Output */}
        <section>
          {/* Operation Schema & Clarification Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Layers size={20} color="#34d399" />
                Parsed AudioOperation Schema
              </h2>
              {interpretation && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    backgroundColor:
                      interpretation.status === 'success'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color:
                      interpretation.status === 'success'
                        ? '#34d399'
                        : '#fbbf24',
                    fontWeight: 600,
                  }}
                >
                  {interpretation.status}
                </span>
              )}
            </div>

            {/* If clarification needed */}
            {interpretation?.status === 'needs_clarification' && (
              <div className="alert alert-warning">
                <HelpCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Clarification Needed</div>
                  <div>{interpretation.question}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.3rem' }}>
                    Reason: {interpretation.reason}
                  </div>
                </div>
              </div>
            )}

            {/* If success */}
            {interpretation?.status === 'success' && (
              <div className="alert alert-success">
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{interpretation.explanation}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}>
                    Pattern: {interpretation.matchedPattern} · Confidence: {Math.round(interpretation.confidence * 100)}%
                  </div>
                </div>
              </div>
            )}

            {/* Operation JSON Viewer */}
            <div className="code-preview">
              <pre>
                {interpretation?.status === 'success'
                  ? JSON.stringify(interpretation.operations, null, 2)
                  : '// Type an instruction or click a quick chip to generate structured AudioOperations'}
              </pre>
            </div>

            {/* Execution Controls */}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Output Format:
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as OutputAudioFormat)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '0.5rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    fontWeight: 600,
                  }}
                >
                  <option value="mp3">MP3 (192kbps)</option>
                  <option value="wav">WAV (Lossless 16-bit)</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                style={{ flex: 1, minWidth: '180px', marginTop: '1.25rem' }}
                disabled={
                  isProcessing ||
                  tracks.length === 0 ||
                  interpretation?.status !== 'success'
                }
                onClick={() => {
                  if (interpretation?.status === 'success') {
                    executeProcessing(interpretation.operations);
                  }
                }}
              >
                <Play size={16} />
                {isProcessing ? 'Processing in Browser...' : 'Apply & Process Audio'}
              </button>
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-header">
                  <span>FFmpeg.wasm Audio Processing</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Generated Result & Playback Card */}
          {result?.success && result.output && (
            <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ color: '#34d399' }}>
                  <Volume2 size={20} />
                  Edited Audio Output
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Processed in {result.metrics?.processingTimeMs}ms
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <audio controls autoPlay src={result.output.blobUrl} />

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Duration</div>
                    <div style={{ fontWeight: 700 }}>{result.output.duration}s</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Size</div>
                    <div style={{ fontWeight: 700 }}>
                      {(result.output.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Format</div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                      {result.output.format}
                    </div>
                  </div>
                </div>

                <a
                  href={result.output.blobUrl}
                  download={result.output.filename}
                  className="btn btn-success"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={16} />
                  Download Edited Song ({result.output.format.toUpperCase()})
                </a>
              </div>
            </div>
          )}

          {/* Execution Log Terminal */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ fontSize: '0.95rem' }}>
                <TerminalIcon size={16} color="#94a3b8" />
                Live Execution Logs
              </h2>
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setEngineLogs([])}
              >
                Clear
              </button>
            </div>

            <div className="terminal mono" ref={terminalRef}>
              {engineLogs.length === 0 ? (
                <div style={{ color: '#475569' }}>Logs will appear here during processing...</div>
              ) : (
                engineLogs.map((line, idx) => {
                  let cls = 'terminal-line';
                  if (line.includes('[Workbench]') || line.includes('[Planner]')) cls += ' info';
                  else if (line.includes('Successfully') || line.includes('ready')) cls += ' success';
                  else if (line.includes('Error') || line.includes('Failure')) cls += ' error';
                  return (
                    <div key={idx} className={cls}>
                      {line}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Utility: Converts an AudioBuffer into a WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sample: number;
  let offset = 0;
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF chunk descriptor
  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');

  // FMT sub-chunk
  writeString('fmt ');
  setUint32(16); // subchunk1size (16 for PCM)
  setUint16(1); // audio format (1 = PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // Data sub-chunk
  writeString('data');
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}
