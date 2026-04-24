import React, { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/dashboard/dashboard";
import Category from "./pages/products/category/category";
import Products from "./pages/products/products/products";
import Purchases from "./pages/purchases/purchases/purchases";
import PurchasesReturn from "./pages/purchases/purchasesReturn/purchasesReturn";
import Sale from "./pages/sale/sale/sale";
import SalesReturn from "./pages/sale/saleReturn/SalesReturn";
import Customer from "./pages/customer/customer";
import Supplier from "./pages/supplier/supplier";
import User from "./pages/users/user";
import Login from "./components/auth/login";
import Register from "./components/auth/register";
import POS from "./pages/pos/pos";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Reports from "./pages/reports/reports/reports";
import "./App.css";
import Units from "./pages/products/units/Units";
import Printbarcode from "./pages/products/printBarcode/printBarcode";
import Settings from "./pages/settings/settings";
//
import { initOfflineDB } from "./utils/offlineDB";
import networkManager from "./utils/networkManager";
import syncManager from "./utils/syncManager";
import NetworkStatus from "./components/NetworkStatus";
import OfflineNotification from "./components/OfflineNotification";

// Create a separate component for the main app logic
function AppContent() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [currentComponent, setCurrentComponent] = useState(<Dashboard />);
  const [pageTitle, setPageTitle] = useState("Dashboard");
  const [currentAuthPage, setCurrentAuthPage] = useState("login");
  const [isPOSMode, setIsPOSMode] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [dbReady, setDbReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineNotification, setShowOfflineNotification] = useState(false);

  const { user, login, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    const initializeOfflineMode = async () => {
      try {
        // Initialize offline database
        await initOfflineDB();
        setDbReady(true);

        // Start auto-sync
        syncManager.startAutoSync();

        console.log("Offline mode initialized successfully");
      } catch (error) {
        console.error("Failed to initialize offline mode:", error);
        // App can still work, but offline features may be limited
        setDbReady(true); // Still set to true to allow app to load
      }
    };

    initializeOfflineMode();

    // Listen for network changes
    networkManager.addListener((status) => {
      setIsOnline(status);
      if (!status) {
        setShowOfflineNotification(true);
        toast.warning("You're offline. Working in offline mode.", {
          duration: 3000,
        });
      } else {
        setShowOfflineNotification(false);
        toast.success("Back online! Syncing data...", {
          duration: 2000,
        });
      }
    });

    // Cleanup
    return () => {
      syncManager.stopAutoSync();
    };
  }, []);

  // Fetch branches when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchBranches();
    }
  }, [isAuthenticated, user]);

  // In App.js - update the fetchBranches function
  const fetchBranches = async () => {
    try {
      setLoadingBranches(true);
      const token = sessionStorage.getItem("authToken");

      // Call the branches endpoint
      const response = await fetch("http://127.0.0.1:8000/api/branches", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.success && data.branches) {
        setBranches(data.branches);

        // Set current branch from default_branch
        if (data.default_branch) {
          setCurrentBranch(data.default_branch);
        } else if (data.branches.length > 0) {
          // Find default branch or use first one
          const defaultBranch =
            data.branches.find((b) => b.is_default) || data.branches[0];
          setCurrentBranch(defaultBranch);
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoadingBranches(false);
    }
  };

  // Update handleBranchChange function
  const handleBranchChange = async (branch) => {
    if (!branch || currentBranch?.id === branch.id) return;

    try {
      const token = sessionStorage.getItem("authToken");

      // Call the set-user-branch endpoint
      const response = await fetch(
        "http://127.0.0.1:8000/api/branches/set-user-branch",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ branch_id: branch.id }),
        },
      );

      const data = await response.json();

      if (data.success) {
        const newBranch = data.current_branch || branch;
        setCurrentBranch(newBranch);
        toast.success(`Switched to ${newBranch.name}`);

        // Refresh ALL pages data immediately
        handlePageChange(activePage, newBranch);
      } else {
        toast.error(data.message || "Failed to change branch");
      }
    } catch (error) {
      console.error("Error changing branch:", error);
      toast.error("Failed to change branch");
      // Still update the UI even if API fails
      setCurrentBranch(branch);
      // Refresh with new branch even on error
      handlePageChange(activePage, branch);
    }
  };

  const handlePageChange = (pageName, forceBranch = null) => {
    setActivePage(pageName);
    setPageTitle(pageName);

    const branchToUse = forceBranch || currentBranch;

    const componentMap = {
      Dashboard: (
        <Dashboard
          key={`dashboard-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Category: (
        <Category
          key={`category-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Products: (
        <Products
          key={`products-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Units: (
        <Units
          key={`units-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),

      "Print Barcode": <Printbarcode key="print-barcode" isOnline={isOnline} />,

      Purchases: (
        <Purchases
          key={`purchases-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      "Purchases Return": (
        <PurchasesReturn
          key={`purchases-return-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Sales: (
        <Sale
          key={`sales-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      "Sales Return": (
        <SalesReturn
          key={`sales-return-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Customer: (
        <Customer
          key={`customer-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Reports: (
        <Reports
          key={`reports-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Supplier: (
        <Supplier
          key={`supplier-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      User: (
        <User
          key={`user-${branchToUse?.id}`}
          currentBranch={branchToUse}
          isOnline={isOnline}
        />
      ),
      Settings: <Settings key="settings" isOnline={isOnline} />,
    };

    if (componentMap[pageName]) {
      setCurrentComponent(componentMap[pageName]);
    }
  };
  const handleRegisterSuccess = () => {
    setCurrentAuthPage("login");
  };

  const handleLoginSuccess = (userData) => {
    login(userData.token, userData);
  };

  const handleLogout = () => {
    setActivePage("Dashboard");
    setCurrentComponent(<Dashboard />);
    setPageTitle("Dashboard");
    setBranches([]);
    setCurrentBranch(null);
    logout();
  };

  const handlePOSClick = () => {
    setIsPOSMode(true);
  };

  const handlePOSClose = () => {
    setIsPOSMode(false);
  };

  const handlePOSDashboardClick = () => {
    setIsPOSMode(false);
    setActivePage("Dashboard");
    setCurrentComponent(<Dashboard />);
    setPageTitle("Dashboard");
  };

  const handleSettingsClick = () => {
    setActivePage("Settings");
    setPageTitle("Settings");
    setCurrentComponent(<Settings />);
    console.log("Settings clicked");
  };

  if (!dbReady) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Initializing offline mode...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        {currentAuthPage === "login" ? (
          <Login
            onSwitchToRegister={() => setCurrentAuthPage("register")}
            onLoginSuccess={handleLoginSuccess}
            isOnline={isOnline}
          />
        ) : (
          <Register
            onSwitchToLogin={() => setCurrentAuthPage("login")}
            onRegisterSuccess={handleRegisterSuccess}
            isOnline={isOnline}
          />
        )}
        {!isOnline && (
          <div className="login-offline-notice">
            <p>⚠️ You are currently offline. Some features may be limited.</p>
          </div>
        )}
      </div>
    );
  }

  if (isPOSMode) {
    return (
      <div className="pos-fullscreen">
        <POS
          onClose={handlePOSClose}
          onDashboardClick={handlePOSDashboardClick}
          currentBranch={currentBranch}
          isOnline={isOnline}
        />
        {/* <div className="pos-network-status">
          <NetworkStatus />
        </div> */}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar
        storeName="Multi Branch POS"
        pageTitle={pageTitle}
        userName={user ? `${user.firstName} ${user.lastName}` : "User"}
        userRole={user?.role || "cashier"}
        onPOSClick={handlePOSClick}
        onLogout={handleLogout}
        onSettingsClick={handleSettingsClick}
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={handleBranchChange}
        loadingBranches={loadingBranches}
        isOnline={isOnline}
        // Add NetworkStatus component to Navbar
        extraContent={<NetworkStatus />}
      />
      {showOfflineNotification && <OfflineNotification />}

      <div className="main-container">
        <Sidebar
          activePage={activePage}
          onPageChange={handlePageChange}
          userRole={user?.role || "cashier"}
          currentBranch={currentBranch}
          isOnline={isOnline}
        />

        <main className="content-area">{currentComponent}</main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        duration={2500}
        closeButton={true}
        richColors={true}
        expand={false}
        theme="light"
        offset="16px"
      />
      <AppContent />
    </AuthProvider>
  );
}

export default App;
