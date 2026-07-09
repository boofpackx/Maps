/* Region name normalization + alias tables so user input like "USA", "TX",
 * or "South Korea" matches the atlas feature names.
 */
(function () {
  'use strict';

  function normalize(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\bst\.?\b/g, 'saint')
      .replace(/[^a-z0-9]/g, '');
  }

  // alias -> canonical atlas name (world-atlas countries-110m property names)
  const COUNTRY_ALIASES = {
    'usa': 'United States of America',
    'us': 'United States of America',
    'unitedstates': 'United States of America',
    'america': 'United States of America',
    'uk': 'United Kingdom',
    'britain': 'United Kingdom',
    'greatbritain': 'United Kingdom',
    'england': 'United Kingdom',
    'uae': 'United Arab Emirates',
    'emirates': 'United Arab Emirates',
    'czechrepublic': 'Czechia',
    'bosnia': 'Bosnia and Herz.',
    'bosniaandherzegovina': 'Bosnia and Herz.',
    'macedonia': 'Macedonia',
    'northmacedonia': 'Macedonia',
    'drc': 'Dem. Rep. Congo',
    'drcongo': 'Dem. Rep. Congo',
    'democraticrepublicofthecongo': 'Dem. Rep. Congo',
    'democraticrepublicofcongo': 'Dem. Rep. Congo',
    'congokinshasa': 'Dem. Rep. Congo',
    'republicofthecongo': 'Congo',
    'congobrazzaville': 'Congo',
    'ivorycoast': "Côte d'Ivoire",
    'cotedivoire': "Côte d'Ivoire",
    'burma': 'Myanmar',
    'southkorea': 'South Korea',
    'republicofkorea': 'South Korea',
    'korea': 'South Korea',
    'northkorea': 'North Korea',
    'dprk': 'North Korea',
    'russianfederation': 'Russia',
    'turkiye': 'Turkey',
    'holland': 'Netherlands',
    'easttimor': 'Timor-Leste',
    'timorleste': 'Timor-Leste',
    'swaziland': 'eSwatini',
    'eswatini': 'eSwatini',
    'centralafricanrepublic': 'Central African Rep.',
    'car': 'Central African Rep.',
    'dominicanrepublic': 'Dominican Rep.',
    'equatorialguinea': 'Eq. Guinea',
    'southsudan': 'S. Sudan',
    'westernsahara': 'W. Sahara',
    'falklandislands': 'Falkland Is.',
    'falklands': 'Falkland Is.',
    'solomonislands': 'Solomon Is.',
    'northerncyprus': 'N. Cyprus',
    'palestinianterritories': 'Palestine',
    'westbank': 'Palestine',
    'vietnam': 'Vietnam',
    'laopdr': 'Laos',
    'brunei': 'Brunei',
    'bruneidarussalam': 'Brunei',
    'syrianarabrepublic': 'Syria',
    'iranislamicrepublicof': 'Iran',
    'boliviaplurinationalstateof': 'Bolivia',
    'venezuelabolivarianrepublicof': 'Venezuela',
    'tanzaniaunitedrepublicof': 'Tanzania',
    'moldovarepublicof': 'Moldova',
    'capeverde': null, // not in 110m atlas — report as unmatched
    'papuanewguinea': 'Papua New Guinea',
    'png': 'Papua New Guinea',
    'newzealand': 'New Zealand',
    'nz': 'New Zealand',
    'saudiarabia': 'Saudi Arabia',
    'ksa': 'Saudi Arabia',
    'srilanka': 'Sri Lanka',
    'southafrica': 'South Africa',
    'rsa': 'South Africa',
    'trinidad': 'Trinidad and Tobago',
    'burkina': 'Burkina Faso',
    'guineabissau': 'Guinea-Bissau',
    'kyrgyzrepublic': 'Kyrgyzstan',
    'slovakrepublic': 'Slovakia',
    'cambodia': 'Cambodia',
    'khmer': 'Cambodia'
  };

  const US_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
    'PR': 'Puerto Rico'
  };

  const STATE_ALIASES = { 'washingtondc': 'District of Columbia' };
  Object.keys(US_STATES).forEach(function (abbr) {
    STATE_ALIASES[abbr.toLowerCase()] = US_STATES[abbr];
  });

  window.NAMES = {
    normalize: normalize,
    COUNTRY_ALIASES: COUNTRY_ALIASES,
    STATE_ALIASES: STATE_ALIASES
  };
})();
