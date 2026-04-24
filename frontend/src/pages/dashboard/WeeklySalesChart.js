import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./WeeklySalesChart.css";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const WeeklySalesChart = () => {
  const [chartData, setChartData] = useState({
    weeklySales: [],
    total: 0,
    loading: true,
    error: null,
  });
  useEffect(() => {
    const fetchWeeklySales = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://127.0.0.1:8000/api/sales/weekly", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();

        if (result.success) {
          setChartData({
            weeklySales: result.weekly_sales,
            total: result.total,
            loading: false,
            error: null,
          });
        } else {
          throw new Error(result.message || "Failed to fetch data");
        }
      } catch (err) {
        console.error("Failed to fetch weekly sales:", err);
        setChartData((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
        // Optional: You could set a fallback to your mock data here
      }
    };
    fetchWeeklySales();
  }, []);

  const data = {
    labels: chartData.weeklySales.map((item) => item.day),
    datasets: [
      {
        label: "Sales (LKR)",
        data: chartData.weeklySales.map((item) => item.amount),
        backgroundColor: "rgba(59, 130, 246, 0.7)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 14,
          weight: "normal",
        },
        bodyFont: {
          size: 14,
          weight: "bold",
        },
        callbacks: {
          label: function (context) {
            return `LKR${context.parsed.y.toLocaleString("en-IN")}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(229, 231, 235, 0.5)",
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
          callback: function (value) {
            return `LKR${value.toLocaleString("en-IN")}`;
          },
        },
        border: {
          dash: [4, 4],
        },
      },
    },
  };

  return (
    <div className="weekly-sales-chart">
      <div className="chart-header">
        <h3 className="chart-title">This Week Sales</h3>
        <div className="chart-summary">
          {chartData.loading ? (
            <span className="loading-text">Loading data...</span>
          ) : chartData.error ? (
            <span className="error-text">Failed to load</span>
          ) : (
            <span className="total-sales">
              Total: LKR {chartData.total.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
      <div className="chart-container">
        {chartData.loading ? (
          <div className="chart-placeholder">Loading chart...</div>
        ) : chartData.error ? (
          <div className="chart-placeholder">Could not load chart data.</div>
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  );
};

export default WeeklySalesChart;
