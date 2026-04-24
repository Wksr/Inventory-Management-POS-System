import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import BranchForm from "./BranchForm";
import "./BranchManagement.css";

const BranchManagement = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Fetch user role on component mount
  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    setUserRole(user.role || "");
  }, []);

  // Check if user is admin
  const isAdmin = userRole === "admin";

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/branches", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.branches) {
        setBranches(data.branches);
        toast.success("Branches loaded successfully");
      } else {
        setBranches(data || []);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branches: " + error.message);
      setBranches(getSampleBranches());
    } finally {
      setLoading(false);
    }
  }, []); // Add dependencies if needed

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Sample data for development
  const getSampleBranches = () => [
    {
      id: 1,
      name: "Main Branch",
      code: "MB01",
      address: "123 Main St, Colombo 03",
      phone: "0112345678",
      email: "main@store.com",
      is_active: true,
      is_default: true,
    },
  ];

  // Handle branch creation (Admin only)
  const handleCreateBranch = async (branchData) => {
    if (!isAdmin) {
      toast.error("Only administrators can create branches");
      return;
    }

    setIsCreatingBranch(true);
    try {
      const token = localStorage.getItem("authToken");

      const response = await fetch("http://127.0.0.1:8000/api/branches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(branchData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`,
        );
      }

      if (data.success && data.branch) {
        setBranches((prev) => [...prev, data.branch]);
        setShowBranchForm(false);
        toast.success(`Branch "${data.branch.name}" created successfully`);
        return data.branch;
      } else {
        throw new Error(data.message || "Failed to create branch");
      }
    } catch (error) {
      console.error("Error creating branch:", error);

      // Handle validation errors
      if (error.message.includes("Validation")) {
        toast.error("Please check the form data and try again");
      } else if (error.message.includes("Unauthorized")) {
        toast.error("You don't have permission to create branches");
      } else {
        toast.error(error.message || "Failed to create branch");
      }

      throw error;
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Handle branch editing (Admin only)
  const handleEditBranch = (branch) => {
    if (!isAdmin) {
      toast.error("Only administrators can edit branches");
      return;
    }

    setEditingBranch(branch);
    setShowBranchForm(true);
  };

  // Handle branch update (Admin only)
  const handleUpdateBranch = async (branchData) => {
    if (!editingBranch || !isAdmin) {
      toast.error("Only administrators can update branches");
      return;
    }

    setIsCreatingBranch(true);
    try {
      const token = localStorage.getItem("authToken");

      const response = await fetch(
        `http://127.0.0.1:8000/api/branches/${editingBranch.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(branchData),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`,
        );
      }

      if (data.success && data.branch) {
        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === editingBranch.id ? data.branch : branch,
          ),
        );
        setShowBranchForm(false);
        setEditingBranch(null);
        toast.success(`Branch "${data.branch.name}" updated successfully`);
        return data.branch;
      } else {
        throw new Error(data.message || "Failed to update branch");
      }
    } catch (error) {
      console.error("Error updating branch:", error);

      // Handle validation errors
      if (error.message.includes("Validation")) {
        toast.error("Please check the form data and try again");
      } else if (error.message.includes("Unauthorized")) {
        toast.error("You don't have permission to update branches");
      } else {
        toast.error(error.message || "Failed to update branch");
      }

      throw error;
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Handle branch deletion (Admin only)
  const handleDeleteBranch = (branchId) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete branches");
      return;
    }

    const branchToDelete = branches.find((branch) => branch.id === branchId);
    if (!branchToDelete) {
      toast.error("Branch not found");
      return;
    }

    // Show confirmation toast
    toast.warning(`Delete ${branchToDelete.name}?`, {
      description: "This branch will be permanently removed from the system.",
      duration: 5000,
      action: {
        label: "Delete",
        onClick: async () => {
          setIsDeleting(true);
          try {
            const token = localStorage.getItem("authToken");

            const response = await fetch(
              `http://127.0.0.1:8000/api/branches/${branchId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                },
              },
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.message || `HTTP error! status: ${response.status}`,
              );
            }

            if (data.success) {
              setBranches((prev) =>
                prev.filter((branch) => branch.id !== branchId),
              );
              toast.success(`${branchToDelete.name} deleted successfully`);
            } else {
              throw new Error(data.message || "Failed to delete branch");
            }
          } catch (error) {
            console.error("Error deleting branch:", error);

            if (error.message.includes("Unauthorized")) {
              toast.error("You don't have permission to delete branches");
            } else if (error.message.includes("Cannot delete")) {
              toast.error(
                "Cannot delete this branch. It may have active records or users assigned.",
              );
            } else {
              toast.error("Failed to delete branch: " + error.message);
            }
          } finally {
            setIsDeleting(false);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Branch deletion cancelled"),
      },
    });
  };

  // Handle form submission (create or update)
  const handleFormSubmit = async (formData) => {
    if (editingBranch) {
      return await handleUpdateBranch(formData);
    } else {
      return await handleCreateBranch(formData);
    }
  };

  // Handle form close
  const handleFormClose = () => {
    setShowBranchForm(false);
    setEditingBranch(null);
  };

  // Render loading state
  const renderLoading = () => (
    <div className="loading-state">
      <div className="spinner"></div>
      <p>Loading branches...</p>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="empty-state">
      <Building2 size={48} className="empty-icon" />
      <h3>No branches found</h3>
      <p>
        {isAdmin
          ? "Start by adding your first branch"
          : "No branches available"}
      </p>
    </div>
  );

  // Render branches table
  const renderBranchesTable = () => (
    <div className="table-wrapper">
      <table className="branches-table">
        <thead>
          <tr>
            <th>Branch Name</th>
            <th>Code</th>
            <th>Users</th>
            <th>Address</th>
            <th>Contact</th>
            <th>Status</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id}>
              <td>
                <div className="branch-info">
                  <div className="branch-name">
                    {branch.name}
                    {branch.is_default && (
                      <span className="default-badge">Default</span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <div className="branch-code">{branch.code}</div>
              </td>
              <td>
                <div className="users-count">
                  <span
                    className={`user-badge ${
                      branch.users_count > 0 ? "has-users" : "no-users"
                    }`}
                  >
                    {branch.users_count || 0}
                  </span>
                </div>
              </td>
              <td>
                <div className="branch-address">{branch.address || "-"}</div>
              </td>
              <td>
                <div className="contact-info">
                  {branch.phone && (
                    <div className="contact-phone">{branch.phone}</div>
                  )}
                  {branch.email && (
                    <div className="contact-email">{branch.email}</div>
                  )}
                </div>
              </td>
              <td>
                <span
                  className={`status-badge ${
                    branch.is_active ? "active" : "inactive"
                  }`}
                >
                  {branch.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              {isAdmin && (
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEditBranch(branch)}
                      title="Edit Branch"
                      disabled={isDeleting}
                    >
                      <Edit size={16} />
                    </button>
                    {!branch.is_default && (
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteBranch(branch.id)}
                        title="Delete Branch"
                        disabled={isDeleting}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="branch-management">
      <div className="management-header">
        <div className="header-content">
          <h1>Branch Management</h1>
          {/* <p className="header-description">
            {isAdmin
              ? "Manage all your business branches in one place"
              : "View your accessible branches"}
          </p> */}
        </div>
        {isAdmin && (
          <button
            className="add-branch-btn"
            onClick={() => setShowBranchForm(true)}
            disabled={isCreatingBranch || isDeleting}
          >
            <Plus size={20} />
            <span>Add Branch</span>
          </button>
        )}
      </div>

      <div className="management-content">
        {loading
          ? renderLoading()
          : branches.length === 0
            ? renderEmptyState()
            : renderBranchesTable()}
      </div>

      {/* Branch Form Modal (Admin only) */}
      {showBranchForm && isAdmin && (
        <BranchForm
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          isSubmitting={isCreatingBranch}
          initialData={editingBranch}
          isEditing={!!editingBranch}
        />
      )}
    </div>
  );
};

export default BranchManagement;
