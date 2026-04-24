import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  X,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import EditUserModal from "./EditUserModal";
import Register from "../../components/auth/register";
import "./user.css";

const User = ({ currentBranch }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const recordsPerPage = 20;

  // Use the auth context
  const { token, isAuthenticated } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔑 Auth Token from context:", token);
      console.log("🔍 Is authenticated:", isAuthenticated);
      console.log("📋 Full auth context:", { token, isAuthenticated });

      // Check if we have a valid token
      if (!token) {
        setError("No authentication token available. Please login again.");
        setLoading(false);
        setInitialLoad(false);
        return;
      }

      const response = await fetch("http://127.0.0.1:8000/api/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      console.log("📡 Users API Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Users data received:", data);
        setUsers(data.users || data.data || []);
      } else if (response.status === 401) {
        setError("Authentication failed. Please login again.");
        // Don't clear localStorage here, let the AuthProvider handle it
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch users");
      }
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      setError(error.message);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/branches", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (data.success) {
          setBranches(data.branches);
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };

    if (token) {
      fetchBranches();
    }
  }, [token]);

  // Handle Edit Button Click
  const handleEdit = (user) => {
    setEditingUser(user);
    setIsEditModalOpen(true);
  };

  // Handle User Update
  const handleUserUpdate = (updatedUser) => {
    // Update the user in the local state
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  };

  // Fetch users when component mounts and when auth state changes
  useEffect(() => {
    console.log("🔄 User component auth state changed:", {
      token,
      isAuthenticated,
    });

    if (isAuthenticated && token) {
      console.log("✅ Fetching users with token:", token);
      fetchUsers();
    } else if (isAuthenticated && !token) {
      console.log("❌ Auth issue: isAuthenticated=true but token is undefined");
      setError("Authentication token is missing. Please login again.");
      setInitialLoad(false);
    } else {
      console.log("❌ Not authenticated, skipping user fetch");
      setInitialLoad(false);
    }
  }, [isAuthenticated, token, fetchUsers]);

  // Rest of your component remains the same...
  const handleDelete = async (id) => {
    toast.warning("Are you sure you want to delete this user?", {
      description: "All user data will be permanently removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const response = await fetch(
              `http://127.0.0.1:8000/api/users/${id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (response.ok) {
              setUsers(users.filter((user) => user.id !== id));
              toast.success("User deleted successfully");
            } else {
              throw new Error(data.message || "Failed to delete user");
            }
          } catch (error) {
            console.error("Error deleting user:", error);
            toast.error(`Error: ${error.message}`);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Delete cancelled"),
      },
    });
  };

  const handleAddUser = () => {
    setIsRegisterModalOpen(true);
  };
  const handleRegisterSuccess = () => {
    setIsRegisterModalOpen(false);
    fetchUsers(); // Refresh user list
    toast.success("User added successfully");
  };

  const handleRetry = () => {
    fetchUsers();
  };

  // Search and pagination
  const filteredUsers = users.filter(
    (user) =>
      `${user.first_name} ${user.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredUsers.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const getFullName = (user) => {
    return `${user.first_name} ${user.last_name}`;
  };

  if (initialLoad) {
    return (
      <div className="user-page">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="user-page">
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={editingUser}
        onUpdate={handleUserUpdate}
      />

      {/* Register Modal */}
      {isRegisterModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsRegisterModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button
                className="modal-close"
                onClick={() => setIsRegisterModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <Register
                onSuccess={handleRegisterSuccess}
                onCancel={() => setIsRegisterModalOpen(false)}
                branches={branches} // Pass branches
                defaultBranchId={currentBranch?.id}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={handleRetry} style={{ marginLeft: "10px" }}>
            Retry
          </button>
        </div>
      )}

      <div className="user-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="header-right">
          <button className="add-user-btn" onClick={handleAddUser}>
            <Plus size={20} />
            <span className="btn-text">Add User</span>
          </button>
        </div>
      </div>

      {!loading && users.length === 0 && !error && (
        <div className="no-users">
          <p>No users found.</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <>
          <div className="user-table-container">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Name">{getFullName(user)}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <span className={`role-badge ${user.role.toLowerCase()}`}>
                        {user.role}
                      </span>
                    </td>
                    <td data-label="Branch">
                      {/* Display branch information */}
                      {user.primary_branch ? (
                        <div className="branch-info">
                          <span className="branch-name">
                            {user.primary_branch.name}
                          </span>
                          {user.primary_branch.code && (
                            <span className="branch-code">
                              {user.primary_branch.code}
                            </span>
                          )}
                        </div>
                      ) : user.branches && user.branches.length > 0 ? (
                        // If using branches array instead of primary_branch
                        <div className="branch-info">
                          <span className="branch-name">
                            {user.branches[0].name}
                          </span>
                          {user.branches[0].code && (
                            <span className="branch-code">
                              {user.branches[0].code}
                            </span>
                          )}
                          {user.branches.length > 1 && (
                            <span
                              className="branch-count"
                              title={`${user.branches.length} branches`}
                            >
                              +{user.branches.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="no-branch">Not Assigned</span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`status-badge ${
                          user.is_active ? "active" : "inactive"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td data-label="Action">
                      <div className="action-buttons">
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="pagination-info">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredUsers.length)} of{" "}
              {filteredUsers.length} entries
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={handlePrevious}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
                <span className="btn-text">Previous</span>
              </button>
              <span className="page-number">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={handleNext}
                disabled={currentPage === totalPages}
              >
                <span className="btn-text">Next</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default User;
