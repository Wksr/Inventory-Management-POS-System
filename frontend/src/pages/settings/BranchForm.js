import React, { useState } from "react";
import { X, Building, Phone, Mail, MapPin } from "lucide-react";
import "./BranchForm.css";

const BranchForm = ({
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData = null,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    code: initialData?.code || "",
    address: initialData?.address || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
  });

  const [errors, setErrors] = useState({});

  const formTitle = isEditing ? "Edit Branch" : "Add New Branch";
  const submitButtonText = isEditing ? "Update Branch" : "Create Branch";

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

  const generateBranchCode = () => {
    if (formData.name.trim() === "") return "";

    // Generate code from first 2 letters of name + random 2 digits
    const namePart = formData.name.substring(0, 2).toUpperCase();
    const randomPart = Math.floor(10 + Math.random() * 90); // 10-99
    const generatedCode = `${namePart}${randomPart}`;

    setFormData((prev) => ({
      ...prev,
      code: generatedCode,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Branch name is required";
    }
    // if (!formData.code.trim()) {
    //   newErrors.code = "Branch code is required";
    // }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(formData);
      // Form will be closed by parent after successful submission
    } catch (error) {
      // Handle submission error in parent component
      console.error("Form submission error:", error);
    }
  };

  return (
    <div className="branch-form-overlay" onClick={onClose}>
      <div
        className="branch-form-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="branch-form-header">
          <div className="branch-form-title">
            <Building size={20} />
            <h2>{formTitle}</h2>
          </div>
          <button className="branch-form-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="branch-form">
          <div className="branch-form-group">
            <label htmlFor="name">
              <Building size={16} />
              Branch Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter branch name"
              className={errors.name ? "branch-form-error" : ""}
            />
            {errors.name && (
              <span className="error-message">{errors.name}</span>
            )}
          </div>

          <div className="branch-form-group">
            <label htmlFor="code">Branch Code *</label>
            <div className="code-input-group">
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="e.g., MB01"
                maxLength={10}
                className={errors.code ? "branch-form-error" : ""}
              />
              <button
                type="button"
                className="generate-code-btn"
                onClick={generateBranchCode}
                disabled={!formData.name.trim()}
              >
                Generate
              </button>
            </div>
            {errors.code && (
              <span className="error-message">{errors.code}</span>
            )}
            <small className="help-text">
              Unique code for the branch (max 10 characters)
            </small>
          </div>

          <div className="branch-form-group">
            <label htmlFor="address">
              <MapPin size={16} />
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter branch address"
              rows={3}
            />
          </div>

          <div className="form-grid">
            <div className="branch-form-group">
              <label htmlFor="phone">
                <Phone size={16} />
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g., +1234567890"
              />
            </div>

            <div className="branch-form-group">
              <label htmlFor="email">
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="branch@example.com"
                className={errors.email ? "branch-form-error" : ""}
              />
              {errors.email && (
                <span className="error-message">{errors.email}</span>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                submitButtonText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchForm;
