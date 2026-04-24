import React, { useState, useEffect } from "react";
import {
  Search,
  Trash2,
  RefreshCw,
  // DollarSign,
  Package,
  X,
} from "lucide-react";
import { toast } from "sonner";
import CompleteHoldOrderModal from "./CompleteHoldOrderModal";
import "./HoldOrdersModal.css";
import offlineDB from "../../utils/offlineDB";

const HoldOrdersModal = ({ isOpen, onClose, onRestoreOrder }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [holdOrders, setHoldOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [business, setBusiness] = useState(null);

  const recordsPerPage = 10;

  const filteredOrders = holdOrders.filter(
    (order) =>
      order.reference_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer?.name || "Walk-in")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOrders.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  useEffect(() => {
    if (isOpen) {
      fetchHoldOrders();
      fetchBusiness();
    }
  }, [isOpen]);

  const fetchHoldOrders = async () => {
    try {
      setLoading(true);

      // 🔥 ALWAYS load from local cache first (single source of truth)
      let holdOrdersData = await offlineDB.getAllHoldOrders();
      console.log(
        `Loaded ${holdOrdersData.length} hold orders from local cache`
      );

      // If online, fetch fresh from server ONLY if needed
      if (navigator.onLine) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch(
            "http://127.0.0.1:8000/api/sales/hold-orders",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.hold_orders)) {
              const serverOrders = data.hold_orders;

              let newOrUpdated = 0;
              for (const order of serverOrders) {
                // Only cache if not already in local (by server id) or newer
                const existing = holdOrdersData.find((o) => o.id === order.id);
                if (
                  !existing ||
                  new Date(order.updated_at) >
                    new Date(existing.updated_at || 0)
                ) {
                  await offlineDB.addHoldOrder(order);
                  newOrUpdated++;
                }
              }

              if (newOrUpdated > 0) {
                // Reload after updating
                holdOrdersData = await offlineDB.getAllHoldOrders();
                console.log(
                  `Updated ${newOrUpdated} orders from server → total: ${holdOrdersData.length}`
                );
              } else {
                console.log("No new/updated orders from server");
              }
            }
          }
        } catch (error) {
          console.warn("Server fetch failed, using local cache only:", error);
        }
      }

      // Remove duplicates by local_id or server id
      const uniqueMap = new Map();
      holdOrdersData.forEach((order) => {
        const key = order.local_id || order.id || Math.random();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, order);
        }
      });

      const uniqueOrders = Array.from(uniqueMap.values());

      setHoldOrders(uniqueOrders);
      console.log(`Final unique hold orders: ${uniqueOrders.length}`);
    } catch (error) {
      console.error("Error loading hold orders:", error);
      setError("Failed to load hold orders");
      setHoldOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteHoldOrder = async (holdOrder) => {
    const orderId = holdOrder.id; // server ID (online use)
    const localId = holdOrder.local_id; // local ID (offline use)

    toast.warning(`Delete hold order?`, {
      description: "This hold order will be permanently removed.",
      duration: 5000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            setActionLoading(true);

            // === OFFLINE MODE: Delete from local DB + queue for sync ===
            if (!navigator.onLine || !orderId) {
              // Offline or locally created hold order
              try {
                // Delete main sale record
                await offlineDB.db.delete("sales", localId);

                // Delete related sale items
                const tx = offlineDB.db.transaction("sale_items", "readwrite");
                const index = tx.store.index("sale_local_id");
                const items = await index.getAll(localId);
                for (const item of items) {
                  await tx.store.delete(item.id || item); // idb handles key
                }
                await tx.done;

                console.log("Hold order deleted offline:", localId);

                // Add to sync queue for later deletion on server (if it has server ID)
                if (orderId) {
                  await offlineDB.addToSyncQueue("delete_hold_order", {
                    server_id: orderId,
                    local_id: localId,
                  });
                  console.log("Queued hold order deletion for sync:", orderId);
                }

                toast.success("Hold order deleted (will sync when online)");
              } catch (error) {
                console.error("Failed to delete hold order offline:", error);
                toast.error("Failed to delete locally");
                return;
              }
            }
            // === ONLINE MODE: Delete from server + local ===
            else {
              const token = localStorage.getItem("authToken");
              const response = await fetch(
                `http://127.0.0.1:8000/api/sales/hold-orders/${orderId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                  },
                }
              );

              const data = await response.json();

              if (data.success || response.ok) {
                // Also remove from local DB to keep in sync
                await offlineDB.db.delete("sales", localId);
                // Delete items too (same as above)
                const tx = offlineDB.db.transaction("sale_items", "readwrite");
                const index = tx.store.index("sale_local_id");
                const items = await index.getAll(localId);
                for (const item of items) {
                  await tx.store.delete(item.id || item);
                }
                await tx.done;

                toast.success("Hold order deleted successfully");
              } else {
                throw new Error(data.message || "Failed to delete on server");
              }
            }

            // 🔥 ALWAYS refresh the list after delete
            setHoldOrders((prev) =>
              prev.filter((order) => order.local_id !== localId)
            );
          } catch (error) {
            console.error("Error deleting hold order:", error);
            toast.error(
              "Failed to delete hold order: " +
                (error.message || "Unknown error")
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Hold order deletion cancelled"),
      },
    });
  };

  const fetchBusiness = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/business", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
      }
    } catch (err) {
      console.log("Business data fetch failed");
    }
  };

  // const handleCompleteClick = (order) => {
  //   setSelectedOrderForPayment(order);
  //   setShowPaymentModal(true);
  // };

  const handleCompletePayment = async (id, paymentMethod, paidAmount) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/sales/hold-orders/${id}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            payment_method: paymentMethod,
            paid_amount: parseFloat(paidAmount),
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Hold order completed successfully!");

        setHoldOrders((prev) => prev.filter((order) => order.id !== id));
        fetchHoldOrders();
        setShowPaymentModal(false);
        setSelectedOrderForPayment(null);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error completing hold order:", error);
      toast.error("Failed to complete hold order");
    } finally {
      setActionLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) return "Expired";
    return `${diffHours}h ${diffMinutes}m`;
  };

  // Get total items count
  const getTotalItems = (items) => {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <CompleteHoldOrderModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedOrderForPayment(null);
        }}
        holdOrder={selectedOrderForPayment}
        onComplete={handleCompletePayment}
        business={business}
      />
      <div className="hold-orders-modal">
        <div className="modal-header">
          <div className="modal-title">
            <Package size={24} />
            <h2>Hold Orders</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="units-page">
          <div className="units-header">
            <div className="header-left">
              <div className="search-box">
                <Search className="search-icon" size={20} />
                <input
                  type="text"
                  placeholder="Search hold orders..."
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
              <button
                className="add-unit-btn"
                onClick={fetchHoldOrders}
                disabled={loading}
              >
                <RefreshCw size={20} />
                <span className="btn-text">Refresh</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading hold orders...</div>
          ) : error ? (
            <div className="error-message">Error: {error}</div>
          ) : (
            <>
              <div className="table-container">
                <table className="units-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th>Expires In</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOrders.length > 0 ? (
                      currentOrders.map((order) => {
                        const isExpired =
                          getTimeRemaining(order.expires_at) === "Expired";
                        return (
                          <tr
                            key={`${order.local_id || order.id || "temp"}-${
                              order.created_at || Date.now()
                            }`}
                            className={isExpired ? "expired-row" : ""}
                          >
                            <td data-label="Reference">
                              <div className="ref-cell">
                                <span className="ref-badge">HOLD</span>
                                <span className="ref-number">
                                  {order.reference_no}
                                </span>
                              </div>
                            </td>
                            <td data-label="Customer">
                              {order.customer ? order.customer.name : "Walk-in"}
                            </td>
                            <td data-label="Items">
                              <span className="items-badge">
                                {getTotalItems(order.items)} items
                              </span>
                            </td>
                            <td data-label="Total">
                              <span className="total-amount">
                                LKR {parseFloat(order.total).toFixed(2)}
                              </span>
                            </td>
                            <td data-label="Created">
                              {formatDate(order.created_at)}
                            </td>
                            <td data-label="Expires In">
                              <span className={isExpired ? "expired-text" : ""}>
                                {getTimeRemaining(order.expires_at)}
                              </span>
                            </td>
                            <td data-label="Status">
                              <span
                                className={`status-badge ${
                                  isExpired ? "expired" : "active"
                                }`}
                              >
                                {isExpired ? "Expired" : "Active"}
                              </span>
                            </td>
                            <td data-label="Actions">
                              <div className="action-buttons">
                                <button
                                  className="action-btn restore-btn"
                                  onClick={() => {
                                    if (onRestoreOrder) {
                                      onRestoreOrder(order);
                                    }
                                    onClose();
                                  }}
                                  disabled={actionLoading}
                                  title="Restore to cart"
                                >
                                  <RefreshCw size={16} />
                                </button>
                                {/* <button
                                  className="action-btn sell-btn"
                                  onClick={() => handleCompleteClick(order)}
                                  disabled={actionLoading || isExpired}
                                  title="Complete sale"
                                >
                                  <DollarSign size={16} />
                                </button> */}
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => deleteHoldOrder(order)}
                                  disabled={actionLoading}
                                  title="Delete order"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="no-data">
                          <div className="empty-state">
                            <Package size={48} />
                            <p>No hold orders found</p>
                            <p className="subtext">
                              Orders placed on hold will appear here
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredOrders.length > 0 && (
                <div className="table-footer">
                  <div className="pagination-info">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredOrders.length)} of{" "}
                    {filteredOrders.length} entries
                  </div>
                  <div className="pagination-buttons">
                    <button
                      className="pagination-btn"
                      onClick={handlePrevious}
                      disabled={currentPage === 1}
                    >
                      <span className="btn-text">Previous</span>
                    </button>
                    <span className="page-number">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={handleNext}
                      disabled={currentPage === totalPages}
                    >
                      <span className="btn-text">Next</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HoldOrdersModal;
