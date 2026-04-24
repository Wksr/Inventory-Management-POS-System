<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController; 
use App\Http\Controllers\UnitController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PurchaseReturnController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\POSController;
use App\Http\Controllers\SaleReturnController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\LoyaltySettingsController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\InventoryReportController;
use App\Http\Controllers\BackupController;




Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toDateTimeString(),
        'app' => 'POS System'
    ]);
});

  Route::post('/backup/create', [BackupController::class, 'create']);
Route::get('/backup/download/{filename}', [BackupController::class, 'download']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

     Route::prefix('branches')->group(function () {
        // Get user's accessible branches
        Route::get('/', [BranchController::class, 'index']);
        
        // Get current user's default branch
        Route::get('/current', [BranchController::class, 'getCurrentBranch']);
        
        // Set user's current branch
        Route::post('/set-user-branch', [BranchController::class, 'setUserBranch']);
        
          // Admin only routes 
    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        // Create new branch
        Route::post('/', [BranchController::class, 'store']);
        
        // Update branch
        Route::put('/{id}', [BranchController::class, 'update']);
        
        // Delete/deactivate branch
        Route::delete('/{id}', [BranchController::class, 'destroy']);
        
        // Get users for a branch
        Route::get('/{id}/users', [BranchController::class, 'getBranchUsers']);
        
        // Assign user to branch
        Route::post('/assign-user', [BranchController::class, 'assignUser']);
    });
    });

    Route::get('/business', [BusinessController::class, 'show']);
Route::post('/business', [BusinessController::class, 'store']);
Route::put('/business/{id}', [BusinessController::class, 'update']);
 Route::post('/business/{id}/logo', [BusinessController::class, 'uploadLogo']);

     // User management routes
    Route::apiResource('users', UserController::class);

      // Category management routes
      Route::apiResource('categories', CategoryController::class);

         Route::get('/products/top-selling', [SaleController::class, 'topSellingProducts']);
    Route::get('/products/available-years', [SaleController::class, 'getAvailableYears']);

    Route::get('/sales/export', [SaleController::class, 'export']);

      Route::get('/products/low-stock', [ProductController::class, 'lowStock']);

      Route::get('/products/expiring', [ProductController::class, 'expiring']);

      // Product management routes
       Route::apiResource('products', ProductController::class);

       
      

        // Supplier management routes
        Route::apiResource('suppliers', SupplierController::class);

        // Unit management routes
        Route::apiResource('units', UnitController::class);

    // Purchase management routes
    Route::get('/purchases', [PurchaseController::class, 'index']);
    Route::post('/purchases', [PurchaseController::class, 'store']);
    Route::get('/purchases/{id}', [PurchaseController::class, 'show']);
    Route::put('/purchases/{id}', [PurchaseController::class, 'update']);
    Route::delete('/purchases/{id}', [PurchaseController::class, 'destroy']);

   

    // Purchase Return management routes
   Route::apiResource('purchase-returns', PurchaseReturnController::class);
   Route::get('purchases/{purchaseId}/items', [PurchaseReturnController::class, 'getPurchaseItems']);

    Route::get('/purchases/report/export', [PurchaseController::class, 'exportReport']);
  
    
    Route::apiResource('customers', CustomerController::class);
   // Route::get('/customers/search', [CustomerController::class, 'search']);

   

   Route::get('/sales/recent', [SaleController::class, 'recentSales']);

    Route::get('/sales/weekly', [SaleController::class, 'weeklySales']);

      // Hold Orders
        Route::post('/sales/hold', [SaleController::class, 'holdOrder']);
        Route::get('/sales/hold-orders', [SaleController::class, 'getHoldOrders']);
        Route::get('/sales/hold-orders/{id}/restore', [SaleController::class, 'restoreHoldOrder']);
        Route::post('/sales/hold-orders/{id}/complete', [SaleController::class, 'completeHoldOrder']);
        Route::delete('/sales/hold-orders/{id}', [SaleController::class, 'deleteHoldOrder']);
        

   

   Route::get('/dashboard/stats', [SaleController::class, 'dashboardStats']);

    Route::get('/loyalty/settings', [LoyaltySettingsController::class, 'show']);
    Route::put('/loyalty/settings', [LoyaltySettingsController::class, 'update']);

     // Sales Routes
    Route::prefix('sales')->group(function () {
        Route::get('/', [SaleController::class, 'index']);
        Route::post('/', [SaleController::class, 'store']);
        Route::get('/{id}', [SaleController::class, 'show']);
        Route::put('/{id}', [SaleController::class, 'update']);
        Route::delete('/{id}', [SaleController::class, 'destroy']);

       
      
    });

    Route::prefix('pos')->group(function () {
        Route::get('/products', [POSController::class, 'getProducts']);
       Route::get('/categories', [POSController::class, 'getCategories']);
      Route::get('/customers/search', [POSController::class, 'searchCustomer']);
        Route::get('/products/barcode/{barcode}', [POSController::class, 'getProductByBarcode']);
    });

    //  Route::get('/sales-returns', [SaleReturnController::class, 'index']);
    // Route::post('/sales-returns', [SaleReturnController::class, 'store']);
    // Route::get('/sales-returns/{id}', [SaleReturnController::class, 'show']);
    // Route::put('/sales-returns/{id}', [SaleReturnController::class, 'update']);
    // Route::delete('/sales-returns/{id}', [SaleReturnController::class, 'destroy']);
    Route::apiResource('sales-returns', SaleReturnController::class);
    Route::get('/sales-returns/sale/returnable', [SaleReturnController::class, 'getReturnableSales']);
    Route::get('/sales-returns/sale/{saleId}', [SaleReturnController::class, 'getSaleDetails']);

     Route::get('/reports/profit', [ReportController::class, 'profitReport']);

     Route::get('/inventory/report', [InventoryReportController::class, 'report']);
     Route::get('/inventory/report/export', [InventoryReportController::class, 'exportReport']);
     Route::get('/inventory/low-stock', [InventoryReportController::class, 'lowStockReport']);

   

});