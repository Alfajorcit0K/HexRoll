'use strict';
const CHANNEL = Object.freeze({ provider: 'github', owner: 'Alfajorcit0K', repo: 'Perks-Killer-Roulette', private: false });

function createUpdates({ version, updater, enabled = true, changed = () => {} }) {
  let checking = false, state = { phase: enabled ? 'idle' : 'development', version, percent: 0 };
  function notify(patch) { state = { ...state, ...patch }; changed({ ...state }); return { ...state }; }
  updater.setFeedURL(CHANNEL);
  updater.logger = null;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.on('checking-for-update', () => notify({ phase: 'checking', percent: 0 }));
  updater.on('update-available', info => notify({ phase: 'downloading', nextVersion: info.version }));
  updater.on('download-progress', progress => {
    const percent = Math.max(0, Math.min(100, Math.floor(progress.percent || 0)));
    if (percent !== state.percent) notify({ phase: 'downloading', percent });
  });
  updater.on('update-not-available', () => notify({ phase: 'current', nextVersion: null }));
  updater.on('update-downloaded', info => notify({ phase: 'ready', nextVersion: info.version, percent: 100 }));
  updater.on('error', () => notify({ phase: 'error', percent: 0 }));
  const busy = () => checking || state.phase === 'downloading';
  return {
    state: () => ({ ...state }),
    async check() {
      if (!enabled || busy() || state.phase === 'ready') return { ...state };
      checking = true;
      try {
        const result = await updater.checkForUpdates();
        if (result?.downloadPromise) void result.downloadPromise.catch(() => notify({ phase: 'error', percent: 0 }));
      }
      catch (_) { notify({ phase: 'error', percent: 0 }); }
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
