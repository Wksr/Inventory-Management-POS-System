// src/components/charts/ProfitChart.js
import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import "./ProfitChart.css";

const ProfitChart = ({ data, chartType = "line", height = 300 }) => {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: item.date,
    revenue: item.revenue || 0,
    cost: item.cost || 0,
    profit: item.profit || 0,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="tooltip-item"
              style={{ color: entry.color }}
            >
              {`${entry.name}: LKR ${entry.value.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom tick formatter for Y-axis
  const formatYAxis = (value) => {
    if (value >= 1000000) {
      return `LKR ${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `LKR ${(value / 1000).toFixed(0)}K`;
    }
    return `LKR ${value}`;
  };

  // Format X-axis for dates
  const formatXAxis = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="profit-chart-container">
      <div className="chart-header">
        <h3>Profit Trend</h3>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color revenue"></span>
            <span>Revenue</span>
          </div>
          <div className="legend-item">
            <span className="legend-color cost"></span>
            <span>Cost</span>
          </div>
          <div className="legend-item">
            <span className="legend-color profit"></span>
            <span>Profit</span>
          </div>
        </div>
      </div>

      <div className="chart-wrapper" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height={height} debounce={1}>
          {chartType === "line" ? (
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                tickFormatter={formatYAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name="Revenue"
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name="Cost"
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name="Profit"
              />
            </LineChart>
          ) : chartType === "bar" ? (
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                tickFormatter={formatYAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="revenue" fill="#059669" name="Revenue" />
              <Bar dataKey="cost" fill="#dc2626" name="Cost" />
              <Bar dataKey="profit" fill="#2563eb" name="Profit" />
            </BarChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                tickFormatter={formatYAxis}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stackId="1"
                stroke="#059669"
                fill="#059669"
                fillOpacity={0.3}
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="cost"
                stackId="2"
                stroke="#dc2626"
                fill="#dc2626"
                fillOpacity={0.3}
                name="Cost"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stackId="3"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.3}
                name="Profit"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="chart-footer">
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Total Revenue:</span>
            <span className="stat-value revenue">
              LKR{" "}
              {chartData
                .reduce((sum, item) => sum + item.revenue, 0)
                .toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Profit:</span>
            <span className="stat-value profit">
              LKR{" "}
              {chartData
                .reduce((sum, item) => sum + item.profit, 0)
                .toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitChart;
