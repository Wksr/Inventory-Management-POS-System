import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import networkManager from "../utils/networkManager";
import syncManager from "../utils/syncManager";

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(networkManager.getStatus());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Listen for network changes
    networkManager.addListener((status) => {
      setIsOnline(status);
    });

    // Check sync status periodically
    const checkSyncStatus = async () => {
      const status = await syncManager.getSyncStatus();
      setPendingCount(status.pendingSales + status.pendingQueueItems);
      setIsSyncing(status.isSyncing);
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    try {
      await syncManager.manualSync();
      // Refresh status after sync
      const status = await syncManager.getSyncStatus();
      setPendingCount(status.pendingSales + status.pendingQueueItems);
    } catch (error) {
      console.error("Manual sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline) {
    return (
      <div className="network-status online">
        <Wifi size={16} />
        <span>Online</span>

        {pendingCount > 0 && (
          <>
            <div className="pending-count">{pendingCount} pending</div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="sync-now-btn"
            >
              {isSyncing ? (
                <RefreshCw size={14} className="spinning" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sync Now
            </button>
          </>
        )}

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="details-btn"
        >
          {showDetails ? "Hide" : "Details"}
        </button>

        {showDetails && (
          <div className="sync-details">
            <SyncDetails />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="network-status offline">
      <WifiOff size={16} />
      <span>Offline Mode</span>

      {pendingCount > 0 && (
        <div className="pending-count warning">
          <AlertCircle size={14} />
          {pendingCount} pending
        </div>
      )}
    </div>
  );
};

const SyncDetails = () => {
  const [details, setDetails] = useState({
    pendingSales: 0,
    pendingQueueItems: 0,
    failedItems: 0,
    lastSync: null,
  });

  useEffect(() => {
    const loadDetails = async () => {
      const status = await syncManager.getSyncStatus();
      setDetails(status);
    };

    loadDetails();
    const interval = setInterval(loadDetails, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sync-details-content">
      <h4>Sync Status</h4>
      <div className="detail-row">
        <span>Pending Sales:</span>
        <span className={details.pendingSales > 0 ? "pending" : ""}>
          {details.pendingSales}
        </span>
      </div>
      <div className="detail-row">
        <span>Other Items:</span>
        <span className={details.pendingQueueItems > 0 ? "pending" : ""}>
          {details.pendingQueueItems}
        </span>
      </div>
      <div className="detail-row">
        <span>Failed Items:</span>
        <span className={details.failedItems > 0 ? "failed" : ""}>
          {details.failedItems}
        </span>
      </div>
      <div className="detail-row">
        <span>Last Sync:</span>
        <span>
          {details.lastSync
            ? new Date(details.lastSync).toLocaleTimeString()
            : "Never"}
        </span>
      </div>
    </div>
  );
};

export default NetworkStatus;
