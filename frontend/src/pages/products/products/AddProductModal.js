import React, { useState, useEffect } from "react";
import { X, Plus, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import CategoryModal from "../../products/category/CategoryModal";
import "./AddProductModal.css";
import offlineDB from "../../../utils/offlineDB";

const AddProductModal = ({ isOpen, onClose, onProductAdded }) => {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category_id: "",
    unit_id: "",
    cost_price: "",
    price: "",
    supplier_id: "",
    stock: "",
    low_stock_alert: "10",
    expire_date: "",
    description: "",
    image: null,
  });

  const [variations, setVariations] = useState({
    color: "",
    size: "",
  });

  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);

  const colors = [
    "Red",
    "Blue",
    "Green",
    "Black",
    "White",
    "Yellow",
    "Orange",
    "Purple",
    "Pink",
    "Brown",
    "Gray",
  ];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      if (navigator.onLine) {
        // Try server
        const token = localStorage.getItem("authToken");
        const res = await fetch("http://127.0.0.1:8000/api/categories", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCategories(data.categories);
            // Cache them
            for (const cat of data.categories) {
              await offlineDB.addCategory(cat);
            }
            return;
          }
        }
      }

      // Offline fallback
      const cached = await offlineDB.getAllCategories();
      if (cached.length > 0) {
        setCategories(cached);
        toast.info("Using cached categories (offline)");
      } else {
        toast.warning("No categories available offline");
      }
    } catch (err) {
      console.error("Categories fetch failed:", err);
      // Final fallback
      const cached = await offlineDB.getAllCategories();
      setCategories(cached || []);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const isOnline = navigator.onLine;
      let suppliersData = [];

      // 1. Online mode
      if (isOnline) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch("http://127.0.0.1:8000/api/suppliers", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              suppliersData = data.suppliers?.data || data.suppliers || [];

              for (const supplier of suppliersData) {
                await offlineDB.addSupplier(supplier);
              }

              console.log("Suppliers loaded from server + cached");
            }
          } else {
            console.warn("Server response not OK, using cache");
          }
        } catch (onlineErr) {
          console.warn(
            "Online fetch failed, falling back to cache:",
            onlineErr,
          );
        }
      }

      // 2. Offline fallback OR online fail
      if (suppliersData.length === 0) {
        const cachedSuppliers = await offlineDB.getAllSuppliers();
        if (cachedSuppliers.length > 0) {
          suppliersData = cachedSuppliers;
          toast.info("Using cached suppliers (offline mode)");
        } else {
          toast.warning("No suppliers available (no cache yet)");
        }
      }

      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Critical error fetching suppliers:", error);
      toast.error("Suppliers load error");
      setSuppliers([]);
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const isOnline = navigator.onLine;
      let unitsData = [];

      if (isOnline) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch("http://127.0.0.1:8000/api/units", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              unitsData = data.units?.data || data.units || [];

              for (const unit of unitsData) {
                await offlineDB.addUnit(unit);
              }

              console.log("Units loaded from server & cached");
            }
          } else {
            console.warn("Server response not OK, falling back to cache");
          }
        } catch (onlineErr) {
          console.warn("Online fetch failed, using cache:", onlineErr);
        }
      }

      // 2. Offline fallback OR online fail
      if (unitsData.length === 0) {
        const cachedUnits = await offlineDB.getAllUnits();
        if (cachedUnits.length > 0) {
          unitsData = cachedUnits;
          toast.info("Using cached units (offline mode)");
        } else {
          toast.warning("No units available offline yet");
        }
      }

      setUnits(unitsData);
    } catch (criticalError) {
      console.error("Critical error fetching units:", criticalError);
      toast.error("Units load error");
      setUnits([]); // empty fallback
    }
  };

  const handleVariationChange = (type, value) => {
    setVariations((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCategoryAdded = (newCategory) => {
    // Add new category to the list and select it
    setCategories((prev) => [newCategory, ...prev]);
    setFormData((prev) => ({
      ...prev,
      category_id: newCategory.id,
    }));
  };

  const handleGenerateBarcode = () => {
    // Modern & collision-proof UUID based SKU
    const uuidPart = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)
      .toUpperCase();

    const newSku = `${uuidPart}`;
    // :A1B2C3D4E5F6

    setFormData({ ...formData, sku: newSku });
    toast.success("Unique barcode generated!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");
      const isOnline = navigator.onLine;

      // Prepare product data (core fields)
      const productData = {
        name: formData.name,
        sku: formData.sku,
        category_id: formData.category_id,
        unit_id: formData.unit_id,
        cost_price: parseFloat(formData.cost_price) || 0,
        price: parseFloat(formData.price) || 0,
        supplier_id: formData.supplier_id,
        stock_quantity: parseInt(formData.stock) || 0,
        low_stock_alert: parseInt(formData.low_stock_alert) || 10,
        expire_date: formData.expire_date || null,
        description: formData.description || "",
        color: variations.color || null,
        size: variations.size || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: isOnline ? "synced" : "pending",
      };

      let newProduct;

      if (isOnline) {
        // Online: Send to server (unchanged)
        const submitData = new FormData();
        Object.keys(productData).forEach((key) => {
          if (productData[key] !== null && productData[key] !== undefined) {
            submitData.append(key, productData[key]);
          }
        });
        if (formData.image) {
          submitData.append("image", formData.image);
        }

        const response = await fetch("http://127.0.0.1:8000/api/products", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: submitData,
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) setErrors(data.errors);
          throw new Error(data.message || "Failed to add product");
        }

        newProduct = data.product;
      } else {
        const tempId = `temp_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const selectedCategory = categories.find(
          (c) => c.id === Number(formData.category_id),
        );
        const selectedUnit = units.find(
          (u) => u.id === Number(formData.unit_id),
        );
        const selectedSupplier = suppliers.find(
          (s) => s.id === Number(formData.supplier_id),
        );

        newProduct = {
          ...productData,
          id: tempId,
          local_id: tempId,
          image_url: formData.image
            ? URL.createObjectURL(formData.image)
            : null,

          category: selectedCategory
            ? {
                id: selectedCategory.id,
                name: selectedCategory.name,
              }
            : null,

          unit: selectedUnit
            ? {
                id: selectedUnit.id,
                name: selectedUnit.name,
                short_name: selectedUnit.short_name || "",
              }
            : null,

          supplier: selectedSupplier
            ? {
                id: selectedSupplier.id,
                name: selectedSupplier.name,
              }
            : null,

          stock: productData.stock_quantity || 0,
        };

        try {
          await offlineDB.addProduct(newProduct);
          toast.info(
            "Product saved offline with full details! Will sync when online.",
          );
        } catch (dbError) {
          console.error("IndexedDB save failed:", dbError);
          toast.error("Offline save failed! Please try again.");
          throw dbError;
        }
      }

      // Success handling (unchanged)
      onProductAdded(newProduct);
      onClose();
      resetForm();
      toast.success("Product added successfully!");
    } catch (error) {
      console.error("Add product error:", error);
      toast.error(
        "Failed to add product: " + (error.message || "Unknown error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category_id: "",
      unit_id: "",
      cost_price: "",
      price: "",
      supplier_id: "",
      stock: "",
      low_stock_alert: "10",
      expire_date: "",
      description: "",
      image: null,
    });
    setVariations({
      color: "",
      size: "",
    });
    setImagePreview(null);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="add-product-modal-overlay">
      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryAdded={handleCategoryAdded}
      />

      <div className="add-product-modal-content">
        <div className="add-product-modal-header">
          <h2>Add New Product</h2>
          <button className="add-product-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-product-form">
          {/* Product Name & SKU/Barcode */}
          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? "add-product-error" : ""}
                placeholder="Enter product name"
                required
              />
              {errors.name && (
                <span className="add-product-error-text">{errors.name}</span>
              )}
            </div>

            <div className="add-product-form-group">
              <label>SKU/Barcode *</label>
              <div className="input-with-button">
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className={errors.sku ? "add-product-error" : ""}
                  placeholder="SKU or Barcode number"
                  required
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
          </div>

          {/* Category with Add Button */}
          <div className="add-product-form-group">
            <label>Category *</label>
            <div className="category-select-container">
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className={errors.category_id ? "add-product-error" : ""}
                required
              >
                <option value="">Select Category</option>
                {isLoading ? (
                  <option disabled>Loading categories...</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="add-category-btn"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Plus size={16} />
              </button>
            </div>
            {errors.category_id && (
              <span className="add-product-error-text">
                {errors.category_id}
              </span>
            )}
          </div>

          {/* Unit & Prices */}
          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>Unit</label>
              <select
                name="unit_id"
                value={formData.unit_id}
                onChange={handleChange}
                className={errors.unit_id ? "add-product-error" : ""}
              >
                <option value="">Select Unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.short_name})
                  </option>
                ))}
              </select>
              {errors.unit_id && (
                <span className="add-product-error-text">{errors.unit_id}</span>
              )}
            </div>
            <div className="add-product-form-group">
              <label>Cost Price (LKR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                className={errors.cost_price ? "add-product-error" : ""}
                placeholder="0.00"
                required
              />
              {errors.cost_price && (
                <span className="add-product-error-text">
                  {errors.cost_price}
                </span>
              )}
            </div>
          </div>

          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>Selling Price (LKR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={errors.price ? "add-product-error" : ""}
                placeholder="0.00"
                required
              />
              {errors.price && (
                <span className="add-product-error-text">{errors.price}</span>
              )}
            </div>

            <div className="add-product-form-group">
              <label>Supplier</label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                className={errors.supplier_id ? "add-product-error" : ""}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {supplier.company}
                  </option>
                ))}
              </select>
              {errors.supplier_id && (
                <span className="add-product-error-text">
                  {errors.supplier_id}
                </span>
              )}
            </div>
          </div>

          {/* Stock Management */}
          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>In Stock</label>
              <input
                type="number"
                min="0"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                className={errors.stock ? "add-product-error" : ""}
                placeholder="0"
              />
              {errors.stock && (
                <span className="add-product-error-text">{errors.stock}</span>
              )}
            </div>

            <div className="add-product-form-group">
              <label>Low Stock Alert *</label>
              <input
                type="number"
                min="0"
                name="low_stock_alert"
                value={formData.low_stock_alert}
                onChange={handleChange}
                className={errors.low_stock_alert ? "add-product-error" : ""}
                placeholder="10"
                required
              />
              {errors.low_stock_alert && (
                <span className="add-product-error-text">
                  {errors.low_stock_alert}
                </span>
              )}
            </div>
          </div>

          {/* Variations */}
          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>Color Variation</label>
              <select
                value={variations.color}
                onChange={(e) => handleVariationChange("color", e.target.value)}
              >
                <option value="">Select Color</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>

            <div className="add-product-form-group">
              <label>Size Variation</label>
              <select
                value={variations.size}
                onChange={(e) => handleVariationChange("size", e.target.value)}
              >
                <option value="">Select Size</option>
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Image Upload */}
          <div className="add-product-form-group">
            <label>Product Image</label>
            <div className="image-upload-container">
              <input
                type="file"
                id="product-image"
                accept="image/*"
                onChange={handleImageChange}
                className="image-upload-input"
              />
              <label htmlFor="product-image" className="image-upload-label">
                <Upload size={20} />
                <span>Choose Image</span>
              </label>
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
          </div>

          {/* Expire Date & Description */}
          <div className="add-product-form-row">
            <div className="add-product-form-group">
              <label>Expire Date</label>
              <input
                type="date"
                name="expire_date"
                value={formData.expire_date}
                onChange={handleChange}
                className={errors.expire_date ? "add-product-error" : ""}
              />
              {errors.expire_date && (
                <span className="add-product-error-text">
                  {errors.expire_date}
                </span>
              )}
            </div>
          </div>

          <div className="add-product-form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={errors.description ? "add-product-error" : ""}
              placeholder="Product description"
              rows="3"
            />
            {errors.description && (
              <span className="add-product-error-text">
                {errors.description}
              </span>
            )}
          </div>

          {errors.submit && (
            <div className="add-product-error-message submit-error">
              {errors.submit}
            </div>
          )}

          <div className="add-product-modal-actions">
            <button
              type="button"
              className="add-product-btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-product-btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
