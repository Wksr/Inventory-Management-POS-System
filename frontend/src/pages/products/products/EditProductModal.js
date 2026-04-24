import React, { useState, useEffect } from "react";
import { X, Plus, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import CategoryModal from "../../products/category/CategoryModal";
import "./AddProductModal.css";

const EditProductModal = ({ isOpen, onClose, onProductUpdated, product }) => {
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
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

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

  // Populate form when product changes
  useEffect(() => {
    if (product && isOpen) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category_id: product.category_id || "",
        unit_id: product.unit?.id || "",
        cost_price: product.cost_price ? String(product.cost_price) : "",
        price: product.price ? String(product.price) : "",
        supplier_id: product.supplier?.id || "",
        stock: product.stock != null ? String(product.stock) : "",
        low_stock_alert: product.low_stock_alert
          ? String(product.low_stock_alert)
          : "10",
        expire_date: product.expire_date || "",
        description: product.description || "",
        image: null,
      });

      setVariations({
        color: product.color || "",
        size: product.size || "",
      });

      // Set image preview if product has image
      if (product.image) {
        setImagePreview(`http://127.0.0.1:8000/storage/${product.image}`);
      } else {
        setImagePreview(null);
      }
    }
  }, [product, isOpen]);

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
      } else {
        console.error("Failed to fetch categories:", data.message);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/units", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUnits(data.units.data || []);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
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
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/suppliers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setSuppliers(data.suppliers.data || []);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
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
    if (!product) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");

      // Prepare form data for file upload
      const submitData = new FormData();

      // Add all form fields
      submitData.append("name", formData.name);
      submitData.append("sku", formData.sku);
      submitData.append("category_id", formData.category_id);
      submitData.append("unit_id", formData.unit_id);
      submitData.append("cost_price", parseFloat(formData.cost_price) || 0);
      submitData.append("price", parseFloat(formData.price) || 0);
      submitData.append("supplier_id", formData.supplier_id);
      submitData.append("stock", parseInt(formData.stock) || 0);
      submitData.append(
        "low_stock_alert",
        parseInt(formData.low_stock_alert) || 10,
      );
      submitData.append("expire_date", formData.expire_date);
      submitData.append("description", formData.description);

      // Add variations if selected
      if (variations.color) {
        submitData.append("color", variations.color);
      }
      if (variations.size) {
        submitData.append("size", variations.size);
      }

      // Add image if selected (only if new image is chosen)
      if (formData.image) {
        submitData.append("image", formData.image);
      }

      // Use PUT method for update
      submitData.append("_method", "PUT");

      console.log("Updating product data:", Object.fromEntries(submitData));

      const response = await fetch(
        `http://127.0.0.1:8000/api/products/${product.id}`,
        {
          method: "POST", // Use POST with _method=PUT for file uploads
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: submitData,
        },
      );

      const data = await response.json();
      console.log("Update product response:", data);

      if (response.ok) {
        onProductUpdated(data.product);
        onClose();
        toast.success("Product updated successfully!");
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ submit: data.message || "Failed to update product" });
          toast.error({ submit: data.message || "Failed to update product" });
        }
      }
    } catch (error) {
      console.error("Update product error:", error);
      setErrors({ submit: "Network error. Please try again." });
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
          <h2>Edit Product</h2>
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
                type="text"
                inputMode="decimal"
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
                type="text"
                inputMode="decimal"
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
              <label>Stock</label>
              <input
                type="text"
                inputMode="numeric"
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
                type="text"
                inputMode="numeric"
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
                <span>Change Image</span>
              </label>
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <div className="image-preview-note">Current image</div>
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
              {isSubmitting ? "Updating..." : "Update Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;
