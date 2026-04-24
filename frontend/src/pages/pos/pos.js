import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Maximize,
  LayoutDashboard,
  Package,
  Hand,
  RotateCcw,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import "./pos.css";
import AddCustomerModal from "../customer/AddCustomerModal";
import HoldOrdersModal from "./HoldOrdersModal";
import PaymentModal from "./PaymentModal";
import api from "../../utils/api";
import offlineDB from "../../utils/offlineDB";

const POS = ({ onClose, onDashboardClick, currentBranch, isOnline = true }) => {
  const [customer, setCustomer] = useState(null);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [discount, setDiscount] = useState("0.00");
  const [shipping, setShipping] = useState("0.00");
  const [holdOrders, setHoldOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCustomerModelOpen, setIsCustomerModelOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdOrdersLoading, setHoldOrdersLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [business, setBusiness] = useState(null);
  const [currentHoldReference, setCurrentHoldReference] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!isOnline);

  const fetchCategories = async () => {
    let categoriesData = [];

    // === ONLINE: Try to fetch fresh categories ===
    if (isOnline) {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/pos/categories",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.categories)) {
            categoriesData = data.categories;

            // Cache each category for offline use
            for (const cat of categoriesData) {
              try {
                await offlineDB.addCategory(cat);
                console.log("Category cached:", cat.name);
              } catch (err) {
                console.warn("Failed to cache category:", cat.name);
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to fetch categories online:", error);
        // Continue to offline fallback
      }
    }

    // === OFFLINE FALLBACK: Use cached categories ===
    if (categoriesData.length === 0) {
      try {
        const cached = await offlineDB.getAllCategories();
        if (Array.isArray(cached) && cached.length > 0) {
          categoriesData = cached;
          console.log("Loaded categories from offline cache:", cached.length);
        } else {
          console.log("No cached categories found");
        }
      } catch (error) {
        console.error("Failed to load cached categories:", error);
      }
    }

    // 🔥 ALWAYS update state — this is critical!
    setCategories(categoriesData);

    // Optional: log final result
    console.log(
      "Final categories set:",
      categoriesData.map((c) => c.name),
    );
  };
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      let productsData = [];

      // Always try online first if isOnline
      if (isOnline) {
        try {
          const response = await api.getProducts();
          console.log("Online API Response:", response); // Debug log

          // Adjust based on your Laravel response format
          let onlineProducts = [];
          if (
            response.success &&
            response.products &&
            Array.isArray(response.products.data)
          ) {
            onlineProducts = response.products.data;
          } else if (response.success && Array.isArray(response.data)) {
            onlineProducts = response.data;
          } else if (Array.isArray(response)) {
            onlineProducts = response;
          }

          if (onlineProducts.length > 0) {
            productsData = onlineProducts;
            toast.success(
              `Fresh products loaded from server (${productsData.length})`,
            );
          }
        } catch (onlineError) {
          console.error("Online fetch completely failed:", onlineError);
          toast.error("Server connection failed — using offline cache");
        }
      }

      // Only fallback to offline if no online data
      if (productsData.length === 0) {
        try {
          const cached = await offlineDB.getAllProducts();
          if (Array.isArray(cached) && cached.length > 0) {
            productsData = cached;
            toast.info(`Using offline cached products (${cached.length})`);
          } else {
            toast.warning("No products available (no cache yet)");
          }
        } catch (offlineError) {
          console.error("Offline cache failed:", offlineError);
          toast.error("Failed to load products");
        }
      }

      // Format and set
      const formatted = productsData.map((p) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.selling_price || p.price || 0),
        image:
          p.image_url ||
          (p.image ? `http://127.0.0.1:8000/storage/${p.image}` : null),
        stock: parseInt(p.stock_quantity || p.stock || 0),
        category: p.category_id || 1,
      }));

      setProducts(formatted);
    } catch (error) {
      console.error("Critical error:", error);
      setProducts([]);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchBusiness();
    setIsOfflineMode(!isOnline);
  }, [isOnline, fetchProducts]);

  useEffect(() => {
    const preloadAllCustomers = async () => {
      if (isOnline) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch("http://127.0.0.1:8000/api/customers", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await response.json();
          if (json.success && Array.isArray(json.customers)) {
            for (const c of json.customers) {
              await offlineDB.addCustomer(c);
            }
            console.log("All customers pre-cached for offline");
          }
        } catch (e) {
          console.log("Failed to preload customers");
        }
      }
    };

    preloadAllCustomers();
  }, [isOnline]);

  useEffect(() => {
    const loadBusiness = async () => {
      // Try IndexedDB first (stronger offline)
      let businessData = await offlineDB.getBusiness();

      // Fallback to localStorage
      if (!businessData) {
        const cached = localStorage.getItem("business");
        if (cached) {
          try {
            businessData = JSON.parse(cached);
          } catch (e) {}
        }
      }

      if (businessData) {
        setBusiness(businessData);
      }

      // Always try to refresh if online
      if (navigator.onLine) {
        fetchBusiness();
      }
    };

    loadBusiness();
  }, []);

  const fetchHoldOrders = async () => {
    try {
      setHoldOrdersLoading(true);

      let holdOrdersData = [];

      // === ONLINE: Fetch from server ===
      if (navigator.onLine) {
        try {
          const token = localStorage.getItem("authToken");
          const response = await fetch(
            "http://127.0.0.1:8000/api/sales/hold-orders",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            },
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.hold_orders)) {
              holdOrdersData = data.hold_orders;

              // Cache each hold order locally
              for (const order of holdOrdersData) {
                await offlineDB.addHoldOrder(order);
              }
              console.log("Hold orders cached for offline use");
            }
          }
        } catch (error) {
          console.warn("Failed to fetch hold orders online:", error);
          // Continue to offline fallback
        }
      }

      // === OFFLINE FALLBACK: Load from local DB ===
      if (holdOrdersData.length === 0) {
        holdOrdersData = await offlineDB.getAllHoldOrders();
        console.log("Hold orders loaded from offline cache");
      }

      // Update state
      setHoldOrders(holdOrdersData);

      return holdOrdersData;
    } catch (error) {
      console.error("Error fetching hold orders:", error);
      toast.error("Failed to load hold orders");
      return [];
    } finally {
      setHoldOrdersLoading(false);
    }
  };
  const fetchProductByBarcode = async (barcode) => {
    try {
      if (isOnline) {
        const token = localStorage.getItem("authToken");
        const res = await fetch(
          `http://127.0.0.1:8000/api/pos/products/barcode/${barcode}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (res.ok) {
          const data = await res.json();
          addToCart(data.product);
          toast.success(`${data.product.name} added via barcode!`);
        } else {
          toast.error("Product not found");
        }
      } else {
        // Offline barcode search
        const product = await offlineDB.getProductByBarcode(barcode);
        if (product) {
          addToCart({
            id: product.id,
            name: product.name,
            price: parseFloat(product.selling_price || product.price || 0),
            stock: product.stock_quantity || 0,
          });
          toast.success(`${product.name} added (offline mode)!`);
        } else {
          toast.error("Product not found in offline database");
        }
      }
    } catch (err) {
      toast.error("Scan failed");
    }
  };

  const fetchBusiness = async () => {
    // First, try to load from offline cache
    const cachedBusiness = localStorage.getItem("business");
    if (cachedBusiness) {
      try {
        const parsed = JSON.parse(cachedBusiness);
        setBusiness(parsed);
        console.log("Business data loaded from offline cache");
      } catch (e) {
        console.warn("Failed to parse cached business data");
      }
    }

    // If online, fetch fresh data and update cache
    if (!navigator.onLine) {
      console.log("Offline: Using cached business data");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/business", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      if (!res.ok) throw new Error("Fetch failed");

      const data = await res.json();

      if (data.success && data.business) {
        const businessData = data.business;

        // Save to localStorage (fast access for receipt)
        localStorage.setItem("business", JSON.stringify(businessData));

        // Also save to IndexedDB for stronger offline persistence (optional but recommended)
        if (typeof offlineDB !== "undefined") {
          await offlineDB.addBusiness(businessData).catch(console.warn);
        }

        setBusiness(businessData);
        console.log("Business data fetched and cached for offline use");
      }
    } catch (err) {
      console.log(
        "Business data fetch failed — using cached version if available",
      );
      // Don't clear cache on failure — keep old data
    }
  };

  // localStorage.setItem("business", JSON.stringify(businessData));

  // Add to cart
  const addToCart = (product) => {
    // Check stock availability
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    // Check if quantity in cart exceeds available stock
    const existing = cart.find((item) => item.id === product.id);
    const currentInCart = existing ? existing.quantity : 0;

    if (currentInCart >= product.stock) {
      toast.error(`Only ${product.stock} items available`);
      return;
    }

    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
      toast.success(`${product.name} added to cart`);
    }
  };

  // Update quantity
  const updateQuantity = (id, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(id);
      return;
    }

    // Find the product to check stock
    const productItem = cart.find((item) => item.id === id);
    const productInfo = products.find((p) => p.id === id);

    if (productInfo && newQuantity > productInfo.stock) {
      toast.error(`Only ${productInfo.stock} items available`);
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === id ? { ...item, quantity: newQuantity } : item,
      ),
    );
  };
  // Remove from cart
  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
    toast.info("Item removed from cart");
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity, 10) || 0;
      return sum + (isNaN(price) ? 0 : price) * qty;
    }, 0);
  };
  const calculateTotalQuantity = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountValue = parseFloat(discount) || 0;
    const shippingValue = parseFloat(shipping) || 0;
    return subtotal - discountValue + shippingValue;
  };

  // Format number to 2 decimal places
  const formatNumber = (num) => {
    return parseFloat(num).toFixed(2);
  };

  // Add these handler functions for discount and shipping fields

  const handleDiscountChange = (e) => {
    let value = e.target.value;

    // Clear "0.00" when user starts typing
    if (value === "0.00" || value === "0") {
      value = "";
    }

    // Remove non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Only allow one decimal point
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + "." + parts[1].substring(0, 2);
    }

    setDiscount(value);
  };

  const handleShippingChange = (e) => {
    let value = e.target.value;

    // Clear "0.00" when user starts typing
    if (value === "0.00" || value === "0") {
      value = "";
    }

    // Remove non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Only allow one decimal point
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + "." + parts[1].substring(0, 2);
    }

    setShipping(value);
  };

  const handleDiscountFocus = (e) => {
    e.target.select();
    if (discount === "0.00" || discount === "0") {
      setDiscount("");
    }
  };

  const handleShippingFocus = (e) => {
    e.target.select();
    if (shipping === "0.00" || shipping === "0") {
      setShipping("");
    }
  };

  const handleDiscountBlur = () => {
    if (discount === "" || discount === ".") {
      setDiscount("0.00");
      return;
    }

    const num = parseFloat(discount);
    if (isNaN(num) || num < 0) {
      setDiscount("0.00");
    } else {
      setDiscount(num.toFixed(2));
    }
  };

  const handleShippingBlur = () => {
    if (shipping === "" || shipping === ".") {
      setShipping("0.00");
      return;
    }

    const num = parseFloat(shipping);
    if (isNaN(num) || num < 0) {
      setShipping("0.00");
    } else {
      setShipping(num.toFixed(2));
    }
  };

  const handleHold = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    // 🔥 IMMEDIATELY clear cart UI — prevent duplicate holds
    const cartCopy = [...cart]; // save for saving
    resetCart(); // ← CLEAR CART FIRST!
    toast.info("Cart cleared — holding order...");

    try {
      const holdOrderData = {
        customer_id: customer?.id || null,
        customer: customer,
        items: cartCopy.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          price: parseFloat(item.price) || 0,
          quantity: item.quantity,
        })),
        subtotal: calculateSubtotal(cartCopy),
        discount: parseFloat(discount) || 0,
        shipping: parseFloat(shipping) || 0,
        total: calculateTotal(cartCopy),
        hold_status: true,
        sync_status: "pending",
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        branch_id: currentBranch?.id || null,
        is_offline: true,
      };

      // Save to offline DB
      const localId = await offlineDB.addHoldOrder(holdOrderData);

      toast.success("Order held successfully!");

      // Refresh hold orders list
      await fetchHoldOrders();
    } catch (error) {
      console.error("Error holding order:", error);
      toast.error("Failed to hold order — cart restored");

      // 🔥 RESTORE CART if failed
      setCart(cartCopy);
      setDiscount(discount);
      setShipping(shipping);
      setCustomer(customer);
    }
  };
  useEffect(() => {
    let isMounted = true;

    const loadHoldOrders = async () => {
      if (!isMounted) return;
      await fetchHoldOrders();
    };

    loadHoldOrders();

    const interval = setInterval(loadHoldOrders, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const restoreHoldOrder = async (holdOrder) => {
    try {
      console.log("=== RESTORE DEBUG ===");
      console.log("Full hold order:", holdOrder);
      console.log("Hold order items:", holdOrder.items);

      // Deep debug each item
      if (holdOrder.items && Array.isArray(holdOrder.items)) {
        holdOrder.items.forEach((item, index) => {
          console.log(`Item ${index} details:`, {
            allFields: Object.keys(item),
            item: item,
            priceField: item.price,
            unit_price: item.unit_price,
            selling_price: item.selling_price,
            subtotal: item.subtotal,
            total: item.total,
          });
        });
      }

      // 🔥 FIXED: Better price extraction with fallback to product price
      const restoredCart = await Promise.all(
        (holdOrder.items || []).map(async (item) => {
          // Get product details from local database
          let product = null;
          try {
            product = await offlineDB.getProduct(item.product_id || item.id);
          } catch (error) {
            console.warn("Product not found in local DB:", item.product_id);
          }

          // Try multiple price sources
          let price = 0;

          // 1. Try item price fields
          const priceSources = [
            item.price,
            item.unit_price,
            item.selling_price,
            item.product_price,
            item.price_per_unit,
          ];

          for (const source of priceSources) {
            if (source != null && source !== "" && source !== 0) {
              const parsed = parseFloat(source);
              if (!isNaN(parsed) && parsed > 0) {
                price = parsed;
                console.log(`Found price in item field: ${price}`);
                break;
              }
            }
          }

          // 2. Try from subtotal
          if (price === 0 && item.subtotal && item.quantity) {
            const calculated =
              parseFloat(item.subtotal) / parseInt(item.quantity);
            if (!isNaN(calculated) && calculated > 0) {
              price = calculated;
              console.log(`Calculated price from subtotal: ${price}`);
            }
          }

          // 3. Try from product data
          if (price === 0 && product) {
            price = parseFloat(product.selling_price || product.price || 0);
            console.log(`Got price from product data: ${price}`);
          }

          // 4. Fallback to a default
          if (price === 0) {
            price = 100; // Default reasonable price
            console.warn("Using default price for:", item.product_name);
          }

          // Quantity
          const quantity = parseInt(item.quantity || 1, 10);
          const safeQuantity = isNaN(quantity) || quantity < 1 ? 1 : quantity;

          console.log(
            `Final item: ${item.product_name}, Price: ${price}, Qty: ${safeQuantity}`,
          );

          return {
            id: item.product_id || product?.id || `temp-${Date.now()}`,
            name:
              item.product_name ||
              item.name ||
              product?.name ||
              "Unknown Product",
            price: price,
            quantity: safeQuantity,
            stock: product?.stock_quantity || product?.stock || 9999,
          };
        }),
      );

      console.log("Final restored cart:", restoredCart);

      // Set state in correct order
      setCart(restoredCart);

      // Discount
      let safeDiscount = "0.00";
      if (holdOrder.discount != null && holdOrder.discount !== "") {
        const d = parseFloat(holdOrder.discount);
        safeDiscount = isNaN(d) || d < 0 ? "0.00" : d.toFixed(2);
      }
      setDiscount(safeDiscount);

      // Shipping
      let safeShipping = "0.00";
      if (holdOrder.shipping != null && holdOrder.shipping !== "") {
        const s = parseFloat(holdOrder.shipping);
        safeShipping = isNaN(s) || s < 0 ? "0.00" : s.toFixed(2);
      }
      setShipping(safeShipping);

      // Customer
      setCustomer(holdOrder.customer || null);

      toast.success("Hold order restored successfully!");

      // Cleanup (optional)
      if (holdOrder.local_id) {
        try {
          await offlineDB.db.delete("sales", holdOrder.local_id);
        } catch (err) {
          console.warn("Cleanup failed:", err);
        }
      }

      // Refresh
      await fetchHoldOrders();
    } catch (error) {
      console.error("Restore failed:", error);
      toast.error("Failed to restore order: " + error.message);
    }
  };
  // Reset cart
  const resetCart = () => {
    setCart([]);
    setDiscount("0.00");
    setShipping("0.00");
    setCustomer(null);
    setSearchCustomer("");
    setSearchResults([]);
    setCurrentHoldReference(null);
    toast.info("Cart reset");
  };

  // Pay
  const handlePay = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setShowPaymentModal(true);
  };

  const handleCompletePayment = async (paymentMethod, paidAmount) => {
    try {
      if (isOnline) {
        // ==================== ONLINE PAYMENT ====================
        const token = localStorage.getItem("authToken");

        const orderData = {
          customer_id: customer?.id || null,
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
          discount: parseFloat(discount) || 0,
          shipping: parseFloat(shipping) || 0,
          tax: 0,
          payment_method: paymentMethod,
          paid_amount: parseFloat(paidAmount),
          notes: "",
          hold_reference_no: currentHoldReference,
        };

        const response = await fetch("http://127.0.0.1:8000/api/sales", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (data.success) {
          toast.success("Sale completed successfully!");
          resetCart();

          // Refresh data
          try {
            await fetchProducts();
            await fetchHoldOrders();
          } catch (refreshErr) {
            console.warn("Failed to refresh data after sale:", refreshErr);
          }

          setShowPaymentModal(false);
          return data;
        } else {
          toast.error(data.message || "Payment failed");
          return null;
        }
      } else {
        // ==================== OFFLINE PAYMENT ====================
        const saleData = {
          customer_id: customer?.id || null,
          customer: customer,
          items: cart.map((item) => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
          })),
          subtotal: calculateSubtotal(),
          discount: parseFloat(discount) || 0,
          shipping: parseFloat(shipping) || 0,
          total_amount: calculateTotal(),
          payment_method: paymentMethod,
          paid_amount: parseFloat(paidAmount) || calculateTotal(),
          change_amount: parseFloat(paidAmount) - calculateTotal(),
          status: "completed",
          sync_status: "pending",
          created_at: new Date().toISOString(),
          branch_id: currentBranch?.id || null,
          is_offline: true,
        };

        if (
          saleData.paid_amount < saleData.total_amount &&
          paymentMethod !== "credit"
        ) {
          toast.error("Paid amount must be at least the total!");
          setShowPaymentModal(false);
          return null;
        }

        let saleId = null;

        try {
          saleId = await offlineDB.createOfflineSaleWithStockUpdate(
            saleData,
            cart,
          );

          toast.success("Sale completed offline! Stock updated locally.");

          generateOfflineReceipt(saleData, saleId);
          resetCart();
          setShowPaymentModal(false);

          // Safe delayed refresh
          setTimeout(async () => {
            try {
              await fetchProducts();
              await fetchHoldOrders();
            } catch (refreshErr) {
              console.warn(
                "Non-critical refresh failed after sale:",
                refreshErr,
              );
            }
          }, 500);
        } catch (error) {
          console.error("Offline sale failed:", error);
          toast.error(`Failed to save sale: ${error.message || error}`);
          return null;
        }

        return { success: true, local_id: saleId };
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Payment failed. Please try again.");
      return null;
    }
  };
  const generateOfflineReceipt = (saleData, localId) => {
    // Load receipt settings from localStorage (with defaults)
    const receiptSettings = JSON.parse(
      localStorage.getItem("receiptSettings"),
    ) || {
      showLogo: true,
      showShopName: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      showDateTime: true,
      showInvoiceNo: true,
      showCashier: true,
      showCustomer: true,
      showThankYou: true,
      footerMessage: "Thank You! Come Again :)",
    };

    // Load business data from localStorage (fallback if not available)
    const business = JSON.parse(localStorage.getItem("business")) || {
      name: "",
      address: "",
      phone: "",
      email: "",
      logo_url: "", // Should be a base64 or cached URL if available
    };

    const currentCustomer = saleData.customer || null;
    const items = saleData.items || [];
    const subtotal = saleData.subtotal || 0;
    const discount = saleData.discount || 0;
    const shipping = saleData.shipping || 0;
    const total = saleData.total_amount || 0;
    const paid = saleData.paid_amount || 0;
    const change = paid - total >= 0 ? paid - total : 0;

    const receiptWindow = window.open("", "_blank");

    if (!receiptWindow) {
      toast.error("Please allow popups to print receipt");
      return;
    }

    const receiptContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Offline Receipt #${localId}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0;
      padding: 10px;
      font-size: 12px;
      line-height: 1.4;
      background: white;
      color: black;
    }
    .receipt { max-width: 80mm; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 10px 0; }
    .item {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    .total-section { margin-top: 10px; font-size: 14px; }
    .logo {
      width: 100px;
      height: auto;
      margin: 10px auto;
      display: block;
    }
   
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #444; }

    @media print {
      body { width: 80mm; margin: 0; padding: 5px; }
      @page { size: 80mm auto; margin: 0; }
    }
  </style>
</head>
<body onload="window.print(); setTimeout(() => window.close(), 1000)">
  <div class="receipt">

    <!-- Logo -->
    ${
      receiptSettings.showLogo && business.logo_url
        ? `<img src="${business.logo_url}" class="logo" alt="Logo" />`
        : ""
    }

    <!-- Shop Header -->
    <div class="center">
      ${
        receiptSettings.showShopName
          ? `<h2 style="margin: 10px 0 5px; font-size: 16px;">${business.name}</h2>`
          : ""
      }
      ${
        receiptSettings.showAddress && business.address
          ? `<p style="margin: 5px 0;">${business.address}</p>`
          : ""
      }
      ${
        receiptSettings.showPhone && business.phone
          ? `<p style="margin: 5px 0;">Tel: ${business.phone}</p>`
          : ""
      }
      ${
        receiptSettings.showEmail && business.email
          ? `<p style="margin: 5px 0;">${business.email}</p>`
          : ""
      }
    </div>

   

    <div class="line"></div>

    <!-- Receipt Info -->
    ${
      receiptSettings.showDateTime
        ? `<p>Date: ${new Date(
            saleData.created_at || Date.now(),
          ).toLocaleString()}</p>`
        : ""
    }
    ${receiptSettings.showInvoiceNo ? `<p>Receipt: INV-${localId}</p>` : ""}
    ${
      receiptSettings.showCashier
        ? `<p>Cashier: ${localStorage.getItem("userName") || "Admin"}</p>`
        : ""
    }
    ${
      receiptSettings.showCustomer && currentCustomer
        ? `<p>Customer: ${currentCustomer.name} ${
            currentCustomer.phone ? `(${currentCustomer.phone})` : ""
          }</p>`
        : ""
    }

    <div class="line"></div>

    <!-- Items List -->
    ${items
      .map(
        (item) => `
      <div class="item">
        <span>${item.product_name || item.name}</span>
        <span>${item.quantity} x ${
          item.unit_price?.toFixed(2) || item.price?.toFixed(2)
        }</span>
      </div>
      <div class="item">
        <span></span>
        <span>LKR ${(item.total_price || item.price * item.quantity).toFixed(
          2,
        )}</span>
      </div>
    `,
      )
      .join("")}

    <div class="line"></div>

    <!-- Totals -->
    <div class="total-section">
      <div class="item"><span>Subtotal:</span><span>LKR ${subtotal.toFixed(
        2,
      )}</span></div>
      ${
        discount > 0
          ? `<div class="item"><span>Discount:</span><span>- LKR ${discount.toFixed(
              2,
            )}</span></div>`
          : ""
      }
      ${
        shipping > 0
          ? `<div class="item"><span>Shipping:</span><span>+ LKR ${shipping.toFixed(
              2,
            )}</span></div>`
          : ""
      }
      <div class="item bold"><span>Total:</span><span>LKR ${total.toFixed(
        2,
      )}</span></div>
      <div class="item"><span>Paid:</span><span>LKR ${paid.toFixed(
        2,
      )}</span></div>
      <div class="item"><span>Change:</span><span>LKR ${change.toFixed(
        2,
      )}</span></div>
      <div class="item"><span>Payment:</span><span>${
        saleData.payment_method || "Cash"
      }</span></div>
    </div>

    <div class="line"></div>

    <!-- Footer -->
    <div class="footer">
    
      ${
        receiptSettings.showThankYou
          ? `<strong>${receiptSettings.footerMessage}</strong>`
          : "Thank you for your purchase!"
      }
    </div>

  </div>
</body>
</html>
  `;

    receiptWindow.document.write(receiptContent);
    receiptWindow.document.close();
    receiptWindow.focus();
  };

  const handleAddCustomer = () => {
    setIsCustomerModelOpen(true);
  };

  const handleCustomerAdded = (newCustomer) => {
    setCustomer(newCustomer);
    setIsCustomerModelOpen(false);
  };

  const handleCustomerSearch = async (query) => {
    setSearchCustomer(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    let foundCustomers = [];

    try {
      // 1. ONLINE: Try backend first (fresh data)
      if (isOnline) {
        const token = localStorage.getItem("authToken");

        const response = await fetch(
          `http://127.0.0.1:8000/api/pos/customers/search?query=${encodeURIComponent(
            query,
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

        if (response.ok) {
          const json = await response.json();
          foundCustomers =
            json.success && Array.isArray(json.data) ? json.data : [];

          setSearchResults(foundCustomers);
          toast.success(`Found ${foundCustomers.length} customers (fresh)`);

          // 🔥 AUTO CACHE UPDATE
          for (const customer of foundCustomers) {
            await offlineDB
              .addCustomer({
                ...customer,
                sync_status: "synced",
                updated_at: new Date().toISOString(),
              })
              .catch(() => {
                // ignore duplicate or minor errors
              });
          }

          return; // Done — no need for fallback
        }
      }

      // 2. OFFLINE or ONLINE FAIL → Use local cache
      toast.info("Searching from local customers");

      const cachedCustomers = await offlineDB.getAllCustomers();

      foundCustomers = cachedCustomers.filter((customer) => {
        return (
          customer.name?.toLowerCase().includes(lowerQuery) ||
          customer.phone?.includes(lowerQuery) ||
          customer.email?.toLowerCase().includes(lowerQuery)
        );
      });

      setSearchResults(foundCustomers);
      toast.success(`Found ${foundCustomers.length} customers (local)`);
    } catch (error) {
      console.error("Customer search failed:", error);
      toast.error("Search error — trying local cache");

      // Final fallback
      try {
        const backup = await offlineDB.getAllCustomers();
        const backupResults = backup.filter(
          (c) =>
            c.name?.toLowerCase().includes(lowerQuery) ||
            c.phone?.includes(lowerQuery) ||
            c.email?.toLowerCase().includes(lowerQuery),
        );
        setSearchResults(backupResults);
        toast.info(`Fallback: ${backupResults.length} from cache`);
      } catch (finalError) {
        setSearchResults([]);
        toast.error("No customers available");
      }
    }
  };

  const selectCustomer = (customerData) => {
    setCustomer(customerData);
    setSearchCustomer("");
    setSearchResults([]);
    toast.success(`Customer: ${customerData.name}`);
  };

  // Filter products
  const filteredProducts = Array.isArray(products)
    ? products.filter((product) => {
        const matchCategory =
          selectedCategory === "all" || product.category === selectedCategory;
        const matchSearch = product.name
          ?.toLowerCase()
          .includes(searchProduct.toLowerCase());
        const hasStock = product.stock > 0;
        return matchCategory && matchSearch && hasStock;
      })
    : [];

  return (
    <div className="pos-container">
      <AddCustomerModal
        isOpen={isCustomerModelOpen}
        onClose={() => setIsCustomerModelOpen(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      <HoldOrdersModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onRestoreOrder={restoreHoldOrder}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartItems={cart}
        discount={discount}
        shipping={shipping}
        onCompletePayment={handleCompletePayment}
        customer={customer}
        business={business}
      />

      {/* Left Side */}
      <div className="pos-left">
        {/* Customer Search */}
        <div className="customer-section">
          <div className="customer-search">
            <User size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Search customers..."
              value={customer ? customer.name : searchCustomer}
              onChange={(e) => handleCustomerSearch(e.target.value)}
              className="customer-input"
              onBlur={() => {
                setTimeout(() => setSearchResults([]), 200);
              }}
            />
            <button
              className="pos-add-customer-btn"
              title="Add Customer"
              onClick={handleAddCustomer}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchCustomer.trim().length >= 2 && searchResults.length > 0 && (
            <div className="customer-search-results">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="customer-result-item"
                  onMouseDown={() => selectCustomer(result)}
                >
                  <div className="customer-result-name">{result.name}</div>
                  <div className="customer-result-details">
                    <span>{result.phone}</span>
                    {result.email && <span> • {result.email}</span>}
                    {result.loyalty_points > 0 && (
                      <span className="loyalty-points">
                        • {result.loyalty_points} pts
                      </span>
                    )}
                    {result.branch?.name && (
                      <span className="branch-name">
                        {" "}
                        • {result.branch.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {searchCustomer.trim().length >= 2 && searchResults.length === 0 && (
            <div className="customer-search-results">
              <div className="no-results">No customers found</div>
            </div>
          )}
        </div>

        {/* Cart Table */}
        <div className="cart-section">
          <div className="cart-table-wrapper">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>QTY</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-cart">
                      <ShoppingCart size={48} />
                      <p>Cart is empty</p>
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.id}>
                      <td className="product-name">{item.name}</td>
                      <td>
                        <div className="qty-control">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td>LKR {formatNumber(item.price)}</td>
                      <td className="subtotal">
                        LKR {formatNumber(item.price * item.quantity)}
                      </td>
                      <td>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Section */}
          <div className="cart-bottom">
            <div className="cart-inputs">
              <div className="input-group">
                <label>Discount (LKR)</label>
                <input
                  type="text"
                  value={discount}
                  onChange={handleDiscountChange}
                  onFocus={handleDiscountFocus}
                  onBlur={handleDiscountBlur}
                  onKeyDown={(e) => {
                    // Prevent form submission on Enter key
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.target.blur(); // Move focus out of field
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="input-group">
                <label>Shipping (LKR)</label>
                <input
                  type="text"
                  value={shipping}
                  onChange={handleShippingChange}
                  onFocus={handleShippingFocus}
                  onBlur={handleShippingBlur}
                  onKeyDown={(e) => {
                    // Prevent form submission on Enter key
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.target.blur(); // Move focus out of field
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="summary-box">
              <div className="summary-row">
                <span>Total QTY:</span>
                <span className="summary-value">
                  {calculateTotalQuantity()}
                </span>
              </div>
              <div className="summary-row">
                <span>Subtotal:</span>
                <span className="summary-value">
                  LKR {formatNumber(calculateSubtotal())}
                </span>
              </div>
              <div className="summary-row total-row">
                <span>Total:</span>
                <span className="summary-value">
                  LKR {formatNumber(calculateTotal())}
                </span>
              </div>
            </div>

            <div className="pos-action-buttons">
              <button
                className="pos-btn-hold"
                onClick={handleHold}
                disabled={cart.length === 0}
              >
                <Hand size={18} />
                Hold ({cart.length})
              </button>
              <button className="pos-btn-reset" onClick={resetCart}>
                <RotateCcw size={18} />
                Reset
              </button>
              <button className="pos-btn-pay" onClick={handlePay}>
                <DollarSign size={18} />
                Pay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="pos-right">
        {/* Top Bar */}
        <div className="pos-topbar">
          <div className="product-search">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Scan/Search Product"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              className="product-search-input"
            />

            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && barcodeInput.trim()) {
                  fetchProductByBarcode(barcodeInput.trim());
                  setBarcodeInput(""); // clear
                }
              }}
              placeholder="Scan barcode..."
              autoFocus
              style={{ position: "absolute", left: "-9999px" }}
            />
          </div>
          <div className="topbar-actions">
            <button
              className="icon-btn"
              title="Hold Orders"
              onClick={async () => {
                await fetchHoldOrders(); // Refresh before opening
                setShowHoldModal(true);
              }}
              disabled={holdOrdersLoading}
            >
              <Package size={20} />
              {holdOrders.length > 0 && (
                <span className="badge">{holdOrders.length}</span>
              )}
            </button>
            <button
              className="icon-btn"
              title="Fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
            >
              <Maximize size={20} />
            </button>
            <button
              className="icon-btn"
              title="Dashboard"
              onClick={onDashboardClick}
            >
              <LayoutDashboard size={20} />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="categories-bar">
          <button
            className={`category-btn ${
              selectedCategory === "all" ? "active" : ""
            }`}
            onClick={() => setSelectedCategory("all")}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-btn ${
                selectedCategory === cat.id ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="product-card"
              onClick={() => addToCart(product)}
            >
              <div className="pos-product-image">
                <img
                  src={
                    product.image
                      ? product.image.startsWith("http")
                        ? product.image // already full URL — use as is
                        : `http://127.0.0.1:8000/storage/${product.image}` // relative path
                      : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAErgG9j6fAAAAASUVORK5CYII="
                  }
                  alt={product.name}
                  onError={(e) => {
                    e.target.src =
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAErgG9j6fAAAAASUVORK5CYII=";
                  }}
                />
                <div className="product-stock">{product.stock} in stock</div>
              </div>
              <div className="product-info">
                <h4 title={product.name}>{product.name}</h4>
                <p className="product-price">
                  LKR {formatNumber(product.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default POS;
