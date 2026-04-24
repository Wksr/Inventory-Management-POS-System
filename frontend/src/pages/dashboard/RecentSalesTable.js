import React, { useState, useEffect } from "react";
import { Receipt } from "lucide-react";
import "./RecentSalesTable.css";

const RecentSalesTable = () => {
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchRecentSales();
  }, []);

  const fetchRecentSales = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/sales/recent", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        // For development: use mock data
        const mockRecentSales = [
          {
            id: "INV-012",
            customer: "Kevin Garcia",
            items: "Bluetooth Speaker (2)",
            amount: "14,000",
            date: "2025-12-04",
            status: "completed",
          },
        ];
        setRecentSales(mockRecentSales);
        return;
      }

      const data = await res.json();
      setRecentSales(data.recent_sales || []);
    } catch (err) {
      console.error("Recent sales fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchRecentSales();
  };

  const displayedSales = showAll ? recentSales : recentSales.slice(0, 10);

  return (
    <div className="recent-sales-table">
      <div className="recent-sales-header">
        <h3 className="recent-sales-title">
          <Receipt size={18} />
          Recent Sales
          {recentSales.length > 0 && (
            <span className="sales-count">({recentSales.length})</span>
          )}
        </h3>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          title="Refresh recent sales"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <div className="table-wrapper">
        <table className="recent-sales-data-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="loading-cell">
                  Loading recent sales...
                </td>
              </tr>
            ) : displayedSales.length > 0 ? (
              displayedSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="invoice-id">{sale.id}</td>
                  <td className="customer-name">{sale.customer}</td>
                  <td className="items-list">{sale.items}</td>
                  <td className="sale-amount">LKR {sale.amount}</td>
                  <td className="sale-date">{formatDate(sale.date)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data-cell">
                  <div className="no-data-content">
                    <Receipt size={32} />
                    <div>
                      <h4>No recent sales!</h4>
                      <p>Sales data will appear here.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recentSales.length > 10 && (
        <div className="table-footer">
          <div className="summary">
            <span className="summary-text">
              Showing {displayedSales.length} of {recentSales.length} recent
              sales
            </span>
          </div>
          <div className="actions">
            <button
              className="view-all-btn"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show Less" : "View All"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentSalesTable;
