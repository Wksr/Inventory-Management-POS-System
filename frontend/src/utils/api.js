import offlineDB from "./offlineDB";
import networkManager from "./networkManager";

class API {
  constructor() {
    this.baseURL = "http://127.0.0.1:8000/api";
    this.isOnline = networkManager.getStatus();

    // Listen for network changes
    networkManager.addListener((status) => {
      this.isOnline = status;
      console.log(`API: ${status ? "Online mode" : "Offline mode"}`);
    });
  }

  // Helper method to get auth headers
  getHeaders() {
    const token = sessionStorage.getItem("authToken");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { ...this.getHeaders(), ...options.headers };

    try {
      const controller = new AbortController();
      // ← Timeout 30 seconds
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);

      // Timeout or network error — DON'T throw OFFLINE_MODE immediately
      if (error.name === "AbortError") {
        console.warn("API call timed out — will retry on next load");
        // Return null or empty instead of throwing OFFLINE_MODE
        return null;
      }

      // Only throw OFFLINE_MODE if explicitly offline
      if (!navigator.onLine) {
        throw new Error("OFFLINE_MODE");
      }

      // Other errors — return null
      return null;
    }
  }
  async getProducts() {
    let productsData = [];

    try {
      if (this.isOnline) {
        const response = await this.fetch("/pos/products");

        if (response && response.success) {
          let onlineProducts = [];
          if (response.products && Array.isArray(response.products.data)) {
            onlineProducts = response.products.data;
          } else if (Array.isArray(response.data)) {
            onlineProducts = response.data;
          } else if (Array.isArray(response)) {
            onlineProducts = response;
          }

          if (onlineProducts.length > 0) {
            productsData = onlineProducts;
            // Cache them
            for (const product of productsData) {
              await offlineDB.addProduct(product).catch(() => {}); // ignore duplicate
            }
            console.log("Fresh products loaded from server");
          }
        }
      }

      // Fallback to cache if no fresh data
      if (productsData.length === 0) {
        const cached = await offlineDB.getAllProducts();
        if (cached.length > 0) {
          productsData = cached;
          console.log("Using offline cache");
        }
      }

      return productsData;
    } catch (error) {
      console.error("Critical error:", error);
      // Final fallback
      const cached = await offlineDB.getAllProducts();
      return cached.length > 0 ? cached : [];
    }
  }
  async createProduct(productData) {
    try {
      const response = await this.fetch("/products", {
        method: "POST",
        body: JSON.stringify(productData),
      });

      // Also store locally
      await offlineDB.addProduct({
        ...productData,
        id: response.product.id,
        sync_status: "synced",
      });

      return response;
    } catch (error) {
      if (error.message === "OFFLINE_MODE") {
        // Store locally for later sync
        const localId = `temp_${Date.now()}`;
        await offlineDB.addProduct({
          ...productData,
          id: localId,
          sync_status: "pending",
        });

        return {
          success: true,
          message: "Product saved locally. Will sync when online.",
          local_id: localId,
        };
      }
      throw error;
    }
  }

  async updateProductStock(productId, quantity) {
    try {
      if (this.isOnline) {
        return await this.fetch(`/products/${productId}/stock`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        });
      }

      // Offline: Update local stock
      await offlineDB.updateStock(productId, quantity, "sale");
      return { success: true, message: "Stock updated locally" };
    } catch (error) {
      if (error.message === "OFFLINE_MODE") {
        await offlineDB.updateStock(productId, quantity, "sale");
        return { success: true, message: "Stock updated locally" };
      }
      throw error;
    }
  }

  // Cache products for offline use
  async cacheProducts(products) {
    for (const product of products) {
      try {
        // Check if product already exists
        const existing = await offlineDB.getProduct(product.id);

        if (
          !existing ||
          new Date(product.updated_at) > new Date(existing.updated_at)
        ) {
          await offlineDB.addProduct({
            ...product,
            sync_status: "synced",
          });
        }
      } catch (error) {
        console.error("Error caching product:", product.id, error);
      }
    }

    console.log(`Cached ${products.length} products for offline use`);
  }

  // ========== SALE API ==========
  async createSale(saleData) {
    try {
      if (this.isOnline) {
        const response = await this.fetch("/sales", {
          method: "POST",
          body: JSON.stringify(saleData),
        });

        return response;
      }

      // Offline mode
      const localSaleId = await offlineDB.createSale(saleData);

      return {
        success: true,
        message: "Sale processed offline. Will sync when online.",
        local_id: localSaleId,
        data: {
          ...saleData,
          local_id: localSaleId,
        },
      };
    } catch (error) {
      if (error.message === "OFFLINE_MODE") {
        const localSaleId = await offlineDB.createSale(saleData);

        return {
          success: true,
          message: "Sale processed offline. Will sync when online.",
          local_id: localSaleId,
          data: {
            ...saleData,
            local_id: localSaleId,
          },
        };
      }
      throw error;
    }
  }

  async getSales(dateFilter = "today") {
    try {
      if (this.isOnline) {
        const response = await this.fetch(`/sales?filter=${dateFilter}`);

        if (response.success) {
          // Cache recent sales
          if (response.sales) {
            await this.cacheSales(response.sales);
          }
          return response.sales || [];
        }
      }

      // Offline: Get sales from local DB
      const allSales = await offlineDB.getAllSales();

      // Apply date filter locally
      return this.filterSalesByDate(allSales, dateFilter);
    } catch (error) {
      console.log("Using offline sales data");
      const allSales = await offlineDB.getAllSales();
      return this.filterSalesByDate(allSales, dateFilter);
    }
  }

  // Helper to filter sales by date
  filterSalesByDate(sales, filter) {
    const now = new Date();
    let startDate = new Date();

    switch (filter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return sales;
    }

    return sales.filter((sale) => new Date(sale.created_at) >= startDate);
  }

  // ========== CUSTOMER API ==========
  async getCustomers() {
    try {
      if (this.isOnline) {
        const response = await this.fetch("/customers");

        if (response.success && response.customers) {
          // Cache customers
          for (const customer of response.customers) {
            await offlineDB.addCustomer({
              ...customer,
              sync_status: "synced",
            });
          }
          return response.customers;
        }
      }

      return await offlineDB.getAllCustomers();
    } catch (error) {
      return await offlineDB.getAllCustomers();
    }
  }

  async createCustomer(customerData) {
    try {
      const response = await this.fetch("/customers", {
        method: "POST",
        body: JSON.stringify(customerData),
      });

      return response;
    } catch (error) {
      if (error.message === "OFFLINE_MODE") {
        await offlineDB.addCustomer({
          ...customerData,
          id: `temp_${Date.now()}`,
          sync_status: "pending",
        });

        return {
          success: true,
          message: "Customer saved locally. Will sync when online.",
        };
      }
      throw error;
    }
  }

  // ========== HEALTH CHECK ==========
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: "HEAD",
        cache: "no-cache",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
const api = new API();

export default api;
