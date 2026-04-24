import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Circle, Building, LogOut, Settings } from "lucide-react";
import "./Navbar.css";
import AddCustomerModal from "../../pages/customer/AddCustomerModal";
import AddSupplierModal from "../../pages/supplier/AddSupplierModal";

const Navbar = ({
  storeName = "My Store",
  pageTitle = "Dashboard",
  onPOSClick,
  userName,
  userRole,
  onLogout,
  branches = [],
  currentBranch = null,
  onBranchChange,
  onSettingsClick,
}) => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const branchDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const addDropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close branch dropdown if clicked outside
      if (
        showBranchDropdown &&
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target)
      ) {
        setShowBranchDropdown(false);
      }

      // Close profile dropdown if clicked outside
      if (
        showProfileDropdown &&
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setShowProfileDropdown(false);
      }

      // Close add dropdown if clicked outside
      if (
        showAddDropdown &&
        addDropdownRef.current &&
        !addDropdownRef.current.contains(event.target)
      ) {
        setShowAddDropdown(false);
      }
    };
    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBranchDropdown, showProfileDropdown, showAddDropdown]);

  const formatDate = (date) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleMaximize = () => {
    if (!isMaximized) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsMaximized(!isMaximized);
  };

  const handleAddCustomer = () => {
    setShowAddDropdown(false);
    setShowAddCustomerModal(true);
  };

  const handleAddSupplier = () => {
    setShowAddDropdown(false);
    setShowAddSupplierModal(true);
  };

  const handleAddOther = () => {
    setShowAddDropdown(false);
    console.log("Add Other clicked");
  };

  const handleLogoutClick = () => {
    setShowProfileDropdown(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleSettingsClick = () => {
    setShowProfileDropdown(false);
    if (onSettingsClick) {
      onSettingsClick();
    }
  };

  const handleBranchSelect = (branch) => {
    setShowBranchDropdown(false);
    if (onBranchChange && branch.id !== currentBranch?.id) {
      onBranchChange(branch);
    }
  };

  const getStatusColor = (role) => {
    switch (role) {
      case "admin":
        return "green";
      case "manager":
        return "amber";
      case "cashier":
        return "blue";
      default:
        return "gray";
    }
  };

  const formatRoleName = (role) => {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";
  };

  // Get current branch display name
  const getCurrentBranchName = () => {
    if (!currentBranch) return storeName;
    return currentBranch.name || `Branch ${currentBranch.id}`;
  };

  // Get current branch code
  const getCurrentBranchCode = () => {
    if (!currentBranch) return "";
    return (
      currentBranch.code ||
      currentBranch.name?.substring(0, 2).toUpperCase() ||
      ""
    );
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Combined Store Name/Branch Name with Dropdown */}
        <div className="store-branch-container" ref={branchDropdownRef}>
          <button
            className="store-branch-button"
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
          >
            <div className="store-branch-content">
              <Building size={20} className="store-branch-icon" />
              <div className="store-branch-info">
                <div className="store-name">{storeName}</div>
                <div className="branch-display">
                  <span className="branch-name">{getCurrentBranchName()}</span>
                  {getCurrentBranchCode() && (
                    <span className="branch-code">
                      {getCurrentBranchCode()}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`dropdown-arrow ${
                  showBranchDropdown ? "rotate" : ""
                }`}
              />
            </div>
          </button>

          {showBranchDropdown && branches.length > 0 && (
            <div className="dropdown-menu branch-dropdown">
              <div className="dropdown-divider"></div>
              <div className="branch-list">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    className={`dropdown-item branch-item ${
                      currentBranch?.id === branch.id ? "active" : ""
                    }`}
                    onClick={() => handleBranchSelect(branch)}
                  >
                    <div className="branch-item-content">
                      <div className="branch-item-name">{branch.name}</div>
                      <div className="branch-item-code">
                        {branch.code ||
                          branch.name?.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    {currentBranch?.id === branch.id && (
                      <div className="branch-active-indicator"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="add-button-container" ref={addDropdownRef}>
          <button
            className="add-button"
            onClick={() => setShowAddDropdown(!showAddDropdown)}
          >
            <span className="add-icon">+</span>
          </button>

          {showAddDropdown && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={handleAddCustomer}>
                Add Customer
              </button>
              <button className="dropdown-item" onClick={handleAddSupplier}>
                Add Supplier
              </button>
              <button className="dropdown-item" onClick={handleAddOther}>
                Add Other
              </button>
            </div>
          )}
        </div>

        <div className="page-title">{pageTitle}</div>
      </div>

      <div className="navbar-right">
        <div className="datetime-display">
          <span className="date-text">{formatDate(currentDateTime)}</span>
          <span className="time-text">{formatTime(currentDateTime)}</span>
        </div>

        <button className="pos-button" onClick={onPOSClick}>
          POS
        </button>

        <button className="maximize-button" onClick={handleMaximize}>
          {isMaximized ? "⊡" : "□"}
        </button>

        <div className="profile-container" ref={profileDropdownRef}>
          <button
            className="profile-button"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <div className="profile-icon">
              {userName
                ? userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                : "U"}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName || "User"}</span>
              <div className="profile-status">
                <Circle
                  size={8}
                  color={getStatusColor(userRole)}
                  fill={getStatusColor(userRole)}
                />
                <span className="profile-role">{formatRoleName(userRole)}</span>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`dropdown-arrow ${
                showProfileDropdown ? "rotate" : ""
              }`}
            />
          </button>

          {showProfileDropdown && (
            <div className="dropdown-menu profile-dropdown">
              <div className="dropdown-user-info">
                <div className="dropdown-user-name">{userName || "User"}</div>
                <div className="dropdown-user-role">
                  {formatRoleName(userRole)}
                </div>
                {currentBranch && (
                  <div className="dropdown-user-branch">
                    <Building size={12} />
                    <span>{currentBranch.name}</span>
                  </div>
                )}
              </div>
              <div className="dropdown-divider"></div>
              {/* <button className="dropdown-item" onClick={handleSettingsClick}>
                <Settings size={16} />
                <span>Settings</span>
              </button> */}
              <button
                className="dropdown-item logout-item"
                onClick={handleLogoutClick}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {showAddCustomerModal && (
        <AddCustomerModal
          isOpen={showAddCustomerModal}
          onClose={() => setShowAddCustomerModal(false)}
          onCustomerAdded={() => {}}
        />
      )}
      {showAddSupplierModal && (
        <AddSupplierModal
          isOpen={showAddSupplierModal}
          onClose={() => setShowAddSupplierModal(false)}
          onSupplierAdded={() => {}}
        />
      )}
    </nav>
  );
};

export default Navbar;
