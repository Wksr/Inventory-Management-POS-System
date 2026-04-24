import React, { useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./login.css";

const Login = ({ onSwitchToRegister, onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
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
    setErrors({});

    try {
      const response = await fetch("http://127.0.0.1:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();
      console.log("Login Response:", data);
      console.log("Response OK:", response.ok);

      if (response.ok) {
        // Login successful
        console.log("Token received:", data.token);
        console.log("User data:", data.user);

        // Store in sessionStorage
        sessionStorage.setItem("authToken", data.token);
        sessionStorage.setItem("user", JSON.stringify(data.user));

        // Update auth context
        login(data.token, data.user);

        console.log("Token stored:", sessionStorage.getItem("authToken"));

        // IMPORTANT: Add a small delay and force reload to ensure state updates
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(data.user);
          }
          // Force reload to ensure all components get the updated auth state
          window.location.reload();
        }, 100);
      } else {
        if (response.status === 401) {
          setErrors({ submit: "Invalid email or password" });
        } else if (data.errors) {
          const fieldErrors = {};
          Object.keys(data.errors).forEach((key) => {
            fieldErrors[key] = data.errors[key][0];
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ submit: data.message || "Login failed" });
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterClick = (e) => {
    e.preventDefault();
    onSwitchToRegister();
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-group">
            <label htmlFor="email" className="login-form-label">
              Email Address
            </label>
            <div className="login-input-container">
              <Mail className="login-input-icon" size={18} />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={` login-form-input ${errors.email ? "login-error" : ""}`}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          <div className="login-form-group">
            <label htmlFor="password" className="login-form-label">
              Password
            </label>
            <div className="login-input-container">
              <Lock className="login-input-icon" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`login-form-input ${errors.password ? "login-error" : ""}`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="register-link">
          <p>
            Don't have an account?{" "}
            <a
              href="#register"
              className="register-link-text"
              onClick={handleRegisterClick}
            >
              Register
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
