import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
} from "chart.js";
import "./TopProductsChart.css";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale);

const TopProductsChart = () => {
  const [chartData, setChartData] = useState({
    products: [],
    loading: true,
    error: null,
    period: "year", // 'year', 'month', 'week', 'custom'
    year: new Date().getFullYear(),
  });

  // Predefined color palette for the chart
  const colorPalette = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
    "#84cc16",
    "#f97316",
    "#06b6d4",
  ];

  // Fetch top products data from API
  const fetchTopProducts = async (
    period = "year",
    year = null,
    month = null,
  ) => {
    setChartData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const token = localStorage.getItem("authToken");
      const params = new URLSearchParams({ period });

      if (year) params.append("year", year);
      if (month) params.append("month", month);

      const response = await fetch(
        `http://127.0.0.1:8000/api/products/top-selling?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result.success) {
        setChartData((prev) => ({
          ...prev,
          products: result.products,
          loading: false,
          period: result.period,
          year: result.year,
          total_sales: result.total_sales,
          total_quantity: result.total_quantity,
        }));
      } else {
        throw new Error(result.message || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Failed to fetch top products:", err);
      setChartData((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  };

  useEffect(() => {
    fetchTopProducts("year");
  }, []);

  // Prepare chart data
  const chartConfig = {
    labels: chartData.products.map((product) => product.name),
    datasets: [
      {
        data: chartData.products.map((product) => product.sales_percentage),
        backgroundColor: chartData.products.map(
          (_, index) => colorPalette[index % colorPalette.length],
        ),
        borderColor: "white",
        borderWidth: 2,
        hoverOffset: 15,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%", // Makes it a doughnut chart
    plugins: {
      legend: {
        display: false, // We'll use our custom legend
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 13,
        },
        bodyFont: {
          size: 14,
          weight: "600",
        },
        callbacks: {
          label: function (context) {
            const product = chartData.products[context.dataIndex];
            const value = context.parsed;
            const sales = product?.total_sales || 0;
            const quantity = product?.total_quantity || 0;
            return [
              `${value.toFixed(1)}% of total sales`,
              `Revenue: LKR ${sales.toLocaleString("en-IN")}`,
              `Units Sold: ${quantity.toLocaleString("en-IN")}`,
              `Avg Price: LKR ${
                product?.average_price?.toLocaleString("en-IN") || "0"
              }`,
            ];
          },
        },
      },
    },
  };

  // Handle period change
  const handlePeriodChange = (period) => {
    setChartData((prev) => ({ ...prev, period }));
    if (period === "year") {
      fetchTopProducts("year");
    } else if (period === "month") {
      fetchTopProducts(
        "month",
        new Date().getFullYear(),
        new Date().getMonth() + 1,
      );
    } else if (period === "week") {
      fetchTopProducts("week");
    }
  };

  // Handle year change
  const handleYearChange = (year) => {
    setChartData((prev) => ({ ...prev, year }));
    fetchTopProducts(chartData.period, year);
  };

  return (
    <div className="top-products-chart">
      <div className="chart-header">
        <h3 className="chart-title">
          Top Selling Products
          <span className="period-badge">
            {chartData.period === "year" && "This Year"}
            {chartData.period === "month" && "This Month"}
            {chartData.period === "week" && "This Week"}
          </span>
        </h3>

        <div className="chart-controls">
          <div className="period-selector">
            <button
              className={`period-btn ${
                chartData.period === "week" ? "active" : ""
              }`}
              onClick={() => handlePeriodChange("week")}
              disabled={chartData.loading}
            >
              Week
            </button>
            <button
              className={`period-btn ${
                chartData.period === "month" ? "active" : ""
              }`}
              onClick={() => handlePeriodChange("month")}
              disabled={chartData.loading}
            >
              Month
            </button>
            <button
              className={`period-btn ${
                chartData.period === "year" ? "active" : ""
              }`}
              onClick={() => handlePeriodChange("year")}
              disabled={chartData.loading}
            >
              Year
            </button>
          </div>

          {chartData.period === "year" && (
            <div className="year-selector">
              <select
                value={chartData.year}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                disabled={chartData.loading}
              >
                {[2023, 2024, 2025].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {chartData.loading ? (
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading top products...</p>
        </div>
      ) : chartData.error ? (
        <div className="chart-error">
          <p>Error: {chartData.error}</p>
          <button onClick={() => fetchTopProducts(chartData.period)}>
            Retry
          </button>
        </div>
      ) : chartData.products.length === 0 ? (
        <div className="chart-empty">
          <p>No sales data available for this period.</p>
        </div>
      ) : (
        <div className="chart-content">
          <div className="chart-wrapper">
            <div className="doughnut-chart">
              <Doughnut data={chartConfig} options={chartOptions} />
            </div>

            {/* Summary in center of doughnut */}
            <div className="chart-center-summary">
              <div className="summary-value">
                LKR {chartData.total_sales?.toLocaleString("en-IN") || "0"}
              </div>
              <div className="summary-label">Total Sales</div>
              <div className="summary-subtext">
                {chartData.total_quantity?.toLocaleString("en-IN") || "0"} units
              </div>
            </div>
          </div>

          {/* Custom Legend */}
          <div className="products-legend">
            <div className="legend-header">
              <span>Product</span>
              <span>Sales %</span>
              <span>Revenue</span>
            </div>

            <div className="legend-items">
              {chartData.products.map((product, index) => (
                <div key={product.id || index} className="legend-item">
                  <div className="item-info">
                    <div
                      className="item-color"
                      style={{
                        backgroundColor:
                          colorPalette[index % colorPalette.length],
                      }}
                    ></div>
                    <div className="item-name">
                      <span className="product-name">{product.name}</span>
                      {product.sku && (
                        <span className="product-sku">{product.sku}</span>
                      )}
                    </div>
                  </div>
                  <div className="item-percentage">
                    {product.sales_percentage.toFixed(1)}%
                  </div>
                  <div className="item-sales">
                    LKR {product.total_sales.toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            {chartData.products.length > 5 && (
              <div className="legend-footer">
                <span>Showing top {chartData.products.length} products</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopProductsChart;
