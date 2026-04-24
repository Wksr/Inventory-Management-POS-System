import React, { useState, useEffect } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./SalesReturnModal.css";
import offlineDB from "../../../utils/offlineDB";

const SalesReturnModal = ({ isOpen, onClose, onReturnAdded }) => {
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

  // Fetch sales and products
  useEffect(() => {
    if (isOpen) {
      fetchSales();
      fetchProducts();
    }
  }, [isOpen]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      console.log(
        "🔧 fetchSales - mode:",
        navigator.onLine ? "Online" : "Offline",
      );

      let salesToDisplay = [];

      if (navigator.onLine) {
        // === ONLINE MODE ===
        const token = localStorage.getItem("authToken");
        if (!token) {
          throw new Error("No auth token found");
        }

        console.log("Fetching fresh sales from server...");

        const res = await fetch(
          `http://127.0.0.1:8000/api/sales?page=1&per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
          const serverSales = data.sales?.data || data.sales || [];
          console.log(`Server returned ${serverSales.length} sales`);

          // Cache all server sales for offline use
          for (const sale of serverSales) {
            await offlineDB.cacheServerSales?.([sale]);
          }

          salesToDisplay = serverSales;
        } else {
          throw new Error(data.message || "Failed to fetch sales");
        }
      } else {
        // === OFFLINE MODE ===
        console.log("Offline mode - loading from IndexedDB");
        const localSales = await offlineDB.getAllSalesForDisplay();
        console.log("Loaded from IndexedDB:", localSales?.length || 0);

        salesToDisplay = localSales || [];
      }

      // === Common processing for both modes ===
      // Remove duplicates (prefer server ID)
      const uniqueSalesMap = new Map();

      salesToDisplay.forEach((sale) => {
        const uniqueKey = sale.id || sale.local_id;
        if (uniqueKey) {
          uniqueSalesMap.set(uniqueKey, sale);
        }
      });

      let processed = Array.from(uniqueSalesMap.values());

      // Sort newest first
      processed.sort((a, b) => {
        const dateA = new Date(a.created_at || a.date || 0);
        const dateB = new Date(b.created_at || b.date || 0);
        return dateB - dateA;
      });

      // Format for dropdown (keep full sale data)
      const dropdownItems = processed.map((sale) => {
        const isPending = !!sale.local_id && !sale.id;

        const normalizedTotal =
          Number(sale.total_amount) ||
          Number(sale.total) ||
          Number(sale.subtotal) ||
          0;

        return {
          key: sale.local_id || sale.id || `temp-${Math.random()}`,
          value: sale.local_id || sale.id,
          label: sale.invoice_no
            ? `${sale.invoice_no} - ${sale.customer?.name || "Walk-in"}`
            : isPending
              ? `PENDING-${String(sale.local_id).slice(-8)} - ${sale.customer?.name || "Walk-in"}`
              : `Sale #${sale.id || "unknown"} - ${sale.customer?.name || "Walk-in"}`,
          is_pending: isPending,
          saleData: { ...sale, total: normalizedTotal },

          // Full sale object for later use
          saleData: { ...sale },

          // Minimal fields for display/performance
          items: sale.items || [],
          customer: sale.customer || null,
          total_amount: normalizedTotal,
        };
      });

      console.log(
        `Final dropdown items: ${dropdownItems.length} (pending: ${
          dropdownItems.filter((i) => i.is_pending).length
        })`,
      );

      setSales(dropdownItems);

      if (dropdownItems.some((i) => i.is_pending)) {
        toast.info(
          `Showing ${dropdownItems.filter((i) => i.is_pending).length} pending sales`,
        );
      }
    } catch (error) {
      console.error("fetchSales failed:", error);
      toast.error("Failed to load sales");
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      let productsData = [];

      if (navigator.onLine && token) {
        // Online: server එකෙන් ගන්න + cache කරන්න
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
          for (const product of productsData) {
            await offlineDB.addProduct?.(product);
          }
          console.log("Products fetched from server & cached");
        } else {
          throw new Error(data.message || "Failed to fetch products");
        }
      }

      // Offline fallback
      if (productsData.length === 0) {
        productsData = (await offlineDB.getAllProducts?.()) || [];
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

  const processSelectedSale = async (sale) => {
    console.log("===== PROCESSING SALE =====");
    console.log("Sale value/local_id:", sale.value || sale.local_id);
    console.log("Invoice No:", sale.invoice_no);
    console.log("Customer:", sale.customer?.name || sale.customer_name);
    console.log("Created at:", sale.created_at);
    console.log("Total:", sale.total || sale.total_amount);
    console.log("Has items?", !!sale.items);
    console.log("Items count:", sale.items?.length || 0);
    console.log("First item example:", sale.items?.[0]);

    const normalizedTotal =
      Number(sale.total_amount) ||
      Number(sale.total) ||
      Number(sale.subtotal) ||
      0;

    console.log("Normalized Total:", normalizedTotal);

    // selectedSale එකට normalized total එක එකතු කරන්න
    const finalSale = {
      ...sale,
      total: normalizedTotal, // UI එකට consistent field එකක් දෙන්න
      total_amount: normalizedTotal, // backend compatible තියාගන්න
    };

    setSelectedSale(finalSale);

    if (sale.items && sale.items.length > 0) {
      const returnItems = sale.items.map((item, index) => {
        const unitPrice = parseFloat(item.price || item.unit_price || 0);
        const qty = item.quantity || 0;

        return {
          id: Date.now() + index,
          product_id: item.product_id,
          sale_item_id: item.id || null,
          productName: item.product_name || item.name || "Unknown Product",
          unit_price: unitPrice,
          max_quantity: qty,
          return_quantity: 0,
          item_reason: "",
          total: unitPrice * qty,
        };
      });

      console.log("Created return items:", returnItems);
      setReturnItems(returnItems);
    } else {
      console.warn("No items found in selected sale");
      setReturnItems([]);
    }
  };
  const handleSaleSelect = async (selectedValue) => {
    if (!selectedValue) {
      setFormData((prev) => ({ ...prev, sale_id: "" }));
      setSelectedSale(null);
      setReturnItems([]);
      return;
    }

    console.log(
      "Selected sale value:",
      selectedValue,
      "type:",
      typeof selectedValue,
    );

    const selectedValueStr = String(selectedValue).trim();

    console.log("Selected value (string):", selectedValueStr);

    const selectedSaleFromDropdown = sales.find((s) => {
      return String(s.value).trim() === selectedValueStr;
    });

    if (!selectedSaleFromDropdown) {
      console.warn("No sale found in dropdown for:", selectedValue);
      console.log(
        "Current sales values:",
        sales.map((s) => String(s.value)),
      );
      setSelectedSale(null);
      setReturnItems([]);
      return;
    }

    console.log("Found sale in dropdown:", selectedSaleFromDropdown);

    // ★★★ IMPORTANT: Full sale data එක ගන්න (saleData එක තියෙනවා නම්)
    let finalSale = selectedSaleFromDropdown.saleData
      ? { ...selectedSaleFromDropdown.saleData }
      : { ...selectedSaleFromDropdown };

    // Selected value එක තහවුරු කරන්න (merge කරද්දි නැති වෙන්න එපා)
    finalSale.value = selectedValueStr;
    finalSale.selectedId = selectedValueStr;

    // Pending sale නම් DB එකෙන් full data reload කරන්න
    if (selectedSaleFromDropdown.is_pending) {
      console.log("Loading full pending sale from DB for:", selectedValue);
      try {
        const fullSale = await offlineDB.getSaleByLocalId(selectedValue);
        if (fullSale) {
          finalSale = { ...finalSale, ...fullSale };
          console.log("Full pending sale loaded from DB:", fullSale);
        } else {
          console.warn("No full sale found in DB");
        }
      } catch (err) {
        console.error("Failed to load full pending sale:", err);
      }
    }

    // Update formData to show selected value in dropdown
    setFormData((prev) => ({ ...prev, sale_id: selectedValueStr }));

    // Final sale එක process කරන්න
    console.log("Final sale for processing:", finalSale);
    await processSelectedSale(finalSale);
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
    console.log("=== handleSubmit STARTED ===");
    console.log("formData:", formData);
    console.log("returnItems:", returnItems);
    console.log("selectedSale:", selectedSale);
    console.log("summaryData:", summaryData);

    // Validation checks
    if (!formData.sale_id) {
      console.log("FAIL: No sale selected");
      toast.error("Please select a sale.");
      return;
    }

    if (!formData.reason.trim()) {
      console.log("FAIL: No return reason");
      toast.error("Please enter a return reason");
      return;
    }

    const validItems = returnItems.filter((item) => item.return_quantity > 0);
    if (validItems.length === 0) {
      console.log("FAIL: No items with return quantity");
      toast.error("Please add items with a return quantity");
      return;
    }

    if (!selectedSale) {
      console.log("FAIL: selectedSale is null");
      toast.error("selected Sale is null");
      return;
    }

    console.log("All validations passed! Preparing returnData...");

    // return_date හරියට format කරන්න (YYYY-MM-DD)
    let formattedReturnDate = formData.return_date;
    try {
      const date = new Date(formData.return_date);
      if (!isNaN(date.getTime())) {
        formattedReturnDate = date.toISOString().split("T")[0]; // '2026-02-24'
      } else {
        console.warn("Invalid date input, using current date");
        formattedReturnDate = new Date().toISOString().split("T")[0];
      }
    } catch (e) {
      console.error("Date format error:", e);
      formattedReturnDate = new Date().toISOString().split("T")[0];
    }

    console.log("Formatted return_date for backend:", formattedReturnDate);

    // Final returnData object
    const returnData = {
      sale_id: formData.sale_id,
      return_date: formattedReturnDate,
      reason: formData.reason.trim(),
      items: validItems.map((item) => ({
        product_id: item.product_id,
        sale_item_id: item.sale_item_id,
        return_quantity: parseInt(item.return_quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        item_reason: item.item_reason?.trim() || "",
      })),
      refund_amount: summaryData.refund_amount || 0,
      notes: formData.notes?.trim() || "",

      // List එකට visible fields
      return_no: `PENDING-${Date.now().toString().slice(-6)}`,
      invoice_no: selectedSale.invoice_no || "N/A",
      customer_name: selectedSale.customer?.name || "Walk-in Customer",
      total_refund: calculateGrandTotal(),
      customer: { name: selectedSale.customer?.name || "Walk-in Customer" },
      sale: { invoice_no: selectedSale.invoice_no || "N/A" },
      sync_status: "pending",
      local_id: `pending_sr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Final returnData prepared:", returnData);

    try {
      setLoading(true);
      console.log(
        "Starting save process... Mode:",
        navigator.onLine ? "Online" : "Offline",
      );

      if (navigator.onLine) {
        // ★★★ Online mode - server එකට direct send කරන්න
        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("No auth token found");

        const response = await fetch(
          "http://127.0.0.1:8000/api/sales-returns",
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
        console.log("Server raw response:", responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("Server returned invalid JSON");
        }

        if (!response.ok) {
          console.log("Server error status:", response.status);
          throw new Error(data.message || `HTTP error ${response.status}`);
        }

        if (data.success) {
          console.log(
            "Online success - real return created:",
            data.sale_return.id,
          );
          const syncedReturn = {
            ...data.sale_return,
            sync_status: "synced",
            local_id: `server_${data.sale_return.id}`, // list එකේ consistent key එකක් තියාගන්න
          };
          toast.success("Sales return created successfully!");
          onReturnAdded(data.sale_return); // server data එක direct pass කරන්න
          handleClose();
          // ★★★ Pending queue එකට add කරන්න එපා — දැනටමත් server එකේ තියෙනවා
        } else {
          throw new Error(data.message || "Server returned failure");
        }
      } else {
        // ★★★ Offline mode විතරයි pending queue එකට add වෙන්නේ
        console.log("Offline mode - saving to IndexedDB");
        const savedReturn = await offlineDB.addPendingSaleReturn(returnData);

        // Stock update (return නිසා stock increase)
        for (const item of returnData.items) {
          const product = await offlineDB.getProduct(item.product_id);
          if (product) {
            const newStock = (product.stock || 0) + item.return_quantity;
            await offlineDB.updateProduct(item.product_id, {
              stock: newStock,
              sync_status: "pending",
              updated_at: new Date().toISOString(),
            });
            console.log(
              `Offline stock update: ${product.name || item.product_id} +${item.return_quantity} → ${newStock}`,
            );
          }
        }

        toast.info(
          "Offline mode: Return saved locally. Will sync when online.",
        );
        onReturnAdded(savedReturn);
        handleClose();
      }
    } catch (error) {
      console.error("handleSubmit ERROR:", error);
      toast.error(
        "Can't create sales return: " + (error.message || "Unknown error"),
      );
    } finally {
      setLoading(false);
      console.log("=== handleSubmit ENDED ===");
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
    <div className="sales-return-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="sales-return-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-return-modal-header">
          <h2>Create Sales Return</h2>
          <button className="sales-return-close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="sales-return-modal-body">
          <div className="sales-return-form-row">
            <div className="sales-return-form-group">
              <label>Return Date</label>
              <input
                type="date"
                value={formData.return_date}
                onChange={(e) =>
                  setFormData({ ...formData, return_date: e.target.value })
                }
                className="sales-return-form-input"
              />
            </div>

            <div className="sales-return-form-group">
              <label>Select Sale</label>
              <select
                value={formData.sale_id || ""} // ← empty string fallback
                onChange={(e) => handleSaleSelect(e.target.value)}
                className="sales-return-form-input"
                disabled={loading}
              >
                <option value="">Select Sale</option>
                {sales.map((sale) => (
                  <option
                    key={sale.key || sale.value}
                    value={String(sale.value)} // ← force string
                  >
                    {sale.label}
                    {sale.is_pending && " (pending sync)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSale && (
            <div className="sales-return-sale-info">
              <h3>Sale Information</h3>
              <div className="sales-return-sale-details">
                <div className="sales-return-detail-item">
                  <span>Customer:</span>
                  <span>
                    {selectedSale.customer?.name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="sales-return-detail-item">
                  <span>Sale Date:</span>
                  <span>
                    {new Date(selectedSale.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="sales-return-detail-item">
                  <span>Total:</span>
                  <span>
                    LKR {(Number(selectedSale?.total) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="sales-return-form-group">
            <label>Return Reason</label>
            <input
              type="text"
              placeholder="Enter reason for return..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="sales-return-form-input"
              disabled={loading}
            />
          </div>

          <div className="sales-return-form-group">
            <label>Search Additional Products</label>
            <div className="sales-return-search-product-container">
              <Search className="sales-return-search-product-icon" size={18} />
              <input
                type="text"
                placeholder="Search and select additional products..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="sales-return-form-input sales-return-search-product-input"
                disabled={loading}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="sales-return-product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="sales-return-product-item"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="sales-return-product-price">
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

          <div className="sales-return-order-items-section">
            <h3>Return Items</h3>
            <div className="sales-return-table-wrapper">
              <table className="sales-return-order-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th>Sold Qty</th>
                    <th>Return Qty</th>
                    <th>Reason</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="sales-return-empty-message">
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
                                e.target.value,
                              )
                            }
                            className="sales-return-qty-input"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="sales-return-max-qty">
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
                                e.target.value,
                              )
                            }
                            className="sales-return-qty-input"
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
                            className="sales-return-reason-input"
                          />
                        </td>
                        <td className="sales-return-total-cell">
                          LKR{" "}
                          {typeof item.total === "number"
                            ? item.total.toLocaleString()
                            : "0"}
                        </td>
                        <td>
                          <button
                            className="sales-return-delete-btn"
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

          <div className="sales-return-summary-section">
            <div className="sales-return-empty-area"></div>
            <div className="sales-return-summary-box">
              <h3>Return Summary</h3>
              <div className="sales-return-summary-row">
                <span>Subtotal:</span>
                <span className="sales-return-summary-value">
                  LKR {calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <div className="sales-return-summary-row">
                <span>Refund Amount:</span>
                <div className="sales-return-summary-input-group">
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
                    className="sales-return-summary-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="sales-return-summary-row sales-return-grand-total">
                <span>Total Refund:</span>
                <span className="sales-return-summary-value">
                  LKR {calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="sales-return-form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="sales-return-form-textarea"
              rows="3"
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <div className="sales-return-modal-footer">
          <button
            className="sales-return-btn-cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="sales-return-btn-submit"
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

export default SalesReturnModal;
