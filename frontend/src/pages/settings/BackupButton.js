import React, { useState } from "react";
import { Download, Loader } from "lucide-react";
import { toast } from "sonner";
import "./backup-button.css";

const BackupButton = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    // Confirmation Toast
    const confirmToast = toast("⚠️ If You Need Database Backup?", {
      description: "Are you sure want to create a database backup?",
      action: {
        label: "Yes, Backup Now",
        onClick: async () => {
          await startBackup();
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => toast.dismiss(confirmToast),
      },
      duration: 2500,
    });
  };

  //  backup logic
  const startBackup = async () => {
    setIsBackingUp(true);

    try {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

      const response = await fetch("http://127.0.0.1:8000/api/backup/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success("✅ Database Backup Completed!");

        // Automatically download
        const downloadUrl = `http://127.0.0.1:8000/api/backup/download/${data.filename}`;

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error(data.message || "Backup Failed: Unknown error");
      }
    } catch (error) {
      console.error(error);
      toast.error("Backup Failed: " + (error.message || "Unknown error"));
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <button
      onClick={handleBackup}
      disabled={isBackingUp}
      className="backup-button"
    >
      {isBackingUp ? (
        <>
          <Loader size={18} className="animate-spin mr-2" />
          Backing Up...
        </>
      ) : (
        <>
          <Download size={18} className="mr-2" />
          Backup Database
        </>
      )}
    </button>
  );
};

export default BackupButton;
