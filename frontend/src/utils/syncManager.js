import offlineDB from "./offlineDB";
import api from "./api";
import networkManager from "./networkManager";
import { toast } from "sonner";

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.maxRetries = 5;
    this.syncInterval = 30000; // 30 seconds
    this.syncTimer = null;

    // Auto-start periodic sync checks
    this.startAutoSync();

    // Trigger sync when going online
    networkManager.addSyncListener(() => this.syncWhenOnline());
  }

  startAutoSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);

    this.syncTimer = setInterval(async () => {
      if (networkManager.canSync() && !this.isSyncing) {
        await this.syncWhenOnline();
      }
    }, this.syncInterval);

    console.log("Auto-sync started (every 30s check)");
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async syncWhenOnline() {
    console.log("DEBUG: syncWhenOnline STARTED");
    if (this.isSyncing || !networkManager.canSync()) {
      console.log("DEBUG: Skipped - isSyncing or cannot sync");
      return;
    }

    this.isSyncing = true;
    console.log("🔄 Sync process started");

    try {
      console.log("DEBUG: Inside try block");
      let syncedCount = 0;
      let failedCount = 0;

      // 1. Sync pending SALES (most important)
      const pendingSales = await offlineDB.getPendingSales();
      for (const sale of pendingSales) {
        const result = await this.syncSale(sale);
        result.success ? syncedCount++ : failedCount++;
      }

      console.log("DEBUG: Before getPendingSaleReturns()");
      const pendingSaleReturns = await offlineDB.getPendingSaleReturns();
      console.log(
        "DEBUG: After getPendingSaleReturns() - length:",
        pendingSaleReturns.length,
      );

      console.log(
        `Found ${pendingSaleReturns.length} pending sale returns to sync`,
      );

      for (const ret of pendingSaleReturns) {
        console.log("DEBUG: Processing return:", ret.local_id);
        try {
          const payload = {
            sale_id: ret.sale_id,
            return_date: ret.return_date,
            reason: ret.reason,
            items: ret.items,
            refund_amount: ret.refund_amount,
            notes: ret.notes || "",
          };

          console.log("Sending sale return to backend:", payload);

          const response = await api.fetch("/sales-returns", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (response?.success && response.sale_return?.id) {
            await offlineDB.deletePendingSaleReturn(ret.local_id);
            console.log(`Deleted pending sale return: ${ret.local_id}`);

            response.updated_products?.forEach((updated) => {
              offlineDB.updateProduct(updated.id, {
                stock: updated.stock,
                pending_stock_change: 0,
                sync_status: "synced",
              });
            });

            toast.success("Sale return synced!");
            syncedCount++;
          } else {
            throw new Error("Sale return sync failed");
          }
        } catch (err) {
          console.error(`Failed to sync sale return ${ret.local_id}:`, err);

          const retryCount = (ret.retry_count || 0) + 1;
          await offlineDB.updatePendingSaleReturn(ret.local_id, {
            retry_count: retryCount,
            error_message: err.message,
          });

          if (retryCount >= 5) {
            await offlineDB.updatePendingSaleReturn(ret.local_id, {
              sync_status: "failed",
            });
          }

          failedCount++;
        }
      }

      console.log("DEBUG: Sale returns sync completed");

      const pendingPurchaseReturns =
        await offlineDB.getPendingPurchaseReturns();
      console.log(
        `Found ${pendingPurchaseReturns.length} pending purchase returns to sync`,
      );

      for (const ret of pendingPurchaseReturns) {
        console.log("DEBUG: Processing purchase return:", ret.local_id);

        try {
          const retryCount = ret.retry_count || 0;
          if (retryCount >= this.maxRetries) {
            await offlineDB.updatePendingPurchaseReturn?.(ret.local_id, {
              sync_status: "failed",
              error_message: "Maximum retry attempts reached",
            });
            toast.error(
              `Purchase return sync failed after retries: ${ret.local_id}`,
            );
            failedCount++;
            continue;
          }

          const payload = {
            purchase_id: ret.purchase_id,
            return_date: ret.return_date,
            reason: ret.reason,
            items: ret.items,
            refund_amount: ret.refund_amount,
            notes: ret.notes || "",
          };

          console.log("Sending purchase return to backend:", payload);

          const response = await api.fetch("/purchase-returns", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (response?.success && response.purchase_return?.id) {
            const serverReturn = response.purchase_return;

            // Delete pending record
            await offlineDB.deletePendingPurchaseReturn?.(ret.local_id);
            console.log(`Deleted pending purchase return: ${ret.local_id}`);

            // Cache real server return
            await offlineDB.cacheServerPurchaseReturns?.([serverReturn]);

            if (response.updated_products) {
              for (const updated of response.updated_products) {
                await offlineDB.updateProduct(updated.id, {
                  stock: updated.stock,
                  pending_stock_change: 0,
                  sync_status: "synced",
                  updated_at: new Date().toISOString(),
                });
                console.log(
                  `Stock reconciled for product ${updated.id}: ${updated.stock}`,
                );
              }
            }

            toast.success(
              `Purchase return synced! Return #: ${serverReturn.return_number || serverReturn.id}`,
            );
            syncedCount++;
          } else {
            throw new Error(response?.message || "Purchase return sync failed");
          }
        } catch (err) {
          console.error(`Failed to sync purchase return ${ret.local_id}:`, err);

          const retryCount = (ret.retry_count || 0) + 1;
          await offlineDB.updatePendingPurchaseReturn?.(ret.local_id, {
            retry_count: retryCount,
            error_message: err.message,
            last_attempt: new Date().toISOString(),
          });

          if (retryCount >= this.maxRetries) {
            await offlineDB.updatePendingPurchaseReturn?.(ret.local_id, {
              sync_status: "failed",
            });
            toast.error(
              `Purchase return sync permanently failed: ${ret.local_id}`,
            );
          } else {
            toast.warning(
              `Purchase return sync failed (retry ${retryCount}/${this.maxRetries})`,
            );
          }

          failedCount++;
        }
      }
      // 2. Sync pending CUSTOMERS
      const pendingCustomers = await offlineDB.db.getAllFromIndex(
        "customers",
        "sync_status",
        "pending",
      );
      for (const customer of pendingCustomers) {
        const result = await this.syncCustomer(customer);
        result.success ? syncedCount++ : failedCount++;
      }

      // Sync pending PURCHASES
      const pendingPurchases = await offlineDB.getPendingPurchases();

      console.log(`Found ${pendingPurchases.length} pending purchases to sync`);

      for (const purchase of pendingPurchases) {
        try {
          // 1. Retry count check
          const retryCount = purchase.retry_count || 0;
          if (retryCount >= 5) {
            await offlineDB.updatePendingPurchase(purchase.local_id, {
              sync_status: "failed",
              error_message: "Maximum retry attempts reached",
            });
            console.warn(
              `Max retries reached for ${purchase.local_id} - marked as failed`,
            );
            failedCount++;
            toast.error(
              `Purchase sync failed after retries: ${purchase.local_id}`,
            );
            continue;
          }

          // 2. Payload prepare
          const payload = {
            supplier_id: purchase.supplier_id,
            date: purchase.date,
            items: purchase.items,
            discount: purchase.discount || 0,
            transport_cost: purchase.transport_cost || 0,
            paid_amount: purchase.paid_amount || 0,
            notes: purchase.notes || "",
          };

          console.log("Sending purchase to backend:", payload);

          // 3. API call
          const response = await api.fetch("/purchases", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          // 4. Success check
          if (response?.success && response.purchase?.id) {
            const serverPurchase = response.purchase;

            // Delete pending record
            await offlineDB.deletePendingPurchase(purchase.local_id);
            console.log(`Deleted pending purchase: ${purchase.local_id}`);

            // ★★★ Real server purchase
            await offlineDB.addPurchase?.({
              ...serverPurchase,
              sync_status: "synced",
              local_id: null,
            });

            // ★★★ Stock reconcile
            if (response.updated_products) {
              for (const updated of response.updated_products) {
                await offlineDB.updateProduct(updated.id, {
                  stock: updated.stock, // real final stock
                  pending_stock_change: 0,
                  sync_status: "synced",
                  updated_at: new Date().toISOString(),
                });
                console.log(
                  `Stock reconciled for product ${updated.id}: ${updated.stock}`,
                );
              }
            }

            toast.success(
              `Purchase synced! Invoice: ${serverPurchase.invoice_number || serverPurchase.id}`,
            );
            syncedCount++;
          } else {
            throw new Error(
              response?.message || "Purchase sync failed - no ID returned",
            );
          }
        } catch (err) {
          console.error(`Failed to sync purchase ${purchase.local_id}:`, err);

          // Update retry count & error message
          const updated = {
            ...purchase,
            retry_count: (purchase.retry_count || 0) + 1,
            last_attempt: new Date().toISOString(),
            error_message: err.message || "Unknown sync error",
          };

          await offlineDB.updatePendingPurchase(purchase.local_id, updated);

          // Max retry
          if (updated.retry_count >= 5) {
            await offlineDB.updatePendingPurchase(purchase.local_id, {
              sync_status: "failed",
            });
            toast.error(
              `Purchase sync permanently failed: ${purchase.local_id}`,
            );
          } else {
            toast.warning(
              `Purchase sync failed (retry ${updated.retry_count}/5)`,
            );
          }

          failedCount++;
        }
      }

      // 3. Sync pending CATEGORIES (created offline)
      const pendingCategories = await offlineDB
        .getAllCategories()
        .then((cats) => cats.filter((c) => c.sync_status === "pending"));

      console.log(
        `Found ${pendingCategories.length} pending categories to sync`,
      );

      for (const category of pendingCategories) {
        try {
          const payload = {
            name: category.name.trim(),
            description: category.description?.trim() || "",
          };

          console.log("Sending category to backend:", payload);

          const response = await api.fetch("/categories", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (response?.success && response.category?.id) {
            const serverCategory = response.category;

            if (category.local_id) {
              await offlineDB.deleteCategory(category.local_id);
              console.log(`Deleted temp category: ${category.local_id}`);
            }

            await offlineDB.addCategory({
              ...serverCategory,
              local_id: null,
              sync_status: "synced",
            });

            console.log(
              `Category "${category.name}" synced → server ID ${serverCategory.id}`,
            );
            toast.success(`Category "${category.name}" synced to server!`);
            syncedCount++;
          }
        } catch (err) {
          console.error(`Category sync failed "${category.name}":`, err);
          failedCount++;
        }
      }

      // 4. Sync pending PRODUCTS (created offline)
      const pendingProducts = await offlineDB
        .getAllProducts()
        .then((prods) =>
          prods.filter(
            (p) => p.sync_status === "pending" && p.local_id != null,
          ),
        );

      console.log(`Found ${pendingProducts.length} pending products to sync`);

      for (const product of pendingProducts) {
        try {
          const payload = {
            name: product.name?.trim() || "",
            sku: product.sku?.trim() || "",
            category_id: product.category_id
              ? parseInt(product.category_id, 10)
              : null,
            cost_price: Number(product.cost_price) || 0,
            price: Number(product.price) || 0,
            low_stock_alert: parseInt(product.low_stock_alert || 10, 10),

            unit_id: product.unit_id ? parseInt(product.unit_id, 10) : null,
            supplier_id: product.supplier_id
              ? parseInt(product.supplier_id, 10)
              : null,
            stock: parseInt(product.stock || 0, 10),
            color: product.color?.trim() || null,
            size: product.size?.trim() || null,
            expire_date: product.expire_date || null,
            description: product.description?.trim() || "",
          };

          const response = await api.fetch("/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (response?.success && response.product?.id) {
            const serverProduct = response.product;

            await offlineDB.db.put("products", {
              ...product,
              id: serverProduct.id,
              local_id: null,
              sync_status: "synced",
              updated_at: new Date().toISOString(),
            });

            await offlineDB.deleteProduct(product.local_id);

            syncedCount++;
            toast.success(`Synced: ${product.name}`);
          }
        } catch (err) {
          console.error(`Sync failed for ${product.name || product.id}`, err);
          failedCount++;
        }
      }

      // 4. Process general sync queue (future actions: stock adjust, delete, etc.)
      const queueItems = await offlineDB.getPendingSyncItems();
      for (const item of queueItems) {
        const result = await this.syncQueueItem(item);
        result.success ? syncedCount++ : failedCount++;
      }

      // Save last sync time
      const now = new Date().toISOString();
      await offlineDB.saveSetting("last_sync", now);

      console.log(
        `✅ Sync completed: ${syncedCount} synced, ${failedCount} failed`,
      );
    } catch (error) {
      console.error("Sync process error:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncSale(sale) {
    try {
      const items = await offlineDB.getSaleItems(sale.local_id);

      if (!items || items.length === 0) {
        throw new Error("No items found in sale");
      }

      const payload = {
        customer_id: sale.customer_id || null,
        items: items.map((item) => ({
          product_id: parseInt(item.product_id || item.id),
          quantity: parseInt(item.quantity),
        })),
        discount: parseFloat(sale.discount || sale.discount_amount || 0),
        shipping: parseFloat(sale.shipping || 0),
        tax: 0,
        payment_method: sale.payment_method || "cash",
        paid_amount: parseFloat(sale.paid_amount || sale.total_amount || 0),
        notes: sale.notes || "",
      };

      console.log("🔥 SALE SYNC PAYLOAD:", JSON.stringify(payload, null, 2));

      const response = await api.fetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response?.success && (response.sale || response.id)) {
        const serverId = response.sale?.id || response.id;

        // Update sale
        await offlineDB.updateSaleStatus(sale.local_id, "synced", serverId);
        await offlineDB.db.put("sales", {
          ...sale,
          id: serverId,
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        });

        console.log(
          `✅ SALE SYNCED: local_${sale.local_id} → server_${serverId}`,
        );

        await offlineDB.deletePendingSale(sale.local_id);
        console.log(
          `🗑️ Deleted pending sale after successful sync: ${sale.local_id}`,
        );

        // ★★★★ PENDING RETURNS
        const pendingReturns = await offlineDB.db.getAllFromIndex(
          "pending_sale_returns",
          "original_sale_id",
          sale.local_id,
        );

        if (pendingReturns.length > 0) {
          console.log(
            `🔄 Found ${pendingReturns.length} pending returns depending on this sale`,
          );

          for (const ret of pendingReturns) {
            await offlineDB.db.put("pending_sale_returns", {
              ...ret,
              sale_id: serverId, // real server ID
              sync_status: "pending", //
              error_message: null,
              updated_at: new Date().toISOString(),
            });

            console.log(
              `   Updated return ${ret.local_id} with sale_id: ${serverId}`,
            );
          }
          await offlineDB.deleteSale(sale.local_id);

          setTimeout(() => syncManager.syncWhenOnline(), 1000);
        }

        return { success: true };
      }

      throw new Error(response?.message || "Sale creation failed");
    } catch (error) {
      console.error(`Sale sync failed (local_${sale.local_id}):`, error);
      await offlineDB.updateSaleStatus(sale.local_id, "failed");
      return { success: false };
    }
  }
  async getPendingSaleReturnsForSale(localSaleId) {
    const allPending = await this.getPendingSaleReturns();
    return allPending.filter(
      (r) =>
        r.original_sale_local_id === localSaleId || r.sale_id === localSaleId,
    );
  }
  async syncCustomer(customer) {
    try {
      const cleanData = {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email ? customer.email.trim() : null,
        branch_id:
          customer.branch_id ||
          parseInt(localStorage.getItem("currentBranchId") || 1),
      };

      console.log("Sync payload:", cleanData); // Debug

      const response = await api.fetch("/customers", {
        method: "POST",
        body: JSON.stringify(cleanData),
      });

      if (response && response.success) {
        const serverCustomer = response.customer || response.data;

        await offlineDB.addCustomer({
          ...customer,
          id: serverCustomer.id,
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        });

        console.log("Customer synced:", serverCustomer.id);
        return true;
      } else {
        throw new Error(response?.message || "Validation failed");
      }
    } catch (error) {
      console.error("Sync failed:", error);
      return false;
    }
  }
  async syncProduct(product) {
    try {
      const payload = {
        name: product.name,
        sku: product.sku,
        category_id: product.category_id,
        unit_id: product.unit_id,
        supplier_id: product.supplier_id,
        cost_price: parseFloat(product.cost_price),
        price: parseFloat(product.price),
        stock_quantity: parseInt(product.stock_quantity || product.stock || 0),
        low_stock_alert: parseInt(product.low_stock_alert || 10),
        expire_date: product.expire_date || null,
        description: product.description || "",
        color: product.color || null,
        size: product.size || null,
      };

      console.log("🔥 PRODUCT SYNC PAYLOAD:", JSON.stringify(payload, null, 2));

      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:8000/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server validation error:", data);
        throw new Error(
          data.message || "Product sync failed - check validation",
        );
      }

      if (data.success && data.product?.id) {
        const serverProduct = data.product;

        // Update local record
        await offlineDB.updateProduct(product.local_id || product.id, {
          id: serverProduct.id,
          local_id: null, // Clear temp ID
          sync_status: "synced",
          updated_at: new Date().toISOString(),
          // Merge other server fields if needed
          ...serverProduct,
        });

        console.log(
          `Product "${product.name}" synced → server ID ${serverProduct.id}`,
        );
        return { success: true };
      }

      throw new Error("No product ID returned from server");
    } catch (error) {
      console.error(
        `Product sync failed (${product.name || product.id}):`,
        error,
      );
      return { success: false };
    }
  }

  async syncQueueItem(item) {
    try {
      console.log(`🔄 Processing queue item ${item.id} (${item.action_type})`);

      switch (item.action_type) {
        case "create_sale":
          // Extract sale data from queue item
          const saleData = item.data;

          // Check if this sale has already been synced from pending sales
          const existingSale = await offlineDB.getSale(saleData.sale_id);

          if (existingSale && existingSale.sync_status === "synced") {
            // Already synced, remove from queue
            console.log(
              `✅ Sale ${saleData.sale_id} already synced, removing from queue`,
            );
            await offlineDB.db.delete("sync_queue", item.id);
            return { success: true };
          }

          // If sale still exists and is pending, sync it
          if (existingSale && existingSale.sync_status === "pending") {
            const result = await this.syncSale(existingSale);

            if (result.success) {
              // Remove from sync queue after successful sync
              await offlineDB.db.delete("sync_queue", item.id);
              console.log(`✅ Queue item ${item.id} processed and removed`);
            } else {
              // Update retry count
              await offlineDB.db.put("sync_queue", {
                ...item,
                retry_count: (item.retry_count || 0) + 1,
                last_attempt: new Date().toISOString(),
                error_message: result.error?.message || "Sync failed",
              });
            }
            return result;
          }

          // Sale not found, remove from queue
          console.log(
            `⚠️ Sale ${saleData.sale_id} not found, removing from queue`,
          );
          await offlineDB.db.delete("sync_queue", item.id);
          return { success: false, error: "Sale not found" };

        default:
          console.log(`❓ Unknown action type: ${item.action_type}`);
          return { success: false, error: "Unknown action type" };
      }
    } catch (error) {
      console.error(`❌ Error processing queue item ${item.id}:`, error);

      // Update queue item with error
      await offlineDB.db.put("sync_queue", {
        ...item,
        retry_count: (item.retry_count || 0) + 1,
        last_attempt: new Date().toISOString(),
        error_message: error.message,
      });

      return { success: false, error: error.message };
    }
  }
  // Manual sync (for button)
  async manualSync() {
    if (!networkManager.canSync()) {
      throw new Error("Offline - cannot sync");
    }
    return this.syncWhenOnline();
  }

  // Status for UI
  async getSyncStatus() {
    const pendingSales = (await offlineDB.getPendingSales()).length;
    const pendingCustomers = (
      await offlineDB.db.getAllFromIndex("customers", "sync_status", "pending")
    ).length;
    const pendingProducts = (
      await offlineDB.db.getAllFromIndex("products", "sync_status", "pending")
    ).length;
    const pendingPurchaseReturns = (await offlineDB.getPendingPurchaseReturns())
      .length;
    const failedSales = await offlineDB.db.getAllFromIndex(
      "sales",
      "sync_status",
      "failed",
    );

    const lastSync = await offlineDB.getSetting("last_sync");

    return {
      isSyncing: this.isSyncing,
      pendingSales,
      pendingCustomers,
      pendingProducts,
      pendingPurchaseReturns,
      pendingQueueItems: (await offlineDB.getPendingSyncItems()).length,
      failedItems: failedSales.length,
      lastSync,
      totalPending:
        pendingSales +
        pendingCustomers +
        pendingProducts +
        pendingPurchaseReturns,
    };
  }
}

// Singleton
const syncManager = new SyncManager();

export default syncManager;
