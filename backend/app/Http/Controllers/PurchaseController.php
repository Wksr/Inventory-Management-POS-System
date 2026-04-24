<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Product;
use App\Models\StockMovement; 
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $query = Purchase::with(['supplier', 'branch', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->latest();

            // Search filter
            if ($request->has('search') && $request->search != '') {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('invoice_number', 'like', "%{$search}%")
                      ->orWhereHas('supplier', function ($q) use ($search) {
                          $q->where('name', 'like', "%{$search}%");
                      });
                });
            }

            // Date filter
            if ($request->has('date_filter')) {
                $this->applyDateFilter($query, $request->date_filter, $request);
            }

            $purchases = $query->paginate($request->per_page ?? 20);

            return response()->json([
                'success' => true,
                'purchases' => $purchases,
                'message' => 'Purchases fetched successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch purchases: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        DB::beginTransaction();
        
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }
            
            $validated = $request->validate([
                'supplier_id' => 'required|exists:suppliers,id',
                'date' => 'required|date',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.unit_cost' => 'required|numeric|min:0',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.discount' => 'nullable|numeric|min:0',
                'discount' => 'nullable|numeric|min:0',
                'transport_cost' => 'nullable|numeric|min:0',
                'paid_amount' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string'
            ]);

            // Calculate totals
            $subtotal = 0;
            foreach ($request->items as $item) {
                $itemTotal = ($item['unit_cost'] * $item['quantity']) - ($item['discount'] ?? 0);
                $subtotal += $itemTotal;
            }

            $grandTotal = $subtotal - ($request->discount ?? 0) + ($request->transport_cost ?? 0);
            $balance = $grandTotal - ($request->paid_amount ?? 0);

            // Create purchase
            $purchase = Purchase::create([
                'invoice_number' => Purchase::generateInvoiceNumber($defaultBranch->id),
                'supplier_id' => $request->supplier_id,
                'branch_id' => $defaultBranch->id,
                'date' => $request->date,
                'subtotal' => $subtotal,
                'discount' => $request->discount ?? 0,
                'transport_cost' => $request->transport_cost ?? 0,
                'grand_total' => $grandTotal,
                'paid_amount' => $request->paid_amount ?? 0,
                'balance' => $balance,
                'notes' => $request->notes,
                'created_by' => $user->id,
                'status' => 'completed'
            ]);

            // Create purchase items and update product stock & cost price
            foreach ($request->items as $itemData) {
                $product = Product::where('id', $itemData['product_id'])
                    ->where('branch_id', $defaultBranch->id)
                    ->firstOrFail();

                // Store old stock for movement tracking
                $oldStock = $product->stock;

                $purchaseItem = PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $itemData['product_id'],
                    'unit_cost' => $itemData['unit_cost'],
                    'quantity' => $itemData['quantity'],
                    'discount' => $itemData['discount'] ?? 0,
                    'total' => ($itemData['unit_cost'] * $itemData['quantity']) - ($itemData['discount'] ?? 0)
                ]);

                // Update product stock and cost price
                $product->stock += $itemData['quantity'];
                $product->cost_price = $itemData['unit_cost'];
                $product->save();

                // Record stock movement - FIXED VARIABLES
                StockMovement::create([
                    'business_id' => $defaultBranch->business_id, // Fixed
                    'branch_id' => $defaultBranch->id, // Fixed
                    'product_id' => $itemData['product_id'],
                    'user_id' => $user->id, // Fixed
                    'reference_type' => 'purchase',
                    'reference_id' => $purchase->id,
                    'movement_type' => 'in',
                    'quantity' => $itemData['quantity'],
                    'stock_before' => $oldStock, // Fixed
                    'stock_after' => $product->stock,
                    'unit_cost' => $itemData['unit_cost'],
                    'reason' => 'Purchase - ' . $purchase->invoice_number,
                ]);
            }

            DB::commit();

            // Reload purchase with relationships
            $purchase->load(['supplier', 'branch', 'items.product']);

            return response()->json([
                'success' => true,
                'purchase' => $purchase,
                'message' => 'Purchase created successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create purchase: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $purchase = Purchase::with(['supplier', 'branch', 'items.product', 'createdBy'])
                ->where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'purchase' => $purchase,
                'message' => 'Purchase fetched successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Purchase not found: ' . $e->getMessage()
            ], 404);
        }
    }

    public function update(Request $request, $id)
    {
        DB::beginTransaction();
        
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }

            $purchase = Purchase::where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            // Can only update pending purchases
            if ($purchase->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending purchases can be updated'
                ], 422);
            }

            $validated = $request->validate([
                'supplier_id' => 'required|exists:suppliers,id',
                'date' => 'required|date',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.unit_cost' => 'required|numeric|min:0',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.discount' => 'nullable|numeric|min:0',
                'discount' => 'nullable|numeric|min:0',
                'transport_cost' => 'nullable|numeric|min:0',
                'paid_amount' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string'
            ]);

            // Revert old stock and record movements
            foreach ($purchase->items as $oldItem) {
                $product = Product::where('id', $oldItem->product_id)
                    ->where('branch_id', $defaultBranch->id)
                    ->first();
                    
                if ($product) {
                    $oldStock = $product->stock;
                    $product->stock -= $oldItem->quantity;
                    $product->save();

                    // Record stock movement for reversal
                    StockMovement::create([
                        'business_id' => $defaultBranch->business_id,
                        'branch_id' => $defaultBranch->id,
                        'product_id' => $oldItem->product_id,
                        'user_id' => $user->id,
                        'reference_type' => 'purchase',
                        'reference_id' => $purchase->id,
                        'movement_type' => 'out',
                        'quantity' => $oldItem->quantity,
                        'stock_before' => $oldStock,
                        'stock_after' => $product->stock,
                        'unit_cost' => $oldItem->unit_cost,
                        'reason' => 'Purchase Update Reversal - ' . $purchase->invoice_number,
                    ]);
                }
            }

            // Delete old items
            $purchase->items()->delete();

            // Calculate new totals
            $subtotal = 0;
            foreach ($request->items as $item) {
                $itemTotal = ($item['unit_cost'] * $item['quantity']) - ($item['discount'] ?? 0);
                $subtotal += $itemTotal;
            }

            $grandTotal = $subtotal - ($request->discount ?? 0) + ($request->transport_cost ?? 0);
            $balance = $grandTotal - ($request->paid_amount ?? 0);

            // Update purchase
            $purchase->update([
                'supplier_id' => $request->supplier_id,
                'date' => $request->date,
                'subtotal' => $subtotal,
                'discount' => $request->discount ?? 0,
                'transport_cost' => $request->transport_cost ?? 0,
                'grand_total' => $grandTotal,
                'paid_amount' => $request->paid_amount ?? 0,
                'balance' => $balance,
                'notes' => $request->notes,
            ]);

            // Create new purchase items and update product stock & cost price
            foreach ($request->items as $itemData) {
                $product = Product::where('id', $itemData['product_id'])
                    ->where('branch_id', $defaultBranch->id)
                    ->firstOrFail();

                $oldStock = $product->stock;

                $purchaseItem = PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $itemData['product_id'],
                    'unit_cost' => $itemData['unit_cost'],
                    'quantity' => $itemData['quantity'],
                    'discount' => $itemData['discount'] ?? 0,
                    'total' => ($itemData['unit_cost'] * $itemData['quantity']) - ($itemData['discount'] ?? 0)
                ]);

                // Update product stock with new quantity and cost price
                $product->stock += $itemData['quantity'];
                $product->cost_price = $itemData['unit_cost'];
                $product->save();

                // Record stock movement for new items
                StockMovement::create([
                    'business_id' => $defaultBranch->business_id,
                    'branch_id' => $defaultBranch->id,
                    'product_id' => $itemData['product_id'],
                    'user_id' => $user->id,
                    'reference_type' => 'purchase',
                    'reference_id' => $purchase->id,
                    'movement_type' => 'in',
                    'quantity' => $itemData['quantity'],
                    'stock_before' => $oldStock,
                    'stock_after' => $product->stock,
                    'unit_cost' => $itemData['unit_cost'],
                    'reason' => 'Purchase Update - ' . $purchase->invoice_number,
                ]);
            }

            DB::commit();

            // Reload purchase with relationships
            $purchase->load(['supplier', 'branch', 'items.product']);

            return response()->json([
                'success' => true,
                'purchase' => $purchase,
                'message' => 'Purchase updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update purchase: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        DB::beginTransaction();
        
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }

            $purchase = Purchase::where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            // Revert product stock and record movements
            foreach ($purchase->items as $item) {
                $product = Product::where('id', $item->product_id)
                    ->where('branch_id', $defaultBranch->id)
                    ->first();
                    
                if ($product) {
                    $oldStock = $product->stock;
                    $product->stock -= $item->quantity;
                    $product->save();

                    // Record stock movement for deletion
                    StockMovement::create([
                        'business_id' => $defaultBranch->business_id,
                        'branch_id' => $defaultBranch->id,
                        'product_id' => $item->product_id,
                        'user_id' => $user->id,
                        'reference_type' => 'purchase',
                        'reference_id' => $purchase->id,
                        'movement_type' => 'out',
                        'quantity' => $item->quantity,
                        'stock_before' => $oldStock,
                        'stock_after' => $product->stock,
                        'unit_cost' => $item->unit_cost,
                        'reason' => 'Purchase Deletion - ' . $purchase->invoice_number,
                    ]);
                }
            }

            // Delete purchase items and purchase
            $purchase->items()->delete();
            $purchase->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Purchase deleted successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete purchase: ' . $e->getMessage()
            ], 500);
        }
    }

    private function applyDateFilter($query, $filter, $request)
    {
        $now = now();

        switch ($filter) {
            case 'today':
                $query->whereDate('date', $now->toDateString());
                break;
            case 'thisweek':
                $query->whereBetween('date', [
                    $now->startOfWeek()->toDateString(),
                    $now->endOfWeek()->toDateString()
                ]);
                break;
            case 'month':
                $query->whereBetween('date', [
                    $now->startOfMonth()->toDateString(),
                    $now->endOfMonth()->toDateString()
                ]);
                break;
            case 'custom':
                if ($request->has(['start_date', 'end_date'])) {
                    $query->whereBetween('date', [
                        $request->start_date,
                        $request->end_date
                    ]);
                }
                break;
        }
    }

    // Add after your existing methods in PurchaseController.php

public function report(Request $request)
{
    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        $filter = $request->input('filter', 'month');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        // Set date range based on filter
        $dateRange = $this->getDateRange($filter, $startDate, $endDate);
        $start = $dateRange['start'];
        $end = $dateRange['end'];

        // Query purchases within date range
        $query = Purchase::with(['supplier', 'items.product'])
            ->where('branch_id', $defaultBranch->id)
            ->whereBetween('date', [$start, $end]);

        // Get total purchases
        $totalPurchases = $query->sum('grand_total');

        // Get total orders
        $totalOrders = $query->count();

        // Get all purchases for detailed analysis
        $purchases = $query->get();

        // Average order value
        $averageOrderValue = $totalOrders > 0 ? $totalPurchases / $totalOrders : 0;

        // Most common supplier
        $mostCommonSupplier = $this->getMostCommonSupplier($purchases);

        // Daily purchase data for chart
        $dailyPurchases = $this->getDailyPurchaseData($defaultBranch->id, $start, $end);

        // Top products purchased
        $topProducts = $this->getTopPurchasedProducts($defaultBranch->id, $start, $end, 5);

        // Supplier statistics
        $supplierStats = $this->getSupplierStatistics($defaultBranch->id, $start, $end);

        // Payment method breakdown
        $paymentStats = $this->getPaymentStatistics($defaultBranch->id, $start, $end);

        return response()->json([
            'success' => true,
            'total_purchases' => (float) $totalPurchases,
            'total_orders' => (int) $totalOrders,
            'average_order_value' => round($averageOrderValue, 2),
            'most_common_supplier' => $mostCommonSupplier,
            'daily_purchases' => $dailyPurchases,
            'top_products' => $topProducts,
            'supplier_stats' => $supplierStats,
            'payment_stats' => $paymentStats,
            'date_range' => [
                'start' => $start->format('Y-m-d'),
                'end' => $end->format('Y-m-d'),
                'filter' => $filter
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Error generating purchase report: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to generate purchase report: ' . $e->getMessage()
        ], 500);
    }
}

public function exportReport(Request $request)
{
    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        $filter = $request->input('filter', 'month');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $format = $request->input('format', 'json');

        // Set date range based on filter
        $dateRange = $this->getDateRange($filter, $startDate, $endDate);
        $start = $dateRange['start'];
        $end = $dateRange['end'];

        // Get all purchases for the period
        $purchases = Purchase::with(['supplier', 'items.product'])
            ->where('branch_id', $defaultBranch->id)
            ->whereBetween('date', [$start, $end])
            ->orderBy('date', 'desc')
            ->get();

        // Calculate summary statistics
        $totalPurchases = $purchases->sum('grand_total');
        $totalOrders = $purchases->count();
        $averageOrderValue = $totalOrders > 0 ? $totalPurchases / $totalOrders : 0;

        // Prepare data for response
        $reportData = [
            'total_purchases' => (float) $totalPurchases,
            'total_orders' => (int) $totalOrders,
            'average_order_value' => round($averageOrderValue, 2),
            'purchases' => $purchases,
            'date_range' => [
                'start' => $start->format('Y-m-d'),
                'end' => $end->format('Y-m-d'),
                'filter' => $filter
            ],
            'branch_name' => $defaultBranch->name,
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        return response()->json([
            'success' => true,
            'data' => $reportData,
            'message' => 'Purchase report data fetched successfully'
        ]);

    } catch (\Exception $e) {
        \Log::error('Error exporting purchase report: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to export purchase report: ' . $e->getMessage()
        ], 500);
    }
}

private function getDateRange($filter, $customStart, $customEnd)
{
    $now = now();
    
    switch ($filter) {
        case 'today':
            $start = $now->copy()->startOfDay();
            $end = $now->copy()->endOfDay();
            break;
            
        case 'week':
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
            break;
            
        case 'month':
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
            break;
            
        case 'year':
            $start = $now->copy()->startOfYear();
            $end = $now->copy()->endOfYear();
            break;
            
        case 'custom':
            $start = $customStart ? \Carbon\Carbon::parse($customStart)->startOfDay() : $now->copy()->startOfDay();
            $end = $customEnd ? \Carbon\Carbon::parse($customEnd)->endOfDay() : $now->copy()->endOfDay();
            break;
            
        default:
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
    }
    
    return [
        'start' => $start,
        'end' => $end
    ];
}

private function getMostCommonSupplier($purchases)
{
    try {
        if ($purchases->isEmpty()) {
            return 'N/A';
        }

        $supplierCounts = [];
        
        foreach ($purchases as $purchase) {
            if ($purchase->supplier) {
                $supplierId = $purchase->supplier->id;
                $supplierCounts[$supplierId] = [
                    'name' => $purchase->supplier->name,
                    'count' => ($supplierCounts[$supplierId]['count'] ?? 0) + 1
                ];
            }
        }

        if (empty($supplierCounts)) {
            return 'N/A';
        }

        // Find supplier with highest count
        usort($supplierCounts, function($a, $b) {
            return $b['count'] <=> $a['count'];
        });

        return $supplierCounts[0]['name'];
    } catch (\Exception $e) {
        \Log::error('Error getting most common supplier: ' . $e->getMessage());
        return 'N/A';
    }
}

private function getDailyPurchaseData($branchId, $start, $end)
{
    try {
        $data = [];
        $current = $start->copy();
        
        while ($current <= $end) {
            $dayStart = $current->copy()->startOfDay();
            $dayEnd = $current->copy()->endOfDay();
            
            $dailyPurchases = Purchase::where('branch_id', $branchId)
                ->whereBetween('date', [$dayStart, $dayEnd])
                ->sum('grand_total');
            
            $dailyOrders = Purchase::where('branch_id', $branchId)
                ->whereBetween('date', [$dayStart, $dayEnd])
                ->count();
            
            $data[] = [
                'date' => $current->format('Y-m-d'),
                'purchases' => (float) $dailyPurchases,
                'orders' => (int) $dailyOrders,
                'average' => $dailyOrders > 0 ? round($dailyPurchases / $dailyOrders, 2) : 0
            ];
            
            $current->addDay();
        }
        
        return $data;
    } catch (\Exception $e) {
        \Log::error('Error getting daily purchase data: ' . $e->getMessage());
        return [];
    }
}

private function getTopPurchasedProducts($branchId, $start, $end, $limit = 5)
{
    try {
        $topProducts = DB::table('purchase_items')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->where('purchases.branch_id', $branchId)
            ->whereBetween('purchases.date', [$start, $end])
            ->select(
                'products.id',
                'products.name',
                'products.sku',
                DB::raw('SUM(purchase_items.quantity) as total_quantity'),
                DB::raw('SUM(purchase_items.total) as total_amount')
            )
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('total_quantity')
            ->limit($limit)
            ->get()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'total_quantity' => (int) $product->total_quantity,
                    'total_amount' => (float) $product->total_amount
                ];
            })
            ->toArray();

        return $topProducts;
    } catch (\Exception $e) {
        \Log::error('Error getting top purchased products: ' . $e->getMessage());
        return [];
    }
}

private function getSupplierStatistics($branchId, $start, $end)
{
    try {
        // Total unique suppliers
        $totalSuppliers = Purchase::where('branch_id', $branchId)
            ->whereBetween('date', [$start, $end])
            ->whereNotNull('supplier_id')
            ->distinct('supplier_id')
            ->count('supplier_id');

        // Suppliers with multiple orders
        $repeatSuppliers = DB::table('purchases')
            ->select('supplier_id', DB::raw('COUNT(*) as order_count'))
            ->where('branch_id', $branchId)
            ->whereBetween('date', [$start, $end])
            ->whereNotNull('supplier_id')
            ->groupBy('supplier_id')
            ->havingRaw('COUNT(*) > 1')
            ->count();

        // New suppliers (first order in this period)
        $previousPeriodStart = $start->copy()->subDays(30);
        $newSuppliers = DB::table('purchases')
            ->select('supplier_id')
            ->where('branch_id', $branchId)
            ->whereBetween('date', [$start, $end])
            ->whereNotNull('supplier_id')
            ->whereNotExists(function ($query) use ($branchId, $previousPeriodStart, $start) {
                $query->select(DB::raw(1))
                    ->from('purchases as p2')
                    ->whereColumn('p2.supplier_id', 'purchases.supplier_id')
                    ->where('p2.branch_id', $branchId)
                    ->whereBetween('p2.date', [$previousPeriodStart, $start->copy()->subDay()]);
            })
            ->distinct('supplier_id')
            ->count('supplier_id');

        return [
            'total_suppliers' => $totalSuppliers,
            'repeat_suppliers' => $repeatSuppliers,
            'new_suppliers' => $newSuppliers
        ];
    } catch (\Exception $e) {
        \Log::error('Error getting supplier statistics: ' . $e->getMessage());
        return [
            'total_suppliers' => 0,
            'repeat_suppliers' => 0,
            'new_suppliers' => 0
        ];
    }
}

private function getPaymentStatistics($branchId, $start, $end)
{
    try {
        $paymentStats = DB::table('purchases')
            ->select(
                'payment_method',
                DB::raw('COUNT(*) as transaction_count'),
                DB::raw('SUM(grand_total) as total_amount')
            )
            ->where('branch_id', $branchId)
            ->whereBetween('date', [$start, $end])
            ->whereNotNull('payment_method')
            ->groupBy('payment_method')
            ->get()
            ->mapWithKeys(function ($item) {
                return [$item->payment_method => [
                    'transactions' => (int) $item->transaction_count,
                    'total_amount' => (float) $item->total_amount
                ]];
            })
            ->toArray();

        return $paymentStats;
    } catch (\Exception $e) {
        \Log::error('Error getting payment statistics: ' . $e->getMessage());
        return [];
    }
}
}