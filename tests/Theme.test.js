'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { palette, contrast } = require('../Theme');

test('colores del editor mantienen contraste legible en modo claro y oscuro', () => {
  for (const color of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#777777', '#d52b40', '#8051d8', '#2478cc', '#228765', '#c78c21']) {
    for (const mode of ['oscuro', 'claro']) {
      const values = palette(color, mode);
      assert.equal(values.acento, color);
      for (const surface of ['bg', 'panel', 'panel2']) {
        assert.ok(contrast(values.text, values[surface]) >= 4.5, color + ' ' + mode + ' text');
        assert.ok(contrast(values.dim, values[surface]) >= 4.5, color + ' ' + mode + ' secondary');
      }
      assert.ok(contrast(values['sobre-acento'], color) >= 4.5, color + ' button');
      assert.ok(contrast(values.destacado, values.suave) >= 4.5, color + ' banner');
    }
  }
  assert.throws(() => palette('red;display:none', 'oscuro'));
});
