import React, { useState, useEffect } from "react";
import { Printer, ToggleLeft, Save } from "lucide-react";
import { toast } from "sonner";
import "./ReceiptSettings.css";

const ReceiptSettings = () => {
  const [settings, setSettings] = useState({
    showLogo: true,
    showShopName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showDateTime: true,
    showInvoiceNo: true,
    showCashier: true,
    showCustomer: true,
    showThankYou: true,
    footerMessage: "Thank You! Come Again :)",
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const saved = localStorage.getItem("receiptSettings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
        toast.success("Receipt settings loaded");
      } catch (error) {
        console.error("Error loading receipt settings:", error);
      }
    }
    setLoading(false);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("receiptSettings", JSON.stringify(settings));
      toast.success("Receipt settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Error saving receipt settings:", error);
    }
  };

  const toggleSetting = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="receipt-settings loading-state">
        Loading receipt settings...
      </div>
    );
  }

  return (
    <div className="receipt-settings">
      <div className="receipt-header">
        <div className="receipt-icon">
          <Printer size={32} />
        </div>
        <h2>Receipt Customization</h2>
        <p className="receipt-subtitle">
          Turn on/off elements that appear on printed receipts
        </p>
      </div>

      <div className="receipt-options-grid">
        <div className="receipt-option-group">
          <h3>Header Elements</h3>
          <div className="toggle-list">
            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showLogo ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Logo</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showLogo}
                  onChange={() => toggleSetting("showLogo")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showShopName ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Shop Name</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showShopName}
                  onChange={() => toggleSetting("showShopName")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showAddress ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Address</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showAddress}
                  onChange={() => toggleSetting("showAddress")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showPhone ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Phone</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showPhone}
                  onChange={() => toggleSetting("showPhone")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showEmail ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Email</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showEmail}
                  onChange={() => toggleSetting("showEmail")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>

        <div className="receipt-option-group">
          <h3>Transaction Details</h3>
          <div className="toggle-list">
            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showDateTime ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Date & Time</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showDateTime}
                  onChange={() => toggleSetting("showDateTime")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showInvoiceNo
                      ? "toggle-icon active"
                      : "toggle-icon"
                  }
                />
                <span>Show Invoice No</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showInvoiceNo}
                  onChange={() => toggleSetting("showInvoiceNo")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showCashier ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Cashier Name</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showCashier}
                  onChange={() => toggleSetting("showCashier")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>

            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showCustomer ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Customer Info</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showCustomer}
                  onChange={() => toggleSetting("showCustomer")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>

        <div className="receipt-option-group">
          <h3>Footer</h3>
          <div className="toggle-list">
            <label className="toggle-item">
              <div className="toggle-label">
                <ToggleLeft
                  size={20}
                  className={
                    settings.showThankYou ? "toggle-icon active" : "toggle-icon"
                  }
                />
                <span>Show Thank You Message</span>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showThankYou}
                  onChange={() => toggleSetting("showThankYou")}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>

          <div className="footer-message-section">
            <h4>Custom Footer Message</h4>
            <textarea
              value={settings.footerMessage}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  footerMessage: e.target.value,
                }))
              }
              rows="4"
              className="footer-textarea"
              placeholder="Thank You! Come Again :)"
            />
          </div>
        </div>
      </div>

      <div className="receipt-actions">
        <button onClick={saveSettings} className="btn-save-receipt">
          <Save size={20} />
          <span>Save Receipt Settings</span>
        </button>
      </div>
    </div>
  );
};

export default ReceiptSettings;
