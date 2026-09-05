import * as Astronomy from 'astronomy-engine';
import { BabyName } from '../models/BabyName.js';

const zodiacSigns = [
  { en: 'Aries', hi: 'Mesha', rulingPlanet: 'Mars', luckyColors: ['Red', 'Saffron'] },
  { en: 'Taurus', hi: 'Vrishabha', rulingPlanet: 'Venus', luckyColors: ['White', 'Pink'] },
  { en: 'Gemini', hi: 'Mithuna', rulingPlanet: 'Mercury', luckyColors: ['Green', 'Yellow'] },
  { en: 'Cancer', hi: 'Karka', rulingPlanet: 'Moon', luckyColors: ['White', 'Silver'] },
  { en: 'Leo', hi: 'Simha', rulingPlanet: 'Sun', luckyColors: ['Gold', 'Orange'] },
  { en: 'Virgo', hi: 'Kanya', rulingPlanet: 'Mercury', luckyColors: ['Green', 'Brown'] },
  { en: 'Libra', hi: 'Tula', rulingPlanet: 'Venus', luckyColors: ['White', 'Blue'] },
  { en: 'Scorpio', hi: 'Vrishchika', rulingPlanet: 'Mars', luckyColors: ['Red', 'Maroon'] },
  { en: 'Sagittarius', hi: 'Dhanu', rulingPlanet: 'Jupiter', luckyColors: ['Yellow', 'Orange'] },
  { en: 'Capricorn', hi: 'Makara', rulingPlanet: 'Saturn', luckyColors: ['Black', 'Navy'] },
  { en: 'Aquarius', hi: 'Kumbha', rulingPlanet: 'Saturn', luckyColors: ['Blue', 'Grey'] },
  { en: 'Pisces', hi: 'Meena', rulingPlanet: 'Jupiter', luckyColors: ['Yellow', 'Sea Green'] }
];

const nakshatras = [
  ['Ashwini', ['O', 'Chu', 'Che', 'Cho']], ['Bharani', ['Li', 'Lu', 'Le', 'Lo']],
  ['Krittika', ['A', 'E', 'U', 'Ae']], ['Rohini', ['O', 'Va', 'Vi', 'Vu']],
  ['Mrigashira', ['Ve', 'Vo', 'Ka', 'Ki']], ['Ardra', ['Ku', 'Gha', 'Na', 'Cha']],
  ['Punarvasu', ['Ke', 'Ko', 'Ha', 'Hi']], ['Pushya', ['Hu', 'He', 'Ho', 'Da']],
  ['Ashlesha', ['Di', 'Du', 'De', 'Do']], ['Magha', ['Ma', 'Mi', 'Mu', 'Me']],
  ['Purva Phalguni', ['Mo', 'Ta', 'Ti', 'Tu']], ['Uttara Phalguni', ['Te', 'To', 'Pa', 'Pi']],
  ['Hasta', ['Pu', 'Sha', 'Na', 'Tha']], ['Chitra', ['Pe', 'Po', 'Ra', 'Ri']],
  ['Swati', ['Ru', 'Re', 'Ro', 'Ta']], ['Vishakha', ['Ti', 'Tu', 'Te', 'To']],
  ['Anuradha', ['Na', 'Ni', 'Nu', 'Ne']], ['Jyeshtha', ['No', 'Ya', 'Yi', 'Yu']],
  ['Mula', ['Ye', 'Yo', 'Bha', 'Bhi']], ['Purva Ashadha', ['Bhu', 'Dha', 'Pha', 'Dha']],
  ['Uttara Ashadha', ['Bhe', 'Bho', 'Ja', 'Ji']], ['Shravana', ['Ju', 'Je', 'Jo', 'Gha']],
  ['Dhanishta', ['Ga', 'Gi', 'Gu', 'Ge']], ['Shatabhisha', ['Go', 'Sa', 'Si', 'Su']],
  ['Purva Bhadrapada', ['Se', 'So', 'Da', 'Di']], ['Uttara Bhadrapada', ['Du', 'Tha', 'Jha', 'Na']],
  ['Revati', ['De', 'Do', 'Cha', 'Chi']]
];

const getLahiriAyanamsha = (date) => {
  const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
  return 23.85675 + ((year - 2000) * 0.013968);
};

const getMoonDetails = (date) => {
  const tropicalLongitude = Astronomy.EclipticGeoMoon(date).lon;
  const moonLongitude = (tropicalLongitude - getLahiriAyanamsha(date) + 360) % 360;
  const normalizedLongitude = ((moonLongitude % 360) + 360) % 360;
  const rashi = zodiacSigns[Math.min(Math.floor(normalizedLongitude / 30), zodiacSigns.length - 1)];
  const nakshatraPosition = normalizedLongitude / (360 / 27);
  const nakshatraIndex = Math.min(Math.floor(nakshatraPosition), nakshatras.length - 1);
  const pada = Math.min(Math.floor((nakshatraPosition - nakshatraIndex) * 4) + 1, 4);
  const nakshatra = nakshatras[nakshatraIndex];
  return { moonLongitude, rashi, nakshatra: { name: nakshatra[0], pada, recommendedLetter: nakshatra[1][pada - 1], allPadasSyllables: nakshatra[1] } };
};

export const getBirthChartAndNames = async (req, res) => {
  try {
    const { birthDate, birthTime = '00:00', gender } = req.body || {};
    const parsedDate = new Date(`${birthDate}T${birthTime}:00Z`);

    if (!birthDate || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime) ||
        Number.isNaN(parsedDate.getTime()) || !['boy', 'girl', 'unisex'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Valid birthDate, birthTime (HH:mm), and gender (boy, girl, or unisex) are required'
      });
    }

    const details = getMoonDetails(parsedDate);
    const names = await BabyName.find({
      gender,
      'astrology.rashi.en': details.rashi.en,
      startingLetter: new RegExp(`^${details.nakshatra.recommendedLetter}`, 'i')
    }).limit(50);

    res.status(200).json({
      success: true,
      data: {
        astro: {
          moonLongitude: Number(details.moonLongitude.toFixed(2)),
          rashi: details.rashi,
          nakshatra: details.nakshatra
        },
        names
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Birth chart calculation failed',
      error: error.message
    });
  }
};