import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import "./EditCustomerModal.css";
import { toast } from "sonner";

const EditCustomerModal = ({
  isOpen,
  onClose,
  customerId,
  onCustomerUpdated,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define fetchCustomerDetails with useCallback
  const fetchCustomerDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/customers/${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.customer) {
        const customer = data.customer;
        setFormData({
          name: customer.name || "",
          phone: customer.phone || "",
          email: customer.email || "",
        });
      } else {
        throw new Error(data.message || "Failed to fetch customer details");
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
      toast.error("Failed to load customer details");
      onClose();
    }
  }, [customerId, onClose]); // Add dependencies here

  // Fetch customer details when modal opens
  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetails();
    } else {
      // Reset form when modal closes
      setFormData({
        name: "",
        phone: "",
        email: "",
      });
      setErrors({});
    }
  }, [isOpen, customerId, fetchCustomerDetails]); // Include fetchCustomerDetails in dependencies

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

    // Validate required fields
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";

    // Email format validation
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:8000/api/customers/${customerId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onCustomerUpdated(data.customer);
        handleClose();
        toast.success("Customer updated successfully!");
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ submit: data.message || "Failed to update customer" });
        }
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="edit-modal-overlay" onClick={handleClose}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h2>Edit Customer</h2>
          <button className="edit-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-modal-form">
          <div className="edit-form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "edit-error" : ""}
              placeholder="Enter customer name"
              required
              disabled={isSubmitting}
            />
            {errors.name && (
              <span className="edit-error-text">{errors.name}</span>
            )}
          </div>

          <div className="edit-form-group">
            <label>Phone *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errors.phone ? "edit-error" : ""}
              placeholder="Enter phone number"
              required
              disabled={isSubmitting}
            />
            {errors.phone && (
              <span className="edit-error-text">{errors.phone}</span>
            )}
          </div>

          <div className="edit-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "edit-error" : ""}
              placeholder="Enter email address"
              disabled={isSubmitting}
            />
            {errors.email && (
              <span className="edit-error-text">{errors.email}</span>
            )}
          </div>

          {errors.submit && (
            <div className="edit-error-message submit-error">
              {errors.submit}
            </div>
          )}

          <div className="edit-modal-actions">
            <button
              type="button"
              className="edit-btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;
