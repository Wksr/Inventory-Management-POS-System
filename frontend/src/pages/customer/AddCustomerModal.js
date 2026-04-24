import React, { useState } from "react";
import { X } from "lucide-react";
import "./AddCustomerModal.css";
import { toast } from "sonner";
import offlineDB from "../../utils/offlineDB";

const AddCustomerModal = ({ isOpen, onClose, onCustomerAdded }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend basic validation
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Local duplicate check (both online & offline)
      const allCustomers = await offlineDB.getAllCustomers();
      const duplicatePhone = allCustomers.find(
        (c) => c.phone?.trim() === formData.phone.trim(),
      );

      if (duplicatePhone) {
        toast.error("Customer with this phone number already exists!");
        setIsSubmitting(false);
        return;
      }

      const token = localStorage.getItem("authToken");
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email ? formData.email.trim() : null,
      };

      // === ONLINE MODE ===
      if (navigator.onLine) {
        const response = await fetch("http://127.0.0.1:8000/api/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json().catch(() => ({}));

        if (response.ok) {
          const newCustomer = responseData.customer || responseData.data;

          // Save to local as synced
          await offlineDB.addCustomer({
            ...newCustomer,
            sync_status: "synced",
            local_id: `server_${newCustomer.id}`,
          });

          onCustomerAdded(newCustomer);
          toast.success("Customer added successfully!");
          handleClose();
        } else {
          // Handle backend validation errors (422) or server errors (500)
          const errorMessage =
            responseData.message ||
            responseData.errors?.phone?.[0] ||
            responseData.errors?.name?.[0] ||
            "Failed to add customer (server error)";

          toast.error(errorMessage);
          console.error("Server response:", responseData);
        }
      } else {
        // === OFFLINE MODE ===
        const tempId = `pending_cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const localCustomer = {
          id: tempId,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email ? formData.email.trim() : null,
          branch_id: null, // Will be set during sync
          business_id: null,
          sync_status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await offlineDB.addCustomer(localCustomer);
        onCustomerAdded(localCustomer);

        toast.info("Customer added offline! Will sync when online.");
        handleClose();
      }
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error(
        "Failed to save customer: " + (error.message || "Unknown error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", phone: "", email: "" });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Customer</h2>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="customer-form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "error" : ""}
              placeholder="Enter customer name"
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="customer-form-group">
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

          <div className="customer-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "error" : ""}
              placeholder="Enter email address"
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="customer-modal-actions">
            <button
              type="button"
              className="customer-btn-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="customer-btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
