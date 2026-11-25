'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function publish() {
  const version = require('../package.json').version;
  const repository = 'Alfajorcit0K/Perks-Killer-Roulette';
  const tag = 'v' + version;
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF_NAME !== tag) throw new Error('Publica desde la etiqueta de version en GitHub Actions.');
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta la autorizacion del workflow.');
  const api = 'https://api.github.com/repos/' + repository;
  async function request(url, method = 'GET', body, type = 'application/json') {
    const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': type, 'User-Agent': 'HexRollPublisher' },
      ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(300000), redirect: 'error' });
    if (!response.ok) throw new Error('GitHub respondio ' + response.status + ' al publicar.');
    return response.status === 204 ? null : response.json();
  }
  const metadata = await request(api);
  if (metadata.private) throw new Error('Haz publico el repositorio antes de publicar el canal de actualizaciones sin autenticacion.');
  const name = 'HexRollSetup' + version + '.exe';
  const files = [name, name + '.blockmap', 'latest.yml'].map(name => ({ name, data: fs.readFileSync(path.resolve('release', name)) }));
  const latest = files[2].data.toString();
  const digest = crypto.createHash('sha512').update(files[0].data).digest('base64');
  if (!latest.includes('version: ' + version) || !latest.includes(name) || !latest.includes(digest)) throw new Error('El instalador y latest.yml no corresponden a la misma compilacion.');
  const releases = await request(api + '/releases?per_page=100');
  let release = releases.find(r => r.tag_name === tag);
  if (release && !release.draft) throw new Error('Esta version ya esta publicada. Incrementa la version para una nueva entrega.');
  if (!release) release = await request(api + '/releases', 'POST', { tag_name: tag, target_commitish: process.env.GITHUB_SHA, name: 'HexRoll ' + version, draft: true, prerelease: false, body: fs.readFileSync(path.resolve('ReleaseNotes.md'), 'utf8') });
  for (const file of files) {
    const previous = release.assets.find(a => a.name === file.name);
    if (previous) await request(api + '/releases/assets/' + previous.id, 'DELETE');
    await request(release.upload_url.split('{')[0] + '?name=' + encodeURIComponent(file.name), 'POST', file.data, file.name.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream');
  }
  await request(api + '/releases/' + release.id, 'PATCH', { draft: false, make_latest: 'true' });
  console.log('Release de HexRoll ' + version + ' publicada con instalador y metadatos de actualizacion.');
}

publish().catch(error => { console.error(error.message); process.exitCode = 1; });
