import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./ReturnPurchaseModal.css";
import offlineDB from "../../../utils/offlineDB";

const ReturnPurchaseModal = ({ isOpen, onClose, onReturnAdded }) => {
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

  // Fetch purchases and products
  useEffect(() => {
    if (isOpen) {
      fetchPurchases();
      fetchProducts();
    }
  }, [isOpen]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      let purchasesToDisplay = [];

      if (navigator.onLine) {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/purchases", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.success) {
          purchasesToDisplay = data.purchases?.data || data.purchases || [];
          // Cache කරන්න (ඔයාගේ offlineDB එකේ method එක තියෙනවා නම්)
          for (const p of purchasesToDisplay) {
            await offlineDB.addPurchase(p);
          }
        }
      } else {
        // Offline: cached purchases ගන්න
        purchasesToDisplay = (await offlineDB.getAllPurchases()) || [];
        toast.info("Offline mode: Showing cached purchases");
      }

      setPurchases(purchasesToDisplay);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast.error("Failed to load purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let productsData = [];

      if (navigator.onLine) {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/products", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.success) {
          productsData = data.products?.data || [];
          // Cache කරන්න
          for (const p of productsData) {
            await offlineDB.addProduct(p);
          }
        }
      }

      // Offline fallback
      if (productsData.length === 0) {
        productsData = (await offlineDB.getAllProducts()) || [];
        toast.info("Offline mode: Showing cached products");
      }

      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSelect = async (purchaseId) => {
    setFormData({ ...formData, purchase_id: purchaseId });

    if (!purchaseId) {
      setSelectedPurchase(null);
      setReturnItems([]);
      return;
    }

    try {
      let selectedPurchase = null;

      if (navigator.onLine) {
        // Online mode - server එකෙන් ගන්න
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `http://127.0.0.1:8000/api/purchases/${purchaseId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        if (data.success) {
          selectedPurchase = data.purchase;
          // Cache කරන්න (ඔයාගේ offlineDB එකේ addPurchase method එක තියෙනවා නම්)
          await offlineDB.addPurchase?.(data.purchase);
        } else {
          throw new Error(data.message || "Failed to fetch purchase");
        }
      } else {
        // Offline mode - cached/local purchase එකෙන් ගන්න
        console.log(
          "Offline: Loading purchase details from cache for ID:",
          purchaseId,
        );

        // 1. purchases store එකෙන් බලන්න (server synced එකක් නම් id එකෙන් ගන්න)
        selectedPurchase = await offlineDB.getPurchase?.(purchaseId);

        // 2. Pending purchases එකක නම් local_id එකෙන් බලන්න
        if (!selectedPurchase) {
          const pendingPurchases =
            (await offlineDB.getPendingPurchases?.()) || [];
          selectedPurchase = pendingPurchases.find(
            (p) => p.local_id === purchaseId || p.id === purchaseId,
          );
        }

        if (!selectedPurchase) {
          throw new Error("Purchase not found in offline cache");
        }

        toast.info("Offline mode: Loaded purchase details from cache");
      }

      // Details තියෙනවා නම් set කරන්න
      setSelectedPurchase(selectedPurchase);

      // Return items pre-populate කරන්න
      const items =
        selectedPurchase.items?.map((item) => ({
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
    } catch (error) {
      console.error("Error fetching purchase details:", error);
      toast.error("Failed to load purchase details: " + error.message);
      setSelectedPurchase(null);
      setReturnItems([]);
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
      }),
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

    // ★★★ selectedPurchase state එකෙන් ගන්න (ඔයා දැනට useState කරලා තියෙන එක)
    // ඔයාගේ component එකේ මෙහෙම තියෙන්න ඕනේ:
    // const [selectedPurchase, setSelectedPurchase] = useState(null);
    // handlePurchaseSelect එකේ setSelectedPurchase(selectedPurchase) කරලා තියෙනවා නම් මේක හරියට එනවා

    // මෙතන ඔයාගේ state variable එක use කරන්න (ඔයා දැනට setSelectedPurchase කරලා තියෙන එක)
    // ඔයාගේ code එකේ selectedPurchase state එක තියෙනවා නම් මෙහෙම ගන්න:
    const currentSelectedPurchase = selectedPurchase; // ← state එකෙන් ගන්න (ඔයාගේ useState variable එක)

    // Debug කරන්න - මෙතන supplier තියෙනවද බලන්න
    console.log(
      "Selected purchase when submitting return:",
      currentSelectedPurchase,
    );

    if (!currentSelectedPurchase) {
      toast.error(
        "Selected purchase details not loaded. Please select purchase again.",
      );
      return;
    }

    const returnData = {
      purchase_id: formData.purchase_id,
      return_date: formData.return_date,
      reason: formData.reason,
      items: validItems.map((item) => ({
        product_id: item.product_id,
        purchase_item_id: item.purchase_item_id,
        return_quantity: parseInt(item.return_quantity) || 0,
        unit_cost: parseFloat(item.unit_cost) || 0,
        item_reason: item.item_reason || "",
      })),
      refund_amount: summaryData.refund_amount,
      notes: formData.notes,

      // ★★★ Purchase details එකතු කරන්න (list එකේ show කරන්න ඕනේ)
      purchase: {
        id: currentSelectedPurchase.id,
        invoice_number:
          currentSelectedPurchase.invoice_number ||
          `PUR-OFF-${Date.now().toString().slice(-6)}`,
        grand_total:
          currentSelectedPurchase.grand_total ||
          currentSelectedPurchase.total ||
          0,
        supplier: {
          id: currentSelectedPurchase.supplier?.id,
          name: currentSelectedPurchase.supplier?.name || "Unknown Supplier",
        },
      },

      local_id: `pending_pr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      sync_status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      setLoading(true);

      if (navigator.onLine) {
        // Online mode - original code එක
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          "http://127.0.0.1:8000/api/purchase-returns",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(returnData),
          },
        );

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("Server returned invalid response");
        }

        if (!response.ok) {
          throw new Error(data.message || `HTTP error ${response.status}`);
        }

        if (data.success) {
          toast.success("Purchase return created successfully!");
          onReturnAdded(data.purchase_return);
          handleClose();
        }
      } else {
        // OFFLINE MODE
        // 1. Pending save කරන්න
        const savedReturn =
          await offlineDB.addPendingPurchaseReturn(returnData);

        // 2. Stock DECREASE කරන්න
        for (const item of returnData.items) {
          const product = await offlineDB.getProduct(item.product_id);
          if (product) {
            const currentStock = product.stock || 0;
            const qty = item.return_quantity || 0;
            const newStock = currentStock - qty;

            await offlineDB.updateProduct(item.product_id, {
              stock: Math.max(0, newStock),
              pending_stock_change: (product.pending_stock_change || 0) - qty,
              sync_status: "pending",
              updated_at: new Date().toISOString(),
            });

            console.log(
              `Offline purchase return: ${product.name || item.product_id} ` +
                `-${qty} → ${newStock}`,
            );
          }
        }

        toast.info(
          "Purchase return saved offline! Stock decreased locally. Will sync when online.",
        );
        onReturnAdded(savedReturn); // Optimistic UI update
        handleClose();
      }
    } catch (error) {
      console.error("Error creating purchase return:", error);
      toast.error("Failed to create purchase return: " + error.message);
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

  if (!isOpen) return null;

  return (
    <div className="return-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="return-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="return-modal-header">
          <h2>Create Purchase Return</h2>
          <button className="return-close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="return-modal-body">
          <div className="return-form-row">
            <div className="return-form-group">
              <label>Return Date</label>
              <input
                type="date"
                value={formData.return_date}
                onChange={(e) =>
                  setFormData({ ...formData, return_date: e.target.value })
                }
                className="return-form-input"
              />
            </div>

            <div className="return-form-group">
              <label>Select Purchase</label>
              <select
                value={formData.purchase_id}
                onChange={(e) => handlePurchaseSelect(e.target.value)}
                className="return-form-input"
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
            <div className="return-purchase-info">
              <h3>Purchase Information</h3>
              <div className="return-purchase-details">
                <div className="return-detail-item">
                  <span>Supplier:</span>
                  <span>{selectedPurchase.supplier?.name}</span>
                </div>
                <div className="return-detail-item">
                  <span>Purchase Date:</span>
                  <span>
                    {new Date(selectedPurchase.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="return-detail-item">
                  <span>Grand Total:</span>
                  <span>
                    LKR{" "}
                    {parseFloat(selectedPurchase.grand_total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="return-form-group">
            <label>Return Reason</label>
            <input
              type="text"
              placeholder="Enter reason for return..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="return-form-input"
              disabled={loading}
            />
          </div>

          <div className="return-form-group">
            <label>Search Additional Products</label>
            <div className="return-search-product-container">
              <Search className="return-search-product-icon" size={18} />
              <input
                type="text"
                placeholder="Search and select additional products..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="return-form-input return-search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="return-product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="return-product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="return-product-price">
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

          <div className="return-order-items-section">
            <h3>Return Items</h3>
            <div className="return-table-wrapper">
              <table className="return-order-table">
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
                      <td colSpan="7" className="return-empty-message">
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
                                e.target.value,
                              )
                            }
                            className="return-qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="return-max-qty">{item.max_quantity}</td>
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
                                e.target.value,
                              )
                            }
                            className="return-qty-input"
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
                                e.target.value,
                              )
                            }
                            className="return-reason-input"
                          />
                        </td>
                        <td className="return-total-cell">
                          LKR{" "}
                          {typeof item.total === "number"
                            ? item.total.toLocaleString()
                            : "0"}
                        </td>
                        <td>
                          <button
                            className="return-delete-btn"
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

          <div className="return-summary-section">
            <div className="return-empty-area"></div>
            <div className="return-summary-box">
              <h3>Return Summary</h3>
              <div className="return-summary-row">
                <span>Subtotal:</span>
                <span className="return-summary-value">
                  LKR {calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <div className="return-summary-row">
                <span>Refund Amount:</span>
                <div className="return-summary-input-group">
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
                    className="return-summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="return-summary-row return-grand-total">
                <span>Total Return Value:</span>
                <span className="return-summary-value">
                  LKR {calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="return-form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="return-form-textarea"
              rows="3"
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <div className="return-modal-footer">
          <button
            className="return-btn-cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="return-btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Return"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnPurchaseModal;
