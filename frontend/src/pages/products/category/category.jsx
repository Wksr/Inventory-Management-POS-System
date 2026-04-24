import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import CategoryModal from "./CategoryModal";
import "./category.css";
import offlineDB from "../../../utils/offlineDB";

const Category = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const recordsPerPage = 20;

  // Fetch categories from API
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      let allCategories = [];

      if (navigator.onLine) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch("http://127.0.0.1:8000/api/categories", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              allCategories = data.categories || [];

              const existingPending = await offlineDB
                .getAllCategories()
                .then((cats) =>
                  cats.filter((c) => c.sync_status === "pending"),
                );

              for (const cat of allCategories) {
                await offlineDB.addCategory({
                  ...cat,
                  sync_status: "synced",
                  local_id: null,
                });
              }

              allCategories = [...existingPending, ...allCategories];
              console.log(
                `Merged ${existingPending.length} pending + ${allCategories.length} server`,
              );
            }
          }
        } catch (onlineErr) {
          console.warn("Online fetch failed, using cache:", onlineErr);
        }
      }

      if (allCategories.length === 0) {
        const cached = await offlineDB.getAllCategories();
        allCategories = cached.filter((cat) => cat.sync_status !== "deleted");
        toast.info("Using offline cached categories");
      }

      setCategories(allCategories);
    } catch (err) {
      // error handling
    } finally {
      setLoading(false);
    }
  };
  const handleAddCategory = () => {
    setEditingCategory(null); // Set to null for add mode
    setIsModalOpen(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category); // Set the category to edit
    setIsModalOpen(true);
  };

  const handleCategoryAdded = (newCategory, isEdit = false) => {
    if (isEdit) {
      // Update existing category
      setCategories((prev) =>
        prev.map((cat) => (cat.id === newCategory.id ? newCategory : cat)),
      );
    } else {
      // Add new category
      setCategories((prev) => [newCategory, ...prev]);
    }
  };

  const handleDelete = async (id) => {
    toast.warning("Are you sure you want to delete this category?", {
      description: "All category data will be permanently removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/categories/${id}`,
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
              setCategories(
                categories.filter((category) => category.id !== id),
              );
              toast.success("Category deleted successfully");
            } else {
              toast.error(data.message || "Failed to delete category");
            }
          } catch (error) {
            console.error("Error deleting category:", error);
            toast.error("Error deleting category");
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Delete cancelled"),
      },
    });
  };

  // Filter categories based on search
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredCategories.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentCategories = filteredCategories.slice(startIndex, endIndex);

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="category-page">
      {/* Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCategoryAdded={handleCategoryAdded}
        editingCategory={editingCategory}
      />

      <div className="category-header">
        <div className="search-box">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search category..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <button className="add-category-btn" onClick={handleAddCategory}>
          <Plus size={20} />
          Add Category
        </button>
      </div>

      {loading && <div className="loading">Loading categories...</div>}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchCategories} style={{ marginLeft: "10px" }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="category-table-container">
            <table className="category-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Product Count</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentCategories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.description || "-"}</td>
                    <td>{category.products_count || 0}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          category.is_active ? "active" : "inactive"
                        }`}
                      >
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(category.id)}
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
              {Math.min(endIndex, filteredCategories.length)} of{" "}
              {filteredCategories.length} entries
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={handlePrevious}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <span className="page-number">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={handleNext}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Category;
