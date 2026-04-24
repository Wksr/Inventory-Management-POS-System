import React, { useState } from "react";
import { X, CreditCard, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";
import "./PaymentModal.css";

const PaymentModal = ({
  isOpen,
  onClose,
  cartItems = [],
  discount = "0.00",
  shipping = "0.00",
  onCompletePayment,
  customer,
  business,
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [lastSaleData, setLastSaleData] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      setPaymentMethod("cash");
      setPaidAmount("");
      setLoading(false);
    }
  }, [isOpen]);

  // Calculate cart totals
  const calculateSubtotal = () => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountValue = parseFloat(discount) || 0;
    const shippingValue = parseFloat(shipping) || 0;
    return subtotal - discountValue + shippingValue;
  };

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
    const total = calculateTotal();
    const paid = parseFloat(paidAmount || 0);
    const change = paid - total;
    return change >= 0 ? change : 0;
  };

  // Calculate remaining balance
  const calculateBalance = () => {
    const total = calculateTotal();
    const paid = parseFloat(paidAmount || 0);
    const balance = total - paid;
    return balance > 0 ? balance : 0;
  };

  const printReceipt = (saleData = {}) => {
    const receiptSettings = JSON.parse(
      localStorage.getItem("receiptSettings"),
    ) || {
      showLogo: true,
      showShopName: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      showDateTime: true,
      showInvoiceNo: true,
      showCashier: true,
      showCustomer: true,
      showThankYou: true,
      footerMessage: "Thank You! Come Again :)",
    };

    const subtotal = calculateSubtotal();
    const total = calculateTotal();
    const discountValue = parseFloat(discount) || 0;
    const shippingValue = parseFloat(shipping) || 0;
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
        <title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; line-height: 1.4; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 4px 0; }
          .total { font-size: 14px; margin-top: 10px; }
          .logo { width: 100px; height: auto; margin: 10px auto; display: block; }
          @media print { body { width: 80mm; margin: 0; padding: 5px; } @page { size: 80mm auto; margin: 0; } }
        </style>
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 1000)">
        <!-- Logo -->
        ${
          receiptSettings.showLogo && business?.logo_url
            ? `<img src="${business.logo_url}" class="logo" alt="Logo" />`
            : ""
        }

        <!-- Shop Header -->
        <div class="center">
          ${
            receiptSettings.showShopName
              ? `<h2>${business?.name || "My Shop"}</h2>`
              : ""
          }
          ${
            receiptSettings.showAddress && business?.address
              ? `<p>${business.address}</p>`
              : ""
          }
          ${
            receiptSettings.showPhone && business?.phone
              ? `<p>Tel: ${business.phone}</p>`
              : ""
          }
          ${
            receiptSettings.showEmail && business?.email
              ? `<p>Email: ${business.email}</p>`
              : ""
          }
        </div>

        <div class="line"></div>

        ${
          receiptSettings.showDateTime
            ? `<p>Date: ${new Date().toLocaleString()}</p>`
            : ""
        }
        ${
          receiptSettings.showInvoiceNo
            ? `<p>Invoice: ${saleData?.invoice_no || "INV-001"}</p>`
            : ""
        }
        ${receiptSettings.showCashier ? `<p>Cashier: Admin</p>` : ""}
        ${
          receiptSettings.showCustomer && customer
            ? `<p>Customer: ${customer.name} (${customer.phone || ""})</p>`
            : ""
        }

        <div class="line"></div>

        <!-- Items -->
        ${cartItems
          .map(
            (item) => `
          <div class="item">
            <span>${item.name}</span>
            <span>${item.quantity} x ${item.price.toFixed(2)}</span>
          </div>
          <div class="item">
            <span></span>
            <span>LKR ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `,
          )
          .join("")}

        <div class="line"></div>

        <!-- Totals -->
        <div class="total">
          <div class="item"><span>Subtotal:</span><span>LKR ${subtotal.toFixed(
            2,
          )}</span></div>
          ${
            discountValue > 0
              ? `<div class="item"><span>Discount:</span><span>- LKR ${discountValue.toFixed(
                  2,
                )}</span></div>`
              : ""
          }
          ${
            shippingValue > 0
              ? `<div class="item"><span>Shipping:</span><span>+ LKR ${shippingValue.toFixed(
                  2,
                )}</span></div>`
              : ""
          }
          <div class="item bold"><span>Total:</span><span>LKR ${total.toFixed(
            2,
          )}</span></div>
          <div class="item"><span>Paid:</span><span>LKR ${paid.toFixed(
            2,
          )}</span></div>
          <div class="item"><span>Change:</span><span>LKR ${(change >= 0
            ? change
            : 0
          ).toFixed(2)}</span></div>
        </div>

        <div class="line"></div>

        <!-- Footer -->
        ${
          receiptSettings.showThankYou
            ? `
          <div class="center">
            <p><strong>${receiptSettings.footerMessage}</strong></p>
          </div>
        `
            : ""
        }

      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();
  };

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

    const total = calculateTotal();
    if (paid < total) {
      toast.error("Paid amount must be at least the total amount");
      return;
    }

    try {
      setLoading(true);
      const result = await onCompletePayment(paymentMethod, paid);
      if (result && result.sale) {
        setLastSaleData(result.sale);
        printReceipt(result.sale);
        toast.success("Sale completed & receipt printed!");
      } else {
        toast.success("Sale completed!");
      }

      onClose();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Payment failed");
    } finally {
      console.log(
        "PaymentModal finally block executed – loading should be false now",
      );
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return "LKR 0.00";
    return `LKR ${parseFloat(amount).toFixed(2)}`;
  };

  if (!isOpen) return null;

  const subtotal = calculateSubtotal();
  const total = calculateTotal();
  const discountValue = parseFloat(discount) || 0;
  const shippingValue = parseFloat(shipping) || 0;

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal">
        <div className="payment-modal-header">
          <div className="payment-modal-title">
            <DollarSign size={24} />
            <h2>Complete Sale</h2>
            {customer && (
              <span className="customer-badge">Customer: {customer.name}</span>
            )}
          </div>
          <button className="payment-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="payment-form-content">
            {/* Left Side - Payment Details */}
            <div className="payment-details-section">
              <div className="payment-section-header">
                <CreditCard size={20} />
                <h3>Payment Details</h3>
              </div>

              <div className="payment-form-row">
                <div className="payment-form-group">
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

                <div className="payment-form-group">
                  <label>Paid Amount *</label>
                  <div className="payment-amount-input-wrapper">
                    <span className="payment-currency-symbol">LKR</span>
                    <input
                      type="text"
                      value={paidAmount}
                      onChange={handlePaidAmountChange}
                      onBlur={handlePaidAmountBlur}
                      required
                      disabled={loading}
                      placeholder="0.00"
                      className="payment-amount-input"
                    />
                  </div>
                </div>
              </div>

              {paymentMethod === "credit" && parseFloat(paidAmount) > 0 && (
                <div className="payment-form-group">
                  <div className="payment-balance-warning">
                    <span className="payment-balance-label">
                      Credit Balance:
                    </span>
                    <span className="payment-balance-amount">
                      {formatCurrency(calculateBalance())}
                    </span>
                  </div>
                  <small className="payment-helper-text">
                    Customer will owe this amount
                  </small>
                </div>
              )}

              {paymentMethod !== "credit" && parseFloat(paidAmount) > 0 && (
                <div className="payment-summary">
                  <div className="payment-summary-row">
                    <span>Change Due:</span>
                    <span className="payment-change-amount">
                      {formatCurrency(calculateChange())}
                    </span>
                  </div>
                  {calculateChange() > 0 && (
                    <div className="payment-change-note">
                      Give customer {formatCurrency(calculateChange())} in
                      change
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side - Order Summary */}
            <div className="payment-summary-section">
              <div className="payment-section-header">
                <Package size={20} />
                <h3>Order Summary</h3>
              </div>

              <div className="payment-amounts">
                <div className="payment-amount-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {discountValue > 0 && (
                  <div className="payment-amount-row discount">
                    <span>Discount:</span>
                    <span>- {formatCurrency(discountValue)}</span>
                  </div>
                )}

                {shippingValue > 0 && (
                  <div className="payment-amount-row">
                    <span>Shipping:</span>
                    <span>+ {formatCurrency(shippingValue)}</span>
                  </div>
                )}

                <div className="payment-amount-row total">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                <div className="payment-amount-divider"></div>

                <div className="payment-amount-row paid">
                  <span>Paid Amount:</span>
                  <span>{formatCurrency(paidAmount || 0)}</span>
                </div>

                {paymentMethod === "credit" ? (
                  <div className="payment-amount-row balance">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(calculateBalance())}</span>
                  </div>
                ) : (
                  <div className="payment-amount-row change">
                    <span>Change:</span>
                    <span>{formatCurrency(calculateChange())}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="payment-modal-footer">
            <button
              type="button"
              className="payment-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="payment-btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="payment-loading-spinner"></div>
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

export default PaymentModal;
