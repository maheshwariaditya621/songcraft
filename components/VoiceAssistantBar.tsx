'use client';

import React, { useState, useEffect } from 'react';
import { Mic, Square, Sparkles, Send, Volume2, ChevronUp, ChevronDown } from 'lucide-react';
import { defaultVoiceController } from '@/lib/voice/voice-controller';
import { SpeechLanguage, SpeechError } from '@/lib/voice/speech-types';
import { defaultInstructionEngine } from '@/lib/instructions/instruction-engine';
import { AudioTrack, AudioOperation } from '@/lib/types/audio';

interface VoiceAssistantBarProps {
  tracks: AudioTrack[];
  onOperationsSuggested: (ops: AudioOperation[], explanation: string) => void;
  contextHint?: string;
}

export function VoiceAssistantBar({
  tracks,
  onOperationsSuggested,
  contextHint = 'Say e.g.: "Cut first 30 seconds" or "End mein fade out kar do"',
}: VoiceAssistantBarProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [language, setLanguage] = useState<SpeechLanguage>('auto');
  const [transcript, setTranscript] = useState<string>('');
  const [typedInput, setTypedInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    defaultVoiceController.setListener({
      onTranscriptUpdate: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          handleProcessCommand(text);
        }
      },
      onTimeUpdate: () => {},
      onError: (err: SpeechError) => {
        setStatusMessage(err.message);
        setIsListening(false);
      },
    });
  }, [tracks]);

  const handleStartListening = async () => {
    if (tracks.length === 0) {
      setStatusMessage('🎵 Please add or select an audio track first!');
      setIsExpanded(true);
      return;
    }

    setStatusMessage(null);
    setTranscript('');
    setIsListening(true);
    setIsExpanded(true);
    await defaultVoiceController.startListening({ language });
  };

  const handleStopListening = async () => {
    setIsListening(false);
    const finalTxt = await defaultVoiceController.stopListening();
    const effective = finalTxt || transcript;
    if (effective.trim()) {
      handleProcessCommand(effective);
    }
  };

  const handleProcessCommand = async (cmd: string) => {
    if (!cmd.trim() || tracks.length === 0) return;

    try {
      const activeTrack = tracks[0];
      const interpretation = await defaultInstructionEngine.interpret(cmd, {
        activeTrackId: activeTrack.id,
        tracks: tracks,
      });

      if (interpretation.status === 'success' && interpretation.operations.length > 0) {
        setStatusMessage(`✨ Understood: "${interpretation.explanation}"`);
        onOperationsSuggested(interpretation.operations, interpretation.explanation);
      } else if (interpretation.status === 'needs_clarification') {
        setStatusMessage(`❓ ${interpretation.question}`);
      } else {
        setStatusMessage(`Could not recognize command: "${cmd}". Try e.g. "Cut first 30s".`);
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Error parsing command');
    }
  };

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedInput.trim()) {
      handleProcessCommand(typedInput);
      setTypedInput('');
    }
  };

  return (
    <div className="voice-assistant-bar">
      <div className="assistant-bar-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="assistant-title-group">
          <div className="assistant-glow-icon">
            <Sparkles size={16} color="#f97316" />
          </div>
          <div>
            <span className="assistant-main-text">AI Voice & Plain Language Helper</span>
            <span className="assistant-sub-text">Speak or type in Hindi / English</span>
          </div>
        </div>

        <div className="assistant-toggle-btn">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </div>
      </div>

      {isExpanded && (
        <div className="assistant-bar-body">
          <div className="assistant-languages">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Language:</span>
            <button
              className={`mini-lang-pill ${language === 'auto' ? 'active' : ''}`}
              onClick={() => setLanguage('auto')}
            >
              Auto
            </button>
            <button
              className={`mini-lang-pill ${language === 'hi-IN' ? 'active' : ''}`}
              onClick={() => setLanguage('hi-IN')}
            >
              हिन्दी
            </button>
            <button
              className={`mini-lang-pill ${language === 'en-IN' ? 'active' : ''}`}
              onClick={() => setLanguage('en-IN')}
            >
              English
            </button>
            <button
              className={`mini-lang-pill ${language === 'mr-IN' ? 'active' : ''}`}
              onClick={() => setLanguage('mr-IN')}
            >
              मराठी
            </button>
          </div>

          <div className="assistant-input-row">
            {isListening ? (
              <button
                className="mic-circle-btn recording"
                onClick={handleStopListening}
                title="Stop listening"
              >
                <Square size={18} fill="#ffffff" />
              </button>
            ) : (
              <button
                className="mic-circle-btn"
                onClick={handleStartListening}
                title="Tap to speak in your language"
              >
                <Mic size={20} />
              </button>
            )}

            <form onSubmit={handleTypedSubmit} className="assistant-text-form">
              <input
                type="text"
                className="assistant-text-input"
                placeholder={isListening ? 'Listening to your voice...' : contextHint}
                value={isListening ? transcript : typedInput}
                onChange={e => setTypedInput(e.target.value)}
                disabled={isListening}
              />
              <button type="submit" className="assistant-send-btn" disabled={!typedInput.trim()}>
                <Send size={15} />
              </button>
            </form>
          </div>

          {statusMessage && <div className="assistant-status-notice">{statusMessage}</div>}
        </div>
      )}
    </div>
  );
}
