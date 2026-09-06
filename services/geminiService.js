import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const normalizeModel = (model) => {
  const value = String(model || '').trim().replace(/^models\//, '');
  // Gemini 1.5 Flash is no longer available for generateContent on the
  // current API, so keep older environment configurations compatible.
  return value === 'gemini-1.5-flash' ? 'gemini-2.5-flash' : value;
};

const models = [...new Set([
  process.env.GEMINI_MODEL,
  ...(process.env.GEMINI_MODELS || '').split(','),
  'gemini-2.5-flash',
  'gemini-2.0-flash'
].map(normalizeModel).filter(Boolean))];
const apiKeys = [...new Set([
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean))];

const fallbackNames = ({ gender, startingLetter, count = 5 }) => {
  const names = [
    ['Aarav', 'आरव', 'Peaceful and wise'], ['Aadhya', 'आध्या', 'First power; Goddess Durga'],
    ['Vedika', 'वेदिका', 'Full of knowledge'], ['Ishani', 'ईशानी', 'Goddess Durga'],
    ['Dhruv', 'ध्रुव', 'Steady and constant'], ['Anaya', 'अनया', 'Caring and protected'],
    ['Vihaan', 'विहान', 'Dawn and new beginning'], ['Kavya', 'काव्या', 'Poetry and wisdom'],
    ['Arjun', 'अर्जुन', 'Bright and focused'], ['Meera', 'मीरा', 'Devotee of Krishna']
  ];
  const requested = String(startingLetter || '').trim().toLowerCase();
  const filtered = requested ? names.filter(item => item[0].toLowerCase().startsWith(requested)) : names;
  const selected = (filtered.length ? filtered : names).slice(0, Math.min(Math.max(Number(count) || 5, 1), 20));
  return selected.map(([name, devanagari, meaning]) => ({
    name, devanagari, meaning, gender: gender || 'unisex',
    startingLetter: name.charAt(0), isAiGenerated: true
  }));
};

const parseResponse = (text) => {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed)) throw new Error('Gemini returned an invalid names array');
  return parsed;
};

/**
 * Generate Hindu baby names based on Rashi, Starting Letter, Gender, Deity & Themes
 */
export const generateGeminiBabyNames = async ({ gender, rashi, startingLetter, deity, theme, count = 5, year, month }) => {
  const prompt = `You are an expert in Vedic Sanskrit and Hindu baby naming rituals.
Generate ${count} modern, meaningful Hindu baby names for a baby with the following constraints:
- Gender: ${gender || 'any'}
- Rashi (Moon Sign): ${rashi || 'any'}
- Must start with syllable/letter: "${startingLetter || 'any'}"
- Deity Association: ${deity || 'any'}
- Theme/Vibe: ${theme || 'modern, short, meaningful'}
- Calendar recommendation: ${month ? `month ${month}` : 'any month'} ${year || ''}

Rules: Use only real, attested Hindu/Sanskrit names with a documented meaning.
Do not invent generic-sounding names, placeholders, transliterations without meaning, or duplicate names.

Return STRICTLY a valid JSON array of objects with no Markdown backticks or prose. Format:
[
  {
    "name": "Aarav",
    "devanagari": "आरव",
    "gender": "${gender || 'boy'}",
    "meaning": "Wisdom, musical note, peaceful",
    "startingLetter": "${startingLetter || 'A'}",
    "astrology": {
      "rashi": { "en": "${rashi || 'Aries'}", "hi": "Mesh" },
      "nakshatra": "Ashwini",
      "rulingPlanet": "Mars",
      "element": "Fire"
    },
    "attributes": {
      "luckyColors": ["Red", "Saffron"],
      "luckyNumbers": [1, 9],
      "numerologyNumber": 1,
      "luckyGems": ["Red Coral"],
      "deities": ["${deity || 'Shiva'}"]
    }
  }
]`;

  let lastError;
  for (const key of apiKeys) {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const candidateModel of models) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel, contents: prompt, config: { responseMimeType: 'application/json' }
        });
        const result = parseResponse(response.text);
        if (result.length) return result;
      } catch (error) {
        lastError = error;
      }
    }
  }
  if (lastError) console.warn('Gemini providers unavailable; using local name fallback:', lastError.message);
  return fallbackNames({ gender, startingLetter, count });
};

/**
 * Generates combined baby names from Mother's and Father's names
 */
export const blendParentNames = async ({ fatherName, motherName, gender }) => {
  const prompt = `Blend the Father's name "${fatherName}" and Mother's name "${motherName}" to create 5 beautiful, modern Hindu baby names for a ${gender}.
Ensure each name has a deep Sanskrit meaning, correct Devanagari script, and sounds natural (not artificial).

Return strictly a JSON array of objects:
[
  {
    "name": "Name",
    "devanagari": "नाम",
    "meaning": "Meaning in English",
    "blendOrigin": "How father and mother letters were derived",
    "gender": "${gender}"
  }
]`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  return JSON.parse(response.text.trim());
};

export const generatePremiumBabyNames = async ({ parentNames, gender, style, startingLetters, rashi, nakshatra, meaning, count = 12 }) => {
  const prompt = `You are a careful Hindu and Sanskrit baby-name researcher.
Suggest ${count} real, attested Indian baby names for a premium personalized naming report.
Parents: ${parentNames || 'not provided'}
Gender: ${gender || 'any'}
Preferred style: ${style || 'modern Indian'}
Starting letters: ${startingLetters?.join(', ') || 'any'}
Rashi: ${rashi || 'any'}
Nakshatra: ${nakshatra || 'any'}
Meaning preference: ${meaning || 'meaningful and auspicious'}

Do not invent names. Return only names that families genuinely use and provide a short reason for each suggestion.
Return strictly valid JSON with no Markdown:
[{"name":"Aarav","reason":"Short explanation of why this name fits the requested profile."}]`;
  let lastError;
  for (const key of apiKeys) {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const candidateModel of models) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        const result = parseResponse(response.text)
          .filter(item => item && typeof item.name === 'string' && item.name.trim())
          .map(item => ({ name: item.name.trim(), reason: String(item.reason || '').trim() }))
          .slice(0, Math.min(Math.max(Number(count) || 12, 1), 30));
        if (result.length) return result;
      } catch (error) {
        lastError = error;
      }
    }
  }
  if (lastError) console.warn('Gemini premium generation unavailable:', lastError.message);
  return [];
};