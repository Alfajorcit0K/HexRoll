'use strict';
const CHANNEL = Object.freeze({ provider: 'github', owner: 'Alfajorcit0K', repo: 'Perks-Killer-Roulette', private: false });

function errorReason(error) {
  const code = error?.code || error?.cause?.code;
  const status = error?.statusCode || error?.status || error?.response?.statusCode;
  const wrapped = String(error?.message || '');
  if (['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code) || /\b(?:ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT)\b|net::ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_TIMED_OUT|TIMED_OUT)\b/.test(wrapped)) return 'network';
  if (status === 404 || ['ERR_UPDATER_NO_PUBLISHED_VERSIONS', 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'].includes(code) || code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' && /\b404\b/.test(wrapped)) return 'unavailable';
  if (status === 401 || status === 403) return 'access';
  if (['ERR_UPDATER_CHECKSUM_MISMATCH', 'ERR_UPDATER_INVALID_SIGNATURE'].includes(code)) return 'integrity';
  return 'unknown';
}

function createUpdates({ version, updater, enabled = true, changed = () => {} }) {
  let checking = false, state = { phase: enabled ? 'idle' : 'development', version, percent: 0 };
  function notify(patch) { state = { ...state, ...patch }; changed({ ...state }); return { ...state }; }
  function failed(error) { return notify({ phase: 'error', reason: errorReason(error), percent: 0 }); }
  updater.setFeedURL(CHANNEL);
  updater.logger = null;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.on('checking-for-update', () => notify({ phase: 'checking', reason: null, percent: 0 }));
  updater.on('update-available', info => notify({ phase: 'downloading', nextVersion: info.version }));
  updater.on('download-progress', progress => {
    const percent = Math.max(0, Math.min(100, Math.floor(progress.percent || 0)));
    if (percent !== state.percent) notify({ phase: 'downloading', percent });
  });
  updater.on('update-not-available', () => notify({ phase: 'current', nextVersion: null }));
  updater.on('update-downloaded', info => notify({ phase: 'ready', nextVersion: info.version, percent: 100 }));
  updater.on('error', failed);
  const busy = () => checking || state.phase === 'downloading';
  return {
    state: () => ({ ...state }),
    async check() {
      if (!enabled || busy() || state.phase === 'ready') return { ...state };
      checking = true;
      try {
        const result = await updater.checkForUpdates();
        if (result?.downloadPromise) void result.downloadPromise.catch(failed);
      }
      catch (error) { failed(error); }
      finally { checking = false; }
      return { ...state };
    },
    install() {
      if (!enabled || state.phase !== 'ready') throw new Error('Todavia no hay una actualizacion lista para instalar.');
      updater.quitAndInstall(false, true);
    }
  };
}

module.exports = { createUpdates, CHANNEL };
