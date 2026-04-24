import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import "./EditUserModal.css";

const EditUserModal = ({ user, isOpen, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "cashier",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        role: user.role || "cashier",
        password: "",
        password_confirmation: "",
      });
    }
    setErrors({});
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const token = localStorage.getItem("authToken");

      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: formData.role,
      };

      if (formData.password) {
        updateData.password = formData.password;
        updateData.password_confirmation = formData.password_confirmation;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/api/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onUpdate(data.user);
        onClose();
        toast.success("User updated successfully!");
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ submit: data.message || "Failed to update user" });
          toast.error({ submit: data.message || "Failed to update user" });
        }
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
      toast.error({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="edit-user-modal-overlay">
      <div className="edit-user-modal-content">
        <div className="edit-user-modal-header">
          <h2>Edit User</h2>
          <button className="edit-user-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-user-form">
          <div className="edit-user-form-row">
            <div className="edit-user-form-group">
              <label>First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={errors.first_name ? "edit-user-error" : ""}
                placeholder="Enter first name"
              />
              {errors.first_name && (
                <span className="edit-user-error-text">
                  {errors.first_name}
                </span>
              )}
            </div>

            <div className="edit-user-form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={errors.last_name ? "edit-user-error" : ""}
                placeholder="Enter last name"
              />
              {errors.last_name && (
                <span className="edit-user-error-text">{errors.last_name}</span>
              )}
            </div>
          </div>

          <div className="edit-user-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "edit-user-error" : ""}
              placeholder="Enter email"
            />
            {errors.email && (
              <span className="edit-user-error-text">{errors.email}</span>
            )}
          </div>

          <div className="edit-user-form-group">
            <label>Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={errors.role ? "edit-user-error" : ""}
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <span className="edit-user-error-text">{errors.role}</span>
            )}
          </div>

          <div className="edit-user-password-section">
            <h3>Change Password (Optional)</h3>

            <div className="edit-user-form-group">
              <label>New Password</label>
              <div className="edit-user-password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? "edit-user-error" : ""}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="edit-user-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <span className="edit-user-error-text">{errors.password}</span>
              )}
            </div>

            <div className="edit-user-form-group">
              <label>Confirm Password</label>
              <div className="edit-user-password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="password_confirmation"
                  value={formData.password_confirmation}
                  onChange={handleChange}
                  className={
                    errors.password_confirmation ? "edit-user-error" : ""
                  }
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="edit-user-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {errors.password_confirmation && (
                <span className="edit-user-error-text">
                  {errors.password_confirmation}
                </span>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="edit-user-error-message submit-error">
              {errors.submit}
            </div>
          )}

          <div className="edit-user-modal-actions">
            <button
              type="button"
              className="edit-user-btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-user-btn-save"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
