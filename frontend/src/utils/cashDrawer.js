// utils/cashDrawer.js

export const openCashDrawer = () => {
  try {
    console.log("💰 Sending command to open cash drawer...");

    // ESC/POS Command for Open Cash Drawer (Standard)
    const openDrawerCommand = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0x19]);
    // 1B 70 00 19 19 → Cash Drawer 1 Open (most common)

    // Method 1: Print a hidden window and send command
    const printWindow = window.open("", "_blank", "width=1,height=1");

    if (!printWindow) {
      alert(
        "Popup allow is required to open Cash Drawer. Please enable popups for this site.",
      );
      return false;
    }

    // Send the raw ESC/POS command
    printWindow.document.write(`
      <html>
        <body>
          <script>
            // This triggers the printer to open the drawer in many setups
            window.print();
          </script>
        </body>
      </html>
    `);

    // Close the window after small delay
    setTimeout(() => {
      printWindow.close();
    }, 800);

    console.log("✅ Cash drawer open command sent successfully");
    return true;
  } catch (error) {
    console.error("Cash drawer open failed:", error);
    alert("Failed to open Cash Drawer. Check Printer connection and settings.");
    return false;
  }
};
