import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data on app start
    const storedToken = sessionStorage.getItem("authToken");
    const storedUser = sessionStorage.getItem("user");

    console.log("🔄 AuthProvider initializing:", { storedToken, storedUser });

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        console.log("✅ AuthProvider: Token and user set from sessionStorage");
      } catch (error) {
        console.error("Error parsing stored user:", error);
        logout();
      }
    } else {
      console.log("❌ AuthProvider: No stored token or user found");
    }
    setIsLoading(false);
  }, []);

  const login = (newToken, userData) => {
    console.log("🔐 AuthProvider login called:", { newToken, userData });

    if (!newToken) {
      console.error("❌ AuthProvider: No token provided to login function");
      return;
    }

    sessionStorage.setItem("authToken", newToken);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);

    console.log("✅ AuthProvider: Login successful, token and user set");
  };

  const logout = () => {
    console.log("🚪 AuthProvider: Logging out");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAuthenticated: !!token, // This should be based on token, not a separate state
  };

  console.log("🔄 AuthProvider value:", value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
