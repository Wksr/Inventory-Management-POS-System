import React from "react";
import { WifiOff } from "lucide-react";

const OfflineNotification = () => {
  return (
    <div className="offline-notification">
      <WifiOff size={16} />
      <span>
        You are currently offline. Working in offline mode. Data will sync when
        you're back online.
      </span>
    </div>
  );
};

export default OfflineNotification;
