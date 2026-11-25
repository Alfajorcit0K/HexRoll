'use strict';
(function (root) {
  const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
  function mix(a, b, amount) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v * (1 - amount) + y[i] * amount).toString(16).padStart(2, '0')).join(''); }
  function luminance(hex) { const c = rgb(hex).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function palette(color, mode) {
    if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Invalid theme color.');
    const dark = mode === 'oscuro';
    const values = dark ? {
      bg: mix('#121317', color, .045), panel: mix('#1c1e24', color, .06), panel2: mix('#272a32', color, .085),
      text: '#f5f3f6', dim: '#bdb5bf', borde: mix('#5a5360', color, .25), suave: mix('#181a21', color, .19),
      destacado: mix(color, '#ffffff', .65), imagen: mix('#101115', color, .03), sombra: '0 4px 18px #00000022'
    } : {
      bg: mix('#f7f8fb', color, .035), panel: '#ffffff', panel2: mix('#f6f5f8', color, .045),
      text: '#25232a', dim: '#635c68', borde: mix('#d7d1dc', color, .35), suave: mix('#ffffff', color, .12),
      destacado: color, imagen: mix('#eeebf1', color, .1), sombra: '0 4px 18px #22132d0c'
    };
    if (!dark) while (contrast(values.destacado, values.suave) < 4.5) values.destacado = mix(values.destacado, '#000000', .12);
    values.acento = color.toLowerCase();
    values['sobre-acento'] = contrast(color, '#ffffff') >= contrast(color, '#000000') ? '#ffffff' : '#000000';
    return values;
  }
  function tintPixels(bytes, color, order = 'rgba') {
    if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Invalid theme color.');
    const target = rgb(color), peak = Math.max(...target);
    const strength = peak ? target.map(value => value / peak) : [1, 1, 1];
    const channels = order === 'bgra' ? [2, 1, 0] : [0, 1, 2];
    for (let i = 0; i < bytes.length; i += 4) {
      const r = bytes[i + channels[0]], g = bytes[i + channels[1]], b = bytes[i + channels[2]];
      const floor = Math.min(r, g, b), energy = Math.max(r, g, b) - floor;
      for (let channel = 0; channel < 3; channel++) bytes[i + channels[channel]] = Math.round(floor + energy * strength[channel]);
    }
    return bytes;
  }
  const api = { palette, contrast, tintPixels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HexRollTheme = api;
})(globalThis);
