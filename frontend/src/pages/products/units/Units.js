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
import AddUnitModal from "./AddUnitModal";
import EditUnitModal from "./EditUnitModal";
import "./units.css";

const Units = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [editingUnit, setEditingUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const recordsPerPage = 10;

  const filteredUnits = units.filter(
    (unit) =>
      unit.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.short_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.base_unit?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredUnits.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentUnits = filteredUnits.slice(startIndex, endIndex);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/units", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setUnits(data.units?.data || []);
      } else {
        setError(data.message || "Failed to fetch units");
      }
    } catch (error) {
      console.error("Error fetching units:", error);
      setError("Failed to fetch units: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
  };

  const handleUnitUpdated = (updatedUnit) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === updatedUnit.id ? updatedUnit : u)),
    );
    setEditingUnit(null);
  };

  const handleDelete = async (unit) => {
    toast.warning(`Delete "${unit.name}"?`, {
      description: "All unit data will be permanently removed.",
      duration: 10000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(
              `http://127.0.0.1:8000/api/units/${unit.id}`,
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
              setUnits((prev) => prev.filter((u) => u.id !== unit.id));
              toast.success("Unit deleted successfully!");
            } else {
              throw new Error(data.message || "Failed to delete unit");
            }
          } catch (error) {
            console.error("Error deleting unit:", error);
            toast.error("Failed to delete unit: " + error.message);
          }
        },
      },
      cancel: {
        label: "Cancel",
      },
    });
  };

  const handleAddUnit = (newUnit) => {
    setUnits((prev) => [newUnit, ...prev]);
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

  if (loading) {
    return (
      <div className="units-page">
        <div className="loading">Loading units...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="units-page">
        <div className="error-message">Error: {error}</div>
        <button onClick={fetchUnits} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="units-page">
      <AddUnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onUnitAdded={handleAddUnit}
      />
      <EditUnitModal
        isOpen={!!editingUnit}
        onClose={() => setEditingUnit(null)}
        onUnitUpdated={handleUnitUpdated}
        unit={editingUnit}
      />
      <div className="units-header">
        <div className="header-left">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search units..."
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
          <button
            className="add-unit-btn"
            onClick={() => setIsUnitModalOpen(true)}
          >
            <Plus size={20} />
            <span className="btn-text">Add Unit</span>
          </button>
        </div>
      </div>

      <div className="units-table-container">
        <table className="units-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Short Name</th>
              <th>Base Unit</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentUnits.length > 0 ? (
              currentUnits.map((unit) => (
                <tr key={unit.id}>
                  <td data-label="Name">{unit.name}</td>
                  <td data-label="Short Name">
                    <span className="short-name-badge">{unit.short_name}</span>
                  </td>
                  <td data-label="Base Unit">
                    {unit.base_unit || "No Base Unit"}
                  </td>
                  <td data-label="Action">
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(unit)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(unit)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="no-data">
                  No units found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredUnits.length > 0 && (
        <div className="table-footer">
          <div className="pagination-info">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredUnits.length)} of {filteredUnits.length}{" "}
            entries
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

export default Units;
