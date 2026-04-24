import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./AddPurchaseModal.css";

const EditPurchaseModal = ({
  isOpen,
  onClose,
  onPurchaseUpdated,
  purchase,
}) => {
  const [formData, setFormData] = useState({
    date: "",
    supplier_id: "",
    notes: "",
  });

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [summaryData, setSummaryData] = useState({
    discount: 0,
    transport_cost: 0,
    paid_amount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Initialize form with purchase data
  useEffect(() => {
    if (isOpen && purchase) {
      console.log("Initializing with purchase:", purchase); // Debug log

      setFormData({
        date: purchase.date || new Date().toISOString().split("T")[0],
        supplier_id: purchase.supplier_id?.toString() || "",
        notes: purchase.notes || "",
      });

      // Ensure items have proper numeric values
      const initializedItems =
        purchase.items?.map((item) => ({
          id: item.id || Date.now(),
          product_id: item.product_id,
          productName: item.product?.name || "Unknown Product",
          unit_cost: Number(item.unit_cost) || 0,
          quantity: Number(item.quantity) || 1,
          discount: Number(item.discount) || 0,
          total: Number(item.total) || 0,
        })) || [];

      console.log("Initialized items:", initializedItems); // Debug log

      setOrderItems(initializedItems);

      setSummaryData({
        discount: Number(purchase.discount) || 0,
        transport_cost: Number(purchase.transport_cost) || 0,
        paid_amount: Number(purchase.paid_amount) || 0,
      });
    }
  }, [isOpen, purchase]);
  // Fetch suppliers and products
  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      fetchProducts();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/suppliers", {
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
        setSuppliers(data.suppliers?.data || []);
      } else {
        throw new Error(data.message || "Failed to fetch suppliers");
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Failed to fetch suppliers");
      const sampleSuppliers = [];
      setSuppliers(sampleSuppliers);
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
        setProducts(data.products?.data || []);
      } else {
        throw new Error(data.message || "Failed to fetch products");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products");
      const sampleProducts = [];
      setProducts(sampleProducts);
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
      (item) => item.product_id === product.id,
    );
    if (existingItem) {
      toast.error("Product already added!");
      return;
    }

    const unitCost = parseFloat(product.unit_cost || product.cost_price || 0);

    const newItem = {
      id: Date.now(),
      product_id: product.id,
      productName: product.name,
      unit_cost: unitCost,
      quantity: 1,
      discount: 0,
      total: unitCost,
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
          } else if (field === "discount" || field === "unit_cost") {
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
          const unitCost =
            typeof updatedItem.unit_cost === "number"
              ? updatedItem.unit_cost
              : parseFloat(updatedItem.unit_cost) || 0;
          const quantity =
            typeof updatedItem.quantity === "number"
              ? updatedItem.quantity
              : parseInt(updatedItem.quantity) || 0;
          const discount =
            typeof updatedItem.discount === "number"
              ? updatedItem.discount
              : parseFloat(updatedItem.discount) || 0;

          updatedItem.total = unitCost * quantity - discount;

          return updatedItem;
        }
        return item;
      }),
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
    return Math.round(subtotal * 100) / 100; // Ensure 2 decimal places
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = Number(summaryData.discount) || 0;
    const transport = Number(summaryData.transport_cost) || 0;
    const grandTotal = subtotal - discount + transport;
    return Math.round(grandTotal * 100) / 100; // Ensure 2 decimal places
  };

  const calculateBalance = () => {
    const grandTotal = calculateGrandTotal();
    const paidAmount = Number(summaryData.paid_amount) || 0;
    const balance = grandTotal - paidAmount;
    return Math.round(balance * 100) / 100; // Ensure 2 decimal places
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
    if (!formData.supplier_id) {
      toast.error("Please select a supplier");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    const purchaseData = {
      supplier_id: formData.supplier_id,
      date: formData.date,
      items: orderItems.map((item) => ({
        product_id: item.product_id,
        unit_cost:
          typeof item.unit_cost === "number"
            ? item.unit_cost
            : parseFloat(item.unit_cost) || 0,
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
      transport_cost: summaryData.transport_cost,
      paid_amount: summaryData.paid_amount,
      notes: formData.notes,
    };

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/purchases/${purchase.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(purchaseData),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Purchase updated successfully!");
        onPurchaseUpdated(data.purchase);
        handleClose();
      } else {
        throw new Error(data.message || "Failed to update purchase");
      }
    } catch (error) {
      console.error("Error updating purchase:", error);
      toast.error("Failed to update purchase: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      supplier_id: "",
      notes: "",
    });
    setOrderItems([]);
    setSummaryData({
      discount: 0,
      transport_cost: 0,
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
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen || !purchase) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Purchase - {purchase.invoice_number}</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="purchase-form-row">
            <div className="purchase-form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="purchase-form-input"
              />
            </div>

            <div className="purchase-form-group">
              <label>Supplier</label>
              <select
                value={formData.supplier_id}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_id: e.target.value })
                }
                className="purchase-form-input"
                disabled={loading}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="purchase-form-group">
            <label>Search Product</label>
            <div className="purchase-search-product-container">
              <Search className="purchase-search-product-icon" size={18} />
              <input
                type="text"
                placeholder="Search and select product..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="purchase-form-input purchase-search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="purchase-product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="purchase-product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="purchase-product-price">
                        LKR{" "}
                        {(
                          product.unit_cost ||
                          product.cost_price ||
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
                    <th>Unit Cost</th>
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
                              item.unit_cost === 0 || item.unit_cost === ""
                                ? ""
                                : item.unit_cost
                            }
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "unit_cost",
                                e.target.value,
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
                                e.target.value,
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
                                e.target.value,
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
                <span>Transport:</span>
                <div className="summary-input-group">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      summaryData.transport_cost === 0
                        ? ""
                        : summaryData.transport_cost
                    }
                    onChange={(e) =>
                      handleSummaryInputChange("transport_cost", e.target.value)
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
            <div className="purchase-form-group">
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
            <div className="purchase-form-group">
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

          <div className="purchase-form-group">
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
            {loading ? "Updating..." : "Update Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPurchaseModal;
