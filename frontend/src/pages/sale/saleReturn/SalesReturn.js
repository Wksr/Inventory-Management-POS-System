import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import "./salesReturn.css";
import SalesReturnModal from "./SalesReturnModal";
import ViewSalesReturnModal from "./ViewSalesReturnModal";
import EditSalesReturnModal from "./EditSalesReturnModal";
import offlineDB from "../../../utils/offlineDB";

const SalesReturn = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(""); // Changed to track filter type
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [salesReturns, setSalesReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

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
    fetchSalesReturns();
  }, []);

  const fetchSalesReturns = async () => {
    setLoading(true);

    try {
      let salesReturnsToDisplay = [];

      if (navigator.onLine) {
        // ONLINE MODE (ඔයාගේ original code එක same)
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("No auth token");

        let url = `http://127.0.0.1:8000/api/sales-returns?page=${currentPage}&per_page=${recordsPerPage}`;
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        if (dateFilter) {
          url += `&date_filter=${dateFilter}`;
          if (dateFilter === "custom" && customDateStart && customDateEnd) {
            url += `&start_date=${customDateStart}&end_date=${customDateEnd}`;
          }
        }

        console.log("Fetching sales returns from:", url);

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

        const data = await res.json();

        if (data.success) {
          const serverReturns = data.sales_returns?.data || data.data || [];
          console.log("Server sales returns count:", serverReturns.length);

          salesReturnsToDisplay = serverReturns;

          // Cache කරන්න
          await offlineDB.cacheServerSaleReturns?.(serverReturns);
        }
      } else {
        // OFFLINE MODE - Pending + Synced දෙකම ගන්න
        console.log("Offline mode - loading sales returns from IndexedDB");

        // ★★★ Pending returns ගන්න (sync_status: "pending" filter කරන්න ඕනේ නැහැ)
        const pendingReturns =
          (await offlineDB.getPendingSaleReturns?.()) || [];
        const syncedReturns =
          (await offlineDB.getCachedServerSaleReturns?.()) || [];

        console.log(
          `Offline: Pending returns: ${pendingReturns.length}, Synced: ${syncedReturns.length}`,
        );

        // Merge කරන්න
        salesReturnsToDisplay = [...pendingReturns, ...syncedReturns];

        // Duplicates remove කරන්න
        const uniqueMap = new Map();
        salesReturnsToDisplay.forEach((ret) => {
          const key = ret.local_id || ret.id;
          if (key) uniqueMap.set(key, ret);
        });

        salesReturnsToDisplay = Array.from(uniqueMap.values());

        // Newest first sort කරන්න
        salesReturnsToDisplay.sort((a, b) => {
          const dateA = new Date(a.return_date || a.created_at || 0);
          const dateB = new Date(b.return_date || b.created_at || 0);
          return dateB - dateA;
        });

        if (pendingReturns.length > 0) {
          toast.info(
            `Offline mode: Showing ${pendingReturns.length} pending sale returns`,
          );
        }
      }

      setSalesReturns(salesReturnsToDisplay);
    } catch (err) {
      console.error("Sales returns load error:", err);
      toast.error("Failed to load sales returns");

      // Fallback to pending returns only
      try {
        const fallback = (await offlineDB.getPendingSaleReturns?.()) || [];
        setSalesReturns(fallback);
      } catch (fallbackErr) {
        console.error("Fallback failed:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    // Get the return number for display in the toast
    const returnToDelete = salesReturns.find((item) => item.id === id);
    const returnNo = returnToDelete?.return_no || `#${id}`;

    toast.warning("Delete Sales Return?", {
      description: `Delete All Sale Returns Details ${returnNo}? `,
      duration: 5000, // Give user more time to decide
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/sales-returns/${id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            // Check content type first
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const text = await response.text();
              console.error("Server returned non-JSON:", text);
              throw new Error("Server returned an error page");
            }

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.message || `HTTP error! status: ${response.status}`,
              );
            }

            if (data.success) {
              toast.success("Sales return deleted successfully!");
              // Update local state immediately
              setSalesReturns(salesReturns.filter((item) => item.id !== id));
            } else {
              throw new Error(data.message || "Failed to delete sales return");
            }
          } catch (error) {
            console.error("Error deleting sales return:", error);
            toast.error("Failed to delete sales return: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleView = (id) => {
    setSelectedReturnId(id);
    setViewModalOpen(true);
  };

  const handleEdit = (id) => {
    setSelectedReturnId(id);
    setEditModalOpen(true);
  };

  const handleAddSalesReturn = () => {
    setShowReturnModal(true);
  };

  const handleReturnAdded = (newReturn) => {
    setSalesReturns((prev) => [newReturn, ...prev]);
    setShowReturnModal(false);
    toast.success("Sales return created successfully!");
  };

  const handleFilterSelect = (filter) => {
    setDateFilter(filter);
    setShowFilterDropdown(false);
    if (filter === "custom") {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
      setCustomDateStart("");
      setCustomDateEnd("");
    }
  };

  const applyDateFilter = (returnItem) => {
    if (!returnItem.return_date) return false;

    const returnDate = new Date(returnItem.return_date.split(" ")[0]); // Get date part only

    switch (dateFilter) {
      case "today":
        const today = new Date();
        return (
          returnDate.getDate() === today.getDate() &&
          returnDate.getMonth() === today.getMonth() &&
          returnDate.getFullYear() === today.getFullYear()
        );

      case "thisweek":
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        startOfWeek.setHours(0, 0, 0, 0);
        endOfWeek.setHours(23, 59, 59, 999);
        return returnDate >= startOfWeek && returnDate <= endOfWeek;

      case "month":
        const currentMonth = new Date();
        return (
          returnDate.getMonth() === currentMonth.getMonth() &&
          returnDate.getFullYear() === currentMonth.getFullYear()
        );

      case "custom":
        if (!customDateStart || !customDateEnd) return true;
        const startDate = new Date(customDateStart);
        const endDate = new Date(customDateEnd);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return returnDate >= startDate && returnDate <= endDate;

      default:
        return true;
    }
  };

  const filteredSalesReturns = salesReturns.filter((salesReturn) => {
    // First apply date filter
    if (!applyDateFilter(salesReturn)) return false;

    // Then apply search filter
    const invoiceNumber =
      salesReturn.invoiceNumber ||
      salesReturn.invoice_no ||
      salesReturn.sale?.invoice_no ||
      "";

    const customerName =
      salesReturn.customerName ||
      salesReturn.customer_name ||
      salesReturn.customer?.name ||
      "";

    const returnNumber =
      salesReturn.returnNumber || salesReturn.return_no || "";

    const searchTerm = (searchQuery || "").toLowerCase();

    return (
      (invoiceNumber || "").toLowerCase().includes(searchTerm) ||
      (customerName || "").toLowerCase().includes(searchTerm) ||
      (returnNumber || "").toLowerCase().includes(searchTerm)
    );
  });

  const totalPages = Math.ceil(filteredSalesReturns.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentSalesReturns = filteredSalesReturns.slice(startIndex, endIndex);

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

  if (loading) {
    return (
      <div className="sales-return-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="sales-return-page">
      <SalesReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onReturnAdded={handleReturnAdded}
      />

      <ViewSalesReturnModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        salesReturnId={selectedReturnId}
      />

      <EditSalesReturnModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        salesReturnId={selectedReturnId}
        onReturnUpdated={(updatedReturn) => {
          // Update the sales returns list
          setSalesReturns((prev) =>
            prev.map((item) =>
              item.id === updatedReturn.id ? updatedReturn : item,
            ),
          );
        }}
      />

      <div className="sales-return-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search sales returns..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="header-right">
          <div className="sales-return-filter-container" ref={filterRef}>
            <button
              className="sales-return-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="sales-return-filter-dropdown">
                <button
                  className="sales-return-filter-option"
                  onClick={() => handleFilterSelect("all")}
                >
                  All
                </button>
                <button
                  className="sales-return-filter-option"
                  onClick={() => handleFilterSelect("today")}
                >
                  Today
                </button>
                <button
                  className="sales-return-filter-option"
                  onClick={() => handleFilterSelect("thisweek")}
                >
                  This Week
                </button>
                <button
                  className="sales-return-filter-option"
                  onClick={() => handleFilterSelect("month")}
                >
                  Month
                </button>
                <button
                  className="sales-return-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          <button
            className="add-sales-return-btn"
            onClick={handleAddSalesReturn}
          >
            <Plus size={20} />
            <span className="btn-text">Sales Return</span>
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="sales-return-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="sales-return-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="sales-return-date-input"
          />
        </div>
      )}

      <div className="sales-return-table-container">
        <table className="sales-return-table">
          <thead>
            <tr>
              <th>Return Number</th>
              <th>Invoice Number</th>
              <th>Return Date</th>
              <th>Customer Name</th>
              <th>Total Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentSalesReturns.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-message">
                  No sales returns found
                </td>
              </tr>
            ) : (
              currentSalesReturns.map((salesReturn) => {
                // Safely get values
                const returnNo = salesReturn.return_no || "N/A";
                const invoiceNo = salesReturn.sale?.invoice_no || "N/A";
                const returnDate = salesReturn.return_date
                  ? salesReturn.return_date.split(" ")[0]
                  : "N/A";
                const customerName = salesReturn.customer?.name || "N/A";
                const totalRefund = parseFloat(salesReturn.total_refund || 0);

                return (
                  <tr key={salesReturn.id}>
                    <td data-label="Return Number">
                      <span className="return-badge">{returnNo}</span>
                    </td>
                    <td data-label="Invoice Number">
                      <span className="invoice-badge">{invoiceNo}</span>
                    </td>
                    <td data-label="Return Date">{returnDate}</td>
                    <td data-label="Customer Name">{customerName}</td>
                    <td data-label="Total Amount">
                      <span className="amount">
                        LKR {totalRefund.toLocaleString()}
                      </span>
                    </td>
                    <td data-label="Action">
                      <div className="action-buttons">
                        <button
                          className="action-btn view-btn"
                          onClick={() => handleView(salesReturn.id)}
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleEdit(salesReturn.id)}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(salesReturn.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="pagination-info">
          Showing {startIndex + 1} to{" "}
          {Math.min(endIndex, filteredSalesReturns.length)} of{" "}
          {filteredSalesReturns.length} entries
        </div>
        <div className="pagination-buttons">
          <button
            className="pagination-btn"
            onClick={handlePrevious}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
            <span className="btn-text">Previous</span>
          </button>
          <span className="page-number">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            className="pagination-btn"
            onClick={handleNext}
            disabled={currentPage === totalPages}
          >
            <span className="btn-text">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReturn;
