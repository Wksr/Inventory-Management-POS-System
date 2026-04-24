import React, { useState, useEffect, useCallback, useRef } from "react";
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
import "./customer.css";
import AddCustomerModal from "./AddCustomerModal";
import EditCustomerModal from "./EditCustomerModal";

const Customer = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [isCustomerModelOpen, setIsCustomerModelOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/customers", {
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
        setCustomers(data.customers?.data || data.customers || []);
      } else {
        throw new Error(data.message || "Failed to fetch customers");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to fetch customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Date filter function
  const filterCustomersByDate = (customers) => {
    if (!dateFilter || customers.length === 0) return customers;

    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "thisweek":
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        startDate = startOfWeek;
        endDate = endOfWeek;
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        break;
      case "custom":
        if (customDateStart && customDateEnd) {
          startDate = new Date(customDateStart);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customDateEnd);
          endDate.setHours(23, 59, 59, 999);
        } else {
          return customers;
        }
        break;
      default:
        return customers;
    }

    return customers.filter((customer) => {
      const customerDate = customer.created_at
        ? new Date(customer.created_at)
        : customer.date
          ? new Date(customer.date)
          : new Date();

      return customerDate >= startDate && customerDate <= endDate;
    });
  };

  // Filter customers
  const filteredCustomers = customers
    .filter(
      (customer) =>
        customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .filter((customer) => {
      if (!dateFilter || dateFilter === "all") return true;

      if (dateFilter === "custom" && (!customDateStart || !customDateEnd)) {
        return true;
      }

      return filterCustomersByDate([customer]).length > 0;
    });

  const totalPages = Math.ceil(filteredCustomers.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  const handleEdit = (id) => {
    setEditingCustomerId(id);
    setIsEditModalOpen(true);
  };

  const handleCustomerUpdated = (updatedCustomer) => {
    setCustomers((prevCustomers) =>
      prevCustomers.map((customer) =>
        customer.id === updatedCustomer.id ? updatedCustomer : customer,
      ),
    );
    toast.success("Customer updated successfully!");
  };

  const handleDelete = async (customer) => {
    toast.warning(`Delete "${customer.name}"?`, {
      description: "All Customer data will be permanently removed.",
      duration: 2500,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/customers/${customer.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            // Check if response is HTML (error page)
            const contentType = response.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
              // Server returned HTML instead of JSON
              const text = await response.text();
              console.error("Server returned HTML:", text);

              if (response.status === 404) {
                toast.error("Customer not found or already deleted");
              } else if (response.status === 401) {
                toast.error("Session expired. Please login again.");
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
              } else {
                toast.error(`Server error (${response.status})`);
              }
              return;
            }

            const data = await response.json();

            if (data.success) {
              setCustomers((prevCustomers) =>
                prevCustomers.filter((c) => c.id !== customer.id),
              );
              toast.success("Customer deleted successfully!");
            } else {
              throw new Error(data.message || "Failed to delete customer");
            }
          } catch (error) {
            console.error("Error deleting customer:", error);
            toast.error("Failed to delete customer: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleAddCustomer = () => {
    setIsCustomerModelOpen(true);
  };

  const handleCustomerAdded = (newCustomer) => {
    setCustomers((prevCustomers) => [newCustomer, ...prevCustomers]);
    setIsCustomerModelOpen(false);
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
    if (filter === "custom") {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
      setCustomDateStart("");
      setCustomDateEnd("");
    }
    setCurrentPage(1);
  };

  return (
    <div className="customer-page">
      <AddCustomerModal
        isOpen={isCustomerModelOpen}
        onClose={() => setIsCustomerModelOpen(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customerId={editingCustomerId}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <div className="customer-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search customers..."
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
          <div className="customer-filter-container" ref={filterRef}>
            <button
              className="customer-filter-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <Filter size={18} />
              Filter
            </button>
            {showFilterDropdown && (
              <div className="customer-filter-dropdown">
                <button
                  className="customer-filter-option"
                  onClick={() => handleFilterSelect("")}
                >
                  All
                </button>
                <button
                  className="customer-filter-option"
                  onClick={() => handleFilterSelect("today")}
                >
                  Today
                </button>
                <button
                  className="customer-filter-option"
                  onClick={() => handleFilterSelect("thisweek")}
                >
                  This Week
                </button>
                <button
                  className="customer-filter-option"
                  onClick={() => handleFilterSelect("month")}
                >
                  Month
                </button>
                <button
                  className="customer-filter-option"
                  onClick={() => handleFilterSelect("custom")}
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          <button className="add-customer-btn" onClick={handleAddCustomer}>
            <Plus size={20} />
            Add Customer
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="customer-custom-date-container">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="customer-date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="customer-date-input"
          />
        </div>
      )}

      <div className="customer-table-container">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Loyalty Point</th>
              <th>Email</th>
              <th>Branch</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="loading-cell">
                  <div>Loading...</div>
                </td>
              </tr>
            ) : currentCustomers.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data-cell">
                  No customers found
                </td>
              </tr>
            ) : (
              currentCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>
                    <span className="loyalty-badge">
                      {customer.loyalty_points || 0} pts
                    </span>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.branch?.name}</td>
                  <td>
                    {customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(customer.id)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(customer)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="pagination-info">
          Showing {startIndex + 1} to{" "}
          {Math.min(endIndex, filteredCustomers.length)} of{" "}
          {filteredCustomers.length} entries
        </div>
        <div className="pagination-buttons">
          <button
            className="pagination-btn"
            onClick={handlePrevious}
            disabled={currentPage === 1 || loading}
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
            disabled={currentPage === totalPages || loading}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Customer;
