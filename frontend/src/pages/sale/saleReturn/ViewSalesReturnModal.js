import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { toast } from "sonner";
import "./ViewSalesReturnModal.css";

const ViewSalesReturnModal = ({ isOpen, onClose, salesReturnId }) => {
  const [salesReturn, setSalesReturn] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSalesReturnDetails = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `http://127.0.0.1:8000/api/sales-returns/${salesReturnId}`,
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
          setSalesReturn(data.sale_return);
        } else {
          throw new Error(
            data.message || "Failed to fetch sales return details",
          );
        }
      } catch (error) {
        console.error("Error fetching sales return details:", error);
        toast.error("Failed to fetch sales return details: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && salesReturnId) {
      fetchSalesReturnDetails();
    }
  }, [isOpen, salesReturnId]);

  const handleClose = () => {
    setSalesReturn(null);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handlePrint = () => {
    const printArea = document.getElementById("sales-return-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const title = `Sales Return - ${salesReturn.return_no || "Return"}`;

    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; color:#111; padding:20px}
      h3{margin:0 0 8px 0}
      table{width:100%; border-collapse:collapse; margin-top:10px}
      th,td{border:1px solid #ddd; padding:8px; text-align:left}
      .sales-return-view-summary-row{display:flex; justify-content:space-between; padding:6px 0}
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
      <div className="sales-return-view-overlay" onClick={handleOverlayClick}>
        <div
          className="sales-return-view-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sales-return-view-header">
            <h2>Sales Return Details</h2>
            <button
              className="sales-return-view-close-btn"
              onClick={handleClose}
            >
              <X size={24} />
            </button>
          </div>
          <div className="sales-return-view-body">
            <div className="sales-return-view-loading">
              Loading sales return details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!salesReturn) {
    return (
      <div className="sales-return-view-overlay" onClick={handleOverlayClick}>
        <div
          className="sales-return-view-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sales-return-view-header">
            <h2>Sales Return Details</h2>
            <button
              className="sales-return-view-close-btn"
              onClick={handleClose}
            >
              <X size={24} />
            </button>
          </div>
          <div className="sales-return-view-body">
            <div className="sales-return-view-error-message">
              Sales return not found
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return dateString.split(" ")[0]; // Get only date part
  };

  return (
    <div className="sales-return-view-overlay" onClick={handleOverlayClick}>
      <div
        className="sales-return-view-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-return-view-header">
          <h2>Sales Return Details - {salesReturn.return_no}</h2>
          <div className="sales-return-view-header-actions">
            <button
              className="sales-return-view-action-btn sales-return-view-print-btn"
              onClick={handlePrint}
              title="Print"
            >
              <Printer size={18} />
            </button>

            <button
              className="sales-return-view-close-btn"
              onClick={handleClose}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="sales-return-view-body" id="sales-return-print-area">
          {/* Customer Info and Return Info Side by Side */}
          <div className="sales-return-view-info-sections">
            {/* Customer Info - Left Side */}
            <div className="sales-return-view-info-section sales-return-view-customer-info">
              <h3>Customer Information</h3>
              <div className="sales-return-view-info-grid">
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">Name:</span>
                  <span className="sales-return-view-info-value">
                    {salesReturn.customer?.name || "Walk-in Customer"}
                  </span>
                </div>
                {salesReturn.customer?.phone && (
                  <div className="sales-return-view-info-row">
                    <span className="sales-return-view-info-label">Phone:</span>
                    <span className="sales-return-view-info-value">
                      {salesReturn.customer.phone}
                    </span>
                  </div>
                )}
                {salesReturn.customer?.email && (
                  <div className="sales-return-view-info-row">
                    <span className="sales-return-view-info-label">Email:</span>
                    <span className="sales-return-view-info-value">
                      {salesReturn.customer.email}
                    </span>
                  </div>
                )}
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Created By:
                  </span>
                  <span className="sales-return-view-info-value">
                    {salesReturn.user?.name || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Return Info - Right Side */}
            <div className="sales-return-view-info-section sales-return-view-details-info">
              <h3>Return Information</h3>
              <div className="sales-return-view-info-grid">
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Return Number:
                  </span>
                  <span className="sales-return-view-info-value">
                    {salesReturn.return_no}
                  </span>
                </div>
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Original Sale Invoice:
                  </span>
                  <span className="sales-return-view-info-value">
                    {salesReturn.sale?.invoice_no || "N/A"}
                  </span>
                </div>
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Return Date:
                  </span>
                  <span className="sales-return-view-info-value">
                    {formatDate(salesReturn.return_date)}
                  </span>
                </div>
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Return Reason:
                  </span>
                  <span className="sales-return-view-info-value">
                    {salesReturn.reason || "N/A"}
                  </span>
                </div>
                <div className="sales-return-view-info-row">
                  <span className="sales-return-view-info-label">
                    Payment Status:
                  </span>
                  <span
                    className={`sales-return-view-status-badge sales-return-view-status-${salesReturn.payment_status}`}
                  >
                    {salesReturn.payment_status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Return Items */}
          <div className="sales-return-view-order-items-section">
            <h3>Return Items</h3>
            <div className="sales-return-view-table-wrapper">
              <table className="sales-return-view-order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Unit Price</th>
                    <th>Return Quantity</th>
                    <th>Reason</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReturn.items?.length > 0 ? (
                    salesReturn.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.product_name ||
                            item.product?.name ||
                            "Unknown Product"}
                        </td>
                        <td>{item.sku || item.product?.sku || "N/A"}</td>
                        <td>
                          LKR{" "}
                          {parseFloat(item.unit_price || 0).toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </td>
                        <td>{item.return_quantity}</td>
                        <td>{item.item_reason || "N/A"}</td>
                        <td className="sales-return-view-total-cell">
                          LKR{" "}
                          {parseFloat(
                            item.total || item.subtotal || 0,
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="sales-return-view-empty-message"
                      >
                        No return items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Return Summary */}
          <div className="sales-return-view-summary-section">
            <div className="sales-return-view-summary-box">
              <h3>Return Summary</h3>
              <div className="sales-return-view-summary-row">
                <span>Subtotal:</span>
                <span className="sales-return-view-summary-value">
                  LKR{" "}
                  {parseFloat(salesReturn.subtotal || 0).toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}
                </span>
              </div>
              {salesReturn.discount > 0 && (
                <div className="sales-return-view-summary-row">
                  <span>Discount:</span>
                  <span className="sales-return-view-summary-value sales-return-view-discount">
                    - LKR{" "}
                    {parseFloat(salesReturn.discount || 0).toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </span>
                </div>
              )}
              {salesReturn.tax > 0 && (
                <div className="sales-return-view-summary-row">
                  <span>Tax:</span>
                  <span className="sales-return-view-summary-value">
                    LKR{" "}
                    {parseFloat(salesReturn.tax || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="sales-return-view-summary-row sales-return-view-grand-total">
                <span>Total Refund:</span>
                <span className="sales-return-view-summary-value">
                  LKR{" "}
                  {parseFloat(salesReturn.total_refund || 0).toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}
                </span>
              </div>
              <div className="sales-return-view-summary-row">
                <span>Refund Amount:</span>
                <span className="sales-return-view-summary-value">
                  LKR{" "}
                  {parseFloat(salesReturn.refund_amount || 0).toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}
                </span>
              </div>
              <div className="sales-return-view-summary-row sales-return-view-balance-row">
                <span>Balance Amount:</span>
                <span
                  className={`sales-return-view-summary-value ${
                    salesReturn.balance_amount > 0
                      ? "sales-return-view-balance-amount"
                      : "sales-return-view-fully-paid"
                  }`}
                >
                  {salesReturn.balance_amount > 0 ? "LKR " : "Fully Paid"}
                  {salesReturn.balance_amount > 0
                    ? parseFloat(
                        salesReturn.balance_amount || 0,
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ""}
                </span>
              </div>
              <div className="sales-return-view-summary-row">
                <span>Payment Method:</span>
                <span className="sales-return-view-summary-value">
                  {salesReturn.payment_method?.replace("_", " ") || "Cash"}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {salesReturn.notes && (
            <div className="sales-return-view-notes-section">
              <h3>Notes</h3>
              <div className="sales-return-view-notes-content">
                {salesReturn.notes}
              </div>
            </div>
          )}
        </div>

        <div className="sales-return-view-modal-footer">
          <button
            className="sales-return-view-btn-cancel"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewSalesReturnModal;
