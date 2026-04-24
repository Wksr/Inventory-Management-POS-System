import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "./SalesReport.css";

const SalesReport = () => {
  const [salesData, setSalesData] = useState({
    title: "Sales Report",
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
    fetchSalesData();
  }, [currentPage, searchQuery, dateFilter, customDateStart, customDateEnd]);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");

      let url = `http://127.0.0.1:8000/api/sales?page=${currentPage}&per_page=${recordsPerPage}`;

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
        const salesArray = data.sales.data || data.sales || [];

        // Calculate summary statistics
        const totalSales = salesArray.reduce(
          (sum, sale) => sum + parseFloat(sale.total || 0),
          0,
        );
        const totalOrders = salesArray.length;
        const averageOrderValue =
          totalOrders > 0 ? totalSales / totalOrders : 0;

        // Count payment methods
        const paymentMethods = {
          cash: 0,
          card: 0,
          transfer: 0,
          credit: 0,
          mobile_money: 0,
        };

        salesArray.forEach((sale) => {
          if (
            sale.payment_method &&
            paymentMethods[sale.payment_method] !== undefined
          ) {
            paymentMethods[sale.payment_method]++;
          }
        });

        // Find most common payment method
        const mostCommonPayment = Object.entries(paymentMethods).sort(
          ([, a], [, b]) => b - a,
        )[0] || ["N/A", 0];

        setSalesData({
          title: `Sales Report (${getDateRangeLabel()})`,
          data: salesArray,
          summary: {
            totalSales,
            totalOrders,
            averageOrderValue,
            mostCommonPayment:
              mostCommonPayment[0].charAt(0).toUpperCase() +
              mostCommonPayment[0].slice(1),
            totalCustomers: [
              ...new Set(
                salesArray
                  .filter((s) => s.customer_id)
                  .map((s) => s.customer_id),
              ),
            ].length,
          },
        });
      } else {
        throw new Error(data.message || "Failed to fetch sales data");
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setError(error.message);
      toast.error("Failed to load sales report");
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
      let url = "http://127.0.0.1:8000/api/sales?per_page=10000"; // large number to get all

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

      const sales = result.sales.data || result.sales || [];

      if (sales.length === 0) {
        toast.error("No sales data to export");
        return;
      }

      // Prepare worksheet data
      const wsData = [
        [
          "Invoice No",
          "Date",
          "Customer",
          "Items",
          "Total (LKR)",
          "Payment Method",
          "Status",
        ],
        ...sales.map((sale) => [
          sale.invoice_no || "",
          new Date(sale.created_at).toLocaleDateString(),
          sale.customer?.name || "Walk-in",
          sale.items_count || (sale.items ? sale.items.length : 0),
          parseFloat(sale.total || 0).toFixed(2),
          sale.payment_method || "",
          sale.status || "",
        ]),
      ];

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

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
      const fileName = `Sales_Report_${range}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);

      toast.success(`Excel exported successfully! (${sales.length} records)`);
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
  const totalPages = Math.ceil(salesData.data.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentSales = salesData.data.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="sales-report-content loading">
        <RefreshCw size={24} />

        <p>Loading sales report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sales-report-content error">
        <AlertCircle size={48} />
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchSalesData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="sales-report-content">
      <div className="sales-report-header">
        <div className="sales-report-title-section">
          <h2 className="sales-report-title">
            <ShoppingCart size={24} />
            {salesData.title}
          </h2>

          <div className="sales-report-actions">
            <div className="sales-filter-section">
              <div className="sales-filter-wrapper">
                <button
                  className="sales-filter-btn"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                >
                  <Filter size={18} />
                  Filter
                </button>
                {showFilterDropdown && (
                  <div className="sales-filter-dropdown" ref={filterRef}>
                    <button
                      className="sales-filter-option"
                      onClick={() => handleFilterSelect("today")}
                    >
                      Today
                    </button>
                    <button
                      className="sales-filter-option"
                      onClick={() => handleFilterSelect("thisweek")}
                    >
                      This Week
                    </button>
                    <button
                      className="sales-filter-option"
                      onClick={() => handleFilterSelect("month")}
                    >
                      This Month
                    </button>
                    <button
                      className="sales-filter-option"
                      onClick={() => handleFilterSelect("year")}
                    >
                      This Year
                    </button>
                    <button
                      className="sales-filter-option"
                      onClick={() => handleFilterSelect("custom")}
                    >
                      Custom Date
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              className="sales-export-btn sales-excel-btn"
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
          <div className="sales-custom-date">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => {
                setCustomDateStart(e.target.value);
                setCurrentPage(1);
              }}
              className="sales-date-input"
            />
            <span className="sales-date-separator">to</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => {
                setCustomDateEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="sales-date-input"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {salesData.summary && (
        <div className="sales-summary-grid">
          <div className="sales-summary-card">
            <div className="sales-summary-label">Total Sales</div>
            <div className="sales-summary-value">
              LKR {formatCurrency(salesData.summary.totalSales)}
            </div>
          </div>
          <div className="sales-summary-card">
            <div className="sales-summary-label">Total Orders</div>
            <div className="sales-summary-value">
              {salesData.summary.totalOrders}
            </div>
          </div>
          <div className="sales-summary-card">
            <div className="sales-summary-label">Avg Order Value</div>
            <div className="sales-summary-value">
              LKR {formatCurrency(salesData.summary.averageOrderValue)}
            </div>
          </div>
          <div className="sales-summary-card">
            <div className="sales-summary-label">Most Common Payment</div>
            <div className="sales-summary-value">
              {salesData.summary.mostCommonPayment}
            </div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="sales-report-table-section">
        <table className="sales-report-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Payment Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentSales.length === 0 ? (
              <tr>
                <td colSpan="7" className="sales-no-data">
                  No sales found
                </td>
              </tr>
            ) : (
              currentSales.map((sale) => (
                <tr key={sale.id} className="sales-report-row">
                  <td className="sales-invoice-cell">{sale.invoice_no}</td>
                  <td className="sales-date-cell">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </td>
                  <td className="sales-customer-cell">
                    {sale.customer ? sale.customer.name : "Walk-in"}
                  </td>
                  <td className="sales-items-cell">
                    {sale.items_count || (sale.items ? sale.items.length : 0)}
                  </td>
                  <td className="sales-amount-cell">
                    LKR {formatCurrency(sale.total)}
                  </td>
                  <td className="sales-payment-cell">
                    <span
                      className={`sales-payment-badge sales-payment-${sale.payment_method?.toLowerCase()}`}
                    >
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="sales-status-cell">
                    <span
                      className={`sales-status-badge sales-status-${sale.status}`}
                    >
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {salesData.data.length > 0 && (
        <div className="sales-report-pagination">
          <div className="sales-pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, salesData.data.length)} of{" "}
            {salesData.data.length} entries
          </div>
          <div className="sales-pagination-buttons">
            <button
              className="sales-pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="sales-page-number">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="sales-pagination-btn"
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

export default SalesReport;
