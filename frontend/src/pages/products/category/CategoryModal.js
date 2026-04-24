import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import "./CategoryModal.css";
import offlineDB from "../../../utils/offlineDB";

const CategoryModal = ({
  isOpen,
  onClose,
  onCategoryAdded,
  editingCategory,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens or editing category changes
  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        // Edit mode - fill form with existing data
        setFormData({
          name: editingCategory.name || "",
          description: editingCategory.description || "",
        });
      } else {
        // Add mode - reset form
        setFormData({
          name: "",
          description: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, editingCategory]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");
      const isOnline = navigator.onLine;

      let newCategory;

      if (isOnline) {
        // Online: Server එකට යවන්න (ඔයාගේ existing code)
        const url = editingCategory
          ? `http://127.0.0.1:8000/api/categories/${editingCategory.id}`
          : "http://127.0.1:8000/api/categories";

        const method = editingCategory ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok) {
          newCategory = data.category;
        } else {
          if (data.errors) setErrors(data.errors);
          throw new Error(data.message || "Failed");
        }
      } else {
        // Offline: Local එකට save කරන්න
        const tempId = `temp_cat_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 8)}`;

        newCategory = {
          id: tempId,
          local_id: tempId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "pending", // මේක sync කරන්න ඕන කියලා mark කරනවා
        };

        await offlineDB.addCategory(newCategory);
        toast.info("Category saved offline! Will sync when online.");
      }

      // Callback එක call කරලා AddProductModal එකේ dropdown එක update කරන්න
      onCategoryAdded(newCategory, !!editingCategory);
      onClose();
      toast.success(editingCategory ? "Category updated!" : "Category added!");
    } catch (error) {
      console.error("Category save error:", error);
      toast.error("Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="category-modal-overlay">
      <div className="category-modal-content">
        <div className="category-modal-header">
          <h2>{editingCategory ? "Edit Category" : "Add New Category"}</h2>
          <button className="category-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="category-form">
          <div className="category-form-group">
            <label>Category Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "category-error" : ""}
              placeholder="Enter category name"
              required
            />
            {errors.name && (
              <span className="category-error-text">{errors.name}</span>
            )}
          </div>

          <div className="category-form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={errors.description ? "category-error" : ""}
              placeholder="Enter category description"
              rows="4"
            />
            {errors.description && (
              <span className="category-error-text">{errors.description}</span>
            )}
          </div>

          {errors.submit && (
            <div className="category-error-message submit-error">
              {errors.submit}
            </div>
          )}

          <div className="category-modal-actions">
            <button
              type="button"
              className="category-btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="category-btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? editingCategory
                  ? "Updating..."
                  : "Adding..."
                : editingCategory
                ? "Update Category"
                : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;
