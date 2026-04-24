import React, { useState } from "react";
import { X, CreditCard, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";
import "./CompleteHoldOrderModal.css";

const CompleteHoldOrderModal = ({
  isOpen,
  onClose,
  holdOrder,
  onComplete,
  business,
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");

  // Don't auto-fill with order total - leave empty for user input
  React.useEffect(() => {
    if (isOpen) {
      setPaidAmount("");
      setPaymentMethod("cash");
    }
  }, [isOpen]);

  if (!isOpen || !holdOrder) return null;

  // Handle paid amount input
  const handlePaidAmountChange = (e) => {
    let value = e.target.value;

    // Allow empty input
    if (value === "") {
      setPaidAmount("");
      return;
    }

    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Only allow one decimal point
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + "." + parts[1].substring(0, 2);
    }

    setPaidAmount(value);
  };

  // Format paid amount on blur
  const handlePaidAmountBlur = () => {
    if (paidAmount === "" || paidAmount === ".") {
      setPaidAmount("");
      return;
    }

    const num = parseFloat(paidAmount);
    if (isNaN(num)) {
      setPaidAmount("");
    } else {
      setPaidAmount(num.toFixed(2));
    }
  };

  // Calculate change
  const calculateChange = () => {
    const total = parseFloat(holdOrder.total || 0);
    const paid = parseFloat(paidAmount || 0);
    const change = paid - total;
    return change >= 0 ? change : 0;
  };

  // Calculate remaining balance
  const calculateBalance = () => {
    const total = parseFloat(holdOrder.total || 0);
    const paid = parseFloat(paidAmount || 0);
    const balance = total - paid;
    return balance > 0 ? balance : 0;
  };

  const printReceipt = () => {
    const total = parseFloat(holdOrder.total || 0);
    const discountValue = parseFloat(holdOrder.discount || 0);
    const shippingValue = parseFloat(holdOrder.shipping || 0);
    const paid = parseFloat(paidAmount || 0);
    const change = paid - total;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups for receipt printing");
      return;
    }

    printWindow.document.write(`
    <html>
      <head>
        <title>Receipt - ${holdOrder.reference_no}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            margin: 0 auto; 
            padding: 10px; 
            font-size: 12px; 
            line-height: 1.4;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 4px 0; }
          .total { font-size: 14px; margin-top: 10px; }
          .logo { width: 100px; height: auto; margin: 10px auto; display: block; }
          @media print {
            body { width: 80mm; margin: 0; padding: 5px; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 1000)">
        <!-- Real Logo -->
        ${
          business?.logo_url
            ? `<img src="${business.logo_url}" class="logo" alt="Logo" />`
            : ""
        }

        <!-- Real Shop Header -->
        <div class="center">
          <h2>${business?.name || "My Shop"}</h2>
          ${business?.address ? `<p>${business.address}</p>` : ""}
          ${business?.phone ? `<p>Tel: ${business.phone}</p>` : ""}
          ${business?.email ? `<p>Email: ${business.email}</p>` : ""}
        </div>

        <div class="line"></div>

        <p>Date: ${new Date().toLocaleString()}</p>
        <p>Invoice: ${holdOrder.reference_no}</p>
        ${
          holdOrder.customer
            ? `<p>Customer: ${holdOrder.customer.name} (${
                holdOrder.customer.phone || ""
              })</p>`
            : "<p>Customer: Walk-in</p>"
        }

        <div class="line"></div>

        <!-- Real Hold Order Items -->
        ${holdOrder.items
          .map(
            (item) => `
          <div class="item">
            <span>${item.product_name || item.name}</span>
            <span>${item.quantity} x ${parseFloat(
              item.price || item.unit_price
            ).toFixed(2)}</span>
          </div>
          <div class="item">
            <span></span>
            <span>LKR ${(
              item.quantity * parseFloat(item.price || item.unit_price)
            ).toFixed(2)}</span>
          </div>
        `
          )
          .join("")}

        <div class="line"></div>

        <!-- Real Totals -->
        <div class="total">
          <div class="item"><span>Subtotal:</span><span>LKR ${parseFloat(
            holdOrder.subtotal
          ).toFixed(2)}</span></div>
          ${
            discountValue > 0
              ? `<div class="item"><span>Discount:</span><span>- LKR ${discountValue.toFixed(
                  2
                )}</span></div>`
              : ""
          }
          ${
            shippingValue > 0
              ? `<div class="item"><span>Shipping:</span><span>+ LKR ${shippingValue.toFixed(
                  2
                )}</span></div>`
              : ""
          }
          <div class="item bold"><span>Total:</span><span>LKR ${total.toFixed(
            2
          )}</span></div>
          <div class="item"><span>Paid:</span><span>LKR ${paid.toFixed(
            2
          )}</span></div>
          <div class="item"><span>Change:</span><span>LKR ${(change >= 0
            ? change
            : 0
          ).toFixed(2)}</span></div>
        </div>

        <div class="line"></div>
        <div class="center">
          <p><strong>Thank You!</strong></p>
          <p>Come Again</p>
        </div>
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();
  };
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    const paid = parseFloat(paidAmount);
    if (isNaN(paid) || paid <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      setLoading(true);
      await onComplete(holdOrder.id, paymentMethod, paid);
      printReceipt();

      toast.success("Hold order completed & receipt printed!");
      onClose();
    } catch (error) {
      console.error("Error completing order:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return "LKR 0.00";
    return `LKR ${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="modal-overlay">
      <div className="complete-order-modal">
        <div className="modal-header">
          <div className="modal-title">
            <DollarSign size={24} />
            <h2>Complete Hold Order</h2>
            <span className="order-ref">
              <span className="ref-badge">HOLD</span>
              {holdOrder.reference_no}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-content">
            {/* Left Side - Payment Details */}
            <div className="payment-section">
              <div className="section-header">
                <CreditCard size={20} />
                <h3>Payment Details</h3>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    disabled={loading}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Paid Amount *</label>
                  <div className="amount-input-wrapper">
                    <span className="currency-symbol">LKR</span>
                    <input
                      type="text"
                      value={paidAmount}
                      onChange={handlePaidAmountChange}
                      onBlur={handlePaidAmountBlur}
                      required
                      disabled={loading}
                      placeholder="0.00"
                      className="amount-input"
                    />
                  </div>
                </div>
              </div>

              {paymentMethod === "credit" && parseFloat(paidAmount) > 0 && (
                <div className="form-group">
                  <div className="balance-warning">
                    <span className="balance-label">Credit Balance:</span>
                    <span className="balance-amount">
                      {formatCurrency(calculateBalance())}
                    </span>
                  </div>
                  <small className="helper-text">
                    Customer will owe this amount
                  </small>
                </div>
              )}

              {paymentMethod !== "credit" && parseFloat(paidAmount) > 0 && (
                <div className="payment-summary">
                  <div className="summary-row">
                    <span>Change Due:</span>
                    <span className="change-amount">
                      {formatCurrency(calculateChange())}
                    </span>
                  </div>
                  {calculateChange() > 0 && (
                    <div className="change-note">
                      Give customer {formatCurrency(calculateChange())} in
                      change
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side - Simple Amounts Only */}
            <div className="summary-section simple-summary">
              <div className="section-header">
                <Package size={20} />
                <h3>Order Summary</h3>
              </div>

              <div className="simple-amounts">
                <div className="amount-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(holdOrder.subtotal)}</span>
                </div>

                {parseFloat(holdOrder.discount) > 0 && (
                  <div className="amount-row discount">
                    <span>Discount:</span>
                    <span>- {formatCurrency(holdOrder.discount)}</span>
                  </div>
                )}

                {parseFloat(holdOrder.shipping) > 0 && (
                  <div className="amount-row">
                    <span>Shipping:</span>
                    <span>+ {formatCurrency(holdOrder.shipping)}</span>
                  </div>
                )}

                <div className="amount-row total">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(holdOrder.total)}</span>
                </div>

                <div className="amount-divider"></div>

                <div className="amount-row paid">
                  <span>Paid Amount:</span>
                  <span>{formatCurrency(paidAmount || 0)}</span>
                </div>

                {paymentMethod === "credit" ? (
                  <div className="amount-row balance">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(calculateBalance())}</span>
                  </div>
                ) : (
                  <div className="amount-row change">
                    <span>Change:</span>
                    <span>{formatCurrency(calculateChange())}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Processing...
                </>
              ) : (
                "Complete Sale"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteHoldOrderModal;
