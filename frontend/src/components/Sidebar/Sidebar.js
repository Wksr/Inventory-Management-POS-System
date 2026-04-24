import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  Package,
  TrendingUp,
  Users,
  FileText,
  Truck,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  Folder,
  BarChart3,
  ShoppingCart,
  RefreshCw,
  PrinterIcon,
  Ruler,
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ activePage, onPageChange, userRole }) => {
  const [expandedMenu, setExpandedMenu] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const sidebarRef = useRef(null);

  function toggleMenu(menuName) {
    setExpandedMenu((prev) => (prev === menuName ? "" : menuName));
  }

  const handleMenuClick = (pageName, hasSubmenu) => {
    if (hasSubmenu) {
      toggleMenu(pageName);
    } else {
      setExpandedMenu("");
      onPageChange(pageName);
    }
  };

  const handleSubmenuClick = (pageName) => {
    setExpandedMenu("");
    onPageChange(pageName);
  };

  const getSubmenuIcon = (submenuName) => {
    switch (submenuName) {
      case "Products":
        return <Package size={16} />;
      case "Category":
        return <Folder size={16} />;
      case "Units":
        return <Ruler size={16} />;

      case "Print Barcode":
        return <PrinterIcon size={16} />;

      case "Purchases Return":
        return <RefreshCw size={16} />;
      case "Sales":
        return <ShoppingCart size={16} />;
      case "Sales Return":
        return <RefreshCw size={16} />;
      default:
        return <BarChart3 size={16} />;
    }
  };

  const allMenuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      hasSubmenu: false,
      roles: ["admin", "manager", "cashier"],
    },
    {
      name: "Products",
      icon: Package,
      hasSubmenu: true,
      submenu: ["Products", "Category", "Units", "Print Barcode"],
      roles: ["admin", "manager", "cashier"],
    },
    {
      name: "Purchases",
      icon: ShoppingCart,
      hasSubmenu: true,
      submenu: ["Purchases", "Purchases Return"],
      roles: ["admin", "manager", "cashier"],
    },
    {
      name: "Sales",
      icon: TrendingUp,
      hasSubmenu: true,
      submenu: ["Sales", "Sales Return"],
      roles: ["admin", "manager", "cashier"],
    },
    {
      name: "Customer",
      icon: Users,
      hasSubmenu: false,
      roles: ["admin", "manager", "cashier"],
    },
    {
      name: "Reports",
      icon: FileText,
      hasSubmenu: false,
      roles: ["admin", "manager"],
    },
    {
      name: "Supplier",
      icon: Truck,
      hasSubmenu: false,
      roles: ["admin", "manager"],
    },
    {
      name: "User",
      icon: User,
      hasSubmenu: false,
      roles: ["admin"],
    },
    {
      name: "Settings",
      icon: Settings,
      hasSubmenu: false,
      roles: ["admin"],
    },
  ];
  const filteredMenuItems = allMenuItems
    .filter((item) => item.roles.includes(userRole))
    .filter((item) => {
      const query = searchQuery.toLowerCase();
      const nameMatch = item.name.toLowerCase().includes(query);
      const submenuMatch =
        item.submenu &&
        item.submenu.some((sub) => sub.toLowerCase().includes(query));
      return nameMatch || submenuMatch;
    });

  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setExpandedMenu("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="sidebar" ref={sidebarRef}>
      <div className="sidebar-search-container">
        <Search className="sidebar-search-icon" size={15} />
        <input
          type="text"
          placeholder="Search"
          className="sidebar-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        {filteredMenuItems.map((item) => (
          <div key={item.name} className="menu-item-container">
            <button
              className={`menu-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => handleMenuClick(item.name, item.hasSubmenu)}
            >
              <div className="menu-item-left">
                <item.icon size={18} />
                <span>{item.name}</span>
              </div>
              {item.hasSubmenu && (
                <span className="menu-arrow">
                  {expandedMenu === item.name ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
              )}
            </button>

            {item.hasSubmenu && expandedMenu === item.name && (
              <div className="submenu">
                {item.submenu
                  .filter(
                    (subItem) =>
                      subItem
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      searchQuery === "",
                  )
                  .map((subItem) => (
                    <button
                      key={subItem}
                      className={`submenu-item ${
                        activePage === subItem ? "active" : ""
                      }`}
                      onClick={() => handleSubmenuClick(subItem)}
                    >
                      <div className="menu-item-left">
                        {getSubmenuIcon(subItem)}
                        <span>{subItem}</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
