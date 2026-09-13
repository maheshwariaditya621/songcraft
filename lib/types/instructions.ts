/**
 * Natural Language / Instruction Layer Types
 * Allows interchangeable instruction interpreters (Rule-based, LLM, Voice, WhatsApp)
 */

import { AudioOperation, AudioTrack } from './audio';

export interface InstructionContext {
  tracks: AudioTrack[];
  activeTrackId?: string;
  previousOperations?: AudioOperation[];
}

export type InterpretationStatus = 'success' | 'needs_clarification' | 'unsupported';

export interface ClarificationOption {
  label: string;
  operationDraft: AudioOperation;
}

export interface InterpretationSuccess {
  status: 'success';
  operations: AudioOperation[];
  explanation: string;
  matchedPattern?: string;
  confidence: number; // 0.0 to 1.0
}

export interface InterpretationClarification {
  status: 'needs_clarification';
  question: string;
  reason: string;
  possibleOptions?: ClarificationOption[];
}

export interface InterpretationUnsupported {
  status: 'unsupported';
  message: string;
  suggestion?: string;
}

export type InterpretationResult =
  | InterpretationSuccess
  | InterpretationClarification
  | InterpretationUnsupported;

/**
 * Universal Interface for converting natural language or speech instructions
 * into verified AudioOperation objects.
 */
export interface InstructionInterpreter {
  name: string;
  version: string;
  interpret(
    input: string,
    context: InstructionContext
  ): Promise<InterpretationResult> | InterpretationResult;
}
