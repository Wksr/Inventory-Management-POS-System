<?php

namespace App\Http\Controllers;

use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use App\Models\Sale;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\LoyaltySetting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SaleReturnController extends Controller
{
    public function index(Request $request): JsonResponse
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

            $query = SaleReturn::with(['sale', 'customer', 'user', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->latest();

            // Search filter
            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Date filter
            if ($request->has('date_filter') && !empty($request->date_filter)) {
                switch ($request->date_filter) {
                    case 'today':
                        $query->today();
                        break;
                    case 'thisweek':
                        $query->thisWeek();
                        break;
                    case 'month':
                        $query->thisMonth();
                        break;
                    case 'custom':
                        if ($request->has(['start_date', 'end_date'])) {
                            $query->whereBetween('return_date', [
                                $request->start_date,
                                $request->end_date
                            ]);
                        }
                        break;
                }
            }

            // Status filter
            if ($request->has('status') && !empty($request->status)) {
                $query->where('status', $request->status);
            }

            $perPage = $request->per_page ?? 20;
            $salesReturns = $query->paginate($perPage);

            // Calculate summary
            $summary = [
                'total_returns' => $query->count(),
                'total_refund_amount' => $query->sum('total_refund'),
                'total_balance' => $query->sum('balance_amount'),
                'average_return' => $query->count() > 0 ? 
                    round($query->sum('total_refund') / $query->count(), 2) : 0
            ];

            return response()->json([
                'success' => true,
                'sales_returns' => $salesReturns,
                'summary' => $summary,
                'message' => 'Sales returns fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching sales returns: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sales returns: ' . $e->getMessage()
            ], 500);
        }
    }

  public function store(Request $request): JsonResponse
{
    DB::beginTransaction();

    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        \Log::info('Creating sales return', [
            'user_id' => $user->id,
            'branch_id' => $defaultBranch->id,
            'branch_name' => $defaultBranch->name ?? 'N/A'
        ]);

        // Make sale_item_id nullable since you might return items not in original sale
        $validator = Validator::make($request->all(), [
            'sale_id' => 'required|exists:sales,id',
            'return_date' => 'required|date',
            'reason' => 'required|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.sale_item_id' => 'nullable|exists:sale_items,id',
            'items.*.return_quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.item_reason' => 'nullable|string|max:255',
            'refund_amount' => 'required|numeric|min:0',
            'payment_method' => 'nullable|in:cash,bank_transfer,credit_note,exchange',
            'notes' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            \Log::warning('Validation failed', ['errors' => $validator->errors()]);
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        // Validate sale exists and belongs to branch
        $sale = Sale::with(['items'])
            ->where('branch_id', $defaultBranch->id)
            ->find($request->sale_id);

        if (!$sale) {
            \Log::warning('Sale not found', [
                'sale_id' => $request->sale_id,
                'branch_id' => $defaultBranch->id
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Sale not found or does not belong to this branch'
            ], 404);
        }

        \Log::info('Sale found for return', [
            'sale_id' => $sale->id,
            'invoice_no' => $sale->invoice_no,
            'customer_id' => $sale->customer_id
        ]);

        // Calculate totals and validate items
        $subtotal = 0;
        $itemsData = [];
        
      foreach ($request->items as $index => $item) {
    $saleItem = null;
    $maxReturnQuantity = 9999; // default for additional/non-linked returns

    
    if (!empty($item['sale_item_id'])) {
        $saleItem = $sale->items()->where('id', $item['sale_item_id'])->first();

        if (!$saleItem) {
            DB::rollBack();
            \Log::warning('Sale item not found', ['sale_item_id' => $item['sale_item_id']]);
            return response()->json([
                'success' => false,
                'message' => "Sale item not found in the original sale"
            ], 404);
        }

        
        $alreadyReturned = SaleReturnItem::where('sale_item_id', $item['sale_item_id'])
            ->sum('return_quantity');

        $availableToReturn = $saleItem->quantity - $alreadyReturned;

        if ($item['return_quantity'] > $availableToReturn) {
            DB::rollBack();
            \Log::warning('Cannot return more than available', [
                'requested' => $item['return_quantity'],
                'available' => $availableToReturn
            ]);
            return response()->json([
                'success' => false,
                'message' => "Cannot return {$item['return_quantity']} items. Only {$availableToReturn} available for return."
            ], 422);
        }

        $maxReturnQuantity = $saleItem->quantity;
    } 
    
    elseif (!empty($item['product_id'])) {
        $saleItem = $sale->items()
            ->where('product_id', $item['product_id'])
            ->first();

        if ($saleItem) {
        
            $alreadyReturned = SaleReturnItem::where('sale_item_id', $saleItem->id)
                ->sum('return_quantity');

            $availableToReturn = $saleItem->quantity - $alreadyReturned;

            if ($item['return_quantity'] > $availableToReturn) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => "Cannot return more than available for product {$item['product_id']}"
                ], 422);
            }

            $maxReturnQuantity = $saleItem->quantity;
        } else {
           
            \Log::warning("No sale item linked for product {$item['product_id']} in return");
            $maxReturnQuantity = 9999; // unlimited
        }
    }
   
    else {
        \Log::warning("Return item without sale_item_id or product_id", ['index' => $index]);
        $maxReturnQuantity = 9999;
    }

    // Validate product exists in branch (this is common for all cases)
    $product = Product::where('branch_id', $defaultBranch->id)
        ->find($item['product_id']);

    if (!$product) {
        DB::rollBack();
        \Log::warning('Product not found in branch', [
            'product_id' => $item['product_id'],
            'branch_id' => $defaultBranch->id
        ]);
        return response()->json([
            'success' => false,
            'message' => "Product not found in this branch"
        ], 404);
    }

    // Calculate item total
    $itemTotal = $item['unit_price'] * $item['return_quantity'];
    $subtotal += $itemTotal;

    // Prepare item data
    $itemsData[] = [
        'sale_item_id'     => $saleItem?->id,  // linked or null
        'product_id'       => $product->id,
        'product_name'     => $product->name,
        'sku'              => $product->sku ?? '',
        'unit_price'       => $item['unit_price'],
        'return_quantity'  => $item['return_quantity'],
        'max_return_quantity' => $maxReturnQuantity,
        'item_reason'      => $item['item_reason'] ?? '',
        'subtotal'         => $itemTotal,
        'tax'              => 0,
        'total'            => $itemTotal
    ];
}

        $totalRefund = $subtotal;
        $refundAmount = $request->refund_amount ?? 0;
        $balanceAmount = $totalRefund - $refundAmount;

        if ($refundAmount > $totalRefund) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Refund amount cannot exceed total refund value'
            ], 422);
        }

        // Generate return number - FIXED VERSION
        $returnNo = $this->generateReturnNumber($defaultBranch);
        
        \Log::info('Creating sale return with data', [
            'return_no' => $returnNo,
            'sale_id' => $sale->id,
            'total_refund' => $totalRefund,
            'items_count' => count($itemsData)
        ]);

        // Create sale return
        $saleReturn = SaleReturn::create([
            'return_no' => $returnNo,
            'sale_id' => $sale->id,
            'customer_id' => $sale->customer_id,
            'branch_id' => $defaultBranch->id,
            'business_id' => $defaultBranch->business_id,
            'user_id' => $user->id,
            'reason' => $request->reason,
            'subtotal' => $subtotal,
            'discount' => 0,
            'tax' => 0,
            'total_refund' => $totalRefund,
            'refund_amount' => $refundAmount,
            'balance_amount' => $balanceAmount,
            'payment_method' => $request->payment_method ?? 'cash',
            'payment_status' => $balanceAmount > 0 ? 'refunded' : 'completed',
            'status' => 'completed',
            'notes' => $request->notes ?? '',
            'return_date' => $request->return_date
        ]);

        \Log::info('Sale return created', ['sale_return_id' => $saleReturn->id]);

        // Create return items
        foreach ($itemsData as $itemData) {
            $saleReturn->items()->create($itemData);
        }

        // Update product stock
        foreach ($saleReturn->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock + $item->return_quantity;
                
                $product->update(['stock' => $newStock]);
                
                // Record stock movement
                StockMovement::create([
                    'business_id' => $defaultBranch->business_id,
                    'branch_id' => $defaultBranch->id,
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'reference_type' => 'sale_return',
                    'reference_id' => $saleReturn->id,
                    'movement_type' => 'in',
                    'quantity' => $item->return_quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->unit_price,
                    'reason' => 'Sales Return - ' . $returnNo
                ]);
            }
        }

        // Update sale status if needed
        $totalReturned = SaleReturn::where('sale_id', $sale->id)->sum('total_refund');
        if ($totalReturned >= $sale->total) {
            $sale->update(['status' => 'refunded']);
        } elseif ($totalReturned > 0) {
            $sale->update(['status' => 'refunded']);
        }

 if ($saleReturn->customer && $saleReturn->total_refund > 0) {
    try {
        // Fetch loyalty settings: prefer branch-specific, fallback to global (branch_id NULL)
        $settings = LoyaltySetting::where('business_id', $saleReturn->business_id)
            ->where(function ($query) use ($saleReturn) {
                $query->where('branch_id', $saleReturn->branch_id)
                      ->orWhereNull('branch_id');
            })
            // MariaDB/MySQL compatible ordering: non-null (branch-specific) first
            ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('branch_id', 'DESC')
            ->first();

        // If no settings found, use defaults
        if (!$settings) {
            $pointsToDeduct = floor($saleReturn->total_refund / 100); // default: 1 point per 100 LKR
        } else {
            if (!$settings->enabled) {
                // Program disabled — no deduction
                $pointsToDeduct = 0;
            } else {
                $pointsToDeduct = floor(
                    ($saleReturn->total_refund / $settings->currency_value) *
                    $settings->points_per_currency
                );
            }
        }

        // Only deduct if points > 0
        if ($pointsToDeduct > 0) {
            $saleReturn->customer->decrement('loyalty_points', $pointsToDeduct);
            $saleReturn->customer->decrement('total_purchases', $saleReturn->total_refund);

            \Log::info("Loyalty points deducted on sales return", [
                'customer_id' => $saleReturn->customer_id,
                'points_deducted' => $pointsToDeduct,
                'total_refund' => $saleReturn->total_refund,
                'return_no' => $saleReturn->return_no,
            ]);
        }
    } catch (\Exception $e) {
        \Log::error('Error deducting loyalty points on return: ' . $e->getMessage(), [
            'return_no' => $saleReturn->return_no ?? 'unknown',
            'trace' => $e->getTraceAsString()
        ]);
        // Do not rollback transaction — return should still succeed
    }
}
        DB::commit();

        // Reload relationships
        $saleReturn->load(['sale.customer', 'items.product', 'user']);

        \Log::info('Sales return created successfully', [
            'sale_return_id' => $saleReturn->id,
            'return_no' => $saleReturn->return_no
        ]);

        return response()->json([
            'success' => true,
            'sale_return' => $saleReturn,
            'message' => 'Sales return created successfully'
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error creating sales return: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'Failed to create sales return: ' . $e->getMessage()
        ], 500);
    }
}

// Add this helper method in the controller
private function generateReturnNumber($branch)
{
    try {
        // Get branch code safely
        $branchCode = 'BRN';
        if (!empty($branch->code)) {
            $branchCode = strtoupper(substr($branch->code, 0, 3));
        } elseif (!empty($branch->name)) {
            $branchCode = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $branch->name), 0, 3));
        }
        
        $date = now()->format('Ymd');
        
        // Get the last return number for today
        $lastReturn = SaleReturn::where('branch_id', $branch->id)
            ->whereDate('created_at', today())
            ->orderBy('id', 'desc')
            ->first();

        $sequence = 1;
        if ($lastReturn && !empty($lastReturn->return_no)) {
            // Extract sequence number from return_no (assuming format RTN-XXX-YYYYMMDD-0001)
            $parts = explode('-', $lastReturn->return_no);
            if (count($parts) >= 4) {
                $lastSeq = (int) $parts[3];
                $sequence = $lastSeq + 1;
            }
        }

        return sprintf('RTN-%s-%s-%04d', $branchCode, $date, $sequence);
        
    } catch (\Exception $e) {
        \Log::error('Error generating return number: ' . $e->getMessage());
        // Fallback to simple timestamp-based number
        return 'RTN-' . now()->format('YmdHis') . rand(100, 999);
    }

}
    public function show(Request $request, $id): JsonResponse
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

            $saleReturn = SaleReturn::with(['sale', 'customer', 'items.product', 'user'])
                ->where('branch_id', $defaultBranch->id)
                ->find($id);

            if (!$saleReturn) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sales return not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'sale_return' => $saleReturn,
                'message' => 'Sales return details fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching sales return: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sales return: ' . $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id): JsonResponse
    {
        DB::beginTransaction();

        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $saleReturn = SaleReturn::with(['items'])
                ->where('branch_id', $defaultBranch->id)
                ->find($id);

            if (!$saleReturn) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sales return not found'
                ], 404);
            }

            // Only allow status and payment updates
            $validator = Validator::make($request->all(), [
                'status' => 'nullable|in:pending,completed,cancelled',
                'payment_status' => 'nullable|in:pending,partial,completed',
                'refund_amount' => 'nullable|numeric|min:0',
                'balance_amount' => 'nullable|numeric|min:0',
                'payment_method' => 'nullable|in:cash,bank_transfer,credit_note,exchange',
                'notes' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            $validated = $validator->validated();
            
            // Recalculate balance if refund amount updated
            if (isset($validated['refund_amount'])) {
                $validated['balance_amount'] = $saleReturn->total_refund - $validated['refund_amount'];
                $validated['payment_status'] = $validated['balance_amount'] > 0 ? 'refunded' : 'completed';
            }

            $saleReturn->update($validated);

            DB::commit();

            $saleReturn->load(['sale', 'customer', 'items.product']);

            return response()->json([
                'success' => true,
                'sale_return' => $saleReturn,
                'message' => 'Sales return updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating sales return: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update sales return: ' . $e->getMessage()
            ], 500);
        }
    }

  public function destroy(Request $request, $id): JsonResponse
{
    DB::beginTransaction();

    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        $saleReturn = SaleReturn::with(['items'])
            ->where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$saleReturn) {
            return response()->json([
                'success' => false,
                'message' => 'Sales return not found'
            ], 404);
        }

        // Reverse stock adjustment (remove returned items from stock again)
        foreach ($saleReturn->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock - $item->return_quantity;

                $product->update(['stock' => $newStock]);

                StockMovement::create([
                    'business_id' => $saleReturn->business_id,
                    'branch_id' => $saleReturn->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'reference_type' => 'sale_return_reversal',
                    'reference_id' => $saleReturn->id,
                    'movement_type' => 'out',
                    'quantity' => $item->return_quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->unit_price,
                    'reason' => 'Sales Return Deletion - Return No: ' . $saleReturn->return_no
                ]);
            }
        }

        // Restore loyalty points using the same dynamic settings as creation
        if ($saleReturn->customer && $saleReturn->total_refund > 0) {
            try {
                // Fetch loyalty settings (branch-specific first, then global)
                $settings = LoyaltySetting::where('business_id', $saleReturn->business_id)
                    ->where(function ($query) use ($saleReturn) {
                        $query->where('branch_id', $saleReturn->branch_id)
                              ->orWhereNull('branch_id');
                    })
                    ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('branch_id', 'DESC')
                    ->first();

                // Default settings if none found
                $pointsToRestore = floor($saleReturn->total_refund / 100); // default 1pt per 100 LKR

                if ($settings && $settings->enabled) {
                    $pointsToRestore = floor(
                        ($saleReturn->total_refund / $settings->currency_value) *
                        $settings->points_per_currency
                    );
                }

                if ($pointsToRestore > 0) {
                    $saleReturn->customer->increment('loyalty_points', $pointsToRestore);
                    $saleReturn->customer->increment('total_purchases', $saleReturn->total_refund);

                    \Log::info("Loyalty points restored on return deletion", [
                        'customer_id' => $saleReturn->customer_id,
                        'points_restored' => $pointsToRestore,
                        'total_refund' => $saleReturn->total_refund,
                        'return_no' => $saleReturn->return_no,
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Error restoring loyalty points on return deletion: ' . $e->getMessage());
                // Continue — deletion should still succeed
            }
        }

        // Update original sale status
        $sale = $saleReturn->sale;
        if ($sale) {
            $remainingRefunded = SaleReturn::where('sale_id', $sale->id)
                ->where('id', '!=', $saleReturn->id)
                ->sum('total_refund');

            if ($remainingRefunded <= 0) {
                $sale->update(['status' => 'completed']);
            } elseif ($remainingRefunded < $sale->total) {
                $sale->update(['status' => 'partial_refunded']); // or 'refunded' if you prefer
            } else {
                $sale->update(['status' => 'refunded']);
            }
        }

        $saleReturn->delete();

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'Sales return deleted successfully'
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error deleting sales return: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'Failed to delete sales return: ' . $e->getMessage()
        ], 500);
    }
}

    public function getReturnableSales(Request $request): JsonResponse
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

            $sales = Sale::with(['customer', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->where('status', '!=', 'cancelled')
                ->where('created_at', '>=', now()->subDays(30)) // Last 30 days only
                ->latest()
                ->get()
                ->map(function ($sale) {
                    $sale->total_returned = SaleReturn::where('sale_id', $sale->id)
                        ->sum('total_refund');
                    $sale->remaining_amount = $sale->total - $sale->total_returned;
                    
                    // Add available items for return
                    foreach ($sale->items as $item) {
                        $returnedQty = SaleReturnItem::where('sale_item_id', $item->id)
                            ->sum('return_quantity');
                        $item->available_for_return = $item->quantity - $returnedQty;
                    }
                    
                    return $sale;
                })
                ->filter(function ($sale) {
                    return $sale->remaining_amount > 0;
                });

            return response()->json([
                'success' => true,
                'sales' => $sales,
                'message' => 'Returnable sales fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching returnable sales: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch returnable sales: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getSaleDetails(Request $request, $saleId): JsonResponse
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

            $sale = Sale::with(['customer', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->find($saleId);

            if (!$sale) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sale not found'
                ], 404);
            }

            // Calculate already returned quantities
            foreach ($sale->items as $item) {
                $returnedQty = SaleReturnItem::where('sale_item_id', $item->id)
                    ->sum('return_quantity');
                $item->already_returned = $returnedQty;
                $item->available_for_return = $item->quantity - $returnedQty;
            }

            $totalReturned = SaleReturn::where('sale_id', $sale->id)
                ->sum('total_refund');
            $sale->total_returned = $totalReturned;
            $sale->remaining_amount = $sale->total - $totalReturned;

            return response()->json([
                'success' => true,
                'sale' => $sale,
                'message' => 'Sale details with return info fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching sale details: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sale details: ' . $e->getMessage()
            ], 500);
        }
    }
}