import { AudioOperation } from '../types/audio';
import {
  InstructionContext,
  InstructionInterpreter,
  InterpretationResult,
} from '../types/instructions';
import { parseTimeToSeconds } from './time-parser';

/**
 * RuleBasedInstructionInterpreter
 *
 * Deterministic parser for converting English, Hindi (Devanagari script),
 * and Hinglish natural language instructions into verified AudioOperations.
 *
 * If uncertain, strictly returns 'needs_clarification'.
 */
export class RuleBasedInstructionInterpreter implements InstructionInterpreter {
  public readonly name = 'RuleBasedInstructionInterpreter';
  public readonly version = '1.1.0';

  public interpret(input: string, context: InstructionContext): InterpretationResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return {
        status: 'needs_clarification',
        question: 'What would you like to do with the audio?',
        reason: 'Empty instruction received',
      };
    }

    let lower = trimmed.toLowerCase();

    // -------------------------------------------------------------
    // Conversational & Correction Normalization (Hindi & English):
    // "नहीं, 40 सेकंड से 1 मिनट तक" -> "40 सेकंड से 1 मिनट तक"
    // "इस गाने का पहले 30 सेकंड हटा दो" -> "पहले 30 सेकंड हटा दो"
    // -------------------------------------------------------------
    lower = lower.replace(
      /^(?:नहीं|ना|अरे\s*नहीं|nahi|nahin|no|wait|arre|arre\s+nahi)\s*[,.]?\s*/i,
      ''
    );
    lower = lower.replace(
      /^(?:इस\s+गाने\s+(?:का|को|से)|गाने\s+(?:का|को)|is\s+gaane\s+(?:ka|ko|se)|gaane\s+(?:ka|ko)|please|bhai|yaar|कृपया)\s*/i,
      ''
    );
    lower = lower.trim();

    const activeTrack =
      context.tracks.find((t) => t.id === context.activeTrackId) || context.tracks[0];
    const duration = activeTrack ? activeTrack.duration : 0;
    const trackId = activeTrack ? activeTrack.id : 'track_1';

    // -------------------------------------------------------------
    // Ambiguous requests (e.g. "Isko accha bana do", "इसको अच्छा बना दो", "make it better")
    // Explicitly prompt with friendly one-click choices
    // -------------------------------------------------------------
    if (
      /(?:अच्छा|बढ़िया|मस्त|परफेक्ट|accha|achha|badhiya|better|mast|perfect)\s*(?:बना\s*दो|कर\s*दो|करो|bana\s*do|kar\s*do|karo)?$/i.test(
        lower
      ) ||
      /(?:make\s+it\s+(?:sound\s+)?(?:better|good|nice|perfect))/i.test(lower) ||
      /(?:sound\s+(?:accha|better)\s*(?:karo|banao)?)/i.test(lower)
    ) {
      return {
        status: 'needs_clarification',
        question: 'What would you like to change in the song?',
        reason: 'Subjective / ambiguous request',
        possibleOptions: [
          {
            label: '🎚️ Make it louder (+30%)',
            operationDraft: { type: 'volume', trackId, value: 1.3 },
          },
          {
            label: '✂️ Shorten to 1 minute',
            operationDraft: {
              type: 'trim',
              trackId,
              start: 0,
              end: Math.min(60, duration > 0 ? duration : 60),
            },
          },
          {
            label: '🎵 Smooth the ending (5s)',
            operationDraft: { type: 'fade_out', trackId, duration: 5 },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // Compound command check: e.g. "remove first 30s and fade out ending"
    // or "पहले 30 सेकंड हटा दो और अंत में 5 सेकंड फेड कर दो"
    // -------------------------------------------------------------
    if (
      lower.includes(' and ') ||
      lower.includes(' aur ') ||
      lower.includes(' then ') ||
      lower.includes(' phir ') ||
      lower.includes(' और ') ||
      lower.includes(' फिर ')
    ) {
      const compoundResult = this.tryParseCompound(lower, context, trackId, duration);
      if (compoundResult) {
        return compoundResult;
      }
    }

    // -------------------------------------------------------------
    // 1. MERGE / JOIN SONGS (English, Devanagari Hindi, Hinglish)
    // "join these two songs", "दोनों गाने जोड़ दो", "dono gane jod do", "combine songs", "crossfade both songs"
    // -------------------------------------------------------------
    if (
      /(?:join|merge|combine|connect|crossfade|blend)\s+(?:these\s+)?(?:two\s+)?(?:songs?|tracks?|audios?)/i.test(
        lower
      ) ||
      /(?:दोनो|दोनों|dono|donon)\s+(?:गाने|गानों|सॉन्ग्स|ga?ane|songs?|tracks?)(?:\s+(?:smoothly|आसानी\s*से|स्मूथली))?\s+(?:जोड़\s*दो|मिला\s*दो|क्रॉसफेड|crossfade|jod|mil?a|ek\s+saath)\s*(?:do|karo|दो|करो)?/i.test(
        lower
      ) ||
      /^(?:join|merge|combine|crossfade|blend|जोड़ो|मिलाओ|क्रॉसफेड)\b/i.test(lower) ||
      /(?:गाने|सॉन्ग्स)\s*(?:जोड़\s*दो|मिला\s*दो|क्रॉसफेड\s*करो)/i.test(lower) ||
      /(?:crossfade|cross\s*fade|blend|smoothly\s+join|स्मूथली\s*(?:जोड़\s*दो|मिला\s*दो))/i.test(lower)
    ) {
      if (context.tracks.length < 2) {
        return {
          status: 'needs_clarification',
          question: 'Please add at least two songs to join them together.',
          reason: 'Fewer than 2 tracks loaded in the project',
        };
      }

      const wantsCrossfade =
        /(?:crossfade|cross-fade|cross\s+fade|smoothly|blend|स्मूथली|क्रॉसफेड|आसानी\s*से|घुलकर)/i.test(lower);

      const op: AudioOperation = wantsCrossfade
        ? {
            type: 'merge',
            tracks: context.tracks.map((t) => t.id),
            crossfade: true,
            crossfadeDuration: 3,
          }
        : {
            type: 'merge',
            tracks: context.tracks.map((t) => t.id),
          };

      return {
        status: 'success',
        operations: [op],
        explanation: wantsCrossfade
          ? `Join all ${context.tracks.length} songs with a smooth 3-second musical crossfade.`
          : `Join all ${context.tracks.length} songs sequentially.`,
        matchedPattern: wantsCrossfade ? 'merge_tracks_crossfade' : 'merge_tracks',
        confidence: 0.98,
      };
    }

    // -------------------------------------------------------------
    // 2. TRIM: CUT FIRST X SECONDS (English, Devanagari Hindi, Hinglish)
    // "cut first 30 seconds", "remove first 20 seconds", "delete first 30s"
    // "पहले 30 सेकंड हटा दो", "pehle 30 second hata do", "first 30 seconds remove"
    // "शुरू के 20 सेकंड काट दो", "starting ke 20s cut kar do"
    // -------------------------------------------------------------
    const cutFirstRegexes = [
      /(?:cut|remove|delete|drop|trim)\s+(?:the\s+)?(?:first|initial|starting)\s+([^,]+?)(?:\s+from\s+the\s+start|\s+from\s+beginning)?$/i,
      /(?:first|initial|starting)\s+([^,]+?)\s+(?:remove|cut|delete|drop)$/i,
      /(?:पहले|शुरू\s*के?|स्टार्टिंग\s*के?|शुरुआती|pehle|shuru\s+ke?|starting\s+ke?)\s+([^,]+?)\s*(?:हटा\s*दो|हटाओ|काट\s*दो|काटो|हटा\s*दें|निकाल\s*दो|hata\s*do|kaat\s*do|cut\s*kar\s*do|delete\s*kar\s*do|remove\s*kar\s*do)/i,
    ];

    for (const rx of cutFirstRegexes) {
      const match = lower.match(rx);
      if (match && match[1]) {
        const cutSeconds = parseTimeToSeconds(match[1]);
        if (cutSeconds !== null && cutSeconds > 0) {
          if (duration > 0 && cutSeconds >= duration) {
            return {
              status: 'needs_clarification',
              question: `The cut time (${cutSeconds}s) exceeds the song duration (${duration.toFixed(1)}s). How many seconds would you like to cut?`,
              reason: 'Cut time exceeds song duration',
            };
          }
          const end = duration > 0 ? duration : cutSeconds + 60;
          return {
            status: 'success',
            operations: [
              {
                type: 'trim',
                trackId,
                start: cutSeconds,
                end,
              },
            ],
            explanation: `Cut the first ${cutSeconds}s (keeping from ${cutSeconds}s to the end).`,
            matchedPattern: 'cut_first_x',
            confidence: 0.98,
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 3. TRIM: CUT LAST X SECONDS
    // "cut last 15 seconds", "remove last 30 seconds"
    // "आखिरी 10 सेकंड हटा दो", "aakhiri 10 second hata do", "लास्ट के 15 सेकंड काट दो"
    // -------------------------------------------------------------
    const cutLastRegexes = [
      /(?:cut|remove|delete|drop)\s+(?:the\s+)?(?:last|final|ending)\s+([^,]+?)$/i,
      /(?:आखिरी|आखिर\s*के?|अंतिम|लास्ट\s*के?|aakhiri|last\s+ke?|ending\s+ke?)\s+([^,]+?)\s*(?:हटा\s*दो|हटाओ|काट\s*दो|kaat\s*do|cut\s*kar\s*do)/i,
    ];

    for (const rx of cutLastRegexes) {
      const match = lower.match(rx);
      if (match && match[1]) {
        const cutSeconds = parseTimeToSeconds(match[1]);
        if (cutSeconds !== null && cutSeconds > 0) {
          if (duration > 0 && cutSeconds >= duration) {
            return {
              status: 'needs_clarification',
              question: `The cut time (${cutSeconds}s) exceeds the song duration (${duration.toFixed(1)}s).`,
              reason: 'Cut time exceeds song duration',
            };
          }
          const end = duration > 0 ? duration - cutSeconds : 0;
          return {
            status: 'success',
            operations: [
              {
                type: 'trim',
                trackId,
                start: 0,
                end,
              },
            ],
            explanation: `Remove the last ${cutSeconds}s (keeping from start to ${end}s).`,
            matchedPattern: 'cut_last_x',
            confidence: 0.95,
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 4. TRIM: KEEP RANGE FROM X TO Y
    // "keep 30 seconds to 1 minute", "keep only 45 seconds to 1 minute 20 seconds"
    // "30 सेकंड से 1 मिनट तक रखो", "30 second se 1 minute tak rakho", "40 second se 1 minute tak"
    // -------------------------------------------------------------
    const keepRangeRegexes = [
      /(?:keep|play|trim)\s+(?:only\s+)?([^,]+?)\s+(?:to|till|until|-)\s+([^,]+)$/i,
      /(?:keep|play)\s+(?:from\s+)?([^,]+?)\s+(?:to|till|until|-)\s+([^,]+)$/i,
      /([^,]+?)\s+(?:से|se)\s+([^,]+?)(?:\s+(?:तक|tak))?(?:\s*(?:रखो|चलाओ|रखना|rakho|chalao|rakhna|play\s*karo))?$/i,
    ];

    for (const rx of keepRangeRegexes) {
      const match = lower.match(rx);
      if (match && match[1] && match[2]) {
        const startSec = parseTimeToSeconds(match[1]);
        const endSec = parseTimeToSeconds(match[2]);

        if (startSec !== null && endSec !== null) {
          if (endSec <= startSec) {
            return {
              status: 'needs_clarification',
              question: `The end time (${endSec}s) must be after the start time (${startSec}s). Please specify a valid range.`,
              reason: 'End time before start time',
            };
          }
          if (duration > 0 && endSec > duration + 1) {
            return {
              status: 'needs_clarification',
              question: `That ending time (${endSec}s) is longer than the song (${duration.toFixed(1)}s). Where should it stop?`,
              reason: 'End time exceeds track duration',
            };
          }
          return {
            status: 'success',
            operations: [
              {
                type: 'trim',
                trackId,
                start: startSec,
                end: endSec,
              },
            ],
            explanation: `Keep audio from ${startSec}s to ${endSec}s.`,
            matchedPattern: 'keep_range',
            confidence: 0.98,
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 5. FADE OUT
    // "fade out", "fade out for 5 seconds", "अंत में 5 सेकंड फेड कर दो", "last mein dheere dheere band karo"
    // -------------------------------------------------------------
    if (
      /(?:fade\s*out|fade\s+it\s+out|fade\s*at\s*(?:the\s*)?end)/i.test(lower) ||
      (/(?:अंत|लास्ट|आखिर|एंड|end|last|aakhir)/i.test(lower) &&
        /(?:फेड|धीमे|धीरे\s*धीरे\s*बंद|fade)/i.test(lower)) ||
      /(?:धीरे\s*धीरे\s*बंद|dheere\s*dheere\s*band)\s*(?:करो|kar\s*do|karo)/i.test(lower) ||
      /(?:फेड\s*आउट|fade\s*out)/i.test(lower)
    ) {
      let fadeDuration = 4;
      const durMatch =
        lower.match(/(?:for|के\s*लिए|ke\s*liye)\s*([^,]+)/i) ||
        lower.match(/(\d+|[^\s,]+)\s*(?:seconds|second|secs|sec|s|सेकंड|सेकण्ड)\s*(?:फेड|fade)/i);
      if (durMatch && durMatch[1]) {
        const parsedDur = parseTimeToSeconds(durMatch[1]);
        if (parsedDur && parsedDur > 0 && parsedDur <= 30) {
          fadeDuration = parsedDur;
        }
      }
      return {
        status: 'success',
        operations: [
          {
            type: 'fade_out',
            trackId,
            duration: fadeDuration,
          },
        ],
        explanation: `Fade out the end of the song for ${fadeDuration} seconds.`,
        matchedPattern: 'fade_out',
        confidence: 0.95,
      };
    }

    // -------------------------------------------------------------
    // 6. FADE IN
    // "fade in", "fade in for 3 seconds", "शुरू में फेड इन करो", "starting mein fade in karo"
    // -------------------------------------------------------------
    if (
      /(?:fade\s*in|fade\s+it\s+in|fade\s*at\s*(?:the\s*)?start)/i.test(lower) ||
      /(?:शुरू|स्टार्ट|shuru|starting|start)\s*me(?:in|में|मे)?\s*(?:फेड|धीमे|fade|dheere\s*se\s*shuru)\s*(?:इन|in)?\s*(?:कर\s*दो|करो|kar\s*do|karo)?/i.test(
        lower
      ) ||
      /(?:फेड\s*इन|fade\s*in)/i.test(lower)
    ) {
      const durMatch = lower.match(/(?:for|के\s*लिए|ke\s*liye)\s*([^,]+)/i);
      let fadeDuration = 3;
      if (durMatch && durMatch[1]) {
        const parsedDur = parseTimeToSeconds(durMatch[1]);
        if (parsedDur && parsedDur > 0) {
          fadeDuration = parsedDur;
        }
      }
      return {
        status: 'success',
        operations: [
          {
            type: 'fade_in',
            trackId,
            duration: fadeDuration,
          },
        ],
        explanation: `Fade in the beginning of the song for ${fadeDuration} seconds.`,
        matchedPattern: 'fade_in',
        confidence: 0.95,
      };
    }

    // -------------------------------------------------------------
    // 7. VOLUME
    // "make it louder", "आवाज़ बढ़ाओ", "volume up", "volume 80%"
    // -------------------------------------------------------------
    if (
      /(?:make\s+it\s+louder|increase\s+volume|volume\s+up|आवाज़\s*बढ़ाओ|आवाज\s*बढ़ाओ|aawaz\s+badhao|tez\s+karo)/i.test(
        lower
      )
    ) {
      return {
        status: 'success',
        operations: [
          {
            type: 'volume',
            trackId,
            value: 1.3,
          },
        ],
        explanation: 'Increase track volume by 30%.',
        matchedPattern: 'volume_up',
        confidence: 0.9,
      };
    }
    if (
      /(?:lower\s+volume|decrease\s+volume|volume\s+down|आवाज़\s*कम\s*करो|aawaz\s+kam\s+karo|dheemi\s+karo)/i.test(
        lower
      )
    ) {
      return {
        status: 'success',
        operations: [
          {
            type: 'volume',
            trackId,
            value: 0.7,
          },
        ],
        explanation: 'Decrease track volume to 70%.',
        matchedPattern: 'volume_down',
        confidence: 0.9,
      };
    }

    // -------------------------------------------------------------
    // 8. AUDIO NORMALIZATION
    // "normalize audio", "balance volume"
    // -------------------------------------------------------------
    if (/(?:normalize|balance\s+volume|sound\s+leveling)/i.test(lower)) {
      return {
        status: 'success',
        operations: [
          {
            type: 'normalize',
            trackId,
          },
        ],
        explanation: 'Apply dynamic audio normalization to even out volume peaks.',
        matchedPattern: 'normalize',
        confidence: 0.95,
      };
    }

    // -------------------------------------------------------------
    // FALLBACK: CANNOT CONFIDENTLY UNDERSTAND
    // Strictly return needs_clarification
    // -------------------------------------------------------------
    return {
      status: 'needs_clarification',
      question:
        "We couldn't understand that instruction. Please tell us which part of the song you want to keep, cut, fade, or merge.",
      reason: 'Instruction did not match known deterministic editing patterns',
    };
  }

  private tryParseCompound(
    lower: string,
    context: InstructionContext,
    trackId: string,
    duration: number
  ): InterpretationResult | null {
    // Check for: "remove first 30s and fade out ending"
    // or "पहले 30 सेकंड हटा दो और अंत में 5 सेकंड फेड कर दो"
    const cutMatch = lower.match(
      /(?:remove|cut|delete|pehle|shuru ke?|पहले|शुरू\s*के?)\s+(?:the\s+)?(?:first\s+)?(.+?)\s*(?:and|aur|then|और|फिर)\s+/i
    );
    const hasFadeOut =
      /(?:fade|फेड|धीमे|धीरे)/i.test(lower) &&
      /(?:out|ending|end|last|aakhir|अंत|लास्ट|आखिर|बंद)/i.test(lower);

    if (cutMatch && cutMatch[1] && hasFadeOut) {
      const cleanedCutStr = cutMatch[1].replace(
        /\s*(?:hata\s*do|kaat\s*do|cut\s*kar\s*do|remove|cut|delete|हटा\s*दो|काट\s*दो).*$/i,
        ''
      );
      const cutSeconds = parseTimeToSeconds(cleanedCutStr);
      if (cutSeconds && cutSeconds > 0) {
        let fadeDur = 4;
        const fadeDurMatch = lower.match(
          /(?:for\s+([0-9a-z]+)|([0-9a-z]+)\s*(?:second|sec|s|सेकंड|सेकण्ड)?\s*(?:fade|फेड))/i
        );
        if (fadeDurMatch) {
          const parsed = parseTimeToSeconds(fadeDurMatch[1] || fadeDurMatch[2]);
          if (parsed && parsed > 0 && parsed <= 20) {
            fadeDur = parsed;
          }
        }

        const ops: AudioOperation[] = [
          {
            type: 'trim',
            trackId,
            start: cutSeconds,
            end: duration > 0 ? duration : cutSeconds + 60,
          },
          {
            type: 'fade_out',
            trackId,
            duration: fadeDur,
          },
        ];

        return {
          status: 'success',
          operations: ops,
          explanation: `Remove the first ${cutSeconds}s and fade out the final ${fadeDur} seconds.`,
          matchedPattern: 'compound_trim_fade_out',
          confidence: 0.95,
        };
      }
    }

    // Check for: "keep the first song from 30 seconds to 1 minute and then play the second song"
    if (
      /(?:keep|play)\s+(?:the\s+)?first\s+song\s+from\s+([^,]+?)\s+to\s+([^,]+?)\s+(?:and\s+then|aur\s+phir|और\s+फिर)\s+(?:play\s+)?(?:the\s+)?second\s+song/i.test(
        lower
      )
    ) {
      if (context.tracks.length >= 2) {
        const match = lower.match(
          /from\s+([^,]+?)\s+to\s+([^,]+?)\s+(?:and\s+then|aur\s+phir|और\s+फिर)/i
        );
        if (match && match[1] && match[2]) {
          const start = parseTimeToSeconds(match[1]);
          const end = parseTimeToSeconds(match[2]);
          if (start !== null && end !== null) {
            const track1 = context.tracks[0];
            const track2 = context.tracks[1];
            return {
              status: 'success',
              operations: [
                {
                  type: 'trim',
                  trackId: track1.id,
                  start,
                  end,
                },
                {
                  type: 'merge',
                  tracks: [track1.id, track2.id],
                },
              ],
              explanation: `Trim "${track1.filename}" to ${start}s-${end}s, then merge with "${track2.filename}".`,
              matchedPattern: 'compound_trim_and_merge',
              confidence: 0.95,
            };
          }
        }
      }
    }

    return null;
  }
}
