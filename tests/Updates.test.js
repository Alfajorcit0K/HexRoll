'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../desktop/Updates');

function fixture(options = {}) {
  const updater = new EventEmitter();
  updater.setFeedURL = config => { updater.feed = config; };
  updater.checkForUpdates = async () => { updater.emit('checking-for-update'); updater.emit('update-not-available'); };
  updater.quitAndInstall = (...args) => { updater.installed = args; };
  return { updater, updates: createUpdates({ version: '1.0.0', updater, ...options }) };
}

test('errores de actualizacion distinguen canal inexistente, permisos, red y verificacion sin mostrar detalles internos', async () => {
  for (const [error, reason] of [[{ statusCode: 404 }, 'unavailable'], [{ code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND', message: 'HttpError: 404 Not Found' }, 'unavailable'], [{ code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND', message: 'net::ERR_INTERNET_DISCONNECTED' }, 'network'], [{ code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }, 'unknown'], [{ statusCode: 403 }, 'access'], [{ code: 'ENOTFOUND' }, 'network'], [{ code: 'ERR_UPDATER_CHECKSUM_MISMATCH' }, 'integrity'], [new Error('offline token=private'), 'unknown']]) {
    const { updater, updates } = fixture();
    updater.checkForUpdates = async () => { throw error; };
    await updates.check();
    assert.equal(updates.state().reason, reason);
    assert.ok(!JSON.stringify(updates.state()).includes('private'));
  }
});

test('canal publico funciona sin tokens y no instala ni retrocede automaticamente', async () => {
  const { updater, updates } = fixture();
  assert.equal(updater.feed.private, false);
  assert.equal(updater.feed.repo, 'Perks-Killer-Roulette');
  assert.ok(!Object.hasOwn(updater.feed, 'token'));
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(updater.allowPrerelease, false);
  await updates.check(); assert.equal(updates.state().phase, 'current');
});

test('descarga informa progreso y permite instalar solo cuando esta lista', async () => {
  const { updater, updates } = fixture();
  assert.throws(() => updates.install(), /Todavia/);
  updater.emit('update-available', { version: '1.0.1' });
  updater.emit('download-progress', { percent: 55.8 });
  assert.equal(updates.state().phase, 'downloading'); assert.equal(updates.state().percent, 55);
  updater.emit('error', new Error('internal request details'));
  assert.equal(updates.state().phase, 'error');
  assert.ok(!JSON.stringify(updates.state()).includes('internal request'));
  updater.emit('update-downloaded', { version: '1.0.1' });
  assert.equal(updates.state().phase, 'ready'); updates.install();
  assert.deepEqual(updater.installed, [false, true]);
});

test('desarrollo no consulta GitHub y los errores de descarga no quedan sin manejar', async () => {
  const dev = fixture({ enabled: false });
  dev.updater.checkForUpdates = () => { throw new Error('No debe consultar'); };
  assert.equal((await dev.updates.check()).phase, 'development');
  const { updater, updates } = fixture();
  updater.checkForUpdates = async () => ({ downloadPromise: Promise.reject(new Error('offline')) });
  await updates.check(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates.state().phase, 'error');
});
