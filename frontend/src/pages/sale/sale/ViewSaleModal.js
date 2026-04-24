import React, { useState, useEffect } from "react";
import { X, Printer, Download } from "lucide-react";
import "./ViewSaleModal.css";

const ViewSaleModal = ({ isOpen, onClose, saleId }) => {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSaleDetails = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `http://127.0.0.1:8000/api/sales/${saleId}`,
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
          setSale(data.sale);
        } else {
          throw new Error(data.message || "Failed to fetch sale details");
        }
      } catch (error) {
        console.error("Error fetching sale details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && saleId) {
      fetchSaleDetails();
    }
  }, [isOpen, saleId]);

  const handleClose = () => {
    setSale(null);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handlePrint = () => {
    const printArea = document.getElementById("sale-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const title = `Sale - ${sale.invoice_no || "Invoice"}`;

    // Minimal styles to make the printed details readable
    const styles = `
      body{font-family: Arial, Helvetica, sans-serif; color:#111; padding:20px}
      h3{margin:0 0 8px 0}
      table{width:100%; border-collapse:collapse; margin-top:10px}
      th,td{border:1px solid #ddd; padding:8px; text-align:left}
      .view-sale-summary-row{display:flex; justify-content:space-between; padding:6px 0}
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

    // Allow the new window to render before calling print
    setTimeout(() => {
      try {
        printWindow.print();
        printWindow.close();
      } catch (err) {
        console.error("Print failed:", err);
      }
    }, 300);
  };

  const handleDownload = () => {
    console.log("Download sale:", saleId);
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="view-sale-modal-overlay" onClick={handleOverlayClick}>
        <div
          className="view-sale-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="view-sale-modal-header">
            <h2>Sale Details</h2>
            <button className="view-sale-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="view-sale-modal-body">
            <div className="view-sale-loading">Loading sale details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="view-sale-modal-overlay" onClick={handleOverlayClick}>
        <div
          className="view-sale-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="view-sale-modal-header">
            <h2>Sale Details</h2>
            <button className="view-sale-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
          <div className="view-sale-modal-body">
            <div className="view-sale-error-message">Sale not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-sale-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="view-sale-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="view-sale-modal-header">
          <h2>Sale Details - {sale.invoice_no}</h2>
          <div className="view-sale-header-actions">
            {/* <button
              className="view-sale-action-btn sale-download-btn"
              onClick={handleDownload}
              title="Download Invoice"
            >
              <Download size={18} />
            </button> */}
            <button
              className="view-sale-action-btn sale-print-btn"
              onClick={handlePrint}
              title="Print"
            >
              <Printer size={18} />
            </button>
            <button className="view-sale-close-btn" onClick={handleClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="view-sale-modal-body" id="sale-print-area">
          {/* Customer Info and Sale Info Side by Side */}
          <div className="view-sale-info-sections">
            {/* Customer Info - Left Side */}
            <div className="view-sale-info-section sale-customer-info">
              <h3>Customer Information</h3>
              <div className="view-sale-info-grid">
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Name:</span>
                  <span className="view-sale-info-value">
                    {sale.customer?.name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Phone:</span>
                  <span className="view-sale-info-value">
                    {sale.customer?.phone || "N/A"}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Email:</span>
                  <span className="view-sale-info-value">
                    {sale.customer?.email || "N/A"}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Loyalty Points:</span>
                  <span className="view-sale-info-value">
                    {sale.customer?.loyalty_points || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Sale Info - Right Side */}
            <div className="view-sale-info-section sale-transaction-info">
              <h3>Transaction Information</h3>
              <div className="view-sale-info-grid">
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Invoice Number:</span>
                  <span className="view-sale-info-value sale-invoice-value">
                    {sale.invoice_no}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Date:</span>
                  <span className="view-sale-info-value">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Time:</span>
                  <span className="view-sale-info-value">
                    {new Date(sale.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">Status:</span>
                  <span
                    className={`view-sale-status-badge sale-status-${sale.status}`}
                  >
                    {sale.status}
                  </span>
                </div>
                <div className="view-sale-info-row">
                  <span className="view-sale-info-label">User:</span>
                  <span className="view-sale-info-value">
                    {sale.user?.first_name || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sale Items */}
          <div className="view-sale-items-section">
            <h3>Sale Items</h3>
            <div className="view-sale-table-wrapper">
              <table className="view-sale-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.length > 0 ? (
                    sale.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>{item.sku || "N/A"}</td>
                        <td>
                          LKR{" "}
                          {parseFloat(item.price).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>{item.quantity}</td>
                        <td className="view-sale-total-cell">
                          LKR{" "}
                          {parseFloat(item.total).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="view-sale-empty-message">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sale Summary */}
          <div className="view-sale-summary-section">
            <div className="view-sale-summary-box">
              <h3>Sale Summary</h3>
              <div className="view-sale-summary-row">
                <span>Subtotal: </span>
                <span className="view-sale-summary-value">
                  LKR{" "}
                  {parseFloat(sale.subtotal).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Discount:</span>
                <span className="view-sale-summary-value sale-discount-value">
                  - LKR{" "}
                  {parseFloat(sale.discount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Shipping:</span>
                <span className="view-sale-summary-value">
                  + LKR{" "}
                  {parseFloat(sale.shipping).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span className="view-sale-summary-value">
                  + LKR{" "}
                  {parseFloat(sale.tax).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row sale-grand-total">
                <span>Total Amount:</span>
                <span className="view-sale-summary-value sale-total-value">
                  LKR{" "}
                  {parseFloat(sale.total).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Payment Method:</span>
                <span
                  className={`view-sale-payment-badge sale-payment-${sale.payment_method}`}
                >
                  {sale.payment_method}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Payment Status:</span>
                <span
                  className={`view-sale-payment-status sale-payment-status-${sale.payment_status}`}
                >
                  {sale.payment_status}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Paid Amount:</span>
                <span className="view-sale-summary-value">
                  LKR{" "}
                  {parseFloat(sale.paid_amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="view-sale-summary-row">
                <span>Change Amount:</span>
                <span className="view-sale-summary-value sale-change-value">
                  LKR{" "}
                  {parseFloat(sale.change_amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="view-sale-notes-section">
              <h3>Notes</h3>
              <div className="view-sale-notes-content">{sale.notes}</div>
            </div>
          )}
        </div>

        <div className="view-sale-modal-footer">
          <button className="view-sale-btn-close" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewSaleModal;
