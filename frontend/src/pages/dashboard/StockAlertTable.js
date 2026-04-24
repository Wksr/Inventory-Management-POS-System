import React, { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import "./StockAlertTable.css";

const StockAlertTable = () => {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    checkLowStock();
  }, []);

  const checkLowStock = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/products/low-stock", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        // For development: use mock data
        const mockLowStock = [
          {
            id: 12,
            name: "Hard Drive",
            sku: "HD-012",
            stock: 4,
            low_stock_alert: 15,
          },
        ];
        setLowStockProducts(mockLowStock);

        if (
          mockLowStock.length > 0 &&
          !sessionStorage.getItem("lowStockToast")
        ) {
          toast.warning(
            `${mockLowStock.length} products are running low on stock!`,
            {
              duration: 10000,
            },
          );
          sessionStorage.setItem("lowStockToast", "true");
        }
        return;
      }

      const data = await res.json();
      const products = data.low_stock_products || [];
      setLowStockProducts(products);

      if (products.length > 0 && !sessionStorage.getItem("lowStockToast")) {
        toast.warning(`${products.length} products are running low on stock!`, {
          duration: 10000,
        });
        sessionStorage.setItem("lowStockToast", "true");
      }
    } catch (err) {
      console.error("Low stock check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (product) => {
    if (product.stock <= 0) return "out-of-stock";
    const stockPercentage = (product.stock / product.low_stock_alert) * 100;
    if (stockPercentage <= 30) return "critical";
    if (stockPercentage <= 50) return "warning";
    return "low";
  };

  const getStatusText = (status) => {
    switch (status) {
      case "critical":
        return "Critical";
      case "out-of-stock":
        return "Out of Stock";
      case "low":
        return "Low";
      default:
        return "Warning";
    }
  };

  const handleRefresh = () => {
    sessionStorage.removeItem("lowStockToast");
    setLoading(true);
    checkLowStock();
  };

  const displayedProducts = showAll
    ? lowStockProducts
    : lowStockProducts.slice(0, 10);

  return (
    <div className="stock-alert-table">
      <div className="stock-alert-header">
        <h3 className="stock-alert-title">
          Stock Alert
          {lowStockProducts.length > 0 && (
            <span className="alert-count">({lowStockProducts.length})</span>
          )}
        </h3>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          title="Refresh stock alerts"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <div className="table-wrapper">
        <table className="stock-alert-data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Current Stock</th>
              <th>Alert Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="loading-cell">
                  Loading stock alerts...
                </td>
              </tr>
            ) : displayedProducts.length > 0 ? (
              displayedProducts.map((product) => {
                const status = getStockStatus(product);
                const statusText = getStatusText(status);

                return (
                  <tr key={product.id}>
                    <td className="product-name">{product.name}</td>
                    <td className="product-sku">{product.sku}</td>
                    <td className={`stock-value ${status}`}>{product.stock}</td>
                    <td className="alert-level">{product.low_stock_alert}</td>
                    <td>
                      <span className={`status-badge ${status}`}>
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="no-data-cell">
                  <div className="no-data-content">
                    <Package size={32} />
                    <div>
                      <h4>All products are well stocked!</h4>
                      <p>No low stock alerts at the moment.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {lowStockProducts.length > 10 && (
        <div className="table-footer">
          <div className="summary">
            <span className="summary-text">
              Showing {displayedProducts.length} of {lowStockProducts.length}{" "}
              low stock products
            </span>
          </div>
          <div className="actions">
            <button
              className="view-all-btn"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show Less" : "View All"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAlertTable;
