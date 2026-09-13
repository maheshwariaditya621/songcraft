import {
  InstructionContext,
  InstructionInterpreter,
  InterpretationResult,
} from '../types/instructions';
import { RuleBasedInstructionInterpreter } from './rule-parser';

/**
 * InstructionEngine
 *
 * Facade coordinating one or more InstructionInterpreters.
 * In V1, it uses RuleBasedInstructionInterpreter (deterministic, ₹0 cost).
 * In future phases, LLMInstructionInterpreter or VoiceInstructionInterpreter
 * can be plugged in without changing the audio engine.
 */
export class InstructionEngine {
  private primaryInterpreter: InstructionInterpreter;

  constructor(interpreter?: InstructionInterpreter) {
    this.primaryInterpreter = interpreter || new RuleBasedInstructionInterpreter();
  }

  public setInterpreter(interpreter: InstructionInterpreter): void {
    this.primaryInterpreter = interpreter;
  }

  public getInterpreterName(): string {
    return this.primaryInterpreter.name;
  }

  public async interpret(
    input: string,
    context: InstructionContext
  ): Promise<InterpretationResult> {
    return this.primaryInterpreter.interpret(input, context);
  }
}

// Global default singleton instance
export const defaultInstructionEngine = new InstructionEngine();
