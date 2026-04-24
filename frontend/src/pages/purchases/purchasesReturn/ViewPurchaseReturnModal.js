import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { toast } from "sonner";
import "./ViewPurchaseReturnModal.css";

const ViewPurchaseReturnModal = ({ isOpen, onClose, purchaseReturnId }) => {
  const [purchaseReturn, setPurchaseReturn] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPurchaseReturnDetails = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `http://127.0.0.1:8000/api/purchase-returns/${purchaseReturnId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setPurchaseReturn(data.purchase_return);
        } else {
          throw new Error(
            data.message || "Failed to fetch purchase return details",
          );
        }
      } catch (error) {
        console.error("Error fetching purchase return details:", error);
        toast.error(
          "Failed to fetch purchase return details: " + error.message,
        );
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && purchaseReturnId) {
      fetchPurchaseReturnDetails();
    }
  }, [isOpen, purchaseReturnId]);

  const handleClose = () => {
    setPurchaseReturn(null);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handlePrint = () => {
    const printArea = document.getElementById("purchase-return-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const title = `Purchase Return - ${purchaseReturn.return_number || "Return"}`;

    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; color:#111; padding:20px}
      h3{margin:0 0 8px 0}
      table{width:100%; border-collapse:collapse; margin-top:10px}
      th,td{border:1px solid #ddd; padding:8px; text-align:left}
      .return-summary-row{display:flex; justify-content:space-between; padding:6px 0}
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
      <div className="return-modal-overlay" onClick={handleOverlayClick}>
        <div
          className="return-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="return-modal-header">
            <h2>Purchase Return Details</h2>
            <button className="return-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="return-modal-body">
            <div className="return-loading">
              Loading purchase return details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!purchaseReturn) {
    return (
      <div className="return-modal-overlay" onClick={handleOverlayClick}>
        <div
          className="return-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="return-modal-header">
            <h2>Purchase Return Details</h2>
            <button className="return-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="return-modal-body">
            <div className="return-error-message">
              Purchase return not found
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="return-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="return-modal-container view-purchase-return-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="return-modal-header">
          <h2>Purchase Return Details - {purchaseReturn.return_number}</h2>
          <div className="return-header-actions">
            <button
              className="return-action-btn return-print-btn"
              onClick={handlePrint}
              title="Print"
            >
              <Printer size={18} />
            </button>

            <button className="return-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="return-modal-body" id="purchase-return-print-area">
          {/* Supplier Info and Return Info Side by Side */}
          <div className="return-info-sections">
            {/* Supplier Info - Left Side */}
            <div className="return-info-section return-supplier-info">
              <h3>Supplier Information</h3>
              <div className="return-info-grid">
                <div className="return-info-row">
                  <span className="return-info-label">Name:</span>
                  <span className="return-info-value">
                    {purchaseReturn.supplier?.name || "N/A"}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Company:</span>
                  <span className="return-info-value">
                    {purchaseReturn.supplier?.company || "N/A"}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Phone:</span>
                  <span className="return-info-value">
                    {purchaseReturn.supplier?.phone || "N/A"}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Email:</span>
                  <span className="return-info-value">
                    {purchaseReturn.supplier?.email || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Return Info - Right Side */}
            <div className="return-info-section return-details-info">
              <h3>Return Information</h3>
              <div className="return-info-grid">
                <div className="return-info-row">
                  <span className="return-info-label">Return Number:</span>
                  <span className="return-info-value">
                    {purchaseReturn.return_number}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Original Invoice:</span>
                  <span className="return-info-value">
                    {purchaseReturn.purchase?.invoice_number || "N/A"}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Return Date:</span>
                  <span className="return-info-value">
                    {new Date(purchaseReturn.return_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="return-info-row">
                  <span className="return-info-label">Return Reason:</span>
                  <span className="return-info-value">
                    {purchaseReturn.reason}
                  </span>
                </div>
                <div className="return-info-row"></div>
              </div>
            </div>
          </div>

          {/* Return Items */}
          <div className="return-order-items-section">
            <h3>Return Items</h3>
            <div className="return-table-wrapper">
              <table className="return-order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Cost</th>
                    <th>Return Quantity</th>
                    <th>Reason</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseReturn.items?.length > 0 ? (
                    purchaseReturn.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || "Unknown Product"}</td>
                        <td>
                          LKR{" "}
                          {item.unit_cost?.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>{item.return_quantity}</td>
                        <td>{item.reason || "N/A"}</td>
                        <td className="return-total-cell">
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
                      <td colSpan="5" className="return-empty-message">
                        No return items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Return Summary */}
          <div className="return-summary-section">
            <div className="return-summary-box">
              <h3>Return Summary</h3>
              <div className="return-summary-row">
                <span>Subtotal: </span>
                <span className="return-summary-value">
                  LKR{" "}
                  {purchaseReturn.subtotal?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {purchaseReturn.tax_amount > 0 && (
                <div className="return-summary-row">
                  <span>Tax Amount:</span>
                  <span className="return-summary-value">
                    LKR{" "}
                    {purchaseReturn.tax_amount?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="return-summary-row return-grand-total">
                <span>Grand Total:</span>
                <span className="return-summary-value">
                  LKR{" "}
                  {purchaseReturn.grand_total?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="return-summary-row">
                <span>Refund Amount:</span>
                <span className="return-summary-value">
                  LKR{" "}
                  {purchaseReturn.refund_amount?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="return-summary-row return-balance-row">
                <span>Return Value:</span>
                <span className="return-summary-value return-amount">
                  LKR{" "}
                  {purchaseReturn.grand_total?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {purchaseReturn.notes && (
            <div className="return-notes-section">
              <h3>Notes</h3>
              <div className="return-notes-content">{purchaseReturn.notes}</div>
            </div>
          )}
        </div>

        <div className="return-modal-footer">
          <button className="return-btn-cancel" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPurchaseReturnModal;
