import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "./CustomerReport.css";

const CustomerReport = () => {
  const [customerData, setCustomerData] = useState({
    title: "Customer Report",
    data: [],
    summary: null,
  });
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const recordsPerPage = 20;
  const filterRef = useRef();

  // Close filter dropdown when clicking outside
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

  // Fetch branches once
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/branches", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setBranches(data.branches || []);
        }
      } catch (err) {
        console.error("Failed to fetch branches", err);
      }
    };
    fetchBranches();
  }, []);

  const getDateRangeLabel = () => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "thisweek") return "This Week";
    if (dateFilter === "month") return "This Month";
    if (dateFilter === "year") return "This Year";
    if (dateFilter === "custom") return "Custom Range";
    return "All Time";
  };

  const fetchCustomerData = useCallback(
    async (forExport = false) => {
      try {
        setLoading(!forExport); // Export කරනකොට loading spinner නොපෙන්වන්න
        setError(null);
        const token = localStorage.getItem("authToken");

        let url = `http://127.0.0.1:8000/api/customers?`;

        // Branch filter (export කරද්දීත් apply කරන්න)
        if (selectedBranchId !== "all") {
          url += `branch_id=${selectedBranchId}&`;
        }

        if (!forExport) {
          url += `page=${currentPage}&per_page=${recordsPerPage}&`;
        } else {
          url += `per_page=10000&`; // Export සඳහා සේරම data ගන්න
        }

        if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
        if (dateFilter) url += `date_filter=${dateFilter}&`;
        if (dateFilter === "custom" && customDateStart && customDateEnd) {
          url += `start_date=${customDateStart}&end_date=${customDateEnd}&`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const customersArray = data.customers?.data || data.customers || [];

          if (forExport) {
            return customersArray; // Export සඳහා data return කරන්න
          }

          // Normal report summary calculation
          const totalCustomers = customersArray.length;
          const totalPurchases = customersArray.reduce(
            (sum, c) => sum + parseFloat(c.total_purchases || 0),
            0,
          );
          const totalLoyaltyPoints = customersArray.reduce(
            (sum, c) => sum + parseFloat(c.loyalty_points || 0),
            0,
          );
          const averagePurchase =
            totalCustomers > 0 ? totalPurchases / totalCustomers : 0;

          const statusCounts = { active: 0, inactive: 0 };
          customersArray.forEach((c) => {
            if (c.status && statusCounts[c.status] !== undefined) {
              statusCounts[c.status]++;
            }
          });

          const customersWithLoyalty = customersArray.filter(
            (c) => parseFloat(c.loyalty_points || 0) > 0,
          ).length;

          const topSpender = customersArray.reduce(
            (max, c) =>
              parseFloat(c.total_purchases || 0) >
              parseFloat(max.total_purchases || 0)
                ? c
                : max,
            { total_purchases: 0 },
          );

          const mostLoyal = customersArray.reduce(
            (max, c) =>
              (c.total_visits || 0) > (max.total_visits || 0) ? c : max,
            { total_visits: 0 },
          );

          setCustomerData({
            title: `Customer Report (${getDateRangeLabel()}) ${selectedBranchId !== "all" ? " - " + (branches.find((b) => b.id === Number(selectedBranchId))?.name || "Branch") : "(All Branches)"}`,
            data: customersArray,
            summary: {
              totalCustomers,
              totalPurchases,
              totalLoyaltyPoints,
              averagePurchase,
              activeCustomers: statusCounts.active || 0,
              customersWithLoyalty,
              topSpenderName: topSpender.name || "N/A",
              topSpenderAmount: parseFloat(topSpender.total_purchases || 0),
              mostLoyalName: mostLoyal.name || "N/A",
              mostLoyalVisits: mostLoyal.total_visits || 0,
            },
          });
        } else {
          throw new Error(data.message || "Failed to fetch customer data");
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        if (!forExport) {
          setError(error.message);
          toast.error("Failed to load customer report");
        }
        return forExport ? [] : null;
      } finally {
        if (!forExport) setLoading(false);
      }
    },
    [
      currentPage,
      searchQuery,
      dateFilter,
      customDateStart,
      customDateEnd,
      selectedBranchId,
      branches,
    ],
  );

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleFilterSelect = (filter) => {
    setDateFilter(filter);
    setShowFilterDropdown(false);
    setCurrentPage(1);
    if (filter === "custom") {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // fetchCustomerData එකෙන් ALL data ගන්න (forExport = true)
      const allCustomers = await fetchCustomerData(true);

      if (allCustomers.length === 0) {
        toast.error("No customer data to export");
        return;
      }

      const wsData = [
        [
          "Customer Name",
          "Phone",
          "Email",
          "Total Purchases (LKR)",
          "Total Visits",
          "Loyalty Points",
          "Status",
          "Last Visit",
          "Created Date",
          "Branch", // ← Branch name එකත් export කරන්න
        ],
        ...allCustomers.map((customer) => [
          customer.name || "",
          customer.phone || "",
          customer.email || "",
          parseFloat(customer.total_purchases || 0).toFixed(2),
          customer.total_visits || 0,
          parseFloat(customer.loyalty_points || 0).toFixed(2),
          customer.status || "",
          customer.last_visit
            ? new Date(customer.last_visit).toLocaleDateString()
            : "Never",
          new Date(customer.created_at).toLocaleDateString(),
          customer.branch?.name || "N/A", // ← Branch name එක එකතු කළා
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customer Report");

      // Auto-size columns
      const colWidths = wsData[0].map((_, colIndex) =>
        wsData.reduce(
          (max, row) => Math.max(max, String(row[colIndex] || "").length),
          10,
        ),
      );
      ws["!cols"] = colWidths.map((w) => ({ wch: w + 2 }));

      // Filename එකට branch info එකත් එකතු කරන්න
      const branchName =
        selectedBranchId !== "all"
          ? branches.find((b) => b.id === Number(selectedBranchId))?.name ||
            "Branch"
          : "All Branches";
      const range =
        dateFilter === "custom"
          ? `${customDateStart}_to_${customDateEnd}`
          : getDateRangeLabel().replace(/ /g, "_");
      const fileName = `Customer_Report_${range}_${branchName.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast.success(`Excel exported! (${allCustomers.length} records)`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export Excel");
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat("en-US").format(number);
  };

  // Calculate pagination
  const totalPages = Math.ceil(customerData.data.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentCustomers = customerData.data.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="customer-report-content loading">
        <RefreshCw size={24} />

        <p>Loading customer report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-report-content error">
        <AlertCircle size={48} />
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchCustomerData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="customer-report-content">
      <div className="customer-report-header">
        <div className="customer-report-title-section">
          <h2 className="customer-report-title">
            <Users size={24} />
            {customerData.title}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="customer-branch-selector">
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="customer-filter-wrapper" ref={filterRef}>
              <button
                className="customer-filter-btn"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              >
                <Filter size={18} />
                Filter
              </button>
              {showFilterDropdown && (
                <div className="customer-filter-dropdown">
                  <button
                    className="customer-filter-option"
                    onClick={() => handleFilterSelect("today")}
                  >
                    Today
                  </button>
                  <button
                    className="customer-filter-option"
                    onClick={() => handleFilterSelect("thisweek")}
                  >
                    This Week
                  </button>
                  <button
                    className="customer-filter-option"
                    onClick={() => handleFilterSelect("month")}
                  >
                    This Month
                  </button>
                  <button
                    className="customer-filter-option"
                    onClick={() => handleFilterSelect("year")}
                  >
                    This Year
                  </button>
                  <button
                    className="customer-filter-option"
                    onClick={() => handleFilterSelect("custom")}
                  >
                    Custom Date
                  </button>
                </div>
              )}
            </div>

            <button
              className="customer-export-btn customer-excel-btn"
              onClick={exportToExcel}
              disabled={exporting || loading}
            >
              {exporting ? (
                <>
                  <RefreshCw size={16} />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Export Excel
                </>
              )}
            </button>
          </div>
        </div>

        {showCustomDate && (
          <div className="customer-custom-date">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => {
                setCustomDateStart(e.target.value);
                setCurrentPage(1);
              }}
              className="customer-date-input"
            />
            <span className="customer-date-separator">to</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => {
                setCustomDateEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="customer-date-input"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {customerData.summary && (
        <div className="customer-summary-grid">
          <div className="customer-summary-card">
            <div className="customer-summary-label">Total Customers</div>
            <div className="customer-summary-value">
              {formatNumber(customerData.summary.totalCustomers)}
            </div>
            <div className="customer-summary-sub">
              Active: {formatNumber(customerData.summary.activeCustomers)}
            </div>
          </div>
          <div className="customer-summary-card">
            <div className="customer-summary-label">Total Purchases</div>
            <div className="customer-summary-value">
              LKR {formatCurrency(customerData.summary.totalPurchases)}
            </div>
            <div className="customer-summary-sub">
              Avg: LKR {formatCurrency(customerData.summary.averagePurchase)}
            </div>
          </div>
          <div className="customer-summary-card">
            <div className="customer-summary-label">Loyalty Points</div>
            <div className="customer-summary-value">
              {formatNumber(customerData.summary.totalLoyaltyPoints)}
            </div>
            <div className="customer-summary-sub">
              {customerData.summary.customersWithLoyalty} customers have points
            </div>
          </div>
          <div className="customer-summary-card">
            <div className="customer-summary-label">Most Loyal</div>
            <div className="customer-summary-value">
              {customerData.summary.mostLoyalName}
            </div>
            <div className="customer-summary-sub">
              {customerData.summary.mostLoyalVisits} visits
            </div>
          </div>
        </div>
      )}

      {/* Customer Table */}
      <div className="customer-report-table-section">
        <table className="customer-report-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Total Purchases</th>
              <th>Visits</th>
              <th>Loyalty Points</th>
              <th>Status</th>
              <th>Last Visit</th>
            </tr>
          </thead>
          <tbody>
            {currentCustomers.length === 0 ? (
              <tr>
                <td colSpan="8" className="customer-no-data">
                  No customers found
                </td>
              </tr>
            ) : (
              currentCustomers.map((customer) => (
                <tr key={customer.id} className="customer-report-row">
                  <td className="customer-name-cell">
                    <div className="customer-name-wrapper">
                      <div className="customer-name">{customer.name}</div>
                      <div className="customer-id">ID: {customer.id}</div>
                    </div>
                  </td>
                  <td className="customer-phone-cell">
                    {customer.phone || "N/A"}
                  </td>
                  <td className="customer-email-cell">
                    {customer.email || "N/A"}
                  </td>
                  <td className="customer-purchases-cell">
                    <div className="purchase-amount">
                      LKR {formatCurrency(customer.total_purchases || 0)}
                    </div>
                    {customer.total_visits > 0 && (
                      <div className="purchase-detail">
                        {customer.total_visits} purchase
                        {customer.total_visits !== 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="customer-visits-cell">
                    {formatNumber(customer.total_visits || 0)}
                  </td>
                  <td className="customer-loyalty-cell">
                    <span className="loyalty-points-badge">
                      {formatNumber(customer.loyalty_points || 0)} pts
                    </span>
                  </td>
                  <td className="customer-status-cell">
                    <span
                      className={`customer-status-badge customer-status-${customer.status}`}
                    >
                      {customer.status || "active"}
                    </span>
                  </td>
                  <td className="customer-lastvisit-cell">
                    {customer.last_visit
                      ? new Date(customer.last_visit).toLocaleDateString()
                      : "Never"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {customerData.data.length > 0 && (
        <div className="customer-report-pagination">
          <div className="customer-pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, customerData.data.length)} of{" "}
            {customerData.data.length} entries
          </div>
          <div className="customer-pagination-buttons">
            <button
              className="customer-pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="customer-page-number">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="customer-pagination-btn"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReport;
