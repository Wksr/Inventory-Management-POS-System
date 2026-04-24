import { openDB } from "idb";

class OfflineDB {
  constructor() {
    this.dbName = "pos_offline_db";
    this.version = 12;
    this.db = null;
    this.ready = false;
  }

  _ensureDb() {
    if (!this.db || !this.ready) {
      console.warn("OfflineDB: Database not ready yet (init not completed)");
      return false;
    }
    return true;
  }

  // Initialize database
  async init() {
    try {
      this.db = await openDB(this.dbName, this.version, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log(`Upgrading DB from ${oldVersion} to ${newVersion}`);

          // Products store
          if (!db.objectStoreNames.contains("products")) {
            const productStore = db.createObjectStore("products", {
              keyPath: "id",
            });
            productStore.createIndex("category", "category");
            productStore.createIndex("barcode", "barcode", { unique: true });
            productStore.createIndex("updated_at", "updated_at");
            productStore.createIndex("sync_status", "sync_status");
          }

          // Sales store
          if (!db.objectStoreNames.contains("sales")) {
            const saleStore = db.createObjectStore("sales", {
              keyPath: "local_id",
              autoIncrement: true,
            });
            saleStore.createIndex("date", "created_at");
            saleStore.createIndex("sync_status", "sync_status");
            saleStore.createIndex("server_id", "server_id");
          }

          // Sale items store (for detailed sale items)
          if (!db.objectStoreNames.contains("sale_items")) {
            const saleItemsStore = db.createObjectStore("sale_items", {
              keyPath: "id",
              autoIncrement: true,
            });
            saleItemsStore.createIndex("sale_local_id", "sale_local_id");
            saleItemsStore.createIndex("product_id", "product_id");
          }

          // Customers store
          if (!db.objectStoreNames.contains("customers")) {
            const customerStore = db.createObjectStore("customers", {
              keyPath: "id",
            });
            customerStore.createIndex("phone", "phone", { unique: true });
            customerStore.createIndex("sync_status", "sync_status");
          }
          //categories
          if (!db.objectStoreNames.contains("categories")) {
            const categoryStore = db.createObjectStore("categories", {
              keyPath: "id",
            });
            categoryStore.createIndex("name", "name", { unique: true }); // optional
            console.log("Created 'categories' object store");
          }

          //
          if (!db.objectStoreNames.contains("business")) {
            db.createObjectStore("business", { keyPath: "id" });
          }

          if (!db.objectStoreNames.contains("suppliers")) {
            const supplierStore = db.createObjectStore("suppliers", {
              keyPath: "id",
            });
            supplierStore.createIndex("name", "name");
            supplierStore.createIndex("sync_status", "sync_status");
          }

          if (!db.objectStoreNames.contains("units")) {
            const unitStore = db.createObjectStore("units", { keyPath: "id" });
            unitStore.createIndex("name", "name");
            unitStore.createIndex("sync_status", "sync_status");
            console.log("Created 'units' object store");
          }

          // Pending purchases store
          if (!db.objectStoreNames.contains("pending_purchases")) {
            const pendingPurchaseStore = db.createObjectStore(
              "pending_purchases",
              {
                keyPath: "local_id",
              },
            );
            pendingPurchaseStore.createIndex("supplier_id", "supplier_id");
            pendingPurchaseStore.createIndex("date", "date");
            pendingPurchaseStore.createIndex("sync_status", "sync_status");
          }

          if (!db.objectStoreNames.contains("purchases")) {
            const store = db.createObjectStore("purchases", { keyPath: "id" });
            store.createIndex("date", "date");
            store.createIndex("supplier_id", "supplier_id");
            store.createIndex("sync_status", "sync_status");
          }

          if (!db.objectStoreNames.contains("pending_sale_returns")) {
            const store = db.createObjectStore("pending_sale_returns", {
              keyPath: "local_id",
            });

            store.createIndex("sale_id", "sale_id", { unique: false });
            store.createIndex("sync_status", "sync_status", { unique: false });
            store.createIndex("original_sale_id", "original_sale_id", {
              unique: false,
            });
            store.createIndex("depends_on_sale", "depends_on_sale", {
              unique: false,
            }); // optional but useful

            console.log(
              "Created pending_sale_returns store + all required indexes",
            );
          } else {
            const tx = transaction;
            const store = tx.objectStore("pending_sale_returns");

            const indexesToEnsure = [
              {
                name: "original_sale_id",
                keyPath: "original_sale_id",
                unique: false,
              },
              { name: "sale_id", keyPath: "sale_id", unique: false },
              { name: "sync_status", keyPath: "sync_status", unique: false },
              {
                name: "depends_on_sale",
                keyPath: "depends_on_sale",
                unique: false,
              },
            ];

            indexesToEnsure.forEach((idx) => {
              if (!store.indexNames.contains(idx.name)) {
                store.createIndex(idx.name, idx.keyPath, {
                  unique: idx.unique,
                });
                console.log(
                  `Added missing index: ${idx.name} to pending_sale_returns`,
                );
              }
            });
          }

          if (!db.objectStoreNames.contains("pending_purchase_returns")) {
            const store = db.createObjectStore("pending_purchase_returns", {
              keyPath: "local_id",
            });
            store.createIndex("purchase_id", "purchase_id", { unique: false });
            store.createIndex("sync_status", "sync_status", { unique: false });
            store.createIndex("created_at", "created_at");
            console.log("Created 'pending_purchase_returns' store");
          }

          // Sync queue for failed operations
          if (!db.objectStoreNames.contains("sync_queue")) {
            const syncQueueStore = db.createObjectStore("sync_queue", {
              keyPath: "id",
              autoIncrement: true,
            });
            syncQueueStore.createIndex("action_type", "action_type");
            syncQueueStore.createIndex("status", "status");
            syncQueueStore.createIndex("created_at", "created_at");
          }

          // Settings/store info
          if (!db.objectStoreNames.contains("settings")) {
            const settingsStore = db.createObjectStore("settings", {
              keyPath: "key",
            });
          }
        },
      });

      this.ready = true;
      console.log("Offline Database initialized successfully");
      return this;
    } catch (error) {
      console.error("Failed to initialize offline DB:", error);
      throw error;
    }
  }

  async addCategory(category) {
    if (!this._ensureDb()) return;

    if (!category || !category.id || !category.name) {
      console.warn("Invalid category data, skipping cache");
      return;
    }

    const normalized = {
      id: category.id,
      name: category.name.trim(),
      description: category.description?.trim() || null,
      created_at: category.created_at,
      updated_at: category.updated_at,
      sync_status: category.sync_status,
      local_id: category.local_id || null,
    };

    try {
      await this.db.put("categories", normalized);
      console.log(
        "Category cached successfully:",
        normalized.name,
        "status:",
        normalized.sync_status,
      );
    } catch (error) {
      console.error("Failed to cache category:", normalized.name, error);
      throw error;
    }
  }

  // Add this method too
  async getAllCategories() {
    if (!this._ensureDb()) return [];
    try {
      const categories = await this.db.getAll("categories");
      console.log("Loaded categories from cache:", categories.length);
      return categories;
    } catch (error) {
      console.error("Failed to get cached categories:", error);
      return [];
    }
  }

  async deleteCategory(localId) {
    await this.db.delete("categories", localId);
  }

  // async clearCategories() {
  //   try {
  //     await this.db.clear("categories");
  //     console.log("All local categories cleared for fresh sync");
  //   } catch (err) {
  //     console.error("Failed to clear categories:", err);
  //   }
  // }

  async addSupplier(supplier) {
    if (!this._ensureDb()) return;
    const normalized = {
      ...supplier,
      sync_status: supplier.sync_status || "synced",
      updated_at: new Date().toISOString(),
    };
    await this.db.put("suppliers", normalized);
  }

  async getAllSuppliers() {
    if (!this._ensureDb()) return [];
    try {
      return await this.db.getAll("suppliers");
    } catch (error) {
      console.error("Failed to load suppliers from cache:", error);
      return [];
    }
  }

  async addUnit(unit) {
    if (!this._ensureDb()) return;

    const normalized = {
      ...unit,
      sync_status: unit.sync_status || "synced",
      updated_at: new Date().toISOString(),
    };

    await this.db.put("units", normalized);
  }

  async getAllUnits() {
    if (!this._ensureDb()) return [];
    try {
      return (await this.db.getAll("units")) || [];
    } catch (error) {
      console.error("Failed to load cached units:", error);
      return [];
    }
  }

  async addProduct(product) {
    if (!this._ensureDb()) {
      console.warn("addProduct skipped - DB not ready");
      return;
    }

    const productWithMeta = {
      ...product,
      image_url: product.image
        ? `http://127.0.0.1:8000/storage/${product.image}`
        : null,
      sync_status: product.sync_status || "pending",
      updated_at: new Date().toISOString(),
    };

    try {
      const tx = this.db.transaction("products", "readwrite");
      const store = tx.objectStore("products");

      await store.put(productWithMeta);

      // Wait for transaction to complete
      await tx.done;

      console.log(
        "Product saved to IndexedDB successfully:",
        productWithMeta.name,
      );
      return productWithMeta;
    } catch (error) {
      console.error("Failed to save product to IndexedDB:", error);
      throw error; // Let the caller (handleSubmit) handle the error
    }
  }
  async updateProduct(id, updates) {
    if (!this._ensureDb()) return;
    const tx = this.db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    // Get existing product
    const existing = await store.get(id);
    if (!existing) throw new Error("Product not found");

    // Merge updates
    const updatedProduct = {
      ...existing,
      ...updates,
      sync_status: "pending", // Mark as pending sync
      updated_at: new Date().toISOString(),
      local_updated_at: new Date().toISOString(),
    };

    await store.put(updatedProduct);
    await tx.done;
    return updatedProduct;
  }

  async getProduct(id) {
    return await this.db.get("products", id);
  }

  async getAllProducts() {
    if (!this._ensureDb()) return [];
    const tx = this.db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const all = await store.getAll();
    return all || []; // ← Always return array
  }

  async getProductsByCategory(category) {
    const index = this.db.transaction("products").store.index("category");
    return await index.getAll(category);
  }

  async getProductByBarcode(barcode) {
    const index = this.db.transaction("products").store.index("barcode");
    return await index.get(barcode);
  }

  // async updateStock(productId, quantity, type = "sale") {
  //   const tx = this.db.transaction("products", "readwrite");
  //   const store = tx.objectStore("products");

  //   const product = await store.get(productId);
  //   if (!product) {
  //     console.error("Product not found for ID:", productId);
  //     throw new Error("Product not found");
  //   }

  //
  //   const currentStock = product.stock || 0;
  //   const delta = type === "sale" ? -quantity : +quantity;
  //   const newStock = currentStock + delta;

  //   console.log(
  //     `updateStock: ID=${productId}, qty=${quantity}, type=${type}, oldStock=${currentStock}, delta=${delta}, newStock=${newStock}`,
  //   );

  //   if (newStock < 0 && type === "sale") {
  //     throw new Error(`Insufficient stock: only ${currentStock} available`);
  //   }

  //   product.stock = newStock;
  //   product.pending_stock_change = (product.pending_stock_change || 0) + delta;
  //   product.sync_status = "pending";
  //   product.updated_at = new Date().toISOString();

  //   await store.put(product);
  //   await tx.done;

  //   console.log(`Stock update success: ID=${productId}, newStock=${newStock}`);

  //   return product;
  // }

  // async createSale(saleData) {
  //   if (!this.db) throw new Error("DB not initialized");

  //   const localId = crypto.randomUUID(); // ← guaranteed unique

  //   const sale = {
  //     local_id: localId, // keep for reference if needed
  //     id: null, // ← explicit: no server ID yet
  //     ...saleData,
  //     sync_status: "pending",
  //     created_at: new Date().toISOString(),
  //     updated_at: new Date().toISOString(),
  //     is_offline: true,
  //     is_pending: true, // ← optional flag for easier filtering
  //   };

  //   try {
  //     await this.db.add("sales", sale);

  //     if (saleData.items?.length > 0) {
  //       for (const item of saleData.items) {
  //         const saleItem = {
  //           sale_local_id: localId,
  //           product_id: item.product_id,
  //           product_name: item.product_name || item.name,
  //           quantity: item.quantity,
  //           unit_price: item.unit_price || item.price,
  //           total_price: item.quantity * (item.unit_price || item.price),
  //           created_at: new Date().toISOString(),
  //         };
  //         await this.db.add("sale_items", saleItem);
  //       }
  //     }

  //     console.log("Offline sale created successfully:", localId);
  //     return localId; // return the local_id so caller can use it immediately if needed
  //   } catch (error) {
  //     console.error("Failed to create offline sale:", error);
  //     toast.error("Failed to save sale offline. Please try again.");
  //     throw error;
  //   }
  // }

  async createOfflineSaleWithStockUpdate(saleData, cartItems) {
    if (!this.db) throw new Error("DB not initialized");

    const localId = crypto.randomUUID();
    const sale = {
      local_id: localId,
      id: null,
      ...saleData,
      sync_status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_offline: true,
    };

    const tx = this.db.transaction(
      ["sales", "sale_items", "products"],
      "readwrite",
    );

    try {
      const salesStore = tx.objectStore("sales");
      await salesStore.add(sale);

      if (saleData.items?.length > 0) {
        const itemsStore = tx.objectStore("sale_items");
        for (const item of saleData.items) {
          await itemsStore.add({
            sale_local_id: localId,
            product_id: Number(item.product_id),
            product_name: item.product_name || item.name || "Unknown",
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price || item.price || 0),
            total_price:
              Number(item.quantity) *
              Number(item.unit_price || item.price || 0),
            created_at: new Date().toISOString(),
          });
        }
      }

      // Stock updates
      const productsStore = tx.objectStore("products");
      for (const item of cartItems) {
        const product = await productsStore.get(Number(item.id));
        if (!product) {
          console.warn(`Product ${item.id} not found for stock update`);
          continue;
        }

        const currentStock = Number(product.stock || 0);
        const qty = Number(item.quantity || 1);
        const newStock = currentStock - qty;

        if (newStock < 0) {
          throw new Error(
            `Insufficient stock for ${product.name || item.name}`,
          );
        }

        product.stock = newStock;
        product.pending_stock_change =
          (product.pending_stock_change || 0) - qty;
        product.sync_status = "pending";
        product.updated_at = new Date().toISOString();

        await productsStore.put(product);

        console.log(
          `Stock reduced: ${product.name || item.name} → ${newStock}`,
        );
      }

      await tx.done;

      console.log(
        "✅ Offline sale + stock update completed successfully:",
        localId,
      );
      return localId;
    } catch (error) {
      console.error("❌ createOfflineSaleWithStockUpdate failed:", error);
      // Important: do NOT re-throw if you want to see the exact error
      // but for now we re-throw so the caller can catch it
      throw error;
    }
  }

  async getSale(localId) {
    const sale = await this.db.get("sales", localId);
    if (!sale) return null;

    const items = await this.getSaleItems(localId);
    return { ...sale, items };
  }

  async getSaleItems(saleLocalId) {
    if (!this._ensureDb()) return [];
    try {
      const tx = this.db.transaction("sale_items", "readonly");
      const index = tx.objectStore("sale_items").index("sale_local_id");
      const items = await index.getAll(saleLocalId);
      return Array.isArray(items) ? items : [];
    } catch (err) {
      console.warn(`Failed to load items for sale ${saleLocalId}:`, err);
      return [];
    }
  }

  async getPendingSales() {
    if (!this._ensureDb()) return [];
    const index = this.db.transaction("sales").store.index("sync_status");
    return await index.getAll("pending");
  }

  async updateSaleStatus(localId, status, serverId = null) {
    const tx = this.db.transaction("sales", "readwrite");
    const store = tx.objectStore("sales");

    const sale = await store.get(localId);
    if (!sale) throw new Error("Sale not found");

    sale.sync_status = status;
    if (serverId) sale.server_id = serverId;
    sale.updated_at = new Date().toISOString();

    await store.put(sale);
    await tx.done;

    return sale;
  }

  async addCustomer(customer) {
    const normalized = {
      id:
        customer.id ||
        `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: customer.name?.trim() || "",
      phone: customer.phone?.trim() || "",
      email: customer.email ? customer.email.trim().toLowerCase() : null,
      loyalty_points: parseInt(
        customer.loyalty_points || customer.loyaltyPoints || 0,
      ),
      branch_id:
        customer.branch_id ||
        parseInt(localStorage.getItem("currentBranchId") || 1),
      sync_status: customer.sync_status || "pending",
      created_at: customer.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.put("customers", normalized);
  }

  async getCustomer(id) {
    return await this.db.get("customers", id);
  }

  async getCustomerByPhone(phone) {
    const index = this.db.transaction("customers").store.index("phone");
    return await index.get(phone);
  }

  async getAllCustomers() {
    return await this.db.getAll("customers");
  }

  async searchCustomers(query) {
    const lowerQuery = query.toLowerCase();
    const all = await this.getAllCustomers();
    return all.filter(
      (c) =>
        c.name?.toLowerCase().includes(lowerQuery) ||
        c.phone?.includes(lowerQuery) ||
        c.email?.toLowerCase().includes(lowerQuery),
    );
  }

  async addHoldOrder(holdOrder) {
    const localId =
      holdOrder.local_id ||
      `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const normalized = {
      local_id: localId,
      id: null, // will be set after sync
      ...holdOrder,
      local_id: localId,
      hold_status: true,
      sync_status: "pending",
      created_at: holdOrder.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      // 🔥 Use separate awaits — NO manual transaction for main record
      await this.db.put("sales", normalized);
      console.log("✅ Hold order main record saved:", localId);

      // Clear old items first (if any)
      const itemsToDelete = await this.db.getAllFromIndex(
        "sale_items",
        "sale_local_id",
        localId,
      );
      for (const item of itemsToDelete) {
        await this.db.delete("sale_items", item.local_id || item); // key might be auto-generated
      }

      // Add new items one by one
      if (holdOrder.items && Array.isArray(holdOrder.items)) {
        for (const item of holdOrder.items) {
          await this.db.add("sale_items", {
            sale_local_id: localId,
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            quantity: item.quantity,
            unit_price: item.unit_price || item.selling_price,
            total_price:
              item.quantity * (item.unit_price || item.selling_price),
            created_at: new Date().toISOString(),
          });
        }
        console.log(
          `✅ Saved ${holdOrder.items.length} items for hold order ${localId}`,
        );
      }

      return localId;
    } catch (error) {
      console.error("❌ Failed to save hold order offline:", error);
      throw error;
    }
  }
  async getAllHoldOrders() {
    if (!this._ensureDb()) return [];

    try {
      const allSales = await this.db.getAll("sales");
      const holdOrders = allSales.filter((s) => s.hold_status === true);

      const fullOrders = [];
      for (const order of holdOrders) {
        try {
          const items = await this.getSaleItems(order.local_id || order.id);
          fullOrders.push({ ...order, items: items || [] });
        } catch (itemErr) {
          console.warn(
            `Skipped hold order ${order.local_id} due to item error`,
            itemErr,
          );
          fullOrders.push({ ...order, items: [] });
        }
      }

      console.log("Loaded hold orders from cache:", fullOrders.length);
      return fullOrders;
    } catch (error) {
      console.error("Failed to load hold orders:", error);
      return [];
    }
  }

  async clearProducts() {
    try {
      await this.db.clear("products");
      console.log("All local products cleared");
    } catch (err) {
      console.error("Clear products failed:", err);
    }
  }

  async deleteProduct(localId) {
    try {
      await this.db.delete("products", localId);
      console.log(`Deleted local temp product: ${localId}`);
    } catch (err) {
      console.error("Failed to delete product from IndexedDB:", err);
      throw err;
    }
  }

  async addPendingPurchase(purchase) {
    if (!this._ensureDb()) return;

    const pendingPurchase = {
      ...purchase,
      local_id: `pending_purchase_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 8)}`,
      sync_status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.put("pending_purchases", pendingPurchase);
    console.log("Pending purchase saved offline:", pendingPurchase.local_id);
    return pendingPurchase;
  }

  async getPendingPurchases() {
    if (!this._ensureDb()) return [];
    return await this.db.getAll("pending_purchases");
  }

  async deletePendingPurchase(localId) {
    await this.db.delete("pending_purchases", localId);
    console.log("Deleted pending purchase:", localId);
  }

  async updatePendingPurchase(localId, updates) {
    const tx = this.db.transaction("pending_purchases", "readwrite");
    const store = tx.objectStore("pending_purchases");
    const purchase = await store.get(localId);
    if (purchase) {
      await store.put({ ...purchase, ...updates });
    }
  }

  async addPurchase(purchase) {
    if (!this._ensureDb()) return;
    const normalized = {
      ...purchase,
      id: purchase.id, // real server ID
      sync_status: purchase.sync_status || "synced",
      local_id: purchase.local_id || null,
      updated_at: new Date().toISOString(),
    };
    await this.db.put("purchases", normalized);
    console.log("Purchase cached:", normalized.id);
  }

  async getAllPurchases() {
    if (!this._ensureDb()) return [];
    return await this.db.getAll("purchases");
  }

  async clearPurchases() {
    if (!this._ensureDb()) return;
    await this.db.clear("purchases");
    console.log("Purchases cache cleared");
  }

  // async getPurchase(id) {
  //   if (!this._ensureDb()) return null;

  //   try {
  //     let purchase = await this.db.get("purchases", id);

  //     if (!purchase) {
  //       const pending = await this.getPendingPurchases();
  //       purchase = pending.find((p) => p.local_id === id || p.id === id);
  //     }

  //     if (purchase) {
  //       console.log(
  //         "Retrieved purchase from cache:",
  //         purchase.invoice_number || purchase.local_id,
  //       );
  //     } else {
  //       console.warn("Purchase not found in cache:", id);
  //     }

  //     return purchase;
  //   } catch (error) {
  //     console.error("Failed to get purchase:", error);
  //     return null;
  //   }
  // }
  async getPurchase(id) {
    if (!this._ensureDb()) return null;

    try {
      const searchId = Number(id); // server ID
      console.log(
        "getPurchase called for ID:",
        id,
        "converted to number:",
        searchId,
      );

      // 1. (keyPath = "id")
      let purchase = await this.db.get("purchases", searchId);

      if (!purchase) {
        const allPurchases = await this.db.getAll("purchases");
        purchase = allPurchases.find(
          (p) =>
            String(p.id) === String(id) || String(p.local_id) === String(id),
        );
      }

      // 2. Pending purchases
      if (!purchase) {
        const pending = (await this.db.getAll("pending_purchases")) || [];
        purchase = pending.find(
          (p) =>
            String(p.local_id) === String(id) || String(p.id) === String(id),
        );
      }

      if (purchase) {
        console.log("✅ Purchase found in cache:", {
          id: purchase.id,
          local_id: purchase.local_id || "N/A",
          invoice_number: purchase.invoice_number || "N/A",
          supplier: purchase.supplier?.name || "N/A",
          grand_total: purchase.grand_total || "N/A",
          sync_status: purchase.sync_status || "unknown",
        });
      } else {
        console.warn("❌ Purchase not found for ID:", id);
      }

      return purchase;
    } catch (error) {
      console.error("Failed to retrieve purchase:", error);
      return null;
    }
  }
  // async addPendingSaleReturn(returnData) {
  //   const pending = {
  //     ...returnData,
  //     local_id: `pending_sr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
  //     sync_status: "pending",
  //     created_at: new Date().toISOString(),
  //   };
  //   await this.db.put("pending_sale_returns", pending);
  //   console.log("Pending sale return saved:", pending.local_id);
  //   return pending;
  // }

  async addPendingSaleReturn(returnData) {
    if (!this._ensureDb()) return null;

    console.log("🔄 addPendingSaleReturn called with:", returnData);

    let serverSaleId = null;
    let originalSaleId = returnData.sale_id;
    let isPendingSale = false;

    // 1. sale_id
    if (returnData.sale_id) {
      if (typeof returnData.sale_id === "string") {
        if (returnData.sale_id.startsWith("server_")) {
          // server_266 → 266
          const extractedId = returnData.sale_id.replace("server_", "");
          serverSaleId = Number(extractedId);
          if (!isNaN(serverSaleId)) {
            console.log(
              `✅ Extracted server sale ID: ${serverSaleId} from ${returnData.sale_id}`,
            );
          }
        } else if (
          returnData.sale_id.includes("-") || // UUID
          returnData.sale_id.startsWith("pending_") ||
          returnData.sale_id.startsWith("local_")
        ) {
          isPendingSale = true;
          console.log("🔍 Detected PENDING/LOCAL sale ID:", returnData.sale_id);

          // Pending sale
          const sale = await this.getSale(returnData.sale_id);
          if (sale && sale.id && sale.sync_status === "synced") {
            serverSaleId = Number(sale.id);
            console.log(
              `✅ Pending sale already synced — server ID: ${serverSaleId}`,
            );
          }
        }
      } else if (
        typeof returnData.sale_id === "number" ||
        !isNaN(Number(returnData.sale_id))
      ) {
        serverSaleId = Number(returnData.sale_id);
        console.log(`✅ Direct numeric sale_id: ${serverSaleId}`);
      }
    }

    const processedItems = (returnData.items || [])
      .map((item) => ({
        product_id: Number(item.product_id),
        sale_item_id: item.sale_item_id || null,
        return_quantity: Number(item.return_quantity || item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        item_reason: item.item_reason || "",
      }))
      .filter((item) => item.return_quantity > 0);

    // 3. Pending record create
    const pending = {
      ...returnData,
      sale_id: serverSaleId || originalSaleId, // server ID
      original_sale_id: originalSaleId, // original string
      items: processedItems,
      local_id: `pending_sr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      sync_status: serverSaleId ? "pending" : "waiting_for_sale",
      depends_on_sale: isPendingSale && !serverSaleId,
      retry_count: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("💾 Saving pending sale return:", {
      local_id: pending.local_id,
      sale_id: pending.sale_id,
      original_sale_id: pending.original_sale_id,
      sync_status: pending.sync_status,
      depends_on_sale: pending.depends_on_sale,
      items_count: processedItems.length,
    });

    await this.db.put("pending_sale_returns", pending);
    console.log("✅ Pending sale return saved:", pending.local_id);

    return pending;
  }

  async getPendingSaleReturns() {
    console.log("DEBUG: getPendingSaleReturns() STARTED");

    if (!this._ensureDb()) {
      console.log("DEBUG: DB not ready → return []");
      return [];
    }

    try {
      console.log("DEBUG: Creating transaction");
      const transaction = this.db.transaction(
        ["pending_sale_returns"],
        "readonly",
      );
      const store = transaction.objectStore("pending_sale_returns");

      console.log("DEBUG: Getting all records (no filter)");
      const allReturns = await store.getAll();

      console.log("DEBUG: getAll completed - total count:", allReturns.length);

      if (allReturns.length > 0) {
        console.log("DEBUG: First record:", allReturns[0]);
        console.log(
          "DEBUG: All statuses:",
          allReturns.map((r) => r.sync_status || "no_status"),
        );
      } else {
        console.log("DEBUG: No records in pending_sale_returns");
      }

      const pendingOnly = allReturns.filter((r) => {
        const status = r.sync_status || "pending"; // default pending
        return (
          status === "pending" ||
          status === "waiting_for_sale" ||
          status === "waiting" ||
          !r.id
        );
      });

      console.log(
        "DEBUG: Filtered pending returns count:",
        pendingOnly.length,
        "→ will be sent to sync",
      );

      return pendingOnly;
    } catch (err) {
      console.error("DEBUG: getPendingSaleReturns ERROR:", err);
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      return [];
    } finally {
      console.log("DEBUG: getPendingSaleReturns ENDED");
    }
  }

  async deletePendingSaleReturn(localId) {
    await this.db.delete("pending_sale_returns", localId);
    console.log("Deleted pending sale return:", localId);
  }

  async deletePendingSale(localId) {
    if (!this._ensureDb()) return false;

    try {
      // Delete main sale record
      await this.db.delete("sales", localId);

      // Delete related sale items
      const items = await this.getSaleItems(localId);
      for (const item of items) {
        await this.db.delete("sale_items", item.id || item.local_id);
      }

      console.log(`✅ Pending sale and its items deleted: ${localId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete pending sale ${localId}:`, error);
      return false;
    }
  }

  async updatePendingSaleReturn(localId, updates) {
    const tx = this.db.transaction("pending_sale_returns", "readwrite");
    const store = tx.objectStore("pending_sale_returns");

    const existing = await store.get(localId);
    if (!existing) {
      console.warn("Pending sale return not found:", localId);
      return;
    }

    const updated = { ...existing, ...updates };
    await store.put(updated);
    await tx.done;

    console.log("Updated pending sale return:", localId, updates);
  }

  // async getAllSales() {
  //   return await this.db.getAll("sales");
  // }

  async getAllSales() {
    if (!this._ensureDb()) return [];

    try {
      const transaction = this.db.transaction(["sales"], "readonly");
      const store = transaction.objectStore("sales");

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = (err) => {
          console.error("Failed to get all sales:", err);
          resolve([]);
        };
      });
    } catch (err) {
      console.error("Error getting all sales:", err);
      return [];
    }
  }

  async addSale(sale) {
    await this.db.put("sales", sale);
  }

  cacheServerSales = async (serverSalesArray) => {
    console.group("🔥 cacheServerSales");

    if (!this.db) {
      console.error("this.db is null!");
      console.groupEnd();
      return;
    }

    console.log(`Processing ${serverSalesArray.length} server sales`);

    const tx = this.db.transaction("sales", "readwrite");
    const store = tx.objectStore("sales");

    try {
      // First, delete ALL existing synced sales
      // const allSales = await store.getAll();

      // // Find sales with sync_status = "synced" and delete them
      // const syncedSales = allSales.filter(
      //   (sale) => sale.sync_status === "synced",
      // );
      // console.log(`Deleting ${syncedSales.length} existing synced sales`);

      // for (const sale of syncedSales) {
      //   // Use the correct key (local_id) to delete
      //   await store.delete(sale.local_id || sale.id);
      // }

      // Now store new server sales
      for (const sale of serverSalesArray) {
        console.log(`Storing sale ID: ${sale.id}`);

        // Create a UNIQUE local_id for server sales
        // Use server id with prefix to avoid conflicts with offline sales
        const local_id = `server_${sale.id}`;

        // Create sale object
        const saleToStore = {
          // Copy all server fields
          ...sale,
          // Set the key (local_id)
          local_id: local_id,
          // Set sync_status and is_offline
          sync_status: "synced",
          is_offline: false,
          // Ensure id is set
          id: sale.id,
          // Set timestamps
          updated_at: new Date().toISOString(),
          created_at: sale.created_at || new Date().toISOString(),
        };

        console.log(
          `Storing with local_id: ${saleToStore.local_id}, id: ${saleToStore.id}`,
        );
        await store.put(saleToStore);
      }

      await tx.done;
      console.log(`✅ Successfully stored ${serverSalesArray.length} sales`);
    } catch (err) {
      console.error("Cache failed:", err);
      console.groupEnd();
      throw err;
    }

    console.groupEnd();
  };
  async getAllSalesForDisplay() {
    if (!this.db) throw new Error("DB not initialized");

    try {
      // Get ALL sales from the database
      const allSales = await this.db.getAll("sales");

      console.log(`📊 Found ${allSales.length} sales in IndexedDB`);

      // Sort by created_at (newest first) and return all
      allSales.sort(
        (a, b) =>
          new Date(b.created_at || b.date) - new Date(a.created_at || a.date),
      );

      return allSales;
    } catch (error) {
      console.error("Error getting sales for display:", error);
      return [];
    }
  }

  async cacheServerSaleReturns(serverReturnsArray) {
    if (!this._ensureDb()) return;

    try {
      const tx = this.db.transaction("pending_sale_returns", "readwrite");
      const store = tx.objectStore("pending_sale_returns");

      console.log(`Caching ${serverReturnsArray.length} server sale returns`);

      for (const ret of serverReturnsArray) {
        const localId = `server_${ret.id}`;

        const existing = await store.get(localId);

        const returnToStore = {
          ...ret,
          local_id: localId,
          sync_status: "synced",
          updated_at: new Date().toISOString(),

          ...existing,
        };

        await store.put(returnToStore);
      }

      await tx.done;
      console.log(
        `Successfully cached/updated ${serverReturnsArray.length} server returns`,
      );
    } catch (err) {
      console.error("Failed to cache server sale returns:", err);
    }
  }
  async getCachedServerSaleReturns() {
    if (!this._ensureDb()) return [];

    try {
      const all = await this.db.getAll("pending_sale_returns");
      return all.filter(
        (r) => r.sync_status === "synced" && r.local_id?.startsWith("server_"),
      );
    } catch (err) {
      console.error("Failed to get cached server returns:", err);
      return [];
    }
  }

  // async getAllSaleReturnsForDisplay() {
  //   console.log("🔍 SIMPLE: Returning empty array for now");
  //   return []; // Temporary fix
  // }

  // async getAllSaleReturnsForDisplay() {
  //   if (!this._ensureDb()) {
  //     console.log("❌ DB not ready in getAllSaleReturnsForDisplay");
  //     return [];
  //   }

  //   console.log("🔍 Starting getAllSaleReturnsForDisplay...");

  //   return new Promise((resolve, reject) => {
  //     try {
  //       const transaction = this.db.transaction(
  //         ["pending_sale_returns"],
  //         "readonly",
  //       );
  //       const store = transaction.objectStore("pending_sale_returns");

  //       console.log("📊 Transaction created, getting all records...");

  //       const request = store.getAll();

  //       request.onsuccess = (event) => {
  //         console.log("✅ getAll request succeeded");
  //         try {
  //           const allReturns = event.target.result || [];
  //           console.log(
  //             `📊 Got ${allReturns.length} total records from pending_sale_returns`,
  //           );

  //           // Filter for synced or pending status
  //           const filteredReturns = allReturns.filter(
  //             (ret) =>
  //               ret.sync_status === "synced" || ret.sync_status === "pending",
  //           );

  //           console.log(
  //             `✅ Filtered to ${filteredReturns.length} returns (synced + pending)`,
  //           );

  //           // Simple logging without forEach to avoid errors
  //           if (filteredReturns.length > 0) {
  //             console.log("📋 First few returns:", filteredReturns.slice(0, 3));
  //           }

  //           resolve(filteredReturns);
  //         } catch (filterError) {
  //           console.error("❌ Error filtering returns:", filterError);
  //           resolve([]); // Return empty array on error
  //         }
  //       };

  //       request.onerror = (event) => {
  //         console.error("❌ getAll request failed:", event.target.error);
  //         resolve([]); // Return empty array on error
  //       };

  //       // Add timeout to prevent hanging
  //       setTimeout(() => {
  //         console.log(
  //           "⏰ Timeout in getAllSaleReturnsForDisplay - returning empty array",
  //         );
  //         resolve([]);
  //       }, 5000); // 5 second timeout
  //     } catch (error) {
  //       console.error("❌ Error creating transaction:", error);
  //       resolve([]); // Return empty array on error
  //     }
  //   });
  // }

  async deleteSale(localId) {
    if (!this._ensureDb()) return;
    await this.db.delete("sales", localId);
    console.log(`Deleted pending sale: ${localId}`);

    const items = await this.getSaleItems(localId);
    for (const item of items) {
      await this.db.delete("sale_items", item.local_id || item.id);
    }
  }

  async getAllSaleReturnsForDisplay() {
    if (!this._ensureDb()) return [];

    console.log("🔍 Getting all sale returns for display...");

    try {
      // pending_sale_returns
      const allReturns = await this.db.getAll("pending_sale_returns");

      console.log(
        `📊 Found ${allReturns.length} records in pending_sale_returns`,
      );

      const filtered = allReturns.filter(
        (r) => r && (r.sync_status === "pending" || r.sync_status === "synced"),
      );

      console.log(`✅ Returning ${filtered.length} filtered sale returns`);

      return filtered;
    } catch (err) {
      console.error("❌ Error loading sale returns:", err);
      return [];
    }
  }

  // Pending purchase return save
  async addPendingPurchaseReturn(returnData) {
    if (!this._ensureDb()) return null;

    const pending = {
      ...returnData,
      local_id: `pending_pr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      sync_status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await this.db.put("pending_purchase_returns", pending);
      console.log("Pending purchase return saved:", pending.local_id);
      return pending;
    } catch (err) {
      console.error("Failed to save pending purchase return:", err);
      throw err;
    }
  }

  // Pending purchase returns
  async getPendingPurchaseReturns() {
    if (!this._ensureDb()) return [];

    try {
      const all = await this.db.getAll("pending_purchase_returns");
      const pending = all.filter((r) => r.sync_status === "pending");
      console.log(`Found ${pending.length} pending purchase returns`);
      return pending;
    } catch (err) {
      console.error("Failed to get pending purchase returns:", err);
      return [];
    }
  }

  // Server-synced purchase returns
  async cacheServerPurchaseReturns(serverReturns) {
    if (!this._ensureDb()) return;

    const tx = this.db.transaction("pending_purchase_returns", "readwrite");
    const store = tx.objectStore("pending_purchase_returns");

    for (const ret of serverReturns) {
      const localId = `server_pr_${ret.id}`;
      await store.put({
        ...ret,
        local_id: localId,
        sync_status: "synced",
        updated_at: new Date().toISOString(),
      });
    }

    await tx.done;
    console.log(`Cached ${serverReturns.length} server purchase returns`);
  }

  async getAllPurchaseReturnsForDisplay() {
    if (!this._ensureDb()) return [];

    console.log(
      "🔍 Getting all purchase returns for display (pending + synced)...",
    );

    try {
      // 1. Pending returns
      const pendingReturns =
        (await this.db.getAll("pending_purchase_returns")) || [];
      console.log(`📊 Found ${pendingReturns.length} pending purchase returns`);

      // 2. Synced / cached server returns

      const allReturns =
        (await this.db.getAll("pending_purchase_returns")) || [];

      // 3. Pending + Synced filter
      const filtered = allReturns.filter(
        (r) => r.sync_status === "pending" || r.sync_status === "synced",
      );

      console.log(
        `✅ Returning ${filtered.length} total purchase returns (pending + synced)`,
      );

      return filtered;
    } catch (err) {
      console.error("❌ Error loading purchase returns:", err);
      return [];
    }
  }

  async deletePendingPurchaseReturn(localId) {
    if (!this._ensureDb()) return;
    await this.db.delete("pending_purchase_returns", localId);
    console.log("Deleted pending purchase return:", localId);
  }

  // ========== SYNC QUEUE OPERATIONS ==========
  async addToSyncQueue(actionType, data, retryCount = 0) {
    const queueItem = {
      action_type: actionType,
      data: data,
      status: "pending",
      retry_count: retryCount,
      created_at: new Date().toISOString(),
      last_attempt: null,
      error_message: null,
    };

    return await this.db.add("sync_queue", queueItem);
  }

  async getSaleByLocalId(localId) {
    const tx = this.db.transaction("sales", "readonly");
    const store = tx.objectStore("sales");
    const index = store.index("local_id");
    return await index.get(localId);
  }

  async getPendingSyncItems() {
    const index = this.db.transaction("sync_queue").store.index("status");
    return await index.getAll("pending");
  }

  async updateSyncItem(id, updates) {
    const tx = this.db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");

    const item = await store.get(id);
    if (!item) throw new Error("Sync item not found");

    const updatedItem = { ...item, ...updates };
    await store.put(updatedItem);
    await tx.done;

    return updatedItem;
  }

  // Add or update business data
  async addBusiness(businessData) {
    if (!this.db) return;
    const tx = this.db.transaction("business", "readwrite");
    const store = tx.objectStore("business");
    await store.put({
      id: 1,
      ...businessData,
      cached_at: new Date().toISOString(),
    });
  }

  // Get cached business data
  async getBusiness() {
    if (!this.db) return null;
    const tx = this.db.transaction("business", "readonly");
    const store = tx.objectStore("business");
    return await store.get(1);
  }

  // ========== SETTINGS OPERATIONS ==========
  async saveSetting(key, value) {
    return await this.db.put("settings", { key, value });
  }

  async getSetting(key) {
    const setting = await this.db.get("settings", key);
    return setting ? setting.value : null;
  }

  // ========== UTILITY METHODS ==========
  async clearAllData() {
    const stores = [
      "products",
      "sales",
      "sale_items",
      "customers",
      "sync_queue",
    ];

    for (const storeName of stores) {
      await this.db.clear(storeName);
    }

    console.log("All offline data cleared");
  }

  async getDatabaseSize() {
    let totalSize = 0;
    const stores = [
      "products",
      "sales",
      "sale_items",
      "customers",
      "sync_queue",
    ];

    for (const storeName of stores) {
      const items = await this.db.getAll(storeName);
      totalSize += JSON.stringify(items).length;
    }

    return totalSize;
  }
}

// Create singleton instance
const offlineDB = new OfflineDB();

// Initialize on app start
export const initOfflineDB = async () => {
  try {
    await offlineDB.init();
    console.log("Offline DB ready");

    // Check if we need to sync initial data
    const lastSync = await offlineDB.getSetting("last_sync");
    if (!lastSync) {
      console.log("First time setup - will sync data when online");
    }

    return offlineDB;
  } catch (error) {
    console.error("Failed to init offline DB:", error);
    throw error;
  }
};

export default offlineDB;
