<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\HoldOrder;
use App\Models\Product;
use App\Models\Customer;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SaleController extends Controller
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

            $query = Sale::with(['customer', 'user', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->latest();

            // Search filter
            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Status filter
            if ($request->has('status') && !empty($request->status)) {
                $query->where('status', $request->status);
            }

            // Payment method filter
            if ($request->has('payment_method') && !empty($request->payment_method)) {
                $query->where('payment_method', $request->payment_method);
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
                            $query->whereBetween('created_at', [
                                $request->start_date,
                                $request->end_date . ' 23:59:59'
                            ]);
                        }
                        break;
                }
            }

            // Customer filter
            if ($request->has('customer_id') && !empty($request->customer_id)) {
                $query->where('customer_id', $request->customer_id);
            }

            $perPage = $request->per_page ?? 20;
            $sales = $query->paginate($perPage);

            // Calculate summary
            $summary = [
                'total_sales' => $query->sum('total'),
                'total_transactions' => $query->count(),
                'total_discount' => $query->sum('discount'),
                'total_tax' => $query->sum('tax'),
                'average_sale' => $query->count() > 0 ? round($query->sum('total') / $query->count(), 2) : 0
            ];

            return response()->json([
                'success' => true,
                'sales' => $sales,
                'summary' => $summary,
                'message' => 'Sales fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching sales: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sales: ' . $e->getMessage()
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
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'customer_id' => 'nullable|exists:customers,id',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.quantity' => 'required|integer|min:1',
                'discount' => 'nullable|numeric|min:0',
                'shipping' => 'nullable|numeric|min:0',
                'tax' => 'nullable|numeric|min:0',
                'payment_method' => 'required|in:cash,card,transfer,credit,mobile_money',
                'paid_amount' => 'required|numeric|min:0',
                'notes' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            // Validate stock availability
            foreach ($request->items as $item) {
                $product = Product::where('branch_id', $defaultBranch->id)
                    ->where('id', $item['product_id'])
                    ->first();

                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Product not found or not available in this branch'
                    ], 404);
                }

                if ($product->stock < $item['quantity']) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Insufficient stock for product: {$product->name}. Available: {$product->stock}, Requested: {$item['quantity']}"
                    ], 422);
                }
            }

            // Generate invoice number
            $invoiceNo = Sale::generateInvoiceNo($defaultBranch);
            
            // Calculate totals
            $subtotal = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
                $product = Product::find($item['product_id']);
                $itemSubtotal = $product->price * $item['quantity'];
                $subtotal += $itemSubtotal;

                $itemsData[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $product->sku,
                    'price' => $product->price,
                    'cost_price' => $product->cost_price,
                    'quantity' => $item['quantity'],
                    'subtotal' => $itemSubtotal,
                    'discount' => 0, // Individual item discount if needed
                    'tax' => 0, // Individual item tax if needed
                    'total' => $itemSubtotal
                ];
            }

            $discount = $request->discount ?? 0;
            $shipping = $request->shipping ?? 0;
            $tax = $request->tax ?? 0;
            $total = $subtotal - $discount + $shipping + $tax;
            $paidAmount = $request->paid_amount;
            $changeAmount = $paidAmount - $total;

            if ($changeAmount < 0 && $request->payment_method != 'credit') {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Insufficient payment amount'
                ], 422);
            }

            if ($request->has('hold_reference_no') && $request->hold_reference_no) {
            HoldOrder::where('reference_no', $request->hold_reference_no)
                ->where('branch_id', $defaultBranch->id)
                ->update(['is_active' => false]);
        }

            // Create sale
            $sale = Sale::create([
                'invoice_no' => $invoiceNo,
                'customer_id' => $request->customer_id,
                'branch_id' => $defaultBranch->id,
                'business_id' => $defaultBranch->business_id,
                'user_id' => $user->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'shipping' => $shipping,
                'tax' => $tax,
                'total' => $total,
                'paid_amount' => $paidAmount,
                'change_amount' => max($changeAmount, 0),
                'payment_method' => $request->payment_method,
                'payment_status' => $changeAmount >= 0 ? 'paid' : 'partial',
                'status' => 'completed',
                'notes' => $request->notes,
                'completed_at' => now()
            ]);

            // Create sale items
            foreach ($itemsData as $itemData) {
                $sale->items()->create($itemData);
            }

            // Update stock levels
            $sale->updateStock();

            // Record loyalty points
            $sale->recordLoyaltyPoints();

            DB::commit();

            $sale->load(['customer', 'items.product', 'user']);

            return response()->json([
                'success' => true,
                'sale' => $sale,
                'message' => 'Sale completed successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating sale: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to create sale: ' . $e->getMessage()
            ], 500);
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

            $sale = Sale::with(['customer', 'user', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->find($id);

            if (!$sale) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sale not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'sale' => $sale,
                'message' => 'Sale details fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching sale: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch sale: ' . $e->getMessage()
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

        $sale = Sale::with(['items'])
            ->where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found'
            ], 404);
        }

        // Validate request
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|exists:customers,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'paid_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        // Store old items and totals for reversal
        $oldItems = $sale->items->toArray();
        $oldTotal = $sale->total;

        // === 1. REVERSE OLD STOCK & LOYALTY ===
        // Restore stock from old items
        foreach ($oldItems as $oldItem) {
            $product = Product::where('branch_id', $defaultBranch->id)
                ->where('id', $oldItem['product_id'])
                ->first();

            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock + $oldItem['quantity'];

                $product->update(['stock' => $newStock]);

                StockMovement::create([
                    'business_id' => $sale->business_id,
                    'branch_id' => $sale->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'reference_type' => 'sale_edit_reversal',
                    'reference_id' => $sale->id,
                    'movement_type' => 'in',
                    'quantity' => $oldItem['quantity'],
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $oldItem['cost_price'],
                    'reason' => 'Sale Edit - Stock Restored from Invoice: ' . $sale->invoice_no
                ]);
            }
        }

        // Reverse old loyalty points using dynamic settings
        if ($sale->customer && $oldTotal > 0) {
            try {
                $settings = LoyaltySetting::where('business_id', $sale->business_id)
                    ->where(function ($query) use ($sale) {
                        $query->where('branch_id', $sale->branch_id)
                              ->orWhereNull('branch_id');
                    })
                    ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('branch_id', 'DESC')
                    ->first();

                $oldPoints = $settings && $settings->enabled
                    ? floor(($oldTotal / $settings->currency_value) * $settings->points_per_currency)
                    : floor($oldTotal / 100); // fallback default

                if ($oldPoints > 0) {
                    $sale->customer->decrement('loyalty_points', $oldPoints);
                    $sale->customer->decrement('total_purchases', $oldTotal);

                    \Log::info("Loyalty points reversed on sale edit", [
                        'sale_id' => $sale->id,
                        'customer_id' => $sale->customer_id,
                        'points_reversed' => $oldPoints,
                        'old_total' => $oldTotal
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Error reversing loyalty points on sale edit: ' . $e->getMessage());
            }
        }

        // Delete old items
        $sale->items()->delete();

        // === 2. VALIDATE & PROCESS NEW ITEMS ===
        foreach ($request->items as $item) {
            $product = Product::where('branch_id', $defaultBranch->id)
                ->find($item['product_id']);

            if (!$product) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found in this branch'
                ], 404);
            }

            if ($product->stock < $item['quantity']) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => "Insufficient stock for {$product->name}. Available: {$product->stock}, Requested: {$item['quantity']}"
                ], 422);
            }
        }

        // Calculate new totals
        $subtotal = 0;
        $itemsData = [];

        foreach ($request->items as $item) {
            $product = Product::find($item['product_id']);
            $itemTotal = ($item['unit_price'] * $item['quantity']) - ($item['discount'] ?? 0);
            $subtotal += $itemTotal;

            $itemsData[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sku' => $product->sku,
                'price' => $item['unit_price'],
                'cost_price' => $product->cost_price,
                'quantity' => $item['quantity'],
                'subtotal' => $item['unit_price'] * $item['quantity'],
                'discount' => $item['discount'] ?? 0,
                'tax' => 0,
                'total' => $itemTotal
            ];
        }

        $discount = $request->discount ?? 0;
        $tax = $request->tax ?? 0;
        $newTotal = $subtotal - $discount + $tax;
        $paidAmount = $request->paid_amount;
        $changeAmount = $paidAmount - $newTotal;

        if ($changeAmount < 0) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Insufficient payment amount'
            ], 422);
        }

        // Update sale record
        $sale->update([
            'customer_id' => $request->customer_id,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'total' => $newTotal,
            'paid_amount' => $paidAmount,
            'change_amount' => max($changeAmount, 0),
            'payment_status' => $changeAmount >= 0 ? 'paid' : 'partial',
            'notes' => $request->notes,
            'updated_at' => now()
        ]);

        // Create new sale items
        foreach ($itemsData as $itemData) {
            $sale->items()->create($itemData);
        }

        // Deduct stock for new items
        foreach ($sale->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock - $item->quantity;

                $product->update(['stock' => $newStock]);

                StockMovement::create([
                    'business_id' => $sale->business_id,
                    'branch_id' => $sale->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'reference_type' => 'sale_edit',
                    'reference_id' => $sale->id,
                    'movement_type' => 'out',
                    'quantity' => $item->quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->cost_price,
                    'reason' => 'Sale Edit - Updated Invoice: ' . $sale->invoice_no
                ]);
            }
        }

        // Award new loyalty points using dynamic settings
        if ($sale->customer && $newTotal > 0) {
            try {
                $settings = LoyaltySetting::where('business_id', $sale->business_id)
                    ->where(function ($query) use ($sale) {
                        $query->where('branch_id', $sale->branch_id)
                              ->orWhereNull('branch_id');
                    })
                    ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('branch_id', 'DESC')
                    ->first();

                $newPoints = $settings && $settings->enabled
                    ? floor(($newTotal / $settings->currency_value) * $settings->points_per_currency)
                    : floor($newTotal / 100);

                if ($newPoints > 0) {
                    $sale->customer->increment('loyalty_points', $newPoints);
                    $sale->customer->increment('total_purchases', $newTotal);

                    \Log::info("Loyalty points awarded on sale edit", [
                        'sale_id' => $sale->id,
                        'customer_id' => $sale->customer_id,
                        'points_awarded' => $newPoints,
                        'new_total' => $newTotal
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Error awarding loyalty points on sale edit: ' . $e->getMessage());
            }
        }

        DB::commit();

        $sale->refresh();
        $sale->load(['customer', 'items.product', 'user']);

        return response()->json([
            'success' => true,
            'sale' => $sale,
            'message' => 'Sale updated successfully'
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error updating sale: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'Failed to update sale: ' . $e->getMessage()
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

        $sale = Sale::where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found'
            ], 404);
        }

        // Restore stock before deleting
        foreach ($sale->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock + $item->quantity;

                $product->update(['stock' => $newStock]);

                // Record stock movement reversal
                StockMovement::create([
                    'business_id' => $sale->business_id,
                    'branch_id' => $sale->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'reference_type' => 'sale_delete',
                    'reference_id' => $sale->id,
                    'movement_type' => 'in',
                    'quantity' => $item->quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->cost_price,
                    'reason' => 'Sale Deleted - Invoice: ' . $sale->invoice_no
                ]);
            }
        }

        // Reverse loyalty points using dynamic settings
        if ($sale->customer && $sale->total > 0) {
            try {
                $settings = LoyaltySetting::where('business_id', $sale->business_id)
                    ->where(function ($query) use ($sale) {
                        $query->where('branch_id', $sale->branch_id)
                              ->orWhereNull('branch_id');
                    })
                    ->orderByRaw('CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('branch_id', 'DESC')
                    ->first();

                $pointsToReverse = $settings && $settings->enabled
                    ? floor(($sale->total / $settings->currency_value) * $settings->points_per_currency)
                    : floor($sale->total / 100); // fallback to default rule

                if ($pointsToReverse > 0) {
                    $sale->customer->decrement('loyalty_points', $pointsToReverse);
                    $sale->customer->decrement('total_purchases', $sale->total);

                    \Log::info("Loyalty points reversed on sale deletion", [
                        'sale_id' => $sale->id,
                        'customer_id' => $sale->customer_id,
                        'points_reversed' => $pointsToReverse,
                        'total' => $sale->total,
                        'invoice_no' => $sale->invoice_no
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Error reversing loyalty points on sale delete: ' . $e->getMessage());
                // Continue — deletion should not fail due to loyalty issue
            }
        }

       $sale->items()->delete();

        // Finally delete the sale
        $sale->delete();

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'Sale deleted successfully'
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error deleting sale: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to delete sale: ' . $e->getMessage()
        ], 500);
    }
}
    // Hold Order Methods
    public function holdOrder(Request $request): JsonResponse
    {
        DB::beginTransaction();

        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'customer_id' => 'nullable|exists:customers,id',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.price' => 'required|numeric|min:0',
                'discount' => 'nullable|numeric|min:0',
                'shipping' => 'nullable|numeric|min:0',
                'tax' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            // Validate stock availability (don't deduct stock for hold orders)
            foreach ($request->items as $item) {
                $product = Product::where('branch_id', $defaultBranch->id)
                    ->where('id', $item['product_id'])
                    ->first();

                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Product not found or not available in this branch'
                    ], 404);
                }
            }

            // Generate reference number
            $referenceNo = HoldOrder::generateReferenceNo($defaultBranch);
            
            // Calculate totals
            $subtotal = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
                $product = Product::find($item['product_id']);
                $itemSubtotal = $item['price'] * $item['quantity'];
                $subtotal += $itemSubtotal;

                $itemsData[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $product->sku,
                    'price' => $item['price'],
                    'quantity' => $item['quantity'],
                    'subtotal' => $itemSubtotal
                ];
            }

            $discount = $request->discount ?? 0;
            $shipping = $request->shipping ?? 0;
            $tax = $request->tax ?? 0;
            $total = $subtotal - $discount + $shipping + $tax;

            $holdOrder = HoldOrder::create([
                'reference_no' => $referenceNo,
                'customer_id' => $request->customer_id,
                'branch_id' => $defaultBranch->id,
                'business_id' => $defaultBranch->business_id,
                'user_id' => $user->id,
                'items' => $itemsData,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'shipping' => $shipping,
                'tax' => $tax,
                'total' => $total,
                'notes' => $request->notes,
                'expires_at' => now()->addDays(3),
                'is_active' => true
            ]);

            DB::commit();

            $holdOrder->load(['customer', 'user']);

            return response()->json([
                'success' => true,
                'hold_order' => $holdOrder,
                'message' => 'Order held successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error holding order: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to hold order: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getHoldOrders(Request $request): JsonResponse
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

            $holdOrders = HoldOrder::with(['customer', 'user'])
                ->where('branch_id', $defaultBranch->id)
                ->where('is_active', true)
                ->where('expires_at', '>', now())
                ->latest()
                ->get();

            return response()->json([
                'success' => true,
                'hold_orders' => $holdOrders,
                'message' => 'Hold orders fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching hold orders: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch hold orders: ' . $e->getMessage()
            ], 500);
        }
    }

    public function restoreHoldOrder(Request $request, $id): JsonResponse
    {
        try {
            $holdOrder = HoldOrder::with(['customer'])
                ->where('is_active', true)
                ->where('expires_at', '>', now())
                ->find($id);

            if (!$holdOrder) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hold order not found or expired'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'hold_order' => $holdOrder,
                'message' => 'Hold order restored successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error restoring hold order: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to restore hold order: ' . $e->getMessage()
            ], 500);
        }
    }

    public function completeHoldOrder(Request $request, $id): JsonResponse
    {
        DB::beginTransaction();

        try {
            $user = $request->user();
            $holdOrder = HoldOrder::with(['customer'])
                ->where('is_active', true)
                ->where('expires_at', '>', now())
                ->find($id);

            if (!$holdOrder) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hold order not found or expired'
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'payment_method' => 'required|in:cash,card,transfer,credit,mobile_money',
                'paid_amount' => 'required|numeric|min:0',
                'notes' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            // Validate stock availability
            foreach ($holdOrder->items as $item) {
                $product = Product::where('branch_id', $holdOrder->branch_id)
                    ->where('id', $item['product_id'])
                    ->first();

                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Product not found or not available in this branch'
                    ], 404);
                }

                if ($product->stock < $item['quantity']) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Insufficient stock for product: {$item['product_name']}. Available: {$product->stock}, Requested: {$item['quantity']}"
                    ], 422);
                }
            }

            // Generate invoice number
            $invoiceNo = Sale::generateInvoiceNo($holdOrder->branch);
            
            // Calculate payment details
            $paidAmount = $request->paid_amount;
            $changeAmount = $paidAmount - $holdOrder->total;

            if ($changeAmount < 0 && $request->payment_method != 'credit') {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Insufficient payment amount'
                ], 422);
            }

            // Create sale from hold order
            $sale = Sale::create([
                'invoice_no' => $invoiceNo,
                'customer_id' => $holdOrder->customer_id,
                'branch_id' => $holdOrder->branch_id,
                'business_id' => $holdOrder->business_id,
                'user_id' => $user->id,
                'subtotal' => $holdOrder->subtotal,
                'discount' => $holdOrder->discount,
                'shipping' => $holdOrder->shipping,
                'tax' => $holdOrder->tax,
                'total' => $holdOrder->total,
                'paid_amount' => $paidAmount,
                'change_amount' => max($changeAmount, 0),
                'payment_method' => $request->payment_method,
                'payment_status' => $changeAmount >= 0 ? 'paid' : 'partial',
                'status' => 'completed',
                'notes' => $request->notes ?? $holdOrder->notes,
                'completed_at' => now()
            ]);

            // Create sale items
            foreach ($holdOrder->items as $item) {
                $product = Product::find($item['product_id']);
                $sale->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $item['product_name'],
                    'sku' => $item['sku'],
                    'price' => $item['price'],
                    'cost_price' => $product->cost_price,
                    'quantity' => $item['quantity'],
                    'subtotal' => $item['subtotal'],
                    'discount' => 0,
                    'tax' => 0,
                    'total' => $item['subtotal']
                ]);
            }

            // Update stock levels
            $sale->updateStock();

            // Record loyalty points
            $sale->recordLoyaltyPoints();

            // Deactivate hold order
            $holdOrder->update(['is_active' => false]);

            DB::commit();

            $sale->load(['customer', 'items.product', 'user']);

            return response()->json([
                'success' => true,
                'sale' => $sale,
                'message' => 'Hold order completed successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error completing hold order: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete hold order: ' . $e->getMessage()
            ], 500);
        }
    }

    public function deleteHoldOrder(Request $request, $id): JsonResponse
    {
        try {
            $holdOrder = HoldOrder::find($id);

            if (!$holdOrder) {
                return response()->json([
                    'success' => false,
                    'message' => 'Hold order not found'
                ], 404);
            }

            $holdOrder->update(['is_active' => false]);

            return response()->json([
                'success' => true,
                'message' => 'Hold order deleted successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error deleting hold order: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete hold order: ' . $e->getMessage()
            ], 500);
        }
    }

   public function dashboardStats(Request $request): JsonResponse
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

        $filter = $request->input('filter', 'today');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        // Set date range based on filter
        $dateRange = $this->getDateRange($filter, $startDate, $endDate);

        // Get sales total
        $salesTotal = Sale::where('branch_id', $defaultBranch->id)
            ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
            ->where('status', 'completed')
            ->sum('total');

        // Get customers count
        $customersCount = Sale::where('branch_id', $defaultBranch->id)
            ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
            ->where('status', 'completed')
            ->distinct('customer_id')
            ->count('customer_id');

        // Get total stock (current, not filtered by date)
        $totalStock = Product::where('branch_id', $defaultBranch->id)
            ->sum('stock');

        return response()->json([
            'success' => true,
            'sales_total' => $salesTotal,
            'customers_count' => $customersCount,
            'stock' => $totalStock,
            'filter' => $filter,
            'date_range' => $dateRange
        ]);

    } catch (\Exception $e) {
        \Log::error('Dashboard Stats Error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to load dashboard stats'
        ], 500);
    }
}

private function getDateRange($filter, $customStart = null, $customEnd = null)
{
    $now = now();
    
    switch ($filter) {
        case 'today':
            $start = $now->copy()->startOfDay();
            $end = $now->copy()->endOfDay();
            break;
            
        case 'thisweek':
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
            break;
            
        case 'month':
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
            break;
            
        case 'custom':
            $start = $customStart ? Carbon::parse($customStart)->startOfDay() : $now->copy()->startOfDay();
            $end = $customEnd ? Carbon::parse($customEnd)->endOfDay() : $now->copy()->endOfDay();
            break;
            
        default:
            $start = $now->copy()->startOfDay();
            $end = $now->copy()->endOfDay();
    }
    
    return [
        'start' => $start,
        'end' => $end,
        'start_formatted' => $start->format('Y-m-d'),
        'end_formatted' => $end->format('Y-m-d')
    ];
}
    public function export(Request $request): JsonResponse
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

            $query = Sale::with(['customer', 'items.product'])
                ->where('branch_id', $defaultBranch->id);

            // Apply filters
            if ($request->has('date_filter')) {
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
                            $query->whereBetween('created_at', [
                                $request->start_date,
                                $request->end_date . ' 23:59:59'
                            ]);
                        }
                        break;
                }
            }

            if ($request->has('customer_id') && !empty($request->customer_id)) {
                $query->where('customer_id', $request->customer_id);
            }

            if ($request->has('payment_method') && !empty($request->payment_method)) {
                $query->where('payment_method', $request->payment_method);
            }

            if ($request->has('status') && !empty($request->status)) {
                $query->where('status', $request->status);
            }

            $sales = $query->get();

            $summary = [
                'total_sales' => $sales->sum('total'),
                'total_transactions' => $sales->count(),
                'total_discount' => $sales->sum('discount'),
                'total_tax' => $sales->sum('tax'),
                'start_date' => $request->start_date ?? $sales->min('created_at'),
                'end_date' => $request->end_date ?? $sales->max('created_at')
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'sales' => $sales,
                    'summary' => $summary
                ],
                'message' => 'Sales data exported successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error exporting sales: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export sales: ' . $e->getMessage()
            ], 500);
        }
    }

    public function recentSales(Request $request): JsonResponse
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

        $recentSales = Sale::where('branch_id', $defaultBranch->id)
            ->with(['customer', 'items.product'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($sale) {
                $items = $sale->items->take(3)->map(function ($item) {
                    return $item->product->name . ' (' . $item->quantity . ')';
                })->implode(', ');
                
                if ($sale->items->count() > 3) {
                    $items .= '...';
                }

                return [
                    'id' => $sale->invoice_no,
                    'customer' => $sale->customer->name ?? 'Walk-in Customer',
                    'items' => $items,
                    'amount' => number_format($sale->total),
                    'date' => $sale->created_at->toDateString(),
                    'status' => $sale->status
                ];
            });

        return response()->json([
            'success' => true,
            'recent_sales' => $recentSales
        ]);

    } catch (\Exception $e) {
        \Log::error('Recent Sales Error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to load recent sales'
        ], 500);
    }
}

 public function weeklySales(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned'
                ], 403);
            }

            // Get the start (Monday) and end (Sunday) of the current week
            $startOfWeek = Carbon::now()->startOfWeek(); // Monday
            $endOfWeek = Carbon::now()->endOfWeek();     // Sunday

            // Initialize an array for all 7 days of the week
            $daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            $salesData = [];

            // Loop through each day to fetch or set sales total
            for ($i = 0; $i < 7; $i++) {
                $currentDay = $startOfWeek->copy()->addDays($i);

                // Query sales for this specific day and the user's branch
                $daySales = Sale::where('branch_id', $defaultBranch->id)
                    ->whereDate('created_at', $currentDay->toDateString())
                    ->where('status', 'completed') // Assuming you have a status field
                    ->sum('total');

                // Store the day name and total
                $salesData[] = [
                    'day' => $daysOfWeek[$i],
                    'amount' => (int) $daySales, // Cast to integer for the chart
                    'date' => $currentDay->toDateString()
                ];
            }

            return response()->json([
                'success' => true,
                'period' => 'This Week',
                'start_date' => $startOfWeek->toDateString(),
                'end_date' => $endOfWeek->toDateString(),
                'weekly_sales' => $salesData,
                'total' => array_sum(array_column($salesData, 'amount'))
            ]);

        } catch (\Exception $e) {
            \Log::error('Weekly Sales API Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch weekly sales data'
            ], 500);
        }
    }

      public function topSellingProducts(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned'
                ], 403);
            }

            $period = $request->input('period', 'year'); // 'year', 'month', 'week'
            $year = $request->input('year', date('Y'));
            $month = $request->input('month', date('m'));
            $limit = $request->input('limit', 10); // Number of top products to return

            // Define date range based on period
            $dateRange = $this->getTopProductsDateRange($period, $year, $month);

            // Query to get top selling products with aggregated data
            $topProducts = SaleItem::select([
                'products.id',
                'products.name',
                'products.sku',
                'products.image',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.subtotal) as total_sales'),
                DB::raw('AVG(sale_items.cost_price) as average_price'),
                DB::raw('COUNT(DISTINCT sales.id) as times_sold')
            ])
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->where('sales.branch_id', $defaultBranch->id)
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$dateRange['start'], $dateRange['end']])
                ->groupBy('products.id', 'products.name', 'products.sku', 'products.image')
                ->orderBy('total_sales', 'DESC')
                ->limit($limit)
                ->get();

            // Calculate total sales for percentage calculation
            $totalSalesInPeriod = Sale::where('branch_id', $defaultBranch->id)
                ->where('status', 'completed')
                ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->sum('total');

            // Calculate percentage and prepare response
            $productsData = $topProducts->map(function ($product) use ($totalSalesInPeriod) {
                $salesPercentage = $totalSalesInPeriod > 0 
                    ? ($product->total_sales / $totalSalesInPeriod) * 100 
                    : 0;

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'image' => $product->image ? asset('storage/' . $product->image) : null,
                    'total_quantity' => (int) $product->total_quantity,
                    'total_sales' => (float) $product->total_sales,
                    'average_price' => (float) $product->average_price,
                    'times_sold' => (int) $product->times_sold,
                    'sales_percentage' => round($salesPercentage, 1),
                ];
            });

            return response()->json([
                'success' => true,
                'period' => $period,
                'year' => $year,
                'month' => $period === 'month' ? $month : null,
                'products' => $productsData,
                'total_sales' => (float) $totalSalesInPeriod,
                'total_quantity' => $productsData->sum('total'),
                'product_count' => $productsData->count(),
                'date_range' => [
                    'start' => $dateRange['start']->toDateString(),
                    'end' => $dateRange['end']->toDateString(),
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Top Selling Products API Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch top selling products'
            ], 500);
        }
    }

    /**
     * Helper method to get date range for top products query
     */
    private function getTopProductsDateRange($period, $year, $month)
    {
        $now = Carbon::now();

        switch ($period) {
            case 'week':
                $start = $now->copy()->startOfWeek(); // Monday
                $end = $now->copy()->endOfWeek();     // Sunday
                break;

            case 'month':
                $start = Carbon::create($year, $month, 1)->startOfMonth();
                $end = Carbon::create($year, $month, 1)->endOfMonth();
                break;

            case 'year':
            default:
                $start = Carbon::create($year, 1, 1)->startOfYear();
                $end = Carbon::create($year, 12, 31)->endOfYear();
                break;
        }

        return [
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * Get available years for filter (optional)
     */
    public function getAvailableYears(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned'
                ], 403);
            }

            $years = Sale::where('branch_id', $defaultBranch->id)
                ->where('status', 'completed')
                ->select(DB::raw('YEAR(created_at) as year'))
                ->distinct()
                ->orderBy('year', 'DESC')
                ->pluck('year');

            return response()->json([
                'success' => true,
                'years' => $years
            ]);

        } catch (\Exception $e) {
            \Log::error('Available Years API Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available years'
            ], 500);
        }
    }
}