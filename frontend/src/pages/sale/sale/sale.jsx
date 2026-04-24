import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import "./sale.css";
import ViewSaleModal from "./ViewSaleModal";
import EditSaleModal from "./EditSaleModal";
import offlineDB from "../../../utils/offlineDB";

const Sale = () => {
  const [sales, setSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState(null);

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

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);

      try {
        let salesToDisplay = [];

        if (navigator.onLine) {
          // Online → fetch from server
          const token = localStorage.getItem("authToken");
          if (!token) {
            throw new Error("No authentication token found");
          }

          let url = `http://127.0.0.1:8000/api/sales?page=${currentPage}&per_page=${recordsPerPage}`;

          if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
          if (dateFilter) {
            url += `&date_filter=${dateFilter}`;
            if (dateFilter === "custom" && customDateStart && customDateEnd) {
              url += `&start_date=${customDateStart}&end_date=${customDateEnd}`;
            }
          }

          console.log("Fetching from:", url);

          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const data = await res.json();

          if (data.success) {
            // Get sales from response
            const serverSales =
              data.sales?.data || data.sales || data.data || [];
            console.log("Server sales count:", serverSales.length);

            // Use server sales directly
            salesToDisplay = serverSales;

            // Cache them for offline use (with error handling)
            try {
              await offlineDB.cacheServerSales(serverSales);
            } catch (cacheErr) {
              console.warn(
                "Cache failed, but continuing with server data:",
                cacheErr,
              );
            }
          }
        } else {
          // Offline → get from IndexedDB
          console.log("Offline mode - loading from IndexedDB");
          salesToDisplay = await offlineDB.getAllSalesForDisplay();
          console.log("Loaded from IndexedDB:", salesToDisplay.length);
        }

        // Remove duplicates (prioritize by id)
        const uniqueSalesMap = new Map();

        salesToDisplay.forEach((sale) => {
          const saleId = sale.id || sale.local_id;
          if (saleId) {
            uniqueSalesMap.set(saleId, sale);
          }
        });

        const uniqueSales = Array.from(uniqueSalesMap.values());

        // Sort by date (newest first)
        uniqueSales.sort(
          (a, b) =>
            new Date(b.created_at || b.date) - new Date(a.created_at || a.date),
        );

        console.log("Final unique sales to display:", uniqueSales.length);
        setSales(uniqueSales);
      } catch (err) {
        console.error("Sales load error:", err);
        toast.error("Failed to load sales data");
      } finally {
        setLoading(false);
      }
    };

    loadSales();
  }, [currentPage, searchQuery, dateFilter, customDateStart, customDateEnd]);

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

  // Calculate pagination
  const totalPages = Math.ceil(sales.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentSales = sales.slice(startIndex, endIndex);

  const handleView = (saleId) => {
    setSelectedSaleId(saleId);
    setShowViewModal(true);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleEdit = (saleId) => {
    // Find the sale from the current sales list
    const saleToEdit = sales.find((sale) => sale.id === saleId);
    if (saleToEdit) {
      setSelectedSaleForEdit(saleToEdit);
    }
  };

  const handleSaleUpdated = (updatedSale) => {
    setSales((prevSales) =>
      prevSales.map((sale) =>
        sale.id === updatedSale.id ? updatedSale : sale,
      ),
    );
    setSelectedSaleForEdit(null);
    toast.success("Sale updated successfully");
  };

  const handleDelete = async (saleId) => {
    toast.warning(`Delete Sale?`, {
      description: "All sale details will be removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/sales/${saleId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (data.success) {
              setSales((prev) => prev.filter((sale) => sale.id !== saleId));

              toast.success("Sale deleted successfully");

              if (data.restocked_items) {
                toast.info(
                  `${data.restocked_items} items restocked to inventory`,
                );
              }
            } else {
              throw new Error(data.message || "Failed to delete sale");
            }
          } catch (error) {
            console.error("Error deleting sale:", error);
            toast.error("Failed to delete sale: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Sale deletion cancelled"),
      },
    });
  };

  return (
    <div className="sale-container">
      <ViewSaleModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedSaleId(null);
        }}
        saleId={selectedSaleId}
      />

      <EditSaleModal
        isOpen={!!selectedSaleForEdit}
        onClose={() => setSelectedSaleForEdit(null)}
        onSaleUpdated={handleSaleUpdated}
        sale={selectedSaleForEdit}
      />
      <div className="sale-header-section">
        <div className="sale-search-section">
          <div className="sale-search-box">
            <Search className="sale-search-icon" size={20} />
            <input
              type="text"
              placeholder="Search sales..."
              className="sale-search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="sale-filter-section">
          <div className="sale-filter-wrapper" ref={filterRef}>
            <button
              className="sale-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="sale-filter-dropdown">
                <button
                  className="sale-filter-option"
                  onClick={() => handleFilterSelect("")}
                >
                  All
                </button>
                <button
                  className="sale-filter-option"
                  onClick={() => handleFilterSelect("today")}
                >
                  Today
                </button>
                <button
                  className="sale-filter-option"
                  onClick={() => handleFilterSelect("thisweek")}
                >
                  This Week
                </button>
                <button
                  className="sale-filter-option"
                  onClick={() => handleFilterSelect("month")}
                >
                  Month
                </button>
                <button
                  className="sale-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCustomDate && (
        <div className="sale-custom-date">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => {
              setCustomDateStart(e.target.value);
              setCurrentPage(1);
            }}
            className="sale-date-input"
          />
          <span className="sale-date-separator">to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => {
              setCustomDateEnd(e.target.value);
              setCurrentPage(1);
            }}
            className="sale-date-input"
          />
        </div>
      )}

      <div className="sale-table-section">
        <table className="sale-data-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Total Amount</th>
              <th>Payment Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="sale-loading-row">
                  Loading...
                </td>
              </tr>
            ) : currentSales.length === 0 ? (
              <tr>
                <td colSpan="6" className="sale-no-data">
                  No sales found
                </td>
              </tr>
            ) : (
              currentSales.map((sale) => (
                <tr key={sale.id} className="sale-table-row">
                  <td className="sale-invoice-cell">
                    {sale.invoice_no ? (
                      sale.invoice_no
                    ) : sale.is_pending || sale.local_id ? (
                      <span className="pending-invoice-label">
                        PENDING {String(sale.local_id || "").slice(-8)}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="sale-date-cell">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </td>
                  <td className="sale-customer-cell">
                    {sale.customer ? sale.customer.name : "Walk-in Customer"}
                  </td>
                  <td className="sale-amount-cell">
                    LKR{" "}
                    {parseFloat(sale.total || sale.subtotal).toLocaleString()}
                  </td>
                  <td className="sale-payment-cell">
                    <span
                      className={`sale-payment-badge sale-payment-${(sale.payment_method || "unknown").toLowerCase()}`}
                    >
                      {sale.payment_method || "Unknown"}
                    </span>
                  </td>
                  <td className="sale-action-cell">
                    <div className="sale-action-buttons">
                      <button
                        className="sale-action-btn sale-view-btn"
                        onClick={() => handleView(sale.id)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {/* <button
                        className="sale-action-btn sale-edit-btn"
                        onClick={() => handleEdit(sale.id)}
                        title="Edit Sale"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="sale-action-btn sale-delete-btn"
                        onClick={() => handleDelete(sale.id)}
                        title="Delete Sale"
                      >
                        <Trash2 size={16} />
                      </button> */}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="sale-footer-section">
        <div className="sale-pagination-info">
          Showing {startIndex + 1} to {Math.min(endIndex, sales.length)} of{" "}
          {sales.length} entries
        </div>
        <div className="sale-pagination-buttons">
          <button
            className="sale-pagination-btn"
            onClick={handlePrevious}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
            Previous
          </button>
          <span className="sale-page-number">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="sale-pagination-btn"
            onClick={handleNext}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sale;
