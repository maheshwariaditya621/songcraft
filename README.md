# Audio Editing Platform — V1 Architecture & Audio Engine

> **"Don't learn audio editing. Just tell us what you want."**  
> A consumer-friendly, browser-first audio editing foundation targeting **₹0 infrastructure cost** and absolute user privacy.

---

## 1. System Architecture

```
User Input (Text / Voice / Future WhatsApp / Direct UI)
                           │
                           ▼
            ┌─────────────────────────────┐
            │   InstructionInterpreter    │
            │  (RuleBased / Future LLM)   │
            └──────────────┬──────────────┘
                           │ Outputs structured
                           ▼
            ┌─────────────────────────────┐
            │       AudioOperations       │
            │ (trim, merge, fade, volume) │
            └──────────────┬──────────────┘
                           │ Validated by
                           ▼
            ┌─────────────────────────────┐
            │        AudioEngine          │
            │   (Validator & Pipeline)    │
            └──────────────┬──────────────┘
                           │ Executes via
                           ▼
            ┌─────────────────────────────┐
            │     FFmpegWasmEngine        │
            │   (In-Browser Processing)   │
            └──────────────┬──────────────┘
                           │
                           ▼
                Final Audio Blob / Download
```

### Key Architectural Principles
1. **Decoupled Contracts**: The `AudioOperation` schema is strictly independent of UI, speech-to-text, and AI models.
2. **Pluggable Interpreters**:
   - `RuleBasedInstructionInterpreter`: Deterministic, zero-latency, ₹0 cost for common English, Hindi, and Hinglish editing phrases.
   - Guardrail: When confidence is low, it strictly responds with `{ status: "needs_clarification" }` instead of guessing.
   - Future interchangeable interpreters: `LLMInstructionInterpreter`, `VoiceInstructionInterpreter`, `WhatsAppInstructionInterpreter`.
3. **Browser-First Audio Engine**:
   - Audio is processed directly in the user's browser via `@ffmpeg/ffmpeg` (FFmpeg.wasm).
   - Zero audio bytes are uploaded to our servers, ensuring 100% privacy and **₹0 server bandwidth/compute cost**.
4. **Single-Pass Filter Complex**:
   - Chained operations (`trim` + `fade_in` + `fade_out` + `volume` + `normalize`) are compiled into a unified FFmpeg filtergraph to run in a single pass without quality degradation.

---

## 2. Directory Structure

```
d:/CODING/AUDIO EDITING PLATFORM/
├── app/
│   ├── globals.css         # Sleek dark-mode design system & tokens
│   ├── layout.tsx          # Root layout & web fonts
│   └── page.tsx            # Developer testbench workbench page
├── lib/
│   ├── audio/
│   │   ├── audio-engine.ts    # High-level pipeline coordinator
│   │   ├── ffmpeg-client.ts   # FFmpeg.wasm singleton & virtual FS lifecycle
│   │   ├── filter-builder.ts  # Compiles operations into FFmpeg filtergraphs
│   │   ├── metadata.ts        # Browser-native Web Audio metadata extraction
│   │   └── validator.ts       # Boundaries, timestamp, and security validator
│   ├── instructions/
│   │   ├── instruction-engine.ts # Facade managing interpreters
│   │   ├── rule-parser.ts        # Deterministic English & Hinglish parser
│   │   └── time-parser.ts        # Parses times (e.g., 30s, 1:20, aadha minute)
│   ├── types/
│   │   ├── audio.ts           # AudioTrack, AudioOperation, ProcessingResult
│   │   └── instructions.ts    # InstructionInterpreter & InterpretationResult
│   └── index.ts               # Barrel export
├── tests/
│   ├── filter-builder.test.ts     # Filtergraph generation tests
│   ├── instruction-parser.test.ts # English & Hinglish parser unit tests
│   ├── time-parser.test.ts        # Time conversion tests
│   └── validator.test.ts          # Boundary, bounds, and security tests
├── next.config.mjs         # COOP / COEP security headers for SharedArrayBuffer
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. AudioOperation Schema

All operations follow a clean, discriminated union:

### Trim
```json
{
  "type": "trim",
  "trackId": "track_1",
  "start": 30,
  "end": 60
}
```

### Fade In / Fade Out
```json
{
  "type": "fade_in",
  "trackId": "track_1",
  "duration": 3
}
```
```json
{
  "type": "fade_out",
  "trackId": "track_1",
  "duration": 5
}
```

### Merge (Concatenation)
```json
{
  "type": "merge",
  "tracks": ["track_1", "track_2"]
}
```

### Volume & Normalization
```json
{
  "type": "volume",
  "trackId": "track_1",
  "value": 1.3
}
```
```json
{
  "type": "normalize",
  "trackId": "track_1"
}
```

---

## 4. Supported Natural Language Instructions

### English Examples
- `"cut first 30 seconds"` / `"remove first 20 seconds"`
- `"keep 30 seconds to 1 minute"` / `"keep only 45 seconds to 1 minute 20 seconds"`
- `"fade out at the end"` / `"fade out for 5 seconds"`
- `"fade in"`
- `"join these two songs"` / `"merge these songs"`
- `"remove first 30 seconds and fade out the ending"` (compound)
- `"keep the first song from 30 seconds to 1 minute and then play the second song"` (compound)

### Hindi / Hinglish Examples
- `"pehle 30 second hata do"` / `"first 30 seconds remove"`
- `"30 second se 1 minute tak rakho"`
- `"aadha minute se ek minute tak chalao"`
- `"end mein fade kar do"` / `"last mein dheere dheere band karo"`
- `"dono gane jod do"`

### Ambiguity Guardrail
- Any unrecognized or ambiguous input (e.g. `"make it sound like morning"`, or cutting more than song duration) returns:
```json
{
  "status": "needs_clarification",
  "question": "We couldn't understand that instruction. Please tell us which part of the song you want to keep, cut, fade, or merge."
}
```

---

## 5. Running the Project

### Running Unit Tests
```bash
npm test
```
Executes all 34 automated unit tests covering the validator, filter-builder, time-parser, and instruction-engine.

### Running Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
npm start
```

---

## 6. Infrastructure Cost & Production Estimates

| Component | Architecture Choice | Infrastructure Cost |
|---|---|---|
| **Audio Processing** | FFmpeg.wasm (client-side browser) | **₹0** |
| **Hosting** | Vercel / Cloudflare Pages / Static | **₹0** (Free Tier) |
| **Storage** | Browser Memory / Blob URLs | **₹0** |
| **Instruction Parsing** | Deterministic Rule-based Parser | **₹0** |
| **GPU / Transcoding Clusters** | None required | **₹0** |
| **Estimated Total V1 Cost** | | **₹0 / month** |
