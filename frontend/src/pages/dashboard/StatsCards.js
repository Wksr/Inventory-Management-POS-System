import React, { useState, useEffect } from "react";
import { ShoppingCart, Users, Package, Calendar, X } from "lucide-react";
import "./StatsCards.css";

const StatsCards = () => {
  const [dateFilter, setDateFilter] = useState("today");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [stats, setStats] = useState({
    sales: "0",
    customers: "0",
    stock: "0",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [dateFilter, customDateStart, customDateEnd]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");

      // Build query parameters based on filter
      const params = new URLSearchParams();
      params.append("filter", dateFilter);

      if (dateFilter === "custom" && customDateStart && customDateEnd) {
        params.append("start_date", customDateStart);
        params.append("end_date", customDateEnd);
      }

      const res = await fetch(
        `http://127.0.0.1:8000/api/dashboard/stats?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        // Use mock data for development
        const mockStats = getMockStats();
        setStats(mockStats);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setStats({
          sales: formatNumber(data.sales_total || 0),
          customers: formatNumber(data.customers_count || 0),
          stock: formatNumber(data.stock || 0),
        });
      }
    } catch (err) {
      console.error("Stats fetch failed:", err);
      const mockStats = getMockStats();
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const getMockStats = () => {
    const baseStats = {
      today: { sales: "0", customers: "0", stock: "0" },
      thisweek: { sales: "0", customers: "0", stock: "0" },
      month: { sales: "0", customers: "0", stock: "0" },
      custom: { sales: "0", customers: "0", stock: "0" },
    };

    return baseStats[dateFilter] || baseStats.today;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const handleFilterChange = (filter) => {
    setDateFilter(filter);
    if (filter !== "custom") {
      setShowCustomDate(false);
      setCustomDateStart("");
      setCustomDateEnd("");
    } else {
      setShowCustomDate(true);
    }
  };

  const handleCustomDateApply = () => {
    if (customDateStart && customDateEnd) {
      fetchStats();
    }
  };

  const handleReset = () => {
    setDateFilter("today");
    setShowCustomDate(false);
    setCustomDateStart("");
    setCustomDateEnd("");
  };

  const getDateRangeText = () => {
    switch (dateFilter) {
      case "today":
        return "Today";
      case "thisweek":
        return "This Week";
      case "month":
        return "This Month";
      case "custom":
        return customDateStart && customDateEnd
          ? `${formatDate(customDateStart)} - ${formatDate(customDateEnd)}`
          : "Custom Range";
      default:
        return "Today";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div className="stats-cards">
      <div className="stats-header">
        <h2 className="stats-title"></h2>

        <div className="date-filter-wrapper">
          <div className="date-filter-dropdown">
            <button className="filter-dropdown-btn">
              <Calendar size={16} />
              <span>{getDateRangeText()}</span>
            </button>

            <div className="filter-dropdown-content">
              <button
                className={`dropdown-item ${
                  dateFilter === "today" ? "active" : ""
                }`}
                onClick={() => handleFilterChange("today")}
              >
                Today
              </button>
              <button
                className={`dropdown-item ${
                  dateFilter === "thisweek" ? "active" : ""
                }`}
                onClick={() => handleFilterChange("thisweek")}
              >
                This Week
              </button>
              <button
                className={`dropdown-item ${
                  dateFilter === "month" ? "active" : ""
                }`}
                onClick={() => handleFilterChange("month")}
              >
                This Month
              </button>
              <button
                className={`dropdown-item ${
                  dateFilter === "custom" ? "active" : ""
                }`}
                onClick={() => handleFilterChange("custom")}
              >
                Custom Range
              </button>

              {(dateFilter !== "today" || customDateStart || customDateEnd) && (
                <div className="dropdown-divider"></div>
              )}

              {(dateFilter !== "today" || customDateStart || customDateEnd) && (
                <button
                  className="dropdown-item reset-btn"
                  onClick={handleReset}
                >
                  <X size={14} />
                  Reset to Today
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCustomDate && (
        <div className="custom-date-picker">
          <div className="date-inputs">
            <div className="date-input-group">
              <label>From</label>
              <input
                type="date"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
                className="card-date-input"
                max={customDateEnd || new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="date-input-group">
              <label>To</label>
              <input
                type="date"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
                className="card-date-input"
                min={customDateStart}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <button
              className="apply-btn"
              onClick={handleCustomDateApply}
              disabled={!customDateStart || !customDateEnd}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon sales">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Sales</div>
            <div className="stat-value">
              {loading ? (
                <div className="loading-dots">Loading</div>
              ) : (
                `LKR ${stats.sales}`
              )}
            </div>
            <div className="stat-period">{getDateRangeText()}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon customers">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Customers</div>
            <div className="stat-value">
              {loading ? (
                <div className="loading-dots">Loading</div>
              ) : (
                stats.customers
              )}
            </div>
            <div className="stat-period">{getDateRangeText()}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stock">
            <Package size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Stock</div>
            <div className="stat-value">
              {loading ? (
                <div className="loading-dots">Loading</div>
              ) : (
                stats.stock
              )}
            </div>
            <div className="stat-period">Current</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
