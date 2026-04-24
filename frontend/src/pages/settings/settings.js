import React, { useState } from "react";
import {
  Building2,
  Settings as SettingsIcon,
  Briefcase,
  Receipt,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import BranchManagement from "./BranchManagement";
import BusinessDetails from "./BusinessDetails";
import ReceiptSettings from "./ReceiptSettings";
import LoyaltySettings from "./LoyaltySettings";
import BackupButton from "./BackupButton";
import "./settings.css";

const Settings = () => {
  const [selectedTab, setSelectedTab] = useState("branches");

  const tabs = [
    { id: "branches", name: "Branches", icon: Building2 },
    { id: "business", name: "Business Details", icon: Briefcase },
    { id: "receipt", name: "Receipt Settings", icon: Receipt },
    { id: "loyalty", name: "Loyalty Program", icon: Gift },
    { id: "general", name: "General Settings", icon: SettingsIcon },
  ];

  const handleTabSelect = (tabId) => {
    setSelectedTab(tabId);
    toast.success(`${tabs.find((t) => t.id === tabId)?.name} selected`);
  };

  const renderContent = () => {
    switch (selectedTab) {
      case "branches":
        return <BranchManagement />;

      case "business":
        return <BusinessDetails />;

      case "receipt":
        return <ReceiptSettings />;

      case "loyalty":
        return <LoyaltySettings />;

      case "general":
        return <BackupButton />;

      default:
        return (
          <div className="placeholder-content">
            <div className="placeholder-icon">
              <SettingsIcon size={64} />
            </div>
            <h3>Settings</h3>
            <p>Select a category to manage settings</p>
          </div>
        );
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`settings-tab ${
                selectedTab === tab.id ? "active" : ""
              }`}
              onClick={() => handleTabSelect(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-container">{renderContent()}</div>
    </div>
  );
};

export default Settings;
