import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import ProfitChart from "./ProfitChart";
import "./ProfitReport.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ProfitReport = () => {
  const [profitData, setProfitData] = useState({
    title: "Profit Analysis",
    data: [
      { label: "Total Revenue", value: "LKR 0" },
      { label: "Total Cost", value: "LKR 0" },
      { label: "Net Profit", value: "LKR 0" },
      { label: "Profit Margin", value: "0%" },
    ],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0], // First day of current month
    endDate: new Date().toISOString().split("T")[0], // Today
    filter: "month", // today, week, month, year, custom
  });

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef();
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getDateRangeLabel = useCallback(() => {
    switch (dateRange.filter) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "year":
        return "This Year";
      case "custom":
        return "Custom";
      default:
        return "This Month";
    }
  }, [dateRange.filter]);

  const fetchProfitData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");

      if (!token) {
        throw new Error("No authentication token found");
      }

      // Build query parameters
      const params = new URLSearchParams({
        filter: dateRange.filter,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/reports/profit?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch profit data");
      }

      const profitMargin =
        data.total_revenue > 0
          ? ((data.net_profit / data.total_revenue) * 100).toFixed(1)
          : 0;

      setProfitData({
        title: `Profit Analysis (${getDateRangeLabel()})`,
        data: [
          {
            label: "Total Revenue",
            value: `LKR ${formatCurrency(data.total_revenue || 0)}`,
            rawValue: data.total_revenue || 0,
          },
          {
            label: "Total Cost",
            value: `LKR ${formatCurrency(data.total_cost || 0)}`,
            rawValue: data.total_cost || 0,
          },
          {
            label: "Net Profit",
            value: `LKR ${formatCurrency(data.net_profit || 0)}`,
            rawValue: data.net_profit || 0,
            isProfit: data.net_profit >= 0,
          },
          {
            label: "Profit Margin",
            value: `${profitMargin}%`,
            rawValue: profitMargin,
          },
        ],
        dailyData: data.daily_profit || [],
        topProducts: data.top_profitable_products || [],
        monthlyTrend: data.monthly_trend || [],
      });
    } catch (error) {
      console.error("Error fetching profit data:", error);
      setError(error.message);
      toast.error("Failed to load profit report");
    } finally {
      setLoading(false);
    }
  }, [dateRange, getDateRangeLabel]); // Add getDateRangeLabel as dependency

  useEffect(() => {
    fetchProfitData();
  }, [fetchProfitData]); // Now includes fetchProfitData as dependency

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleFilterSelect = (filter) => {
    setDateRange((prev) => ({
      ...prev,
      filter,
    }));
    setShowFilterDropdown(false);

    // Calculate dates based on filter
    const today = new Date();
    let startDate = new Date();

    switch (filter) {
      case "today":
        startDate = today;
        break;
      case "week":
        startDate = new Date(today.setDate(today.getDate() - 7));
        break;
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case "custom":
        // Show custom date inputs
        return;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setDateRange((prev) => ({
      ...prev,
      filter,
      startDate: startDate.toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    }));
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({
      ...prev,
      [name]: value,
      filter: "custom",
    }));
  };

  const exportToExcel = () => {
    if (!profitData?.dailyData || profitData.dailyData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ["Profit Report", getDateRangeLabel()],
      [""],
      ["Total Revenue", profitData.data[0].value],
      ["Total Cost", profitData.data[1].value],
      ["Net Profit", profitData.data[2].value],
      ["Profit Margin", profitData.data[3].value],
    ];

    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

    // Daily Profit Sheet
    const dailyData = profitData.dailyData.map((item) => ({
      Date: item.date,
      Revenue: item.revenue || 0,
      Cost: item.cost || 0,
      Profit: item.profit || 0,
    }));

    const dailyWS = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, dailyWS, "Daily Profit");

    // Export file
    const fileName = `Profit_Report_${getDateRangeLabel().replace(" ", "_")}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, fileName);

    toast.success("Excel report exported successfully!");
  };

  if (loading) {
    return (
      <div className="profit-report-content loading">
        <RefreshCw size={24} />

        <p>Loading profit report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profit-report-content error">
        <AlertCircle size={48} />
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchProfitData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="profit-report-content">
      <div className="profit-report-header">
        <div className="profit-report-title-section">
          <h2 className="profit-report-title">
            <FileText size={24} />
            {profitData.title}
          </h2>

          {/* This div contains both filter and export buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="profit-filter-wrapper" ref={filterRef}>
              <button
                className="profit-filter-btn"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              >
                <Filter size={18} />
                Filter
              </button>
              {showFilterDropdown && (
                <div className="profit-filter-dropdown">
                  <button
                    className="profit-filter-option"
                    onClick={() => handleFilterSelect("today")}
                  >
                    Today
                  </button>
                  <button
                    className="profit-filter-option"
                    onClick={() => handleFilterSelect("thisweek")}
                  >
                    This Week
                  </button>
                  <button
                    className="profit-filter-option"
                    onClick={() => handleFilterSelect("month")}
                  >
                    This Month
                  </button>
                  <button
                    className="profit-filter-option"
                    onClick={() => handleFilterSelect("year")}
                  >
                    This Year
                  </button>
                  <button
                    className="profit-filter-option"
                    onClick={() => handleFilterSelect("custom")}
                  >
                    Custom Date
                  </button>
                </div>
              )}
            </div>

            <button onClick={exportToExcel} className="profit-export-btn excel">
              <FileSpreadsheet size={18} />
              Export Excel
            </button>
          </div>
        </div>

        {/* Show custom date inputs only when filter is 'custom' */}
        {dateRange.filter === "custom" && (
          <div className="profit-custom-date">
            <input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
              className="profit-date-input"
            />
            <span className="profit-date-separator">to</span>
            <input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
              className="profit-date-input"
            />
          </div>
        )}
      </div>

      <div className="profit-report-grid">
        {profitData.data.map((item, index) => (
          <div
            key={index}
            className={`profit-report-card ${
              item.isProfit !== undefined
                ? item.isProfit
                  ? "profit-positive"
                  : "profit-negative"
                : ""
            }`}
          >
            <div className="profit-report-label">{item.label}</div>
            <div className="profit-report-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="profit-report-chart-placeholder">
        <ProfitChart
          data={profitData.dailyData || []}
          chartType="line"
          height={350}
        />
      </div>
    </div>
  );
};

export default ProfitReport;
