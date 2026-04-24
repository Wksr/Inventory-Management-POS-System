import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
import AddProductModal from "./AddProductModal";
import "./products.css";
import EditProductModal from "./EditProductModal";
import ViewProductModal from "./ViewProductModal";
import offlineDB from "../../../utils/offlineDB";

const Products = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [products, setProducts] = useState({
    data: [],
    current_page: 1,
    last_page: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const recordsPerPage = 20;
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);

  const filterRef = useRef(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Date filtering function
  const filterProductsByDate = (products) => {
    if (!dateFilter) return products;

    const now = new Date();

    switch (dateFilter) {
      case "today":
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return products.filter((product) => {
          if (!product.created_at) return false;
          const productDate = new Date(product.created_at);
          return productDate >= today && productDate < tomorrow;
        });

      case "thisweek":
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return products.filter((product) => {
          if (!product.created_at) return false;
          const productDate = new Date(product.created_at);
          return productDate >= startOfWeek && productDate < endOfWeek;
        });

      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return products.filter((product) => {
          if (!product.created_at) return false;
          const productDate = new Date(product.created_at);
          return productDate >= startOfMonth && productDate <= endOfMonth;
        });

      case "custom":
        if (customDateStart && customDateEnd) {
          const startDate = new Date(customDateStart);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(customDateEnd);
          endDate.setHours(23, 59, 59, 999);
          return products.filter((product) => {
            if (!product.created_at) return false;
            const productDate = new Date(product.created_at);
            return productDate >= startDate && productDate <= endDate;
          });
        }
        return products;

      default:
        return products;
    }
  };

  // Combine search and date filtering
  const filteredProducts = filterProductsByDate(products.data).filter(
    (product) =>
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      product.supplier?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredProducts.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);

      let url = `http://127.0.0.1:8000/api/products?page=${page}&per_page=50`;

      // search තියෙනවා නම් backend එකට යවන්න (server-side search)
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      // date filter ඕනේ නම් backend එකට යවන්න (ඔයාට implement කරන්න පුළුවන්)
      // if (dateFilter) url += `&date_filter=${dateFilter}`;

      const token = localStorage.getItem("authToken");
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // මෙතනදි full pagination object එක ගන්න
        setProducts({
          data: data.products.data || [],
          current_page: data.products.current_page,
          last_page: data.products.last_page,
          total: data.products.total,
          per_page: data.products.per_page,
        });

        // offline cache update කරන්න ඕනේ නම් ඔක්කොම load කරගන්න ඕනේ නැහැ
        // ඒ වෙනුවට ඔයාට ඕනේ නම් current page එක විතරක් cache කරන්න
        // නැත්නම් මේ cache logic එක තාවකාලිකව remove කරලා තියන්න
      } else {
        throw new Error(data.message || "API returned unsuccessful");
      }
    } catch (error) {
      console.error("Products fetch error:", error);

      // offline fallback
      if (!navigator.onLine) {
        try {
          const cached = await offlineDB.getAllProducts();
          const active = cached.filter((p) => p.sync_status !== "deleted");
          setProducts({
            data: active,
            current_page: 1,
            last_page: 1,
            total: active.length,
          });
          toast.info("Offline mode: using cached products");
        } catch (offlineErr) {
          console.error("Offline cache error:", offlineErr);
          setError("Failed to load products (offline)");
        }
      } else {
        setError("Failed to load products");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleEdit = (product) => {
    setEditingProduct(product);
  };

  const handleDelete = async (product) => {
    toast.warning(`Delete "${product.name}"?`, {
      description: "All product data will be permanently removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/products/${product.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (data.success) {
              setProducts((prev) => ({
                ...prev,
                data: prev.data.filter((p) => p.id !== product.id),
                total: prev.total - 1,
              }));
              toast.success("Product deleted successfully!");
            } else {
              throw new Error(data.message || "Failed to delete product");
            }
          } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("Failed to delete product");
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleProductUpdated = (updatedProduct) => {
    setProducts((prev) => ({
      ...prev,
      data: prev.data.map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p,
      ),
    }));
    setEditingProduct(null);
    toast.success("Product updated successfully!");
  };

  const handleAddProduct = () => {
    setIsAddModalOpen(true);
  };

  const handleProductAdded = (newProduct) => {
    setProducts((prev) => ({
      ...prev,
      data: [newProduct, ...prev.data],
      total: prev.total + 1,
    }));
    toast.success("Product added successfully!");
  };

  const handleView = (product) => {
    setViewingProduct(product);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFilterSelect = (filter) => {
    setDateFilter(filter);
    setShowFilterDropdown(false);
    setCurrentPage(1); // Reset to first page when filter changes

    if (filter === "custom") {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
      setCustomDateStart("");
      setCustomDateEnd("");
    }
  };

  if (loading) {
    return (
      <div className="products-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-page">
        <div className="error-message">Error: {error}</div>
        <button onClick={fetchProducts} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="products-page">
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onProductAdded={handleProductAdded}
      />

      <EditProductModal
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onProductUpdated={handleProductUpdated}
      />

      <ViewProductModal
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        product={viewingProduct}
      />

      <div className="products-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="header-right">
          <div className="product-filter-container" ref={filterRef}>
            <button
              className="product-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="product-filter-dropdown">
                <button
                  className="product-filter-option"
                  onClick={() => handleFilterSelect("")}
                >
                  All
                </button>
                <button
                  className="product-filter-option"
                  onClick={() => handleFilterSelect("today")}
                >
                  Today
                </button>
                <button
                  className="product-filter-option"
                  onClick={() => handleFilterSelect("thisweek")}
                >
                  This Week
                </button>
                <button
                  className="product-filter-option"
                  onClick={() => handleFilterSelect("month")}
                >
                  Month
                </button>
                <button
                  className="product-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          <button className="add-product-btn" onClick={handleAddProduct}>
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="product-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="product-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="product-date-input"
          />
        </div>
      )}

      <div className="products-table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product Name</th>
              <th>Category Name</th>
              <th>Supplier</th>
              <th>Unit</th>
              <th>Price (LKR)</th>
              <th>In Stock</th>
              <th>Code</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.length > 0 ? (
              currentProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-image-cell">
                      {product.image ? (
                        <img
                          src={`http://127.0.0.1:8000/storage/${product.image}`}
                          alt={product.name}
                          className="product-image"
                          onError={(e) => {
                            e.target.style.display = "none";
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : (
                        <div className="product-image-placeholder">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      {product.image && (
                        <div
                          className="product-image-placeholder"
                          style={{ display: "none" }}
                        >
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="product-name">{product.name}</td>
                  <td className="product-name">
                    {product.category?.name || "No Category"}
                  </td>
                  <td className="product-name">
                    {product.supplier?.name || "No Supplier"}
                  </td>
                  <td className="product-unit">
                    {product.unit?.name || "No Unit"}
                  </td>
                  <td className="product-price">
                    LKR {product.price?.toLocaleString() || "0"}
                  </td>
                  <td className="stock-count">{product.stock || 0}</td>
                  <td className="product-code">{product.sku}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn view-btn"
                        onClick={() => handleView(product)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > 0 && (
        <div className="table-footer">
          <div className="pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredProducts.length)} of{" "}
            {filteredProducts.length} entries
          </div>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              onClick={handlePrevious}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <span className="page-number">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={handleNext}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
