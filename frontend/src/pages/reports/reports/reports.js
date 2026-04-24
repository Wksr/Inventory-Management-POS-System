import React, { useState } from "react";
import {
  Search,
  FileText,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import ProfitReport from "../profits/ProfitReport";
import SalesReport from "./SalesReports";
import PurchaseReport from "./PurchaseReport";
import InventoryReport from "./InventoryReport";
import CustomerReport from "./CustomerReport";
import "./reports.css";

const Reports = () => {
  // const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState("profits");

  const reportTypes = [
    { id: "profits", name: "Profits", icon: TrendingUp },
    { id: "sales", name: "Sales Reports", icon: ShoppingCart },
    { id: "purchases", name: "Purchase Reports", icon: Package },
    { id: "inventory", name: "Inventory Reports", icon: BarChart3 },
    { id: "customers", name: "Customer Reports", icon: Users },
    // { id: "financial", name: "Financial Reports", icon: DollarSign },
  ];

  const handleReportSelect = (reportId) => {
    setSelectedReport(reportId);
    toast.success(
      `${reportTypes.find((r) => r.id === reportId)?.name} selected`,
    );
  };

  const renderReportContent = () => {
    const reportData = {
      inventory: {
        title: "Inventory Status",
        data: [
          { label: "Total Items", value: "1,250" },
          { label: "Low Stock Items", value: "45" },
          { label: "Out of Stock", value: "12" },
          { label: "Total Value", value: "LKR 3,500,000" },
        ],
      },
      customers: {
        title: "Customer Insights",
        data: [
          { label: "Total Customers", value: "850" },
          { label: "New Customers", value: "125" },
          { label: "Repeat Customers", value: "725" },
          { label: "Average Purchase", value: "LKR 1,470" },
        ],
      },
      // financial: {
      //   title: "Financial Overview",
      //   data: [
      //     { label: "Total Income", value: "LKR 1,250,000" },
      //     { label: "Total Expenses", value: "LKR 950,000" },
      //     { label: "Net Income", value: "LKR 300,000" },
      //     { label: "Cash Flow", value: "LKR 250,000" },
      //   ],
      // },
    };

    const currentReport = reportData[selectedReport];

    return (
      <div className="report-content">
        <h2 className="report-title">
          <FileText size={24} />
          {currentReport.title}
        </h2>
        <div className="report-grid">
          {currentReport.data.map((item, index) => (
            <div key={index} className="report-card">
              <div className="report-label">{item.label}</div>
              <div className="report-value">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="report-chart-placeholder">
          <BarChart3 size={48} />
          <p>Chart visualization will be displayed here</p>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div className="header-left">
          {/* <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search reports..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div> */}
        </div>

        <div className="header-right"></div>
      </div>

      <div className="reports-nav">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              className={`report-tab ${
                selectedReport === report.id ? "active" : ""
              }`}
              onClick={() => handleReportSelect(report.id)}
            >
              <Icon size={18} />
              <span>{report.name}</span>
            </button>
          );
        })}
      </div>

      <div className="reports-container">
        {selectedReport === "profits" ? (
          <ProfitReport />
        ) : selectedReport === "sales" ? (
          <SalesReport />
        ) : selectedReport === "purchases" ? (
          <PurchaseReport />
        ) : selectedReport === "inventory" ? (
          <InventoryReport />
        ) : selectedReport === "customers" ? (
          <CustomerReport />
        ) : (
          renderReportContent()
        )}
      </div>
    </div>
  );
};

export default Reports;
