import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import "./AddSupplierModal.css";
import { toast } from "sonner";

const EditSupplierModal = ({
  isOpen,
  onClose,
  onSupplierUpdated,
  supplier,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when supplier data is available
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        company: supplier.company || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
      });
    }
  }, [supplier]);

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
    if (!supplier) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/suppliers/${supplier.id}`,
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
        onSupplierUpdated(data.supplier);
        onClose();
        toast.success("Supplier updated successfully!");
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ submit: data.message || "Failed to update supplier" });
        }
      }
    } catch (error) {
      console.error("Error updating supplier:", error);
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      company: "",
      phone: "",
      email: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Supplier</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="supplier-form-group">
            <label>Supplier Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "error" : ""}
              placeholder="Enter supplier name"
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="supplier-form-group">
            <label>Company *</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className={errors.company ? "error" : ""}
              placeholder="Enter company name"
              required
            />
            {errors.company && (
              <span className="error-text">{errors.company}</span>
            )}
          </div>

          <div className="supplier-form-group">
            <label>Phone *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errors.phone ? "error" : ""}
              placeholder="Enter phone number"
              required
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="supplier-form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "supplier-error" : ""}
              placeholder="Enter email address"
              required
            />
            {errors.email && (
              <span className="supplier-error-text">{errors.email}</span>
            )}
          </div>

          {errors.submit && (
            <div className="supplier-error-message submit-error">
              {errors.submit}
            </div>
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
              {isSubmitting ? "Updating..." : "Update Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSupplierModal;
