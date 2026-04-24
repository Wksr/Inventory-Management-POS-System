class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.syncListeners = [];
    this.isSyncing = false;

    this.init();
  }

  init() {
    window.addEventListener("online", () => this.setOnline(true));
    window.addEventListener("offline", () => this.setOnline(false));

    // Start health checks after 5 seconds delay
    setTimeout(() => {
      this.healthCheckInterval = setInterval(
        () => this.performHealthCheck(),
        20000
      );
      this.performHealthCheck();
    }, 5000);
  }

  async performHealthCheck() {
    if (!this.isOnline) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch("http://127.0.0.1:8000/api/health", {
        method: "GET",
        signal: controller.signal,
        cache: "no-cache",
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok") {
          if (!this.isOnline) {
            this.setOnline(true);
          }
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("Health check timeout — will retry");
        return; // Don't go offline on timeout
      }
      if (this.isOnline) {
        this.setOnline(false);
      }
    }
  }

  setOnline(online) {
    if (this.isOnline === online) return;

    this.isOnline = online;
    console.log(`Network: ${online ? "Online 🟢" : "Offline 🔴"}`);
    this.listeners.forEach((cb) => cb(online));

    if (online) {
      this.triggerSync();
    }
  }

  notifyStatusListeners(status) {
    this.listeners.forEach((callback) => {
      try {
        callback(status);
      } catch (err) {
        console.error("Status listener error:", err);
      }
    });
  }

  async triggerSync() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    console.log("Starting sync...");

    for (const callback of this.syncListeners) {
      try {
        await callback();
      } catch (err) {
        console.error("Sync listener failed:", err);
      }
    }

    this.isSyncing = false;
    console.log("Sync completed");
  }

  getStatus() {
    return this.isOnline;
  }

  canSync() {
    return this.isOnline && !this.isSyncing;
  }

  addListener(callback) {
    this.listeners.push(callback);
    callback(this.isOnline);
  }

  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter((cb) => cb !== callback);
  }

  destroy() {
    clearInterval(this.healthCheckInterval);
    clearTimeout(this.debounceTimer);
    window.removeEventListener("online", this.debounceStatusChange);
    window.removeEventListener("offline", this.debounceStatusChange);
  }
}

const networkManager = new NetworkManager();
export default networkManager;
