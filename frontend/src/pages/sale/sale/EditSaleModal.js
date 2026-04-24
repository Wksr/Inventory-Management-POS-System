import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./EditSaleModal.css";

const EditSaleModal = ({ isOpen, onClose, onSaleUpdated, sale }) => {
  const [formData, setFormData] = useState({
    customer_id: "",
    notes: "",
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [summaryData, setSummaryData] = useState({
    discount: 0,
    shipping: 0,
    paid_amount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Initialize form with sale data
  useEffect(() => {
    if (isOpen && sale) {
      console.log("Initializing with sale:", sale);

      setFormData({
        customer_id: sale.customer_id?.toString() || "",
        notes: sale.notes || "",
      });

      // Initialize order items
      const initializedItems =
        sale.items?.map((item) => ({
          id: item.id || Date.now(),
          product_id: item.product_id,
          productName: item.product?.name || "Unknown Product",
          unit_price:
            Number(item.unit_price || item.price || item.selling_price) || 0,
          quantity: Number(item.quantity) || 1,
          discount: Number(item.discount) || 0,
          total: Number(item.total) || 0,
        })) || [];

      console.log("Initialized items:", initializedItems);
      setOrderItems(initializedItems);

      // Set summary data
      setSummaryData({
        discount: Number(sale.discount) || 0,
        shipping: Number(sale.shipping) || 0,
        paid_amount: Number(sale.paid_amount) || 0,
      });
    }
  }, [isOpen, sale]);

  // Fetch customers and products
  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      fetchProducts();
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/customers", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers?.data || data.customers || []);
      } else {
        throw new Error(data.message || "Failed to fetch customers");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to fetch customers");
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/products", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setProducts(data.products?.data || data.products || []);
      } else {
        throw new Error(data.message || "Failed to fetch products");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products");
    }
  };

  const handleSearchProduct = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      setShowProductDropdown(true);
    } else {
      setShowProductDropdown(false);
    }
  };

  const handleSelectProduct = (product) => {
    const existingItem = orderItems.find(
      (item) => item.product_id === product.id
    );
    if (existingItem) {
      toast.error("Product already added!");
      return;
    }

    const unitPrice = parseFloat(product.selling_price || product.price || 0);

    const newItem = {
      id: Date.now(),
      product_id: product.id,
      productName: product.name,
      unit_price: unitPrice,
      quantity: 1,
      discount: 0,
      total: unitPrice,
    };

    setOrderItems([...orderItems, newItem]);
    setSearchQuery("");
    setShowProductDropdown(false);
    toast.success("Product added to order");
  };

  const handleUpdateItem = (id, field, value) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.id === id) {
          let updatedItem = { ...item };

          if (field === "quantity") {
            updatedItem[field] = parseInt(value) || 0;
          } else if (field === "discount" || field === "unit_price") {
            if (value === "" || value === "." || value === "0.") {
              updatedItem[field] = value;
            } else {
              const cleanValue = value.replace(/[^\d.]/g, "");
              updatedItem[field] = parseFloat(cleanValue) || 0;
            }
          } else {
            updatedItem[field] = parseFloat(value) || 0;
          }

          // Calculate total only when all values are numbers
          const unitPrice =
            typeof updatedItem.unit_price === "number"
              ? updatedItem.unit_price
              : parseFloat(updatedItem.unit_price) || 0;
          const quantity =
            typeof updatedItem.quantity === "number"
              ? updatedItem.quantity
              : parseInt(updatedItem.quantity) || 0;
          const discount =
            typeof updatedItem.discount === "number"
              ? updatedItem.discount
              : parseFloat(updatedItem.discount) || 0;

          updatedItem.total = unitPrice * quantity - discount;

          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id) => {
    setOrderItems(orderItems.filter((item) => item.id !== id));
    toast.success("Product removed from order");
  };

  const calculateSubtotal = () => {
    const subtotal = orderItems.reduce((sum, item) => {
      const itemTotal =
        typeof item.total === "number"
          ? item.total
          : parseFloat(item.total) || 0;
      return sum + itemTotal;
    }, 0);
    return Math.round(subtotal * 100) / 100;
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = Number(summaryData.discount) || 0;
    const shipping = Number(summaryData.shipping) || 0;
    const grandTotal = subtotal - discount + shipping;
    return Math.round(grandTotal * 100) / 100;
  };

  const calculateBalance = () => {
    const grandTotal = calculateGrandTotal();
    const paidAmount = Number(summaryData.paid_amount) || 0;
    const balance = grandTotal - paidAmount;
    return Math.round(balance * 100) / 100;
  };

  const handleSummaryInputChange = (field, value) => {
    const numericValue = value.replace(/[^\d.]/g, "");

    const decimalRegex = /^\d*\.?\d{0,2}$/;
    if (!decimalRegex.test(numericValue) && numericValue !== "") {
      return;
    }

    const parsedValue = numericValue === "" ? 0 : parseFloat(numericValue);

    setSummaryData({
      ...summaryData,
      [field]: parsedValue,
    });
  };

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    const saleData = {
      customer_id: formData.customer_id || null,
      items: orderItems.map((item) => ({
        product_id: item.product_id,
        unit_price:
          typeof item.unit_price === "number"
            ? item.unit_price
            : parseFloat(item.unit_price) || 0,
        quantity:
          typeof item.quantity === "number"
            ? item.quantity
            : parseInt(item.quantity) || 0,
        discount:
          typeof item.discount === "number"
            ? item.discount
            : parseFloat(item.discount) || 0,
      })),
      discount: summaryData.discount,
      shipping: summaryData.shipping,
      paid_amount: summaryData.paid_amount,
      notes: formData.notes,
    };

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/sales/${sale.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saleData),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Sale updated successfully!");
        onSaleUpdated(data.sale);
        handleClose();
      } else {
        throw new Error(data.message || "Failed to update sale");
      }
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Failed to update sale: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customer_id: "",
      notes: "",
    });
    setOrderItems([]);
    setSummaryData({
      discount: 0,
      shipping: 0,
      paid_amount: 0,
    });
    setSearchQuery("");
    setShowProductDropdown(false);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen || !sale) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Sale - {sale.invoice_no}</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Customer</label>
              <select
                value={formData.customer_id}
                onChange={(e) =>
                  setFormData({ ...formData, customer_id: e.target.value })
                }
                className="form-input"
                disabled={loading}
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Search Product</label>
            <div className="search-product-container">
              <Search className="search-product-icon" size={18} />
              <input
                type="text"
                placeholder="Search and select product..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="form-input search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="product-price">
                        LKR{" "}
                        {(
                          product.selling_price ||
                          product.price ||
                          0
                        ).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="order-items-section">
            <h3>Order Items</h3>
            <div className="table-wrapper">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th>Quantity</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-message">
                        No items added
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.productName}</td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              item.unit_price === 0 || item.unit_price === ""
                                ? ""
                                : item.unit_price
                            }
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "unit_price",
                                e.target.value
                              )
                            }
                            className="qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "quantity",
                                e.target.value
                              )
                            }
                            className="qty-input"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              item.discount === 0 || item.discount === ""
                                ? ""
                                : item.discount
                            }
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "discount",
                                e.target.value
                              )
                            }
                            className="qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="total-cell">
                          LKR{" "}
                          {typeof item.total === "number"
                            ? item.total.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "0.00"}
                        </td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="summary-section">
            <div className="empty-area"></div>
            <div className="summary-box">
              <h3>Order Summary</h3>
              <div className="summary-row">
                <span>Subtotal:</span>
                <span className="summary-value">
                  LKR{" "}
                  {calculateSubtotal().toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span>Discount:</span>
                <div className="summary-input-group">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      summaryData.discount === 0 ? "" : summaryData.discount
                    }
                    onChange={(e) =>
                      handleSummaryInputChange("discount", e.target.value)
                    }
                    className="summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <div className="summary-input-group">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      summaryData.shipping === 0 ? "" : summaryData.shipping
                    }
                    onChange={(e) =>
                      handleSummaryInputChange("shipping", e.target.value)
                    }
                    className="summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="summary-row grand-total">
                <span>Grand Total:</span>
                <span className="summary-value">
                  LKR{" "}
                  {calculateGrandTotal().toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="payment-section">
            <div className="form-group">
              <label>Paid Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={
                  summaryData.paid_amount === 0 ? "" : summaryData.paid_amount
                }
                onChange={(e) =>
                  handleSummaryInputChange("paid_amount", e.target.value)
                }
                className="form-input"
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Balance</label>
              <input
                type="text"
                value={`LKR ${calculateBalance().toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                readOnly
                className="form-input balance-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="form-textarea"
              rows="3"
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Sale"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSaleModal;
