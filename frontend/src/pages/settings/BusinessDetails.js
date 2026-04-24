import React, { useState, useEffect } from "react";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Save,
  Edit,
  Upload,
  Image,
} from "lucide-react";
import { toast } from "sonner";
import "./BusinessDetails.css";

const BusinessDetails = () => {
  const [businessData, setBusinessData] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    is_active: true,
    logo: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  // Fetch business details
  useEffect(() => {
    fetchBusinessDetails();
  }, []);

  const fetchBusinessDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/business", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setBusinessData(data.business);
        if (data.business.logo_url) {
          setLogoPreview(data.business.logo_url);
        } else if (data.business.logo) {
          setLogoPreview(`http://127.0.0.1:8000/storage/${data.business.logo}`);
        }
      } else {
        // If no business exists, show empty form
        toast.info(
          "No business details found. Please add your business information.",
        );
      }
    } catch (error) {
      console.error("Error fetching business details:", error);
      toast.error("Failed to load business details");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBusinessData({
      ...businessData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast.error("Logo file is too large (max 5MB)");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!businessData.name.trim()) {
      toast.error("Business name is required");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("authToken");

      // 1. First update business details with JSON
      const payload = {
        name: businessData.name,
        email: businessData.email || null,
        phone: businessData.phone || null,
        address: businessData.address || null,
        is_active: businessData.is_active,
      };

      console.log("Updating business with:", payload);

      const response = await fetch(
        `http://127.0.0.1:8000/api/business/${businessData.id || ""}`,
        {
          method: businessData.id ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      console.log("Business update response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to update business");
      }

      // 2. If logo exists, upload it separately
      if (logoFile && data.success && data.business.id) {
        console.log("Uploading logo separately...");
        const logoResponse = await uploadLogo(data.business.id, logoFile);

        if (logoResponse.success) {
          data.business.logo_url = logoResponse.logo_url;
          data.business.logo = logoResponse.logo_path;
          toast.success("Logo uploaded!");
        }
      }

      if (data.success) {
        toast.success("Business details updated!");
        setBusinessData(data.business);
        setIsEditing(false);
        if (data.business.logo_url) {
          setLogoPreview(data.business.logo_url);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to save business details");
    } finally {
      setSaving(false);
    }
  };

  // Separate function for logo upload
  const uploadLogo = async (businessId, file) => {
    const token = localStorage.getItem("authToken");
    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch(
      `http://127.0.0.1:8000/api/business/${businessId}/logo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      },
    );

    return response.json();
  };
  if (loading) {
    return (
      <div className="business-details-loading">
        <div className="loading-spinner"></div>
        <p>Loading business details...</p>
      </div>
    );
  }

  return (
    <div className="business-details">
      <div className="business-header">
        <div className="header-left">
          <Building2 size={24} />
          <h2>Business Details</h2>
        </div>
        <div className="header-actions">
          {!isEditing ? (
            <button className="btn-edit" onClick={() => setIsEditing(true)}>
              <Edit size={18} />
              Edit Details
            </button>
          ) : (
            <button
              className="btn-cancel"
              onClick={() => {
                setIsEditing(false);
                fetchBusinessDetails(); // Reset to original data
              }}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="business-form">
        <div className="form-content">
          {/* Left Column - Logo & Basic Info */}
          <div className="form-left">
            <div className="logo-section">
              <div className="logo-preview">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Business Logo"
                    className="logo-image"
                  />
                ) : (
                  <div className="logo-placeholder">
                    <Image size={48} />
                    <span>No Logo</span>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="logo-upload">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="logo-input"
                  />
                  <label htmlFor="logo-upload" className="btn-upload">
                    <Upload size={16} />
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      className="btn-remove-logo"
                      onClick={() => {
                        setLogoPreview("");
                        setLogoFile(null);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="business-form-group">
              <label htmlFor="name">
                <Building2 size={16} />
                Business Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={businessData.name}
                onChange={handleInputChange}
                disabled={!isEditing || saving}
                placeholder="Enter business name"
                required
              />
            </div>

            <div className="business-form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={businessData.is_active}
                  onChange={handleInputChange}
                  disabled={!isEditing || saving}
                />
                <span className="checkbox-label">Active Business</span>
              </label>
            </div>
          </div>

          {/* Right Column - Contact Details */}
          <div className="form-right">
            <div className="business-form-group">
              <label htmlFor="phone">
                <Phone size={16} />
                Phone Number
              </label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={businessData.phone || ""}
                onChange={handleInputChange}
                disabled={!isEditing || saving}
                placeholder="Enter phone number"
              />
            </div>

            <div className="business-form-group">
              <label htmlFor="email">
                <Mail size={16} />
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={businessData.email || ""}
                onChange={handleInputChange}
                disabled={!isEditing || saving}
                placeholder="Enter email address"
              />
            </div>

            <div className="business-form-group">
              <label htmlFor="address">
                <MapPin size={16} />
                Address
              </label>
              <textarea
                id="address"
                name="address"
                value={businessData.address || ""}
                onChange={handleInputChange}
                disabled={!isEditing || saving}
                placeholder="Enter business address"
                rows="4"
              />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="form-footer">
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>

      {/* View Mode Display
      {!isEditing && (
        <div className="business-info-display">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Business Name:</span>
              <span className="info-value">
                {businessData.name || "Not set"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span
                className={`status-badge ${
                  businessData.is_active ? "active" : "inactive"
                }`}
              >
                {businessData.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Phone:</span>
              <span className="info-value">
                {businessData.phone || "Not set"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">
                {businessData.email || "Not set"}
              </span>
            </div>
            <div className="info-item full-width">
              <span className="info-label">Address:</span>
              <span className="info-value">
                {businessData.address || "Not set"}
              </span>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default BusinessDetails;
