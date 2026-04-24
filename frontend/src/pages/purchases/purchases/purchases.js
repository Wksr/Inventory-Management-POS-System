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
import AddPurchaseModal from "./AddPurchaseModal";
import EditPurchaseModal from "./EditPurchaseModal";
import ViewPurchaseModal from "./ViewPurchaseModal";
import { toast } from "sonner";
import "./purchases.css";
import offlineDB from "../../../utils/offlineDB";

const Purchases = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchaseId, setViewingPurchaseId] = useState(null);
  const [allPurchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const isOnline = navigator.onLine;
      let purchasesData = [];

      // 1. Online mode → server එකෙන් ගන්න + cache කරන්න
      if (isOnline && token) {
        try {
          const response = await fetch("http://127.0.0.1:8000/api/purchases", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();

            if (data.success) {
              purchasesData = data.purchases?.data || data.purchases || [];

              // Cache කරන්න (old cache clear optional)
              // await offlineDB.clearPurchases?.();

              for (const purchase of purchasesData) {
                await offlineDB.addPurchase?.({
                  ...purchase,
                  sync_status: "synced",
                  local_id: null,
                });
              }

              console.log("Purchases loaded from server & cached successfully");
            } else {
              throw new Error(data.message || "API returned failure");
            }
          } else {
            console.warn("Server fetch failed (not OK), using cache");
          }
        } catch (onlineErr) {
          console.warn("Online fetch error, falling back to cache:", onlineErr);
        }
      }

      // 2. Offline fallback OR online fail උනාම
      if (purchasesData.length === 0 || !isOnline) {
        const syncedPurchases = (await offlineDB.getAllPurchases?.()) || [];
        const pendingPurchases =
          (await offlineDB.getPendingPurchases?.()) || [];

        console.log(
          `Offline mode: Found ${syncedPurchases.length} synced + ${pendingPurchases.length} pending purchases`,
        );

        // Pending + Synced merge කරන්න
        purchasesData = [...pendingPurchases, ...syncedPurchases];

        // Duplicates remove කරන්න (local_id හෝ id එකෙන් unique කරගන්න)
        const uniqueMap = new Map();
        purchasesData.forEach((p) => {
          const key = p.local_id || p.id;
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, p);
          }
        });

        purchasesData = Array.from(uniqueMap.values());

        // Newest first sort කරන්න
        purchasesData.sort((a, b) => {
          const dateA = new Date(a.date || a.created_at || 0);
          const dateB = new Date(b.date || b.created_at || 0);
          return dateB - dateA;
        });

        if (pendingPurchases.length > 0) {
          toast.info(
            `Offline mode: Showing ${pendingPurchases.length} pending + ${syncedPurchases.length} synced purchases`,
          );
        } else {
          toast.info("Offline mode: Showing cached purchases");
        }
      }

      console.log("Setting purchases to state:", purchasesData.length);
      setPurchases(purchasesData);
    } catch (error) {
      console.error("Critical error in fetchPurchases:", error);
      toast.error("Failed to load purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  // Date filtering logic
  const filterPurchasesByDate = (purchases) => {
    if (!dateFilter) return purchases;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case "today":
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return purchases.filter((purchase) => {
          const purchaseDate = new Date(purchase.date);
          return purchaseDate >= today && purchaseDate < tomorrow;
        });

      case "thisweek":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return purchases.filter((purchase) => {
          const purchaseDate = new Date(purchase.date);
          return purchaseDate >= startOfWeek && purchaseDate < endOfWeek;
        });

      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return purchases.filter((purchase) => {
          const purchaseDate = new Date(purchase.date);
          return purchaseDate >= startOfMonth && purchaseDate <= endOfMonth;
        });

      case "custom":
        if (customDateStart && customDateEnd) {
          const startDate = new Date(customDateStart);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(customDateEnd);
          endDate.setHours(23, 59, 59, 999);
          return purchases.filter((purchase) => {
            const purchaseDate = new Date(purchase.date);
            return purchaseDate >= startDate && purchaseDate <= endDate;
          });
        }
        return purchases;

      default:
        return purchases;
    }
  };

  const filteredPurchases = filterPurchasesByDate(allPurchases).filter(
    (purchase) => {
      // Pending එකකට search filter skip කරන්න (invoice_number නැති නිසා)
      if (
        purchase.sync_status === "pending" ||
        purchase.local_id?.startsWith("pending_purchase_")
      ) {
        return true; // Pending එක always show කරන්න
      }

      // Synced එකකට search filter apply කරන්න
      return (
        purchase.invoice_number
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        purchase.supplier?.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
    },
  );

  const totalPages = Math.ceil(filteredPurchases.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPurchases = filteredPurchases.slice(startIndex, endIndex);

  const handleView = (id) => {
    setViewingPurchaseId(id);
  };

  const handleEdit = (purchase) => {
    setEditingPurchase(purchase);
  };

  const handleDelete = async (id) => {
    toast.warning(`Delete purchase?`, {
      description: "Delete All Purchase Details.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/purchases/${id}`,
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
              setPurchases((prev) =>
                prev.filter((purchase) => purchase.id !== id),
              );
              toast.success("Purchase deleted successfully");
            } else {
              throw new Error(data.message || "Failed to delete purchase");
            }
          } catch (error) {
            console.error("Error deleting purchase:", error);
            toast.error("Failed to delete purchase: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleAddPurchase = () => {
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseAdded = (newPurchase) => {
    setPurchases((prev) => [newPurchase, ...prev]);
  };

  const handlePurchaseUpdated = (updatedPurchase) => {
    setPurchases((prev) =>
      prev.map((p) => (p.id === updatedPurchase.id ? updatedPurchase : p)),
    );
    setEditingPurchase(null);
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
    }
  };

  if (loading) {
    return (
      <div className="purchases-page">
        <div className="loading">Loading purchases...</div>
      </div>
    );
  }

  return (
    <div className="purchases-page">
      <AddPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseAdded={handlePurchaseAdded}
      />

      <EditPurchaseModal
        isOpen={!!editingPurchase}
        onClose={() => setEditingPurchase(null)}
        onPurchaseUpdated={handlePurchaseUpdated}
        purchase={editingPurchase}
      />

      <ViewPurchaseModal
        isOpen={!!viewingPurchaseId}
        onClose={() => setViewingPurchaseId(null)}
        purchaseId={viewingPurchaseId}
      />

      <div className="purchases-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search purchases..."
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
          <div className="purchase-filter-container" ref={filterRef}>
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
                  onClick={() => handleFilterSelect("")}
                >
                  All
                </button>
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
                  Month
                </button>
                <button
                  className="purchase-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          <button className="add-purchase-btn" onClick={handleAddPurchase}>
            <Plus size={20} />
            <span className="btn-text">Add Purchase</span>
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="purchase-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="purchase-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="purchase-date-input"
          />
        </div>
      )}

      <div className="purchases-table-container">
        <table className="purchases-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Grand Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentPurchases.length > 0 ? (
              currentPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td data-label="Invoice Number">
                    {purchase.sync_status === "pending" ||
                    purchase.local_id?.startsWith("pending_purchase_") ? (
                      <span className="pending-badge">
                        PENDING-{String(purchase.local_id || "").slice(-8)}
                      </span>
                    ) : (
                      <span className="invoice-badge">
                        {purchase.invoice_number || "N/A"}
                      </span>
                    )}
                  </td>
                  <td data-label="Supplier">{purchase.supplier?.name}</td>
                  <td data-label="Date">{purchase.date}</td>
                  <td data-label="Grand Total">
                    <span className="amount">
                      LKR {purchase.grand_total?.toLocaleString()}
                    </span>
                  </td>
                  <td data-label="Action">
                    <div className="action-buttons">
                      <button
                        className="action-btn view-btn"
                        onClick={() => handleView(purchase.id)}
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(purchase)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(purchase.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data">
                  No purchases found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredPurchases.length > 0 && (
        <div className="table-footer">
          <div className="pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredPurchases.length)} of{" "}
            {filteredPurchases.length} entries
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
      )}
    </div>
  );
};

export default Purchases;
