import React, { useState, useEffect } from "react";
import { Gift, Coins, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import "./LoyaltySettings.css";

const LoyaltySettings = () => {
  const [settings, setSettings] = useState({
    enabled: true,
    pointsPerCurrency: 1,
    currencyValue: 100, // LKR amount needed for 1 point
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");

      if (!token) {
        toast.error("Authentication token not found. Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch(
        "http://127.0.0.1:8000/api/loyalty/settings",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          enabled: data.settings.enabled ?? true,
          pointsPerCurrency: data.settings.points_per_currency || 1,
          currencyValue: data.settings.currency_value || 100,
        });
        toast.success("Loyalty settings loaded");
      } else {
        toast.error(data.message || "Failed to load settings");
      }
    } catch (error) {
      console.error("Error loading loyalty settings:", error);
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Save settings to backend
  const saveSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("authToken");

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(
        "http://127.0.0.1:8000/api/loyalty/settings",
        {
          method: "PUT", // or POST if your route uses POST
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: settings.enabled,
            points_per_currency: settings.pointsPerCurrency,
            currency_value: settings.currencyValue,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Loyalty settings saved successfully!");
      } else {
        toast.error(data.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving loyalty settings:", error);
      toast.error("Failed to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  // Rest of your component remains the same...
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? parseFloat(value) || 0
            : value,
    }));
  };

  const resetToDefault = () => {
    setSettings({
      enabled: true,
      pointsPerCurrency: 1,
      currencyValue: 100,
    });
    toast.info("Reset to default settings");
  };

  const calculateExample = () => {
    if (!settings.enabled) return "Program is disabled";
    if (settings.currencyValue <= 0 || settings.pointsPerCurrency <= 0)
      return "Invalid settings";

    const amount = 1000;
    const points = Math.floor(
      (amount / settings.currencyValue) * settings.pointsPerCurrency,
    );
    return `A LKR ${amount} purchase earns ${points} points`;
  };

  if (loading) {
    return (
      <div className="loyalty-settings loading-state">
        <RefreshCw className="load" size={24} />
        <p>Loading loyalty settings...</p>
      </div>
    );
  }

  return (
    <div className="loyalty-settings">
      <div className="loyalty-header">
        <div className="loyalty-icon">
          <Gift size={32} />
        </div>
        <div className="loyalty-header-content">
          <h2>Loyalty Program Settings</h2>
          <p className="loyalty-subtitle">
            Configure how customers earn loyalty points
          </p>
        </div>
      </div>

      <div className="loyalty-main-settings">
        <div className="settings-section">
          <div className="section-header">
            <Gift size={20} />
            <h3>Program Status</h3>
          </div>
          <div className="toggle-group">
            <label className="toggle-item large">
              <div className="toggle-label">
                <span className="toggle-title">Enable Loyalty Program</span>
                <span className="toggle-description">
                  Turn loyalty program on/off for all customers
                </span>
              </div>
              <div className="toggle-switch-large">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={settings.enabled}
                  onChange={handleInputChange}
                  className="toggle-input"
                />
                <span className="toggle-slider-large"></span>
              </div>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Coins size={20} />
            <h3>Points Calculation</h3>
          </div>

          <div className="form-group">
            <label>
              <span className="label-text">Points per Currency Unit</span>
              <span className="label-description">
                How many points customers earn per currency spent
              </span>
            </label>
            <div className="input-with-unit">
              <input
                type="number"
                name="pointsPerCurrency"
                value={settings.pointsPerCurrency}
                onChange={handleInputChange}
                min="0.1"
                step="0.1"
                disabled={!settings.enabled}
              />
              <span className="input-unit">points</span>
            </div>
          </div>

          <div className="form-group">
            <label>
              <span className="label-text">Currency Value per Point</span>
              <span className="label-description">
                Currency amount needed for 1 point
              </span>
            </label>
            <div className="input-with-unit">
              <input
                type="number"
                name="currencyValue"
                value={settings.currencyValue}
                onChange={handleInputChange}
                min="1"
                disabled={!settings.enabled}
              />
              <span className="input-unit">LKR</span>
            </div>
          </div>

          <div className="example-box">
            <h4>Example Calculation</h4>
            <p className="example-text">{calculateExample()}</p>
            <p className="example-formula">
              Points = (Purchase Amount ÷ {settings.currencyValue}) ×{" "}
              {settings.pointsPerCurrency}
            </p>
          </div>
        </div>
      </div>

      <div className="loyalty-summary">
        <div className="summary-card">
          <h4>Current Settings</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Program Status:</span>
              <span className="summary-value">
                {settings.enabled ? (
                  <span className="status-active">Active</span>
                ) : (
                  <span className="status-inactive">Inactive</span>
                )}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Points Rate:</span>
              <span className="summary-value">
                {settings.pointsPerCurrency} point(s) per{" "}
                {settings.currencyValue} LKR
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Calculation:</span>
              <span className="summary-value">
                1 point = {settings.currencyValue} LKR
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="loyalty-actions">
        <button
          className="btn-reset"
          onClick={resetToDefault}
          disabled={saving}
        >
          <RefreshCw size={18} />
          <span>Reset to Default</span>
        </button>
        <button className="btn-save" onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <div className="loading-spinner-small"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LoyaltySettings;
