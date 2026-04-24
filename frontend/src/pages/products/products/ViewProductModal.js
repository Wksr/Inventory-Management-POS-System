import React from "react";
import { X, ImageIcon } from "lucide-react";
import "./ViewProductModal.css";

const ViewProductModal = ({ isOpen, onClose, product }) => {
  if (!isOpen || !product) return null;

  // Helper to safely get nested values
  const formatPrice = (price) =>
    price != null
      ? `LKR ${Number(price).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
        })}`
      : "LKR 0.00";

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Product Details</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="product-details">
          {/* Product Image */}
          {product.image ? (
            <div className="image-section">
              <img
                src={`http://127.0.0.1:8000/storage/${product.image}`}
                alt={product.name}
                className="product-view-image"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
              <div className="no-image" style={{ display: "none" }}>
                <ImageIcon size={32} />
                <span>No Image</span>
              </div>
            </div>
          ) : (
            <div className="image-section">
              <div className="no-image">
                <ImageIcon size={32} />
                <span>No Image</span>
              </div>
            </div>
          )}

          <div className="detail-row">
            <label>Product Name:</label>
            <span>{product.name || "—"}</span>
          </div>

          <div className="detail-row">
            <label>SKU/Barcode:</label>
            <span>{product.sku || "—"}</span>
          </div>

          <div className="detail-row">
            <label>Category:</label>
            <span>{product.category?.name || "N/A"}</span>
          </div>

          {/* Fixed Unit */}
          <div className="detail-row">
            <label>Unit:</label>
            <span>
              {product.unit?.name
                ? `${product.unit.name} (${product.unit.short_name})`
                : "N/A"}
            </span>
          </div>

          <div className="detail-row">
            <label>Cost Price:</label>
            <span>{formatPrice(product.cost_price)}</span>
          </div>

          <div className="detail-row">
            <label>Selling Price:</label>
            <span>{formatPrice(product.price)}</span>
          </div>

          <div className="detail-row">
            <label>Stock:</label>
            <span>{product.stock ?? "0"}</span>
          </div>

          {/* Fixed Supplier */}
          <div className="detail-row">
            <label>Supplier:</label>
            <span>
              {product.supplier?.name
                ? `${product.supplier.name} - ${
                    product.supplier.company || ""
                  }`.trim()
                : "N/A"}
            </span>
          </div>

          <div className="detail-row">
            <label>Low Stock Alert:</label>
            <span>{product.low_stock_alert ?? "10"}</span>
          </div>

          {(product.color || product.size) && (
            <div className="detail-row">
              <label>Variations:</label>
              <span>
                {product.color && `Color: ${product.color}`}
                {product.color && product.size && " | "}
                {product.size && `Size: ${product.size}`}
              </span>
            </div>
          )}

          {product.expire_date && (
            <div className="detail-row">
              <label>Expire Date:</label>
              <span>{new Date(product.expire_date).toLocaleDateString()}</span>
            </div>
          )}

          {product.description && (
            <div className="detail-row">
              <label>Description:</label>
              <span className="description-text">{product.description}</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;
