'use strict';
const fs = require('fs');
const path = require('path');
const { construirWidgets } = require('../Roulette');
const { writeWidgetFiles } = require('../WidgetFiles');

module.exports = async ({ packager }) => {
  const root = packager.projectDir;
  const directory = path.join(root, '.build-cache', 'InstallerWidgets');
  if (path.dirname(directory) !== path.join(root, '.build-cache')) throw new Error('Invalid widget output directory.');
  fs.rmSync(directory, { recursive: true, force: true });
  const templates = { normal: fs.readFileSync(path.join(root, 'RouletteTemplate.html'), 'utf8'), lite: fs.readFileSync(path.join(root, 'RouletteLiteTemplate.html'), 'utf8') };
  writeWidgetFiles(directory, construirWidgets(templates, JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'))), root);
};
