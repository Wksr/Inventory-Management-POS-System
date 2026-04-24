import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { toast } from "sonner";
import offlineDB from "../../../utils/offlineDB";
import "./ViewPurchaseModal.css";

const ViewPurchaseModal = ({ isOpen, onClose, purchaseId }) => {
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      if (!purchaseId) return;

      setLoading(true);

      try {
        const token = localStorage.getItem("authToken");
        const isOnline = navigator.onLine;

        let purchaseData = null;

        // 1. Online mode → server එකෙන් ගන්න + cache කරන්න
        if (isOnline && token) {
          try {
            const response = await fetch(
              `http://127.0.0.1:8000/api/purchases/${purchaseId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
              },
            );

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                purchaseData = data.purchase;

                // Cache කරන්න (offlineDB එකේ purchase store එක තියෙනවා නම්)
                await offlineDB.addPurchase?.({
                  ...purchaseData,
                  sync_status: "synced",
                  local_id: null,
                });

                console.log("Purchase details fetched from server & cached");
              } else {
                throw new Error(data.message || "API failure");
              }
            }
          } catch (onlineErr) {
            console.warn(
              "Online fetch failed, falling back to cache:",
              onlineErr,
            );
          }
        }

        // 2. Offline fallback OR online fail උනාම cache එකෙන් ගන්න
        if (!purchaseData) {
          // purchaseId real server ID එකක් නම් cache එකෙන් ගන්න
          purchaseData = await offlineDB.getPurchase?.(purchaseId);

          if (purchaseData) {
            toast.info("Offline mode: Showing cached purchase details");
          } else {
            // Pending purchase නම් pending_purchases store එකෙන් බලන්න
            const pending = await offlineDB.getPendingPurchases?.();
            purchaseData = pending?.find(
              (p) => p.local_id === purchaseId || p.id === purchaseId,
            );

            if (purchaseData) {
              toast.info("Offline pending purchase details");
            }
          }
        }

        if (!purchaseData) {
          throw new Error("Purchase not found in cache or server");
        }

        setPurchase(purchaseData);
      } catch (error) {
        console.error("Error fetching purchase:", error);
        toast.error("Failed to load purchase details: " + error.message);
        setPurchase(null);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && purchaseId) {
      fetchPurchaseDetails();
    }
  }, [isOpen, purchaseId]);

  const handleClose = () => {
    setPurchase(null);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handlePrint = () => {
    const printArea = document.getElementById("purchase-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const title = `Purchase - ${purchase.invoice_number || "Invoice"}`;

    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; color:#111; padding:20px}
      h3{margin:0 0 8px 0}
      table{width:100%; border-collapse:collapse; margin-top:10px}
      th,td{border:1px solid #ddd; padding:8px; text-align:left}
      .summary-row{display:flex; justify-content:space-between; padding:6px 0}
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>${styles}</style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      try {
        printWindow.print();
        printWindow.close();
      } catch (err) {
        console.error("Print failed:", err);
      }
    }, 300);
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Purchase Details</h2>
            <button className="close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="modal-body">
            <div className="loading">Loading purchase details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Purchase Details</h2>
            <button className="close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="modal-body">
            <div className="error-message">Purchase not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-container view-purchase-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Purchase Details - {purchase.invoice_number}</h2>
          <div className="header-actions">
            <button
              className="action-btn print-btn"
              onClick={handlePrint}
              title="Print"
            >
              <Printer size={18} />
            </button>

            <button className="close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-body" id="purchase-print-area">
          {/* Supplier Info and Purchase Info Side by Side */}
          <div className="info-sections">
            {/* Supplier Info - Left Side */}
            <div className="info-section supplier-info">
              <h3>Supplier Information</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">
                    {purchase.supplier?.name || "N/A"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Company:</span>
                  <span className="info-value">
                    {purchase.supplier?.company || "N/A"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Phone:</span>
                  <span className="info-value">
                    {purchase.supplier?.phone || "N/A"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email:</span>
                  <span className="info-value">
                    {purchase.supplier?.email || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Info - Right Side */}
            <div className="info-section purchase-info">
              <h3>Purchase Information</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Invoice Number:</span>
                  <span className="info-value">{purchase.invoice_number}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Date:</span>
                  <span className="info-value">{purchase.date}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className={`status-badge status-${purchase.status}`}>
                    {purchase.status}
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-label">Branch:</span>
                  <span className="info-value">
                    {purchase.branch?.name || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="order-items-section">
            <h3>Order Items</h3>
            <div className="table-wrapper">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Cost</th>
                    <th>Quantity</th>
                    <th>Discount</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.length > 0 ? (
                    purchase.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || "Unknown Product"}</td>
                        <td>
                          LKR{" "}
                          {item.unit_cost?.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>{item.quantity}</td>
                        <td>
                          LKR{" "}
                          {item.discount?.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="total-cell">
                          LKR{" "}
                          {item.total?.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-message">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="summary-section">
            <div className="summary-box">
              <h3>Order Summary</h3>
              <div className="summary-row">
                <span>Subtotal: </span>
                <span className="summary-value">
                  LKR{" "}
                  {purchase.subtotal?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span>Discount:</span>
                <span className="summary-value">
                  LKR{" "}
                  {purchase.discount?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span>Transport Cost:</span>
                <span className="summary-value">
                  LKR{" "}
                  {purchase.transport_cost?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row grand-total">
                <span>Grand Total:</span>
                <span className="summary-value">
                  LKR{" "}
                  {purchase.grand_total?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span>Paid Amount:</span>
                <span className="summary-value">
                  LKR{" "}
                  {purchase.paid_amount?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row balance-row">
                <span>Balance:</span>
                <span
                  className={`summary-value ${
                    purchase.balance > 0 ? "balance-due" : "balance-paid"
                  }`}
                >
                  LKR{" "}
                  {purchase.balance?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {purchase.notes && (
            <div className="notes-section">
              <h3>Notes</h3>
              <div className="notes-content">{purchase.notes}</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPurchaseModal;
