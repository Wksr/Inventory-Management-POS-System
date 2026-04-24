import React, { useState, useEffect, useCallback, useRef } from "react";
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
import "./purchasesReturn.css";
import ReturnPurchaseModal from "./ReturnPurchaseModal";
import ViewPurchaseReturnModal from "./ViewPurchaseReturnModal";
import EditPurchaseReturnModal from "./EditPurchaseReturnModal";
import offlineDB from "../../../utils/offlineDB";

const PurchasesReturn = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [purchaseReturns, setPurchaseReturns] = useState([]); // array එකක්
  const [pagination, setPagination] = useState({
    total: 0,
    current_page: 1,
    last_page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReturnId, setEditingReturnId] = useState(null);
  const [viewingReturnId, setViewingReturnId] = useState(null);

  const recordsPerPage = 20;
  const filterRef = useRef(null);

  // Click outside to close dropdown
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

  const fetchPurchaseReturns = useCallback(async () => {
    setLoading(true);
    try {
      let returnsToDisplay = [];
      let tempPagination = { total: 0, current_page: 1, last_page: 1 };

      const pendingReturns =
        (await offlineDB.getPendingPurchaseReturns?.()) || [];
      console.log("Pending purchase returns loaded:", pendingReturns.length);

      if (navigator.onLine) {
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("No authentication token found");

        const params = new URLSearchParams({
          search: searchQuery,
          page: currentPage,
          per_page: recordsPerPage,
          ...(dateFilter && { date_filter: dateFilter }),
          ...(showCustomDate &&
            customDateStart && { start_date: customDateStart }),
          ...(showCustomDate && customDateEnd && { end_date: customDateEnd }),
        });

        const url = `http://127.0.0.1:8000/api/purchase-returns?${params}`;
        console.log("Fetching purchase returns from:", url);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        const responseText = await response.text();

        if (!response.ok) {
          console.error("Server error:", response.status, responseText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("Invalid JSON response");
        }

        if (data.success) {
          const serverReturns =
            data.purchase_returns?.data || data.purchase_returns || [];
          tempPagination = {
            total: data.purchase_returns?.total || serverReturns.length,
            current_page: data.purchase_returns?.current_page || currentPage,
            last_page: data.purchase_returns?.last_page || 1,
          };

          if (offlineDB.cacheServerPurchaseReturns) {
            await offlineDB.cacheServerPurchaseReturns(serverReturns);
          }

          returnsToDisplay = [...pendingReturns, ...serverReturns];
        } else {
          throw new Error(data.message || "API error");
        }
      } else {
        console.log("Offline mode - loading from IndexedDB");

        const localReturns =
          (await offlineDB.getAllPurchaseReturnsForDisplay?.()) || [];
        returnsToDisplay = localReturns;

        tempPagination = {
          total: localReturns.length,
          current_page: 1,
          last_page: 1,
        };

        toast.info(
          `Offline: ${localReturns.length} local purchase returns loaded`,
        );
      }

      // Duplicates remove
      const uniqueMap = new Map();
      returnsToDisplay.forEach((ret) => {
        const key = ret.local_id || ret.id;
        if (key) {
          if (!uniqueMap.has(key) || ret.sync_status === "pending") {
            uniqueMap.set(key, ret);
          }
        }
      });

      let uniqueReturns = Array.from(uniqueMap.values());

      // Sort newest first
      uniqueReturns.sort((a, b) => {
        const dateA = new Date(a.return_date || a.created_at || 0);
        const dateB = new Date(b.return_date || b.created_at || 0);
        return dateB - dateA;
      });

      console.log(
        "Final unique purchase returns to display:",
        uniqueReturns.length,
      );

      // State update කරන්න
      setPurchaseReturns(uniqueReturns);
      setPagination(tempPagination);
    } catch (error) {
      console.error("Error fetching purchase returns:", error);
      toast.error("Failed to load purchase returns");

      try {
        const fallback = (await offlineDB.getPendingPurchaseReturns?.()) || [];
        setPurchaseReturns(fallback);
        setPagination({
          total: fallback.length,
          current_page: 1,
          last_page: 1,
        });
      } catch (e) {
        setPurchaseReturns([]);
        setPagination({ total: 0, current_page: 1, last_page: 1 });
      }
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    currentPage,
    dateFilter,
    showCustomDate,
    customDateStart,
    customDateEnd,
  ]);

  useEffect(() => {
    fetchPurchaseReturns();
  }, [fetchPurchaseReturns]);

  // Pagination calculations
  const totalPages = pagination.last_page || 1;
  const startIndex = (currentPage - 1) * recordsPerPage + 1;
  const endIndex = Math.min(
    currentPage * recordsPerPage,
    pagination.total || 0,
  );

  const handleView = (id) => {
    setViewingReturnId(id);
    setIsViewModalOpen(true);
  };

  const handleEdit = (id) => {
    setEditingReturnId(id);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id) => {
    toast.warning("Deleting purchase return?", {
      description: "Delete All Purchase Return Details.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/purchase-returns/${id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.message || `HTTP error! status: ${response.status}`,
              );
            }

            if (data.success) {
              toast.success("Purchase return deleted successfully!");
              setPurchaseReturns((prev) =>
                prev.filter((pr) => (pr.id || pr.local_id) !== id),
              );
              setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
              fetchPurchaseReturns();
            }
          } catch (error) {
            console.error("Error deleting purchase return:", error);
            toast.error("Failed to delete purchase return: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewingReturnId(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingReturnId(null);
  };

  const handleReturnUpdated = (updatedReturn) => {
    toast.success("Purchase return updated successfully!");
    fetchPurchaseReturns();
  };

  const handleAddPurchaseReturn = () => {
    setIsReturnModalOpen(true);
  };

  const handleReturnModalClose = () => {
    setIsReturnModalOpen(false);
  };

  const handleReturnAdded = (newReturn) => {
    toast.success("Purchase return created successfully!");

    // Optimistic update
    setPurchaseReturns((prev) => {
      const updated = [newReturn, ...prev];
      console.log("Optimistic update - new return added:", updated.length);
      return updated;
    });

    setPagination((prev) => ({ ...prev, total: prev.total + 1 }));

    fetchPurchaseReturns(); // Full refresh
    handleReturnModalClose();
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
    setCurrentPage(1);
  };

  return (
    <div className="purchases-return-page">
      <ReturnPurchaseModal
        isOpen={isReturnModalOpen}
        onClose={handleReturnModalClose}
        onReturnAdded={handleReturnAdded}
      />

      <ViewPurchaseReturnModal
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        purchaseReturnId={viewingReturnId}
      />

      <EditPurchaseReturnModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        purchaseReturnId={editingReturnId}
        onReturnUpdated={handleReturnUpdated}
      />

      <div className="purchases-return-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search purchase return..."
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
          <div className="purchases-return-filter-container" ref={filterRef}>
            <button
              className="purchases-return-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="purchases-return-filter-dropdown">
                <div className="purchases-return-filter-section">
                  <button
                    className="purchases-return-filter-option"
                    onClick={() => handleFilterSelect("")}
                  >
                    All
                  </button>
                  <button
                    className="purchases-return-filter-option"
                    onClick={() => handleFilterSelect("today")}
                  >
                    Today
                  </button>
                  <button
                    className="purchases-return-filter-option"
                    onClick={() => handleFilterSelect("thisweek")}
                  >
                    This Week
                  </button>
                  <button
                    className="purchases-return-filter-option"
                    onClick={() => handleFilterSelect("month")}
                  >
                    Month
                  </button>
                  <button
                    className="purchases-return-filter-option"
                    onClick={() => handleFilterSelect("custom")}
                  >
                    Custom
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="add-purchase-return-btn"
            onClick={handleAddPurchaseReturn}
          >
            <Plus size={20} />
            <span className="btn-text">Return Purchase</span>
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="purchases-return-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="purchases-return-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="purchases-return-date-input"
          />
        </div>
      )}

      <div className="purchases-return-table-container">
        <table className="purchases-return-table">
          <thead>
            <tr>
              <th>Return Number</th>
              <th>Purchase Invoice</th>
              <th>Supplier</th>
              <th>Return Date</th>
              <th>Grand Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="loading-cell">
                  Loading...
                </td>
              </tr>
            ) : purchaseReturns.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data-cell">
                  No purchase returns found
                </td>
              </tr>
            ) : (
              purchaseReturns.map((purchaseReturn) => {
                const isPending =
                  purchaseReturn.sync_status === "pending" ||
                  purchaseReturn.local_id?.startsWith("pending_pr_");

                return (
                  <tr key={purchaseReturn.local_id || purchaseReturn.id}>
                    <td data-label="Return Number">
                      {isPending ? (
                        <span className="pending-badge">
                          PENDING-
                          {String(purchaseReturn.local_id || "").slice(-8)}
                        </span>
                      ) : (
                        <span className="invoice-badge">
                          {purchaseReturn.return_number || "N/A"}
                        </span>
                      )}
                    </td>
                    <td data-label="Purchase Invoice">
                      {purchaseReturn.purchase?.invoice_number || "PENDING"}
                    </td>
                    <td data-label="Supplier">
                      {purchaseReturn.supplier?.name ||
                        purchaseReturn.purchase?.supplier?.name ||
                        "N/A"}
                    </td>
                    <td data-label="Return Date">
                      {new Date(
                        purchaseReturn.return_date || purchaseReturn.created_at,
                      ).toLocaleDateString()}
                    </td>
                    <td data-label="Grand Total">
                      <span className="amount">
                        LKR{" "}
                        {parseFloat(
                          purchaseReturn.grand_total ||
                            purchaseReturn.purchase?.grand_total ||
                            0,
                        ).toLocaleString()}
                      </span>
                    </td>
                    <td data-label="Action">
                      <div className="action-buttons">
                        <button
                          className="action-btn view-btn"
                          onClick={() =>
                            handleView(
                              purchaseReturn.id || purchaseReturn.local_id,
                            )
                          }
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() =>
                            handleEdit(
                              purchaseReturn.id || purchaseReturn.local_id,
                            )
                          }
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() =>
                            handleDelete(
                              purchaseReturn.id || purchaseReturn.local_id,
                            )
                          }
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
          Showing {startIndex} to {endIndex} of {pagination.total} entries
        </div>
        <div className="pagination-buttons">
          <button
            className="pagination-btn"
            onClick={handlePrevious}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft size={18} />
            <span className="btn-text">Previous</span>
          </button>
          <span className="page-number">
            Page {currentPage} of {pagination.last_page}
          </span>
          <button
            className="pagination-btn"
            onClick={handleNext}
            disabled={currentPage === pagination.last_page || loading}
          >
            <span className="btn-text">Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchasesReturn;
