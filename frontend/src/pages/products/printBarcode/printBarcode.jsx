import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Trash2,
  Eye,
  RotateCcw,
  Printer,
  Plus,
  RefreshCw,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import "./printBarcode.css";

const PrintBarcode = () => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [customData, setCustomData] = useState({
    sku: "",
    name: "",
    price: "",
    quantity: 1,
  });
  const [settings, setSettings] = useState({
    paperSize: "a4",
    customWidth: "",
    customHeight: "",
    showBranch: true,
    showProductName: true,
    showPrice: true,
    showBorder: true,
  });
  const previewRef = useRef(null);

  const paperSizes = [
    { value: "a4", label: "A4 (210mm x 297mm)" },
    { value: "letter", label: 'Letter (8.5" x 11")' },
    { value: "label", label: 'Label (2" x 1")' },
    { value: "custom", label: "Custom Size" },
  ];

  // Fetch products when component mounts
  useEffect(() => {
    fetchProducts();
    fetchBranchName();
  }, []);

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
        // Handle different response structures
        const productsData =
          data.products?.data || data.products || data.data || [];
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        throw new Error(data.message || "Failed to fetch products");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products");
      setProducts([]);
    }
  };

  const fetchBranchName = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/branches", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Branches response:", data); // Check console for this

        // Most common pattern
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          setBranchName(data.data[0].name);
        }
        // Second most common pattern
        else if (
          data.branches &&
          Array.isArray(data.branches) &&
          data.branches.length > 0
        ) {
          setBranchName(data.branches[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching branch name:", error);
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

  // // Use the same filter logic as AddPurchaseModal
  // const filteredProducts = (Array.isArray(products) ? products : []).filter(
  //   (p) => p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  // );

  const handleProductSelect = (product) => {
    const existing = selectedProducts.find((p) => p.id === product.id);
    if (existing) {
      toast.error("Product already added");
      return;
    }

    // Get product code - try different possible fields
    const productCode = product.code || product.sku || product.barcode || "";

    setSelectedProducts([
      ...selectedProducts,
      {
        ...product,
        quantity: 1,
        code: productCode,
        price:
          product.price ||
          product.selling_price ||
          product.unit_price ||
          "0.00",
      },
    ]);
    setSearchQuery("");
    setShowProductDropdown(false);
    toast.success("Product added");
  };

  const handleQuantityChange = (id, quantity) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === id ? { ...p, quantity: parseInt(quantity) || 1 } : p
      )
    );
  };

  const handleRemoveProduct = (id) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
    toast.info("Product removed");
  };

  const handleReset = () => {
    // Reset all states
    setIsCustomMode(false);
    setSearchQuery("");
    setSelectedProducts([]);
    setCustomData({
      sku: "",
      name: "",
      price: "",
      quantity: 1,
    });
    setSettings({
      paperSize: "a4",
      customWidth: "",
      customHeight: "",
      showBranch: true,
      showProductName: true,
      showPrice: true,
      showBorder: true,
    });

    // Clear the preview
    if (previewRef.current) {
      previewRef.current.innerHTML =
        '<p class="no-preview">Click "Preview" to generate barcodes</p>';
    }

    // Hide dropdown if open
    setShowProductDropdown(false);

    toast.info("Reset completed");
  };

  const handlePreview = () => {
    generateBarcodes();
    toast.success("Preview generated");
  };

  const handleGenerateBarcode = () => {
    // Generate a random barcode (12-13 digits)
    const randomBarcode = Math.floor(
      100000000000 + Math.random() * 900000000000
    ).toString();
    setCustomData({ ...customData, sku: randomBarcode });
    toast.success("Barcode generated");
  };

  const generateBarcodes = () => {
    if (previewRef.current) {
      previewRef.current.innerHTML = "";

      const items = isCustomMode ? [customData] : selectedProducts;

      if (items.length === 0 || (isCustomMode && !customData.sku)) {
        previewRef.current.innerHTML =
          '<p class="no-preview">No items to preview</p>';
        return;
      }

      items.forEach((item) => {
        const quantity = item.quantity || 1;

        for (let i = 0; i < quantity; i++) {
          const barcodeContainer = document.createElement("div");
          barcodeContainer.className = `barcode-item ${
            settings.showBorder ? "with-border" : ""
          }`;

          if (settings.showBranch) {
            const branchNameElement = document.createElement("div");
            branchNameElement.className = "branch-name";
            branchNameElement.textContent = branchName; // Use the state variable
            barcodeContainer.appendChild(branchNameElement);
          }

          if (settings.showProductName) {
            const productName = document.createElement("div");
            productName.className = "product-name";
            productName.textContent = item.name || item.productName || "";
            barcodeContainer.appendChild(productName);
          }

          const canvas = document.createElement("canvas");
          barcodeContainer.appendChild(canvas);

          // Create an image element for printing
          const printImage = document.createElement("img");
          printImage.style.display = "none"; // Hide in preview
          printImage.className = "barcode-print-image";
          barcodeContainer.appendChild(printImage);

          // Use code or sku for barcode
          const barcodeValue = item.sku || item.code || item.barcode || "";

          try {
            if (barcodeValue) {
              JsBarcode(canvas, barcodeValue, {
                format: "CODE128",
                width: 2,
                height: 50,
                displayValue: true,
                fontSize: 12,
                margin: 5,
                lineColor: "#000000",
                background: "#ffffff",
              });

              // Convert canvas to data URL for printing
              const dataURL = canvas.toDataURL("image/png");
              printImage.src = dataURL;
              printImage.alt = barcodeValue;
            }
          } catch (error) {
            console.error("Barcode generation error:", error);
          }

          if (settings.showPrice) {
            const price = document.createElement("div");
            price.className = "product-price";
            const formattedPrice = parseFloat(item.price || 0).toFixed(2);
            price.textContent = `LKR ${formattedPrice}`;
            barcodeContainer.appendChild(price);
          }

          previewRef.current.appendChild(barcodeContainer);
        }
      });
    }
  };

  const handlePrint = () => {
    if (!previewRef.current || previewRef.current.children.length === 0) {
      toast.error("Please generate preview first");
      return;
    }

    const printWindow = window.open("", "_blank");

    // Create HTML with images instead of canvas
    let printHTML = "";
    const barcodeItems = previewRef.current.querySelectorAll(".barcode-item");

    barcodeItems.forEach((item) => {
      const clone = item.cloneNode(true);
      const canvas = clone.querySelector("canvas");
      const printImage = clone.querySelector(".barcode-print-image");

      // Replace canvas with image for printing
      if (canvas && printImage) {
        canvas.remove();
        printImage.style.display = "block";
      }

      printHTML += clone.outerHTML;
    });

    printWindow.document.write(`
    <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10mm; }
          @media print {
            @page { 
              size: ${
                settings.paperSize === "custom"
                  ? `${settings.customWidth}mm ${settings.customHeight}mm`
                  : settings.paperSize
              }; 
              margin: 0;
            }
            body { padding: 10mm; }
          }
          .barcode-item {
            display: inline-block;
            text-align: center;
            padding: 10px;
            margin: 5px;
            ${settings.showBorder ? "border: 1px solid #000;" : ""}
            page-break-inside: avoid;
            vertical-align: top;
          }
          .branch-name { font-size: 10px; font-weight: bold; margin-bottom: 5px; }
          .product-name { font-size: 12px; margin-bottom: 5px; }
          .product-price { font-size: 10px; margin-top: 5px; font-weight: bold; }
          img { display: block; margin: 0 auto; max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${printHTML}
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };

    toast.success("Printing...");
  };

  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    const name = p.name || "";
    const code = p.code || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.includes(searchQuery)
    );
  });

  return (
    <div className="print-barcode-page">
      <div className="barcode-header">
        <h1>Print Barcode</h1>
        <div className="toggle-container">
          <span className={!isCustomMode ? "active" : ""}>Product Mode</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isCustomMode}
              onChange={(e) => {
                setIsCustomMode(e.target.checked);
                toast.info(e.target.checked ? "Custom mode" : "Product mode");
              }}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className={isCustomMode ? "active" : ""}>Custom Print</span>
        </div>
      </div>

      <div className="barcode-content">
        {!isCustomMode ? (
          <div className="product-mode">
            <div className="search-section">
              <div className="search-box">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => handleSearchProduct(e.target.value)} // Updated
                  className="search-input"
                />
              </div>
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="product-dropdown">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="product-item"
                      onClick={() => handleProductSelect(product)}
                    >
                      <div>
                        <div className="product-item-name">{product.name}</div>
                        <div className="product-item-code">
                          {product.code || product.sku || "No Code"}
                        </div>
                        <div className="product-item-price">
                          LKR {parseFloat(product.price || 0).toFixed(2)}
                        </div>
                      </div>
                      <Plus size={18} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="products-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-row">
                        No products selected
                      </td>
                    </tr>
                  ) : (
                    selectedProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="product-cell">
                            <div className="product-cell-name">
                              {product.name}
                            </div>
                            <div className="product-cell-code">
                              {product.code || product.sku || "No Code"}
                            </div>
                            <div className="product-cell-price">
                              LKR {parseFloat(product.price || 0).toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) =>
                              handleQuantityChange(product.id, e.target.value)
                            }
                            className="qty-input"
                          />
                        </td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => handleRemoveProduct(product.id)}
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
        ) : (
          <div className="custom-mode">
            <div className="custom-form">
              <div className="form-group">
                <label>SKU/Barcode</label>
                <div className="input-with-button">
                  {" "}
                  {/* Add this wrapper */}
                  <input
                    type="text"
                    value={customData.sku}
                    onChange={(e) =>
                      setCustomData({ ...customData, sku: e.target.value })
                    }
                    placeholder="Enter SKU or barcode"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="generate-barcode-btn"
                    onClick={handleGenerateBarcode}
                    title="Generate barcode"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={customData.name}
                  onChange={(e) =>
                    setCustomData({ ...customData, name: e.target.value })
                  }
                  placeholder="Enter product name"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Price (LKR)</label>
                <input
                  type="number"
                  value={customData.price}
                  onChange={(e) =>
                    setCustomData({ ...customData, price: e.target.value })
                  }
                  placeholder="Enter price"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={customData.quantity}
                  onChange={(e) =>
                    setCustomData({
                      ...customData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}

        <div className="settings-section">
          <h3>Print Settings</h3>

          <div className="form-group">
            <label>Paper Size</label>
            <select
              value={settings.paperSize}
              onChange={(e) =>
                setSettings({ ...settings, paperSize: e.target.value })
              }
              className="form-select"
            >
              {paperSizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {settings.paperSize === "custom" && (
            <div className="custom-size">
              <div className="form-group">
                <label>Width (mm)</label>
                <input
                  type="number"
                  value={settings.customWidth}
                  onChange={(e) =>
                    setSettings({ ...settings, customWidth: e.target.value })
                  }
                  placeholder="Width"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Height (mm)</label>
                <input
                  type="number"
                  value={settings.customHeight}
                  onChange={(e) =>
                    setSettings({ ...settings, customHeight: e.target.value })
                  }
                  placeholder="Height"
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showBranch}
                onChange={(e) =>
                  setSettings({ ...settings, showBranch: e.target.checked })
                }
              />
              <span>Show Branch/Store Name</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showProductName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    showProductName: e.target.checked,
                  })
                }
              />
              <span>Show Product Name</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showPrice}
                onChange={(e) =>
                  setSettings({ ...settings, showPrice: e.target.checked })
                }
              />
              <span>Show Price</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showBorder}
                onChange={(e) =>
                  setSettings({ ...settings, showBorder: e.target.checked })
                }
              />
              <span>Show Border</span>
            </label>
          </div>
        </div>

        <div className="preview-section">
          <h3>Preview</h3>
          <div className="preview-area" ref={previewRef}>
            <p className="no-preview">Click "Preview" to generate barcodes</p>
          </div>
        </div>
      </div>

      <div className="barcode-footer">
        <button className="btn-preview" onClick={handlePreview}>
          <Eye size={18} />
          Preview
        </button>
        <button className="btn-reset" onClick={handleReset}>
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="btn-print" onClick={handlePrint}>
          <Printer size={18} />
          Print
        </button>
      </div>
    </div>
  );
};

export default PrintBarcode;
