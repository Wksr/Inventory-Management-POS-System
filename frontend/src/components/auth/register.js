import React, { useState } from "react";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext"; // Added this import
import "./register.css";

const Register = ({
  onSwitchToLogin,
  onRegisterSuccess,
  branches = [],
  defaultBranchId = null,
}) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin",
    branch_id: defaultBranchId || "",
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Added useAuth hook (but not using it for auto-login)
  const { login } = useAuth();

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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          password_confirmation: formData.confirmPassword, // Laravel expects this for confirmed validation
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful - redirect to login (NO auto-login)
        if (onRegisterSuccess) {
          onRegisterSuccess();
        }
      } else {
        // Handle Laravel validation errors
        if (data.errors) {
          const fieldErrors = {};
          Object.keys(data.errors).forEach((key) => {
            // Map Laravel field names to React field names
            const reactFieldName =
              key === "first_name"
                ? "firstName"
                : key === "last_name"
                  ? "lastName"
                  : key === "password_confirmation"
                    ? "confirmPassword"
                    : key;
            fieldErrors[reactFieldName] = data.errors[key][0];
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ submit: data.message || "Registration failed" });
        }
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginClick = (e) => {
    e.preventDefault(); // Prevent form submission
    onSwitchToLogin();
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h1 className="register-title">Create Account</h1>
          <p className="register-subtitle">Sign up to get started</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-form-row">
            <div className="register-form-group">
              <label htmlFor="firstName" className="register-form-label">
                First Name
              </label>
              <div className="register-input-container">
                <User className="register-input-icon" size={18} />
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`register-form-input ${errors.firstName ? "register-error" : ""}`}
                  placeholder="Enter your first name"
                  disabled={isLoading}
                />
              </div>
              {errors.firstName && (
                <span className="register-error-message">
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className="register-form-group">
              <label htmlFor="lastName" className="register-form-label">
                Last Name
              </label>
              <div className="register-input-container">
                <User className="register-input-icon" size={18} />
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`register-form-input ${errors.lastName ? "register-error" : ""}`}
                  placeholder="Enter your last name"
                  disabled={isLoading}
                />
              </div>
              {errors.lastName && (
                <span className="register-error-message">
                  {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="register-form-group">
            <label htmlFor="email" className="register-form-label">
              Email Address
            </label>
            <div className="register-input-container">
              <Mail className="register-input-icon" size={18} />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`register-form-input ${errors.email ? "register-error" : ""}`}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <span className="register-error-message">{errors.email}</span>
            )}
          </div>

          <div className="register-form-group">
            <label htmlFor="role" className="register-form-label">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`register-form-select ${errors.role ? "register-error" : ""}`}
              disabled={isLoading}
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <span className="register-error-message">{errors.role}</span>
            )}
          </div>

          {branches.length > 0 && (
            <div className="register-form-group">
              <label htmlFor="branch_id" className="register-form-label">
                Assign to Branch
              </label>
              <select
                id="branch_id"
                name="branch_id"
                value={formData.branch_id}
                onChange={handleChange}
                className={`register-form-select ${errors.branch_id ? "register-error" : ""}`}
                disabled={isLoading}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
              {errors.branch_id && (
                <span className="register-error-message">
                  {errors.branch_id}
                </span>
              )}
            </div>
          )}

          <div className="register-form-group">
            <label htmlFor="password" className="register-form-label">
              Password
            </label>
            <div className="register-input-container">
              <Lock className="register-input-icon" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`register-form-input ${errors.password ? "register-error" : ""}`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="register-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span className="register-error-message">{errors.password}</span>
            )}
          </div>

          <div className="register-form-group">
            <label htmlFor="confirmPassword" className="register-form-label">
              Confirm Password
            </label>
            <div className="register-input-container">
              <Lock className="register-input-icon" size={18} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`register-form-input ${
                  errors.confirmPassword ? "register-error" : ""
                }`}
                placeholder="Confirm your password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="register-password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="register-error-message">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          {errors.submit && (
            <div className="register-error-message submit-error">
              {errors.submit}
            </div>
          )}

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="login-link">
          <p>
            Already have an account?{" "}
            <a
              href="#login"
              className="login-link-text"
              onClick={handleLoginClick}
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
