import React, { useState } from "react";

import StockAlertTable from "./StockAlertTable";
import ExpireAlertTable from "./ExpireAlertTable";
import RecentSalesTable from "./RecentSalesTable";
import StatsCards from "./StatsCards";
import WeeklySalesChart from "./WeeklySalesChart";
import TopProductsChart from "./TopProductsChart";
import "./dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
      </div>
      <StatsCards />

      <div className="charts-grid">
        <TopProductsChart />

        <WeeklySalesChart />
      </div>
      <div className="tables-grid">
        <RecentSalesTable />

        <StockAlertTable
          showToast={true}
          autoRefresh={true}
          refreshInterval={60000}
          showActions={true}
        />

        <ExpireAlertTable />
      </div>
    </div>
  );
};

export default Dashboard;
