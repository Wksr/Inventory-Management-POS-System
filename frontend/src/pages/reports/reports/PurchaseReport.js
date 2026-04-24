import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "./PurchaseReport.css";

const PurchaseReport = () => {
  const [purchaseData, setPurchaseData] = useState({
    title: "Purchase Report",
    data: [],
  });
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

  const getDateRangeLabel = () => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "thisweek") return "This Week";
    if (dateFilter === "month") return "This Month";
    if (dateFilter === "year") return "This Year";
    if (dateFilter === "custom") return "Custom Range";
    return "All Time";
  };

  useEffect(() => {
    fetchPurchaseData();
  }, [currentPage, searchQuery, dateFilter, customDateStart, customDateEnd]);

  const fetchPurchaseData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");

      let url = `http://127.0.0.1:8000/api/purchases?page=${currentPage}&per_page=${recordsPerPage}`;

      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      if (dateFilter) {
        url += `&date_filter=${dateFilter}`;

        if (dateFilter === "custom" && customDateStart && customDateEnd) {
          url += `&start_date=${customDateStart}&end_date=${customDateEnd}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        const purchasesArray = data.purchases.data || data.purchases || [];

        // Calculate summary statistics
        const totalPurchases = purchasesArray.reduce(
          (sum, purchase) => sum + parseFloat(purchase.grand_total || 0),
          0,
        );
        const totalOrders = purchasesArray.length;
        const averageOrderValue =
          totalOrders > 0 ? totalPurchases / totalOrders : 0;

        // Count payment methods
        const paymentMethods = {
          cash: 0,
          bank_transfer: 0,
          credit: 0,
          cheque: 0,
        };

        purchasesArray.forEach((purchase) => {
          if (
            purchase.payment_method &&
            paymentMethods[purchase.payment_method] !== undefined
          ) {
            paymentMethods[purchase.payment_method]++;
          }
        });

        // Find most common payment method
        const mostCommonPayment = Object.entries(paymentMethods).sort(
          ([, a], [, b]) => b - a,
        )[0] || ["N/A", 0];

        // Count statuses
        const statusCounts = {
          pending: 0,
          received: 0,
          partial: 0,
          ordered: 0,
          cancelled: 0,
        };

        purchasesArray.forEach((purchase) => {
          if (purchase.status && statusCounts[purchase.status] !== undefined) {
            statusCounts[purchase.status]++;
          }
        });

        // Find most common status
        const mostCommonStatus = Object.entries(statusCounts).sort(
          ([, a], [, b]) => b - a,
        )[0] || ["N/A", 0];

        setPurchaseData({
          title: `Purchase Report (${getDateRangeLabel()})`,
          data: purchasesArray,
          summary: {
            totalPurchases,
            totalOrders,
            averageOrderValue,
            mostCommonPayment:
              mostCommonPayment[0].charAt(0).toUpperCase() +
              mostCommonPayment[0].slice(1).replace("_", " "),
            mostCommonStatus:
              mostCommonStatus[0].charAt(0).toUpperCase() +
              mostCommonStatus[0].slice(1),
            totalSuppliers: [
              ...new Set(
                purchasesArray
                  .filter((p) => p.supplier_id)
                  .map((p) => p.supplier_id),
              ),
            ].length,
          },
        });
      } else {
        throw new Error(data.message || "Failed to fetch purchase data");
      }
    } catch (error) {
      console.error("Error fetching purchase data:", error);
      setError(error.message);
      toast.error("Failed to load purchase report");
    } finally {
      setLoading(false);
    }
  };

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
    try {
      setExporting(true);
      const token = localStorage.getItem("authToken");

      // Build params without pagination to get ALL data
      let url = "http://127.0.0.1:8000/api/purchases?per_page=10000";

      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (dateFilter) url += `&date_filter=${dateFilter}`;
      if (dateFilter === "custom" && customDateStart && customDateEnd) {
        url += `&start_date=${customDateStart}&end_date=${customDateEnd}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch data");

      const result = await response.json();
      if (!result.success) throw new Error(result.message || "No data");

      const purchases = result.purchases.data || result.purchases || [];

      if (purchases.length === 0) {
        toast.error("No purchase data to export");
        return;
      }

      // Prepare worksheet data
      const wsData = [
        [
          "Invoice No",
          "Date",
          "Supplier",
          "Items",
          "Total (LKR)",
          "Payment Method",
          "Status",
        ],
        ...purchases.map((purchase) => [
          purchase.invoice_number || "",
          new Date(purchase.created_at).toLocaleDateString(),
          purchase.supplier?.name || "N/A",
          purchase.items_count || (purchase.items ? purchase.items.length : 0),
          parseFloat(purchase.grand_total || 0).toFixed(2),
          purchase.payment_method || "",
          purchase.status || "",
        ]),
      ];

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Purchase Report");

      // Auto-size columns
      const colWidths = wsData[0].map((_, colIndex) =>
        wsData.reduce(
          (max, row) => Math.max(max, String(row[colIndex] || "").length),
          10,
        ),
      );
      ws["!cols"] = colWidths.map((w) => ({ wch: w + 2 }));

      // Generate filename
      const range =
        dateFilter === "custom"
          ? `${customDateStart}_to_${customDateEnd}`
          : getDateRangeLabel().replace(/ /g, "_");
      const fileName = `Purchase_Report_${range}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);

      toast.success(
        `Excel exported successfully! (${purchases.length} records)`,
      );
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

  // Calculate pagination
  const totalPages = Math.ceil(purchaseData.data.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPurchases = purchaseData.data.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="purchase-report-content loading">
        <RefreshCw size={24} />

        <p>Loading purchase report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="purchase-report-content error">
        <AlertCircle size={48} />
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchPurchaseData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="purchase-report-content">
      <div className="purchase-report-header">
        <div className="purchase-report-title-section">
          <h2 className="purchase-report-title">
            <Package size={24} />
            {purchaseData.title}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="purchase-filter-wrapper" ref={filterRef}>
              <button
                className="purchase-filter-btn"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              >
                <Filter size={18} />
                Filter
              </button>
              {showFilterDropdown && (
                <div className="purchase-filter-dropdown">
                  <button
                    className="purchase-filter-option"
                    onClick={() => handleFilterSelect("today")}
                  >
                    Today
                  </button>
                  <button
                    className="purchase-filter-option"
                    onClick={() => handleFilterSelect("thisweek")}
                  >
                    This Week
                  </button>
                  <button
                    className="purchase-filter-option"
                    onClick={() => handleFilterSelect("month")}
                  >
                    This Month
                  </button>
                  <button
                    className="purchase-filter-option"
                    onClick={() => handleFilterSelect("year")}
                  >
                    This Year
                  </button>
                  <button
                    className="purchase-filter-option"
                    onClick={() => handleFilterSelect("custom")}
                  >
                    Custom Date
                  </button>
                </div>
              )}
            </div>

            <button
              className="purchase-export-btn purchase-excel-btn"
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
          <div className="purchase-custom-date">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => {
                setCustomDateStart(e.target.value);
                setCurrentPage(1);
              }}
              className="purchase-date-input"
            />
            <span className="purchase-date-separator">to</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => {
                setCustomDateEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="purchase-date-input"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {purchaseData.summary && (
        <div className="purchase-summary-grid">
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Total Purchases</div>
            <div className="purchase-summary-value">
              LKR {formatCurrency(purchaseData.summary.totalPurchases)}
            </div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Total Orders</div>
            <div className="purchase-summary-value">
              {purchaseData.summary.totalOrders}
            </div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Avg Order Value</div>
            <div className="purchase-summary-value">
              LKR {formatCurrency(purchaseData.summary.averageOrderValue)}
            </div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Most Common Payment</div>
            <div className="purchase-summary-value">
              {purchaseData.summary.mostCommonPayment}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Table */}
      <div className="purchase-report-table-section">
        <table className="purchase-report-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Items</th>
              <th>Total Amount</th>

              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentPurchases.length === 0 ? (
              <tr>
                <td colSpan="7" className="purchase-no-data">
                  No purchases found
                </td>
              </tr>
            ) : (
              currentPurchases.map((purchase) => (
                <tr key={purchase.id} className="purchase-report-row">
                  <td className="purchase-invoice-cell">
                    {purchase.invoice_number}
                  </td>
                  <td className="purchase-date-cell">
                    {new Date(purchase.created_at).toLocaleDateString()}
                  </td>
                  <td className="purchase-supplier-cell">
                    {purchase.supplier ? purchase.supplier.name : "N/A"}
                  </td>
                  <td className="purchase-items-cell">
                    {purchase.items_count ||
                      (purchase.items ? purchase.items.length : 0)}
                  </td>
                  <td className="purchase-amount-cell">
                    LKR {formatCurrency(purchase.grand_total)}
                  </td>
                  {/* <td className="purchase-payment-cell">
                    <span
                      className={`purchase-payment-badge purchase-payment-${purchase.payment_method?.toLowerCase()}`}
                    >
                      {purchase.payment_method}
                    </span>
                  </td> */}
                  <td className="purchase-status-cell">
                    <span
                      className={`purchase-status-badge purchase-status-${purchase.status}`}
                    >
                      {purchase.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {purchaseData.data.length > 0 && (
        <div className="purchase-report-pagination">
          <div className="purchase-pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, purchaseData.data.length)} of{" "}
            {purchaseData.data.length} entries
          </div>
          <div className="purchase-pagination-buttons">
            <button
              className="purchase-pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="purchase-page-number">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="purchase-pagination-btn"
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

export default PurchaseReport;
