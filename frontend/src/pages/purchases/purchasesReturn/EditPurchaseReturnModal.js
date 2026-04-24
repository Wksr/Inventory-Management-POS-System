import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./EditPurchaseReturnModal.css";

const EditPurchaseReturnModal = ({
  isOpen,
  onClose,
  purchaseReturnId,
  onReturnUpdated,
}) => {
  const [formData, setFormData] = useState({
    return_date: new Date().toISOString().split("T")[0],
    purchase_id: "",
    reason: "",
    notes: "",
  });

  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [summaryData, setSummaryData] = useState({
    refund_amount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [originalReturn, setOriginalReturn] = useState(null);

  // Fetch purchase return details, purchases, and products
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
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.purchase_return) {
          const returnData = data.purchase_return;
          setOriginalReturn(returnData);

          // Set form data
          setFormData({
            return_date: returnData.return_date.split("T")[0],
            purchase_id: returnData.purchase_id,
            reason: returnData.reason || "",
            notes: returnData.notes || "",
          });

          // Set summary data
          setSummaryData({
            refund_amount: parseFloat(returnData.refund_amount) || 0,
          });

          // Set selected purchase
          setSelectedPurchase(returnData.purchase);

          // Set return items
          const items =
            returnData.items?.map((item) => ({
              id: Date.now() + Math.random(),
              product_id: item.product_id,
              purchase_item_id: item.purchase_item_id,
              productName: item.product?.name || "Unknown Product",
              unit_cost: parseFloat(item.unit_cost) || 0,
              max_quantity: item.max_quantity || item.return_quantity || 0,
              return_quantity: parseFloat(item.return_quantity) || 0,
              item_reason: item.reason || "",
              total: parseFloat(item.total) || 0,
            })) || [];
          setReturnItems(items);
        } else {
          throw new Error(
            data.message || "Failed to fetch purchase return details"
          );
        }
      } catch (error) {
        console.error("Error fetching purchase return details:", error);
        toast.error("Failed to fetch purchase return details");
      } finally {
        setLoading(false);
      }
    };

    const fetchPurchases = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/purchases", {
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
          setPurchases(data.purchases?.data || []);
        } else {
          throw new Error(data.message || "Failed to fetch purchases");
        }
      } catch (error) {
        console.error("Error fetching purchases:", error);
        toast.error("Failed to fetch purchases");
        setPurchases([]);
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

    if (isOpen && purchaseReturnId) {
      fetchPurchaseReturnDetails();
      fetchPurchases();
      fetchProducts();
    }
  }, [isOpen, purchaseReturnId]);

  const handlePurchaseSelect = async (purchaseId) => {
    setFormData({ ...formData, purchase_id: purchaseId });

    if (!purchaseId) {
      setSelectedPurchase(null);
      setReturnItems([]);
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/purchases/${purchaseId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setSelectedPurchase(data.purchase);
        // Only populate items if we're changing the purchase (not on initial load)
        if (!originalReturn || originalReturn.purchase_id !== purchaseId) {
          const items =
            data.purchase.items?.map((item) => ({
              id: Date.now() + Math.random(),
              product_id: item.product_id,
              purchase_item_id: item.id,
              productName: item.product?.name || "Unknown Product",
              unit_cost: parseFloat(item.unit_cost) || 0,
              max_quantity: item.quantity,
              return_quantity: 0,
              item_reason: "",
              total: 0,
            })) || [];
          setReturnItems(items);
        }
      } else {
        throw new Error(data.message || "Failed to fetch purchase details");
      }
    } catch (error) {
      console.error("Error fetching purchase details:", error);
      toast.error("Failed to fetch purchase details");
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

    const unitCost = parseFloat(product.unit_cost || product.cost_price || 0);

    const newItem = {
      id: Date.now(),
      product_id: product.id,
      purchase_item_id: null,
      productName: product.name,
      unit_cost: unitCost,
      max_quantity: 0,
      return_quantity: 1,
      item_reason: "",
      total: unitCost,
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
          } else if (field === "unit_cost") {
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
          const unitCost =
            typeof updatedItem.unit_cost === "number"
              ? updatedItem.unit_cost
              : parseFloat(updatedItem.unit_cost) || 0;
          const quantity =
            typeof updatedItem.return_quantity === "number"
              ? updatedItem.return_quantity
              : parseInt(updatedItem.return_quantity) || 0;

          updatedItem.total = unitCost * quantity;

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
    if (!formData.purchase_id) {
      toast.error("Please select a purchase");
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
        purchase_item_id: item.purchase_item_id,
        return_quantity:
          typeof item.return_quantity === "number"
            ? item.return_quantity
            : parseInt(item.return_quantity) || 0,
        unit_cost:
          typeof item.unit_cost === "number"
            ? item.unit_cost
            : parseFloat(item.unit_cost) || 0,
        item_reason: item.item_reason || "",
      })),
      refund_amount: summaryData.refund_amount,
      notes: formData.notes,
    };

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/purchase-returns/${purchaseReturnId}`,
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
        toast.success("Purchase return updated successfully!");
        onReturnUpdated(data.purchase_return);
        handleClose();
      } else {
        throw new Error(data.message || "Failed to update purchase return");
      }
    } catch (error) {
      console.error("Error updating purchase return:", error);
      toast.error("Failed to update purchase return: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      return_date: new Date().toISOString().split("T")[0],
      purchase_id: "",
      reason: "",
      notes: "",
    });
    setReturnItems([]);
    setSummaryData({
      refund_amount: 0,
    });
    setSearchQuery("");
    setShowProductDropdown(false);
    setSelectedPurchase(null);
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
    <div className="edit-return-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="edit-return-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-return-modal-header">
          <h2>Edit Purchase Return</h2>
          <button className="edit-return-close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="edit-return-modal-body">
          <div className="edit-return-form-row">
            <div className="edit-return-form-group">
              <label>Return Date</label>
              <input
                type="date"
                value={formData.return_date}
                onChange={(e) =>
                  setFormData({ ...formData, return_date: e.target.value })
                }
                className="edit-return-form-input"
                disabled={loading}
              />
            </div>

            <div className="edit-return-form-group">
              <label>Select Purchase</label>
              <select
                value={formData.purchase_id}
                onChange={(e) => handlePurchaseSelect(e.target.value)}
                className="edit-return-form-input"
                disabled={loading}
              >
                <option value="">Select Purchase</option>
                {purchases.map((purchase) => (
                  <option key={purchase.id} value={purchase.id}>
                    {purchase.invoice_number} - {purchase.supplier?.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPurchase && (
            <div className="edit-return-purchase-info">
              <h3>Purchase Information</h3>
              <div className="edit-return-purchase-details">
                <div className="edit-return-detail-item">
                  <span>Supplier:</span>
                  <span>{selectedPurchase.supplier?.name}</span>
                </div>
                <div className="edit-return-detail-item">
                  <span>Purchase Date:</span>
                  <span>
                    {new Date(selectedPurchase.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="edit-return-detail-item">
                  <span>Grand Total:</span>
                  <span>
                    LKR{" "}
                    {parseFloat(selectedPurchase.grand_total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="edit-return-form-group">
            <label>Return Reason</label>
            <input
              type="text"
              placeholder="Enter reason for return..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="edit-return-form-input"
              disabled={loading}
            />
          </div>

          <div className="edit-return-form-group">
            <label>Search Additional Products</label>
            <div className="edit-return-search-product-container">
              <Search className="edit-return-search-product-icon" size={18} />
              <input
                type="text"
                placeholder="Search and select additional products..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="edit-return-form-input edit-return-search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="edit-return-product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="edit-return-product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="edit-return-product-price">
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

          <div className="edit-return-order-items-section">
            <h3>Return Items</h3>
            <div className="edit-return-table-wrapper">
              <table className="edit-return-order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Cost</th>
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
                      <td colSpan="7" className="edit-return-empty-message">
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
                              item.unit_cost === 0 || item.unit_cost === ""
                                ? ""
                                : item.unit_cost
                            }
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "unit_cost",
                                e.target.value
                              )
                            }
                            className="edit-return-qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="edit-return-max-qty">
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
                            className="edit-return-qty-input"
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
                            className="edit-return-reason-input"
                          />
                        </td>
                        <td className="edit-return-total-cell">
                          LKR{" "}
                          {typeof item.total === "number"
                            ? item.total.toLocaleString()
                            : "0"}
                        </td>
                        <td>
                          <button
                            className="edit-return-delete-btn"
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

          <div className="edit-return-summary-section">
            <div className="edit-return-empty-area"></div>
            <div className="edit-return-summary-box">
              <h3>Return Summary</h3>
              <div className="edit-return-summary-row">
                <span>Subtotal:</span>
                <span className="edit-return-summary-value">
                  LKR {calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <div className="edit-return-summary-row">
                <span>Refund Amount:</span>
                <div className="edit-return-summary-input-group">
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
                    className="edit-return-summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="edit-return-summary-row edit-return-grand-total">
                <span>Total Return Value:</span>
                <span className="edit-return-summary-value">
                  LKR {calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="edit-return-form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="edit-return-form-textarea"
              rows="3"
              placeholder="Enter any additional notes..."
              disabled={loading}
            />
          </div>
        </div>

        <div className="edit-return-modal-footer">
          <button
            className="edit-return-btn-cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="edit-return-btn-submit"
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

export default EditPurchaseReturnModal;
