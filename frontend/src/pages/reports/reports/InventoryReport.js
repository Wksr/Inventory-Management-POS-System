import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "./InventoryReport.css";

const InventoryReport = () => {
  const [inventoryData, setInventoryData] = useState({
    title: "Inventory Report",
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
    fetchInventoryData();
  }, [currentPage, searchQuery, dateFilter, customDateStart, customDateEnd]);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("authToken");

      let url = `http://127.0.0.1:8000/api/inventory/report?page=${currentPage}&per_page=${recordsPerPage}`;

      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      if (dateFilter) {
        url += `&filter=${dateFilter}`;

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
        // Get movements from the paginated response
        const movements = data.movements?.data || data.movements || [];

        // Use the summary from the API response
        const summary = data.summary || {
          total_in: 0,
          total_out: 0,
          net_change: 0,
          total_value_change: 0,
          most_common_movement: "N/A",
          most_common_reference: "N/A",
          total_products: 0,
        };

        setInventoryData({
          title: `Inventory Report (${getDateRangeLabel()})`,
          data: movements,
          summary: {
            totalIn: summary.total_in || 0,
            totalOut: summary.total_out || 0,
            netChange: summary.net_change || 0,
            totalValueChange: summary.total_value_change || 0,
            mostCommonMovement: summary.most_common_movement || "N/A",
            mostCommonReference: summary.most_common_reference || "N/A",
            totalProducts: summary.total_products || 0,
          },
        });
      } else {
        throw new Error(data.message || "Failed to fetch inventory data");
      }
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      setError(error.message);
      toast.error("Failed to load inventory report");
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
      let url =
        "http://127.0.0.1:8000/api/inventory/report/export?per_page=10000";

      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (dateFilter) url += `&filter=${dateFilter}`;
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

      const movements = result.movements || [];

      if (movements.length === 0) {
        toast.error("No inventory data to export");
        return;
      }

      // Prepare worksheet data
      const wsData = [
        [
          "Date",
          "Product",
          "SKU",
          "Type",
          "Reference",
          "Quantity",
          "Stock Before",
          "Stock After",
          "Unit Cost (LKR)",
          "Total Value (LKR)",
          "Reason",
        ],
        ...movements.map((movement) => [
          new Date(movement.created_at).toLocaleDateString(),
          movement.product?.name || "N/A",
          movement.product?.sku || "N/A",
          movement.movement_type === "in" ? "Stock In" : "Stock Out",
          movement.reference_type || "",
          movement.quantity,
          movement.stock_before,
          movement.stock_after,
          parseFloat(movement.unit_cost || 0).toFixed(2),
          (parseFloat(movement.unit_cost || 0) * movement.quantity).toFixed(2),
          movement.reason || "",
        ]),
      ];

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

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
      const fileName = `Inventory_Report_${range}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);

      toast.success(
        `Excel exported successfully! (${movements.length} records)`,
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

  const formatNumber = (number) => {
    return new Intl.NumberFormat("en-US").format(number);
  };

  // Calculate pagination
  const totalPages = Math.ceil(inventoryData.data.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentMovements = inventoryData.data.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="inventory-report-content loading">
        <RefreshCw size={24} />

        <p>Loading inventory report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inventory-report-content error">
        <AlertCircle size={48} />
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchInventoryData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="inventory-report-content">
      <div className="inventory-report-header">
        <div className="inventory-report-title-section">
          <h2 className="inventory-report-title">
            <Package size={24} />
            {inventoryData.title}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="inventory-filter-wrapper" ref={filterRef}>
              <button
                className="inventory-filter-btn"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              >
                <Filter size={18} />
                Filter
              </button>
              {showFilterDropdown && (
                <div className="inventory-filter-dropdown">
                  <button
                    className="inventory-filter-option"
                    onClick={() => handleFilterSelect("today")}
                  >
                    Today
                  </button>
                  <button
                    className="inventory-filter-option"
                    onClick={() => handleFilterSelect("thisweek")}
                  >
                    This Week
                  </button>
                  <button
                    className="inventory-filter-option"
                    onClick={() => handleFilterSelect("month")}
                  >
                    This Month
                  </button>
                  <button
                    className="inventory-filter-option"
                    onClick={() => handleFilterSelect("year")}
                  >
                    This Year
                  </button>
                  <button
                    className="inventory-filter-option"
                    onClick={() => handleFilterSelect("custom")}
                  >
                    Custom Date
                  </button>
                </div>
              )}
            </div>

            <button
              className="inventory-export-btn inventory-excel-btn"
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
          <div className="inventory-custom-date">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => {
                setCustomDateStart(e.target.value);
                setCurrentPage(1);
              }}
              className="inventory-date-input"
            />
            <span className="inventory-date-separator">to</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => {
                setCustomDateEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="inventory-date-input"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {inventoryData.summary && (
        <div className="inventory-summary-grid">
          <div className="inventory-summary-card">
            <div className="inventory-summary-label">Total Stock In</div>
            <div className="inventory-summary-value">
              {formatNumber(inventoryData.summary.totalIn)}
            </div>
          </div>
          <div className="inventory-summary-card">
            <div className="inventory-summary-label">Total Stock Out</div>
            <div className="inventory-summary-value">
              {formatNumber(inventoryData.summary.totalOut)}
            </div>
          </div>
          <div className="inventory-summary-card">
            <div className="inventory-summary-label">Net Stock Change</div>
            <div
              className={`inventory-summary-value ${
                inventoryData.summary.netChange >= 0 ? "positive" : "negative"
              }`}
            >
              {inventoryData.summary.netChange >= 0 ? "+" : ""}
              {formatNumber(inventoryData.summary.netChange)}
            </div>
          </div>
          <div className="inventory-summary-card">
            <div className="inventory-summary-label">Total Value Change</div>
            <div className="inventory-summary-value">
              LKR {formatCurrency(inventoryData.summary.totalValueChange)}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Movements Table */}
      <div className="inventory-report-table-section">
        <table className="inventory-report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Quantity</th>
              <th>Stock Before</th>
              <th>Stock After</th>
              <th>Unit Cost</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {currentMovements.length === 0 ? (
              <tr>
                <td colSpan="10" className="inventory-no-data">
                  No inventory movements found
                </td>
              </tr>
            ) : (
              currentMovements.map((movement) => (
                <tr key={movement.id} className="inventory-report-row">
                  <td className="inventory-date-cell">
                    {new Date(movement.created_at).toLocaleDateString()}
                  </td>
                  <td className="inventory-product-cell">
                    {movement.product?.name || "N/A"}
                  </td>
                  <td className="inventory-sku-cell">
                    {movement.product?.sku || "N/A"}
                  </td>
                  <td className="inventory-type-cell">
                    <span
                      className={`inventory-type-badge inventory-type-${movement.movement_type}`}
                    >
                      {movement.movement_type === "in" ? "In" : "Out"}
                    </span>
                  </td>
                  <td className="inventory-reference-cell">
                    <span
                      className={`inventory-reference-badge inventory-reference-${movement.reference_type}`}
                    >
                      {movement.reference_type}
                    </span>
                  </td>
                  <td
                    className={`inventory-quantity-cell ${
                      movement.movement_type === "in" ? "positive" : "negative"
                    }`}
                  >
                    {movement.movement_type === "in" ? "+" : "-"}
                    {movement.quantity}
                  </td>
                  <td className="inventory-stock-cell">
                    {formatNumber(movement.stock_before)}
                  </td>
                  <td className="inventory-stock-cell">
                    {formatNumber(movement.stock_after)}
                  </td>
                  <td className="inventory-cost-cell">
                    LKR {formatCurrency(movement.unit_cost)}
                  </td>
                  <td className="inventory-reason-cell" title={movement.reason}>
                    {movement.reason.length > 50
                      ? movement.reason.substring(0, 50) + "..."
                      : movement.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {inventoryData.data.length > 0 && (
        <div className="inventory-report-pagination">
          <div className="inventory-pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, inventoryData.data.length)} of{" "}
            {inventoryData.data.length} entries
          </div>
          <div className="inventory-pagination-buttons">
            <button
              className="inventory-pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="inventory-page-number">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="inventory-pagination-btn"
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

export default InventoryReport;
