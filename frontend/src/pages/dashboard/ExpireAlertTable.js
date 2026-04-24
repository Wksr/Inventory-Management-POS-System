import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import "./ExpireAlertTable.css";

const ExpireAlertTable = () => {
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    checkExpiringProducts();
  }, []);

  const checkExpiringProducts = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/products/expiring", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        // For development: use mock data
        const mockExpiringProducts = [
          {
            id: 12,
            name: "Deodorant",
            sku: "DE-012",
            expire_date: "2025-12-31",
            stock: 90,
            days_to_expire: 22,
          },
        ];
        setExpiringProducts(mockExpiringProducts);

        const criticalProducts = mockExpiringProducts.filter(
          (p) => p.days_to_expire <= 7,
        );
        if (
          criticalProducts.length > 0 &&
          !sessionStorage.getItem("expireToast")
        ) {
          toast.warning(
            `${criticalProducts.length} products are expiring within 7 days!`,
            {
              duration: 10000,
            },
          );
          sessionStorage.setItem("expireToast", "true");
        }
        return;
      }

      const data = await res.json();
      const products = data.expiring_products || [];
      setExpiringProducts(products);

      const criticalProducts = products.filter((p) => p.days_to_expire <= 7);
      if (
        criticalProducts.length > 0 &&
        !sessionStorage.getItem("expireToast")
      ) {
        toast.warning(
          `${criticalProducts.length} products are expiring within 7 days!`,
          {
            duration: 10000,
          },
        );
        sessionStorage.setItem("expireToast", "true");
      }
    } catch (err) {
      console.error("Expiring products check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getExpireStatus = (days) => {
    if (days <= 0) return "expired";
    if (days <= 3) return "critical";
    if (days <= 7) return "warning";
    if (days <= 30) return "near";
    return "safe";
  };

  const getStatusText = (status) => {
    switch (status) {
      case "expired":
        return "Expired";
      case "critical":
        return "Critical";
      case "warning":
        return "Warning";
      case "near":
        return "Near";
      default:
        return "Safe";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleRefresh = () => {
    sessionStorage.removeItem("expireToast");
    setLoading(true);
    checkExpiringProducts();
  };

  const displayedProducts = showAll
    ? expiringProducts
    : expiringProducts.slice(0, 10);

  return (
    <div className="expire-alert-table">
      <div className="expire-alert-header">
        <h3 className="expire-alert-title">
          <Calendar size={18} />
          Expiry Alert
          {expiringProducts.length > 0 && (
            <span className="alert-count">({expiringProducts.length})</span>
          )}
        </h3>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          title="Refresh expiry alerts"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <div className="table-wrapper">
        <table className="expire-alert-data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Stock</th>
              <th>Expiry Date</th>
              <th>Days Left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="loading-cell">
                  Loading expiry alerts...
                </td>
              </tr>
            ) : displayedProducts.length > 0 ? (
              displayedProducts.map((product) => {
                const status = getExpireStatus(product.days_to_expire);
                const statusText = getStatusText(status);

                return (
                  <tr key={product.id}>
                    <td className="product-name">{product.name}</td>
                    <td className="product-sku">{product.sku}</td>
                    <td className="stock-count">{product.stock}</td>
                    <td className="expiry-date">
                      {formatDate(product.expire_date)}
                    </td>
                    <td className={`days-left ${status}`}>
                      {product.days_to_expire <= 0
                        ? "Expired"
                        : `${product.days_to_expire} days`}
                    </td>
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
                <td colSpan="6" className="no-data-cell">
                  <div className="no-data-content">
                    <Calendar size={32} />
                    <div>
                      <h4>No expiry alerts!</h4>
                      <p>All products have sufficient shelf life.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expiringProducts.length > 10 && (
        <div className="table-footer">
          <div className="summary">
            <span className="summary-text">
              Showing {displayedProducts.length} of {expiringProducts.length}{" "}
              expiring products
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

export default ExpireAlertTable;
