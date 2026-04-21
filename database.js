(function () {
  const config = window.SERVICE_HP_CONFIG || {};
  const stateId = config.stateId || 'main';
  const pollInterval = Number(config.pollIntervalMs) || 2500;

  let saveTimer = null;
  let pollTimer = null;
  let lastVersion = '';
  let lastSavedJson = '';
  let isRemoteReady = false;

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data || {}));
  }

  async function requestState(options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`/api/state?id=${encodeURIComponent(stateId)}`, {
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal,
        ...options
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function init(onRemoteData, onStatus) {
    onStatus?.({ mode: 'connecting', message: 'Menghubungkan Neon database...' });

    try {
      const result = await requestState();
      isRemoteReady = true;
      lastVersion = result.updatedAt || '';

      if (result.data && Object.keys(result.data).length > 0) {
        lastSavedJson = JSON.stringify(result.data);
        onRemoteData?.(cloneData(result.data));
      }

      startPolling(onRemoteData, onStatus);
      onStatus?.({ mode: 'online', message: 'Neon database tersambung.' });
      return { mode: 'remote' };
    } catch (error) {
      console.error('Gagal membaca Neon database:', error);
      isRemoteReady = false;
      onStatus?.({ mode: 'local', message: 'Neon belum siap. App memakai localStorage sementara.' });
      return { mode: 'local', error };
    }
  }

  function startPolling(onRemoteData, onStatus) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (document.hidden) return;

      try {
        const result = await requestState();
        isRemoteReady = true;
        if (!result.updatedAt || result.updatedAt === lastVersion) return;

        lastVersion = result.updatedAt;
        const json = JSON.stringify(result.data || {});
        if (json === lastSavedJson) return;

        lastSavedJson = json;
        onRemoteData?.(cloneData(result.data));
      } catch (error) {
        console.error('Gagal polling Neon:', error);
        isRemoteReady = false;
        onStatus?.({ mode: 'error', message: 'Koneksi database terputus. Data lokal tetap aman.' });
      }
    }, pollInterval);
  }

  function save(data, onStatus) {
    const payload = cloneData(data);
    const json = JSON.stringify(payload);
    if (json === lastSavedJson && isRemoteReady) return;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      onStatus?.({ mode: 'saving', message: 'Menyimpan ke Neon...' });

      try {
        const result = await requestState({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ id: stateId, data: payload })
        });

        isRemoteReady = true;
        lastVersion = result.updatedAt || lastVersion;
        lastSavedJson = json;
        onStatus?.({ mode: 'saved', message: 'Data tersimpan di Neon.' });
      } catch (error) {
        console.error('Gagal menyimpan Neon:', error);
        isRemoteReady = false;
        onStatus?.({ mode: 'error', message: 'Gagal simpan ke Neon. Data lokal tetap tersimpan.' });
      }
    }, 250);
  }

  function destroy() {
    clearTimeout(saveTimer);
    clearInterval(pollTimer);
  }

  window.serviceHpDb = {
    init,
    save,
    destroy,
    isConfigured: true
  };
})();
