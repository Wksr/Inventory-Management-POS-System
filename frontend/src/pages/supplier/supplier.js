import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import AddSupplierModal from "./AddSupplierModal";
import EditSupplierModal from "./EditSupplierModal";
import "./supplier.css";

const Supplier = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState({
    data: [],
    current_page: 1,
    last_page: 1,
    total: 0,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const recordsPerPage = 20;
  const filterRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Date filtering function
  const filterSuppliersByDate = (suppliers) => {
    if (!dateFilter) return suppliers;

    const now = new Date();

    switch (dateFilter) {
      case "today":
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return suppliers.filter((supplier) => {
          if (!supplier.created_at) return false;
          const supplierDate = new Date(supplier.created_at);
          return supplierDate >= today && supplierDate < tomorrow;
        });

      case "thisweek":
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return suppliers.filter((supplier) => {
          if (!supplier.created_at) return false;
          const supplierDate = new Date(supplier.created_at);
          return supplierDate >= startOfWeek && supplierDate < endOfWeek;
        });

      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return suppliers.filter((supplier) => {
          if (!supplier.created_at) return false;
          const supplierDate = new Date(supplier.created_at);
          return supplierDate >= startOfMonth && supplierDate <= endOfMonth;
        });

      case "custom":
        if (customDateStart && customDateEnd) {
          const startDate = new Date(customDateStart);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(customDateEnd);
          endDate.setHours(23, 59, 59, 999);
          return suppliers.filter((supplier) => {
            if (!supplier.created_at) return false;
            const supplierDate = new Date(supplier.created_at);
            return supplierDate >= startDate && supplierDate <= endDate;
          });
        }
        return suppliers;

      default:
        return suppliers;
    }
  };

  // Combine search and date filtering
  const filteredSuppliers = filterSuppliersByDate(suppliers.data).filter(
    (supplier) =>
      supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.phone?.includes(searchQuery) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredSuppliers.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentSuppliers = filteredSuppliers.slice(startIndex, endIndex);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/suppliers", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSuppliers(
          data.suppliers || {
            data: [],
            current_page: 1,
            last_page: 1,
            total: 0,
          },
        );
      } else {
        setError(data.message || "Failed to fetch suppliers");
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setError("Failed to fetch suppliers: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
  };

  const handleSupplierUpdated = (updatedSupplier) => {
    setSuppliers((prev) => ({
      ...prev,
      data: prev.data.map((s) =>
        s.id === updatedSupplier.id ? updatedSupplier : s,
      ),
    }));
    setEditingSupplier(null);
  };

  const handleDelete = async (supplier) => {
    toast.warning(`delete "${supplier.id}"?`, {
      description: "All Supplier data will be permanently removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/suppliers/${supplier.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            const data = await response.json();

            if (data.success) {
              setSuppliers((prev) => ({
                ...prev,
                data: prev.data.filter((s) => s.id !== supplier.id),
                total: prev.total - 1,
              }));
              toast.success("Supplier deleted successfully!");
            } else {
              throw new Error(data.message || "Failed to delete supplier");
            }
          } catch (error) {
            console.error("Error deleting supplier:", error);
            toast.error("Failed to delete supplier: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleAddSupplier = () => {
    setIsSupplierModalOpen(true);
  };

  const handleSupplierAdded = (newSupplier) => {
    setSuppliers((prev) => ({
      ...prev,
      data: [newSupplier, ...prev.data],
      total: prev.total + 1,
    }));
  };

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

  const handleFilterSelect = (filter) => {
    setDateFilter(filter);
    setShowFilterDropdown(false);
    setCurrentPage(1);

    if (filter === "custom") {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
    }
  };

  if (loading) {
    return (
      <div className="supplier-page">
        <div className="loading">Loading suppliers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="supplier-page">
        <div className="error-message">Error: {error}</div>
        <button onClick={fetchSuppliers} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="supplier-page">
      <AddSupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSupplierAdded={handleSupplierAdded}
      />
      <EditSupplierModal
        isOpen={!!editingSupplier}
        onClose={() => setEditingSupplier(null)}
        onSupplierUpdated={handleSupplierUpdated}
        supplier={editingSupplier}
      />

      <div className="supplier-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search suppliers..."
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
          <div className="supplier-filter-container" ref={filterRef}>
            <button
              className="supplier-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="supplier-filter-dropdown">
                <button
                  className="supplier-filter-option"
                  onClick={() => handleFilterSelect("all")}
                >
                  All
                </button>
                <button
                  className="supplier-filter-option"
                  onClick={() => handleFilterSelect("today")}
                >
                  Today
                </button>
                <button
                  className="supplier-filter-option"
                  onClick={() => handleFilterSelect("thisweek")}
                >
                  This Week
                </button>
                <button
                  className="supplier-filter-option"
                  onClick={() => handleFilterSelect("month")}
                >
                  Month
                </button>
                <button
                  className="supplier-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          <button className="add-supplier-btn" onClick={handleAddSupplier}>
            <Plus size={20} />
            <span className="btn-text">Add Supplier</span>
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="supplier-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="supplier-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="supplier-date-input"
          />
        </div>
      )}

      <div className="supplier-table-container">
        <table className="supplier-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentSuppliers.length > 0 ? (
              currentSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td data-label="Name">{supplier.name}</td>
                  <td data-label="Company">{supplier.company}</td>
                  <td data-label="Phone">{supplier.phone}</td>
                  <td data-label="Email">{supplier.email}</td>
                  <td data-label="Action">
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(supplier)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data">
                  No suppliers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredSuppliers.length > 0 && (
        <div className="table-footer">
          <div className="pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredSuppliers.length)} of{" "}
            {filteredSuppliers.length} entries
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
      )}
    </div>
  );
};

export default Supplier;
