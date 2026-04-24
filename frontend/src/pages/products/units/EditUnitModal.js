import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import "./AddUnitModal.css";

const EditUnitModal = ({ isOpen, onClose, onUnitUpdated, unit }) => {
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    base_unit: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when unit data is available
  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name || "",
        short_name: unit.short_name || "",
        base_unit: unit.base_unit || "",
      });
    }
  }, [unit]);

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
    if (!unit) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/units/${unit.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        },
      );

      const data = await response.json();

      if (response.ok) {
        onUnitUpdated(data.unit);
        onClose();
        toast.success("Units updated successfully!");
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          const errorMessage = data.message || "Failed to update unit";

          // Show toast for validation errors like duplicate entries
          if (
            errorMessage.includes("Duplicate entry") ||
            errorMessage.includes("Integrity constraint violation")
          ) {
            toast.error(
              "Unit name already exists. Please choose a different name.",
            );
          } else {
            setErrors({ submit: errorMessage });
            toast.error(errorMessage);
          }
        }
      }
    } catch (error) {
      console.error("Error updating unit:", error);
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      short_name: "",
      base_unit: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Unit</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="unit-form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "error" : ""}
              placeholder="Enter unit name"
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="unit-form-group">
            <label>Short Name *</label>
            <input
              type="text"
              name="short_name"
              value={formData.short_name}
              onChange={handleChange}
              className={errors.short_name ? "error" : ""}
              placeholder="Enter short name"
              required
            />
            {errors.short_name && (
              <span className="error-text">{errors.short_name}</span>
            )}
          </div>

          <div className="unit-form-group">
            <label>Base Unit</label>
            <input
              type="text"
              name="base_unit"
              value={formData.base_unit}
              onChange={handleChange}
              className={errors.base_unit ? "error" : ""}
              placeholder="Enter base unit"
            />
            {errors.base_unit && (
              <span className="error-text">{errors.base_unit}</span>
            )}
          </div>

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUnitModal;
