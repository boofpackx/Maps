/* Geometry Dash difficulty tiers.
 *
 * Two icon scales:
 *  - meme:    the 13-tier scale the IG stat pages use — icy "goated" face,
 *             headphones guy, the official GD faces (Auto..Insane, Demon),
 *             then Clubstep monster, black demon and trollface tiers.
 *  - classic: the official 11-tier GD scale (Auto .. Extreme Demon).
 *
 * For each tier the app first tries the real PNG at icons/<file|key>.png and
 * falls back to the original SVG look-alike art below, so dropping the exact
 * meme icons into icons/ (goated.png, chill.png, silent.png, nightmare.png,
 * troll.png, unrankable.png) upgrades them automatically.
 *
 * Tier fields: key, name, fill (map region color), [file] (PNG basename),
 * [alts] (extra names accepted as tier overrides), svg (fallback art).
 */
(function () {
  'use strict';

  function head(key, base, light, extra) {
    return `
      <defs>
        <radialGradient id="${key}-g" cx="0.38" cy="0.3" r="0.95">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="1" stop-color="${base}"/>
        </radialGradient>
      </defs>
      ${extra || ''}
      <circle cx="60" cy="66" r="41" fill="url(#${key}-g)" stroke="#141414" stroke-width="6"/>`;
  }

  function svgWrap(inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${inner}</svg>`;
  }

  function eyes(opts) {
    const { rx = 8.5, ry = 11, dy = 0, pupil = 4.2, tilt = 0, glowColor = null } = opts || {};
    const fill = glowColor || '#ffffff';
    const pupilDot = glowColor
      ? ''
      : `<circle cx="43" cy="${58 + dy + 2}" r="${pupil}" fill="#141414"/>
         <circle cx="77" cy="${58 + dy + 2}" r="${pupil}" fill="#141414"/>`;
    return `
      <g transform="rotate(${tilt} 43 ${58 + dy})">
        <ellipse cx="43" cy="${58 + dy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="#141414" stroke-width="4"/>
      </g>
      <g transform="rotate(${-tilt} 77 ${58 + dy})">
        <ellipse cx="77" cy="${58 + dy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="#141414" stroke-width="4"/>
      </g>
      ${pupilDot}`;
  }

  function brows(dy, thick) {
    const t = thick || 7;
    return `
      <path d="M28 ${42 + dy} L56 ${52 + dy} L54 ${52 + dy + t} L26 ${42 + dy + t} Z" fill="#141414"/>
      <path d="M92 ${42 + dy} L64 ${52 + dy} L66 ${52 + dy + t} L94 ${42 + dy + t} Z" fill="#141414"/>`;
  }

  function horns(size, color) {
    const c = color || '#141414';
    if (size === 1) {
      return `
        <path d="M30 38 Q24 20 14 16 Q30 14 40 28 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
        <path d="M90 38 Q96 20 106 16 Q90 14 80 28 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>`;
    }
    if (size === 2) {
      return `
        <path d="M34 40 Q20 30 16 8 Q36 12 46 30 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
        <path d="M86 40 Q100 30 104 8 Q84 12 74 30 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>`;
    }
    return `
      <path d="M36 42 Q14 34 8 4 Q20 8 30 16 Q42 24 48 34 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
      <path d="M84 42 Q106 34 112 4 Q100 8 90 16 Q78 24 72 34 Z" fill="${c}" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>`;
  }

  // Ring of jagged white teeth inside a dark mouth band.
  function fangRow(y, count, w, h, color) {
    let out = '';
    const step = w / count;
    for (let i = 0; i < count; i++) {
      const x = 60 - w / 2 + i * step;
      out += `<path d="M${x} ${y} L${x + step / 2} ${y + h} L${x + step} ${y} Z" fill="${color || '#ffffff'}"/>`;
    }
    return out;
  }

  // --- official-face fallbacks (used by both scales) -----------------------

  const AUTO = {
    key: 'auto', name: 'Auto', fill: '#ff9c38', alts: ['robot'],
    svg: svgWrap(head('auto', '#f07822', '#ffd27a') + `
      <path d="M60 25 L60 107" stroke="#141414" stroke-width="5"/>
      <circle cx="42" cy="62" r="13" fill="#38b6ff" stroke="#141414" stroke-width="5"/>
      <circle cx="78" cy="62" r="13" fill="#38b6ff" stroke="#141414" stroke-width="5"/>
      <circle cx="38" cy="57" r="4" fill="#c8f2ff"/>
      <circle cx="74" cy="57" r="4" fill="#c8f2ff"/>
      <circle cx="46" cy="34" r="3" fill="#8a3f0e"/>
      <circle cx="74" cy="34" r="3" fill="#8a3f0e"/>
      <circle cx="46" cy="94" r="3" fill="#8a3f0e"/>
      <circle cx="74" cy="94" r="3" fill="#8a3f0e"/>`)
  };

  const EASY = {
    key: 'easy', name: 'Easy', fill: '#4fa8ff',
    svg: svgWrap(head('easy', '#2f7fe0', '#9cc9ff') + eyes({ ry: 12 }) + `
      <path d="M38 76 Q60 100 82 76 Q60 86 38 76 Z" fill="#ffffff" stroke="#141414" stroke-width="5" stroke-linejoin="round"/>`)
  };

  const NORMAL = {
    key: 'normal', name: 'Normal', fill: '#46d647',
    svg: svgWrap(head('normal', '#39b447', '#a4efa0') + eyes({}) + `
      <path d="M42 80 Q60 92 78 80" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`)
  };

  const HARD = {
    key: 'hard', name: 'Hard', fill: '#ffd23d',
    svg: svgWrap(head('hard', '#f0b429', '#ffe89a') + `
      <path d="M30 47 L56 51 L55 58 L29 54 Z" fill="#141414"/>
      <path d="M90 47 L64 51 L65 58 L91 54 Z" fill="#141414"/>` +
      eyes({ dy: 6, ry: 9 }) + `
      <path d="M44 84 L76 84" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`)
  };

  const HARDER = {
    key: 'harder', name: 'Harder', fill: '#ff5033',
    svg: svgWrap(head('harder', '#e8321f', '#ff9d8a') + brows(4) + eyes({ dy: 8, ry: 8.5, tilt: -8 }) + `
      <path d="M42 88 Q60 78 78 88" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`)
  };

  const INSANE = {
    key: 'insane', name: 'Insane', fill: '#f052e0',
    svg: svgWrap(head('insane', '#c02fd6', '#f2a4fa') + brows(2, 8) + eyes({ dy: 9, ry: 8, tilt: -12 }) + `
      <path d="M40 82 L80 82 L78 92 L42 92 Z" fill="#ffffff" stroke="#141414" stroke-width="5" stroke-linejoin="round"/>
      <path d="M50 82 L50 92 M60 82 L60 92 M70 82 L70 92" stroke="#141414" stroke-width="3.5"/>`)
  };

  const DEMON_EXTREME_SVG = svgWrap(`
    <defs>
      <radialGradient id="dext-g" cx="0.38" cy="0.3" r="0.95">
        <stop offset="0" stop-color="#c9203a"/>
        <stop offset="1" stop-color="#5c0713"/>
      </radialGradient>
    </defs>
    <path d="M36 42 Q10 36 2 2 Q18 6 30 15 Q44 24 50 34 Z" fill="#1a0507" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
    <path d="M84 42 Q110 36 118 2 Q102 6 90 15 Q76 24 70 34 Z" fill="#1a0507" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="60" cy="66" r="41" fill="url(#dext-g)" stroke="#141414" stroke-width="6"/>
    <path d="M24 46 L58 55 L56 65 L22 55 Z" fill="#141414"/>
    <path d="M96 46 L62 55 L64 65 L98 55 Z" fill="#141414"/>
    <g transform="rotate(-16 43 70)"><ellipse cx="43" cy="70" rx="8" ry="6.5" fill="#ff9d1c" stroke="#141414" stroke-width="4"/></g>
    <g transform="rotate(16 77 70)"><ellipse cx="77" cy="70" rx="8" ry="6.5" fill="#ff9d1c" stroke="#141414" stroke-width="4"/></g>
    <path d="M34 84 Q60 72 86 84 L84 99 Q60 92 36 99 Z" fill="#141414"/>
    <path d="M40 83 L45 97 L50 84 Z" fill="#ffffff"/>
    <path d="M53 84 L58 98 L62 84 Z" fill="#ffffff"/>
    <path d="M65 84 L70 97 L75 83 Z" fill="#ffffff"/>
    <path d="M77 82 L81 94 L85 81 Z" fill="#ffffff"/>`);

  // --- custom meme-scale faces (SVG fallbacks for the IG icons) -------------

  const GOATED = {
    key: 'goated', name: 'Goated', fill: '#45d6f5', alts: ['goat', 'ice', 'frozen', 'peak'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="goat-g" cx="0.38" cy="0.3" r="0.95">
          <stop offset="0" stop-color="#eafcff"/>
          <stop offset="1" stop-color="#8fdcf2"/>
        </radialGradient>
      </defs>
      <path d="M22 52 Q12 30 24 14 Q28 26 36 22 Q32 34 42 32 Q38 44 48 40 L44 52 Z" fill="#57c8f5" stroke="#1a7fb5" stroke-width="3" stroke-linejoin="round"/>
      <path d="M98 52 Q108 30 96 14 Q92 26 84 22 Q88 34 78 32 Q82 44 72 40 L76 52 Z" fill="#57c8f5" stroke="#1a7fb5" stroke-width="3" stroke-linejoin="round"/>
      <path d="M60 2 Q48 18 54 30 Q60 22 66 30 Q72 18 60 2 Z" fill="#8ae2ff" stroke="#1a7fb5" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="60" cy="66" r="41" fill="url(#goat-g)" stroke="#12557a" stroke-width="6"/>
      <path d="M33 58 Q43 50 53 58" fill="none" stroke="#12557a" stroke-width="5" stroke-linecap="round"/>
      <path d="M67 58 Q77 50 87 58" fill="none" stroke="#12557a" stroke-width="5" stroke-linecap="round"/>
      <path d="M42 82 Q60 94 78 82" fill="none" stroke="#12557a" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="34" cy="72" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>
      <ellipse cx="86" cy="72" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>`)
  };

  const CHILL = {
    key: 'chill', name: 'Chill', fill: '#2fc9c0', alts: ['headphones', 'vibe', 'vibing', 'music'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="chill-g" cx="0.38" cy="0.3" r="0.95">
          <stop offset="0" stop-color="#f2e2a0"/>
          <stop offset="1" stop-color="#cdb45e"/>
        </radialGradient>
      </defs>
      <rect x="20" y="28" width="80" height="78" rx="24" fill="url(#chill-g)" stroke="#141414" stroke-width="6"/>
      <path d="M26 52 Q26 16 60 16 Q94 16 94 52" fill="none" stroke="#141414" stroke-width="10" stroke-linecap="round"/>
      <rect x="14" y="46" width="16" height="26" rx="7" fill="#2b2b2b" stroke="#141414" stroke-width="4"/>
      <rect x="90" y="46" width="16" height="26" rx="7" fill="#2b2b2b" stroke="#141414" stroke-width="4"/>
      <path d="M36 64 Q44 56 52 64" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>
      <path d="M68 64 Q76 56 84 64" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>
      <path d="M46 86 Q60 94 74 86" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>
      <rect x="44" y="97" width="32" height="6" rx="3" fill="#57e05a" stroke="#141414" stroke-width="2.5"/>`)
  };

  const DEMON = {
    key: 'demon', name: 'Demon', fill: '#d6203c', file: 'demon-extreme',
    alts: ['extremedemon', 'reddemon'],
    svg: DEMON_EXTREME_SVG
  };

  const SILENT = {
    key: 'silent', name: 'Silent', fill: '#5c0a10',
    alts: ['clubstep', 'clubstepmonster', 'monster', 'impossible'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="sil-g" cx="0.4" cy="0.35" r="0.95">
          <stop offset="0" stop-color="#7a1420"/>
          <stop offset="1" stop-color="#33040a"/>
        </radialGradient>
      </defs>
      <g stroke="#141414" stroke-width="3" stroke-linejoin="round" fill="#f2f0e8">
        <path d="M18 60 L2 34 L26 44 Z"/><path d="M24 42 L16 12 L38 32 Z"/>
        <path d="M38 30 L40 4 L54 26 Z"/><path d="M56 24 L66 0 L72 24 Z"/>
        <path d="M74 26 L90 6 L86 30 Z"/><path d="M88 32 L108 14 L98 42 Z"/>
        <path d="M96 44 L118 36 L102 60 Z"/>
      </g>
      <circle cx="60" cy="68" r="40" fill="url(#sil-g)" stroke="#141414" stroke-width="6"/>
      <ellipse cx="44" cy="56" rx="7" ry="5" fill="#ff5a3c"/>
      <ellipse cx="76" cy="56" rx="7" ry="5" fill="#ff5a3c"/>
      <circle cx="44" cy="56" r="2" fill="#ffd9a0"/>
      <circle cx="76" cy="56" r="2" fill="#ffd9a0"/>
      <path d="M24 74 Q60 62 96 74 L94 98 Q60 90 26 98 Z" fill="#141414"/>` +
      fangRow(70, 7, 68, 13, '#f2f0e8') + `
      <g transform="translate(0 26) scale(1 -1) translate(0 -170)">` +
      fangRow(72, 7, 64, 12, '#dcdacf') + `</g>`)
  };

  const NIGHTMARE = {
    key: 'nightmare', name: 'Nightmare', fill: '#26262b',
    alts: ['blackdemon', 'shadow', 'cursed'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="nite-g" cx="0.4" cy="0.32" r="0.95">
          <stop offset="0" stop-color="#3a3a42"/>
          <stop offset="1" stop-color="#0c0c10"/>
        </radialGradient>
      </defs>` +
      horns(2, '#0c0c10') + `
      <circle cx="60" cy="66" r="41" fill="url(#nite-g)" stroke="#141414" stroke-width="6"/>
      <path d="M32 56 L54 62 L52 68 L30 61 Z" fill="#e8f6ff"/>
      <path d="M88 56 L66 62 L68 68 L90 61 Z" fill="#e8f6ff"/>
      <path d="M30 80 Q60 68 90 80 L88 96 Q60 88 32 96 Z" fill="#050507"/>` +
      fangRow(77, 8, 56, 11, '#e8f6ff') + `
      <path d="M30 80 Q60 68 90 80" fill="none" stroke="#e8f6ff" stroke-width="2" opacity="0.5"/>`)
  };

  const TROLL = {
    key: 'troll', name: 'Troll', fill: '#111111', alts: ['trollface', 'trolled'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="troll-g" cx="0.4" cy="0.3" r="0.95">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#c9c9c9"/>
        </radialGradient>
      </defs>
      <path d="M60 24 Q92 20 100 44 Q108 62 98 78 Q104 96 84 100 Q64 110 44 102 Q22 100 20 78 Q12 60 24 44 Q32 26 60 24 Z"
            fill="url(#troll-g)" stroke="#141414" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="42" cy="52" rx="10" ry="7" fill="#ffffff" stroke="#141414" stroke-width="3.5"/>
      <ellipse cx="76" cy="50" rx="11" ry="7.5" fill="#ffffff" stroke="#141414" stroke-width="3.5"/>
      <circle cx="44" cy="53" r="2.6" fill="#141414"/>
      <circle cx="78" cy="51" r="2.6" fill="#141414"/>
      <path d="M30 44 Q38 38 50 42" fill="none" stroke="#141414" stroke-width="3"/>
      <path d="M64 40 Q76 34 88 42" fill="none" stroke="#141414" stroke-width="3"/>
      <path d="M26 68 Q40 60 58 64 Q78 58 94 66 Q96 84 78 90 Q56 98 36 88 Q26 80 26 68 Z"
            fill="#ffffff" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>
      <path d="M32 72 Q56 66 90 70 M34 80 Q58 76 88 78" fill="none" stroke="#141414" stroke-width="2.5"/>
      <path d="M42 66 L42 88 M54 64 L54 92 M66 63 L66 92 M78 64 L78 88" stroke="#141414" stroke-width="2.5"/>
      <path d="M24 58 Q30 56 34 58 M86 92 Q92 90 96 92" fill="none" stroke="#141414" stroke-width="2.5"/>`)
  };

  const UNRANKABLE = {
    key: 'unrankable', name: 'Unrankable', fill: '#000000',
    alts: ['faded', 'invisible', 'doomed', 'beyond'],
    svg: svgWrap(`
      <defs>
        <radialGradient id="unr-g" cx="0.4" cy="0.3" r="0.95">
          <stop offset="0" stop-color="#222222"/>
          <stop offset="1" stop-color="#0a0a0a"/>
        </radialGradient>
      </defs>
      <path d="M60 24 Q92 20 100 44 Q108 62 98 78 Q104 96 84 100 Q64 110 44 102 Q22 100 20 78 Q12 60 24 44 Q32 26 60 24 Z"
            fill="url(#unr-g)" stroke="#2e2e2e" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="42" cy="52" rx="10" ry="7" fill="none" stroke="#3a3a3a" stroke-width="3.5"/>
      <ellipse cx="76" cy="50" rx="11" ry="7.5" fill="none" stroke="#3a3a3a" stroke-width="3.5"/>
      <path d="M26 68 Q40 60 58 64 Q78 58 94 66 Q96 84 78 90 Q56 98 36 88 Q26 80 26 68 Z"
            fill="none" stroke="#3a3a3a" stroke-width="4" stroke-linejoin="round"/>
      <path d="M42 66 L42 88 M54 64 L54 92 M66 63 L66 92 M78 64 L78 88" stroke="#333333" stroke-width="2.5"/>`)
  };

  // --- classic-scale demons --------------------------------------------------

  const DEMON_EASY = {
    key: 'demon-easy', name: 'Easy Demon', fill: '#8347f5',
    svg: svgWrap(head('deasy', '#7a3fe8', '#c6a4ff', horns(1, '#5b21b6')) +
      brows(3, 8) + eyes({ dy: 9, ry: 8, tilt: -14 }) + `
      <path d="M40 84 Q60 76 80 84 L76 92 Q60 86 44 92 Z" fill="#141414"/>
      <path d="M46 84 L50 92 L54 84 Z" fill="#ffffff"/>
      <path d="M66 84 L70 92 L74 84 Z" fill="#ffffff"/>`)
  };

  const DEMON_MEDIUM = {
    key: 'demon-medium', name: 'Medium Demon', fill: '#c9308f',
    svg: svgWrap(head('dmed', '#b52a8f', '#f07ac9', horns(2, '#701a5a')) +
      brows(2, 9) + eyes({ dy: 9, ry: 8, tilt: -16 }) + `
      <path d="M38 82 Q60 74 82 82 L80 94 Q60 88 40 94 Z" fill="#141414"/>
      <path d="M44 82 L49 93 L54 83 Z" fill="#ffffff"/>
      <path d="M58 83 L62 94 L66 83 Z" fill="#ffffff"/>
      <path d="M68 83 L73 93 L77 82 Z" fill="#ffffff"/>`)
  };

  const DEMON_HARD = {
    key: 'demon-hard', name: 'Hard Demon', fill: '#e02a2a', alts: ['harddemon'],
    svg: svgWrap(head('dhard', '#b41212', '#f56a6a', horns(3, '#450a0a')) + `
      <path d="M26 44 L58 54 L56 63 L24 52 Z" fill="#141414"/>
      <path d="M94 44 L62 54 L64 63 L96 52 Z" fill="#141414"/>` +
      eyes({ dy: 11, rx: 7.5, ry: 7, glowColor: '#7ae05a' }) + `
      <path d="M36 82 Q60 72 84 82 L82 96 Q60 90 38 96 Z" fill="#141414"/>
      <path d="M42 81 L47 94 L52 82 Z" fill="#ffffff"/>
      <path d="M56 82 L60 95 L64 82 Z" fill="#ffffff"/>
      <path d="M68 82 L73 94 L78 81 Z" fill="#ffffff"/>`)
  };

  const DEMON_INSANE = {
    key: 'demon-insane', name: 'Insane Demon', fill: '#ab1616',
    svg: svgWrap(head('dins', '#8f0e0e', '#e05252', horns(3, '#2b0505')) + `
      <path d="M26 44 L58 54 L56 63 L24 52 Z" fill="#141414"/>
      <path d="M94 44 L62 54 L64 63 L96 52 Z" fill="#141414"/>` +
      eyes({ dy: 11, rx: 7.5, ry: 7, glowColor: '#ffdd30' }) + `
      <path d="M36 82 Q60 72 84 82 L82 96 Q60 90 38 96 Z" fill="#141414"/>
      <path d="M42 81 L47 94 L52 82 Z" fill="#ffffff"/>
      <path d="M56 82 L60 95 L64 82 Z" fill="#ffffff"/>
      <path d="M68 82 L73 94 L78 81 Z" fill="#ffffff"/>`)
  };

  const DEMON_EXTREME = {
    key: 'demon-extreme', name: 'Extreme Demon', fill: '#7a0d12',
    svg: DEMON_EXTREME_SVG
  };

  const SCALES = {
    meme: [GOATED, CHILL, AUTO, EASY, NORMAL, HARD, HARDER, INSANE, DEMON,
           SILENT, NIGHTMARE, TROLL, UNRANKABLE],
    classic: [AUTO, EASY, NORMAL, HARD, HARDER, INSANE, DEMON_EASY,
              DEMON_MEDIUM, DEMON_HARD, DEMON_INSANE, DEMON_EXTREME]
  };

  const GD = { SCALES: SCALES, TIERS: null, TIER_LOOKUP: null };

  GD.setScale = function (name) {
    const tiers = SCALES[name] || SCALES.meme;
    GD.TIERS = tiers;
    const lookup = {};
    tiers.forEach(function (t, i) {
      lookup[String(i + 1)] = i;
      lookup[t.name.toLowerCase().replace(/[^a-z]/g, '')] = i;
      lookup[t.key.replace(/[^a-z]/g, '')] = i;
      (t.alts || []).forEach(function (a) {
        lookup[a.toLowerCase().replace(/[^a-z0-9]/g, '')] = i;
      });
    });
    GD.TIER_LOOKUP = lookup;
  };

  GD.setScale('meme');
  window.GD = GD;
})();
