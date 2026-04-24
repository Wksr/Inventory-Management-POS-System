import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./EditSalesReturnModal.css";

const EditSalesReturnModal = ({
  isOpen,
  onClose,
  salesReturnId,
  onReturnUpdated,
}) => {
  const [formData, setFormData] = useState({
    return_date: new Date().toISOString().split("T")[0],
    sale_id: "",
    reason: "",
    notes: "",
  });

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [summaryData, setSummaryData] = useState({
    refund_amount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [originalReturn, setOriginalReturn] = useState(null);

  // Fetch sales return details, sales, and products
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
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.sale_return) {
          const returnData = data.sale_return;
          setOriginalReturn(returnData);

          // Set form data
          setFormData({
            return_date: returnData.return_date.split("T")[0],
            sale_id: returnData.sale_id,
            reason: returnData.reason || "",
            notes: returnData.notes || "",
          });

          // Set summary data
          setSummaryData({
            refund_amount: parseFloat(returnData.refund_amount) || 0,
          });

          // Set selected sale
          setSelectedSale(returnData.sale);

          // Set return items
          const items =
            returnData.items?.map((item) => ({
              id: Date.now() + Math.random(),
              product_id: item.product_id,
              sale_item_id: item.sale_item_id,
              productName:
                item.product_name || item.product?.name || "Unknown Product",
              unit_price: parseFloat(item.unit_price) || 0,
              max_quantity:
                item.max_return_quantity || item.return_quantity || 0,
              return_quantity: parseFloat(item.return_quantity) || 0,
              item_reason: item.item_reason || "",
              total: parseFloat(item.total) || 0,
            })) || [];
          setReturnItems(items);
        } else {
          throw new Error(
            data.message || "Failed to fetch sales return details"
          );
        }
      } catch (error) {
        console.error("Error fetching sales return details:", error);
        toast.error("Failed to fetch sales return details");
      } finally {
        setLoading(false);
      }
    };

    const fetchSales = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/sales", {
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
          setSales(data.sales?.data || []);
        } else {
          throw new Error(data.message || "Failed to fetch sales");
        }
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error("Failed to fetch sales");
        setSales([]);
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
        setProducts([]);
      }
    };

    if (isOpen && salesReturnId) {
      fetchSalesReturnDetails();
      fetchSales();
      fetchProducts();
    }
  }, [isOpen, salesReturnId]);

  const handleSaleSelect = async (saleId) => {
    setFormData({ ...formData, sale_id: saleId });

    if (!saleId) {
      setSelectedSale(null);
      setReturnItems([]);
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/sales/${saleId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setSelectedSale(data.sale);
        // Only populate items if we're changing the sale (not on initial load)
        if (!originalReturn || originalReturn.sale_id !== saleId) {
          const items =
            data.sale.items?.map((item) => ({
              id: Date.now() + Math.random(),
              product_id: item.product_id,
              sale_item_id: item.id,
              productName: item.product?.name || "Unknown Product",
              unit_price: parseFloat(item.price || item.unit_price) || 0,
              max_quantity: item.quantity,
              return_quantity: 0,
              item_reason: "",
              total: 0,
            })) || [];
          setReturnItems(items);
        }
      } else {
        throw new Error(data.message || "Failed to fetch sale details");
      }
    } catch (error) {
      console.error("Error fetching sale details:", error);
      toast.error("Failed to fetch sale details");
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
    const existingItem = returnItems.find(
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
      sale_item_id: null,
      productName: product.name,
      unit_price: unitPrice,
      max_quantity: 0,
      return_quantity: 1,
      item_reason: "",
      total: unitPrice,
    };

    setReturnItems([...returnItems, newItem]);
    setSearchQuery("");
    setShowProductDropdown(false);
    toast.success("Product added to return");
  };

  const handleUpdateItem = (id, field, value) => {
    setReturnItems(
      returnItems.map((item) => {
        if (item.id === id) {
          let updatedItem = { ...item };

          if (field === "return_quantity") {
            const quantity = parseInt(value) || 0;
            const maxQuantity = item.max_quantity || 9999;
            updatedItem[field] = Math.min(quantity, maxQuantity);
          } else if (field === "unit_price") {
            if (value === "" || value === "." || value === "0.") {
              updatedItem[field] = value;
            } else {
              const cleanValue = value.replace(/[^\d.]/g, "");
              updatedItem[field] = parseFloat(cleanValue) || 0;
            }
          } else {
            updatedItem[field] = value;
          }

          // Calculate total
          const unitPrice =
            typeof updatedItem.unit_price === "number"
              ? updatedItem.unit_price
              : parseFloat(updatedItem.unit_price) || 0;
          const quantity =
            typeof updatedItem.return_quantity === "number"
              ? updatedItem.return_quantity
              : parseInt(updatedItem.return_quantity) || 0;

          updatedItem.total = unitPrice * quantity;

          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id) => {
    setReturnItems(returnItems.filter((item) => item.id !== id));
    toast.success("Product removed from return");
  };

  const calculateSubtotal = () => {
    return returnItems.reduce((sum, item) => {
      const itemTotal =
        typeof item.total === "number"
          ? item.total
          : parseFloat(item.total) || 0;
      return sum + itemTotal;
    }, 0);
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal();
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
    if (!formData.sale_id) {
      toast.error("Please select a sale");
      return;
    }

    if (!formData.reason.trim()) {
      toast.error("Please provide a return reason");
      return;
    }

    const validItems = returnItems.filter((item) => item.return_quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one product with return quantity");
      return;
    }

    const returnData = {
      return_date: formData.return_date,
      reason: formData.reason,
      items: validItems.map((item) => ({
        product_id: item.product_id,
        sale_item_id: item.sale_item_id,
        return_quantity:
          typeof item.return_quantity === "number"
            ? item.return_quantity
            : parseInt(item.return_quantity) || 0,
        unit_price:
          typeof item.unit_price === "number"
            ? item.unit_price
            : parseFloat(item.unit_price) || 0,
        item_reason: item.item_reason || "",
      })),
      refund_amount: summaryData.refund_amount,
      notes: formData.notes,
    };

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/sales-returns/${salesReturnId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(returnData),
        }
      );

      // Get the raw response text first
      const responseText = await response.text();

      // Check if response is HTML (error page)
      if (
        responseText.trim().startsWith("<!DOCTYPE html>") ||
        responseText.includes("<!DOCTYPE html>")
      ) {
        console.error("Server returned HTML error page instead of JSON");

        // Try to extract error message from HTML
        const errorMatch =
          responseText.match(/<title>(.*?)<\/title>/) ||
          responseText.match(/<h1>(.*?)<\/h1>/) ||
          responseText.match(/<div class="[^"]*error[^"]*">(.*?)<\/div>/);

        const errorMessage = errorMatch
          ? errorMatch[1]
          : "Server returned HTML error page";
        throw new Error(`Server Error: ${errorMessage}`);
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON. Raw response:", responseText);
        throw new Error("Server returned invalid JSON response");
      }

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        );
      }

      if (data.success) {
        toast.success("Sales return updated successfully!");
        onReturnUpdated(data.sale_return);
        handleClose();
      } else {
        throw new Error(data.message || "Failed to update sales return");
      }
    } catch (error) {
      console.error("Error updating sales return:", error);
      toast.error("Failed to update sales return: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      return_date: new Date().toISOString().split("T")[0],
      sale_id: "",
      reason: "",
      notes: "",
    });
    setReturnItems([]);
    setSummaryData({
      refund_amount: 0,
    });
    setSearchQuery("");
    setShowProductDropdown(false);
    setSelectedSale(null);
    setOriginalReturn(null);
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

  if (!isOpen) return null;

  return (
    <div
      className="edit-sales-return-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="edit-sales-return-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-sales-return-modal-header">
          <h2>Edit Sales Return</h2>
          <button className="edit-sales-return-close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="edit-sales-return-modal-body">
          <div className="edit-sales-return-form-row">
            <div className="edit-sales-return-form-group">
              <label>Return Date</label>
              <input
                type="date"
                value={formData.return_date}
                onChange={(e) =>
                  setFormData({ ...formData, return_date: e.target.value })
                }
                className="edit-sales-return-form-input"
                disabled={loading}
              />
            </div>

            <div className="edit-sales-return-form-group">
              <label>Select Sale</label>
              <select
                value={formData.sale_id}
                onChange={(e) => handleSaleSelect(e.target.value)}
                className="edit-sales-return-form-input"
                disabled={loading}
              >
                <option value="">Select Sale</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.invoice_no} - {sale.customer?.name || "Walk-in"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSale && (
            <div className="edit-sales-return-sale-info">
              <h3>Sale Information</h3>
              <div className="edit-sales-return-sale-details">
                <div className="edit-sales-return-detail-item">
                  <span>Customer:</span>
                  <span>
                    {selectedSale.customer?.name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="edit-sales-return-detail-item">
                  <span>Sale Date:</span>
                  <span>
                    {new Date(selectedSale.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="edit-sales-return-detail-item">
                  <span>Total:</span>
                  <span>
                    LKR {parseFloat(selectedSale.total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="edit-sales-return-form-group">
            <label>Return Reason</label>
            <input
              type="text"
              placeholder="Enter reason for return..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="edit-sales-return-form-input"
              disabled={loading}
            />
          </div>

          <div className="edit-sales-return-form-group">
            <label>Search Additional Products</label>
            <div className="edit-sales-return-search-product-container">
              <Search
                className="edit-sales-return-search-product-icon"
                size={18}
              />
              <input
                type="text"
                placeholder="Search and select additional products..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="edit-sales-return-form-input edit-sales-return-search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="edit-sales-return-product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="edit-sales-return-product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="edit-sales-return-product-price">
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

          <div className="edit-sales-return-order-items-section">
            <h3>Return Items</h3>
            <div className="edit-sales-return-table-wrapper">
              <table className="edit-sales-return-order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th>Max Qty</th>
                    <th>Return Qty</th>
                    <th>Reason</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="edit-sales-return-empty-message"
                      >
                        No items added for return
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item) => (
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
                            className="edit-sales-return-qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="edit-sales-return-max-qty">
                          {item.max_quantity}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={item.max_quantity || 9999}
                            value={item.return_quantity}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "return_quantity",
                                e.target.value
                              )
                            }
                            className="edit-sales-return-qty-input"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Item reason..."
                            value={item.item_reason}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "item_reason",
                                e.target.value
                              )
                            }
                            className="edit-sales-return-reason-input"
                          />
                        </td>
                        <td className="edit-sales-return-total-cell">
                          LKR{" "}
                          {typeof item.total === "number"
                            ? item.total.toLocaleString()
                            : "0"}
                        </td>
                        <td>
                          <button
                            className="edit-sales-return-delete-btn"
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

          <div className="edit-sales-return-summary-section">
            <div className="edit-sales-return-empty-area"></div>
            <div className="edit-sales-return-summary-box">
              <h3>Return Summary</h3>
              <div className="edit-sales-return-summary-row">
                <span>Subtotal:</span>
                <span className="edit-sales-return-summary-value">
                  LKR {calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <div className="edit-sales-return-summary-row">
                <span>Refund Amount:</span>
                <div className="edit-sales-return-summary-input-group">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      summaryData.refund_amount === 0
                        ? ""
                        : summaryData.refund_amount
                    }
                    onChange={(e) =>
                      handleSummaryInputChange("refund_amount", e.target.value)
                    }
                    className="edit-sales-return-summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="edit-sales-return-summary-row edit-sales-return-grand-total">
                <span>Total Return Value:</span>
                <span className="edit-sales-return-summary-value">
                  LKR {calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="edit-sales-return-form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="edit-sales-return-form-textarea"
              rows="3"
              placeholder="Enter any additional notes..."
              disabled={loading}
            />
          </div>
        </div>

        <div className="edit-sales-return-modal-footer">
          <button
            className="edit-sales-return-btn-cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="edit-sales-return-btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Return"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSalesReturnModal;
