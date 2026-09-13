/**
 * Time Parser for English, Hindi (Devanagari), & Hinglish expressions
 * Converts time strings into seconds
 */

// Converts Devanagari numerals (०-९) to ASCII digits (0-9)
function normalizeDevanagariNumerals(str: string): string {
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let result = str;
  devanagariDigits.forEach((d, idx) => {
    result = result.split(d).join(String(idx));
  });
  return result;
}

export function parseTimeToSeconds(input: string): number | null {
  if (!input) return null;

  // Normalize numerals and lower-case
  let raw = normalizeDevanagariNumerals(input.trim().toLowerCase());

  // 1. Colon notation (e.g. "1:20", "01:20", "0:45", "1:15:30")
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    const parts = raw.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // 2. Word-to-number map for spoken Hindi (Devanagari & Hinglish) & English numbers
  const wordNumberMap: Record<string, number> = {
    // Devanagari Hindi number words
    'पाँच': 5,
    'पांच': 5,
    'दस': 10,
    'पंद्रह': 15,
    'पन्द्रह': 15,
    'बीस': 20,
    'पच्चीस': 25,
    'तीस': 30,
    'पैंतीस': 35,
    'चालीस': 40,
    'पैंतालीस': 45,
    'पचास': 50,
    'साठ': 60,

    // Hinglish spoken numbers
    paanch: 5,
    panch: 5,
    das: 10,
    dus: 10,
    pandrah: 15,
    pandra: 15,
    bees: 20,
    pachees: 25,
    tees: 30,
    paintrees: 35,
    chalis: 40,
    chaalis: 40,
    paintalis: 45,
    pachaas: 50,
    pachas: 50,
    saath: 60,
    sath: 60,

    // English number words
    five: 5,
    ten: 10,
    fifteen: 15,
    twenty: 20,
    twentyfive: 25,
    'twenty-five': 25,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
  };

  // Check if string is a known number word optionally followed by seconds unit in EN or HI
  const wordMatch = raw.match(
    /^([^\s]+)\s*(?:seconds|second|secs|sec|s|सेकंड|सेकण्ड|सेकंड्स)?$/i
  );
  if (wordMatch && wordNumberMap[wordMatch[1]]) {
    return wordNumberMap[wordMatch[1]];
  }

  // 3. Devanagari colloquial minute phrases
  if (/^(आधा|अधा)\s*मिनट?$/i.test(raw)) {
    return 30;
  }
  if (/^(एक|1)\s*मिनट$/i.test(raw)) {
    return 60;
  }
  if (/^(डेढ़|डेढ|1\.5)\s*मिनट?$/i.test(raw)) {
    return 90;
  }
  if (/^(दो|2)\s*मिनट$/i.test(raw)) {
    return 120;
  }
  if (/^(ढाई|2\.5)\s*मिनट?$/i.test(raw)) {
    return 150;
  }

  // 4. Hinglish / English colloquial minute phrases
  if (/^(aadha|adha|half)\s*(?:a\s+)?(minute|min|m)?$/i.test(raw)) {
    return 30;
  }
  if (/^(ek|1|one)\s*(minute|min|m)$/i.test(raw)) {
    return 60;
  }
  if (/^(derh|dedh|1\.5|one and a half)\s*(minute|min|m)?$/i.test(raw)) {
    return 90;
  }
  if (/^(do|2|two)\s*(minute|min|m)$/i.test(raw)) {
    return 120;
  }
  if (/^(dhai|dhaye|2\.5)\s*(minute|min|m)?$/i.test(raw)) {
    return 150;
  }

  let totalSeconds = 0;
  let matchedAny = false;

  // 5. Minutes composite (EN & Devanagari)
  const minMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min|m|मिनट)(?:\b|\s|$)/i);
  if (minMatch) {
    totalSeconds += parseFloat(minMatch[1]) * 60;
    matchedAny = true;
  }

  // 6. Seconds composite (EN & Devanagari)
  const secMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s|सेकंड|सेकण्ड|सेकंड्स)(?:\b|\s|$)/i
  );
  if (secMatch) {
    totalSeconds += parseFloat(secMatch[1]);
    matchedAny = true;
  }

  // 7. Raw number standalone, e.g. "30"
  if (!matchedAny && /^\d+(?:\.\d+)?$/.test(raw)) {
    return parseFloat(raw);
  }

  return matchedAny ? totalSeconds : null;
}
