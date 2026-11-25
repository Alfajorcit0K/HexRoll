'use strict';
const fs = require('fs');
const path = require('path');

function writeWidgetFiles(directory, widgets, imageRoot) {
  fs.mkdirSync(directory, { recursive: true });
  for (const folder of ['perks', 'killers']) {
    const source = path.join(imageRoot, 'images', folder), target = path.join(directory, 'images', folder);
    if (source === target || !fs.existsSync(source)) continue;
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name)) continue;
      const input = path.join(source, entry.name), output = path.join(target, entry.name);
      const stat = fs.statSync(input);
      if (!fs.existsSync(output) || fs.statSync(output).size !== stat.size || fs.statSync(output).mtimeMs < stat.mtimeMs) fs.copyFileSync(input, output);
    }
  }
  for (const [name, html] of Object.entries(widgets)) fs.writeFileSync(path.join(directory, name), html);
}

module.exports = { writeWidgetFiles };
