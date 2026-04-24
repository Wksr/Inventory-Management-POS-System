<?php

namespace App\Http\Controllers;

use App\Models\PurchaseReturn;
use App\Models\Purchase;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\PurchaseReturnItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseReturnController extends Controller
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

            $query = PurchaseReturn::with(['supplier', 'branch', 'purchase', 'items.product'])
                ->where('branch_id', $defaultBranch->id)
                ->latest();

            // Search filter
            if ($request->has('search') && $request->search != '') {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('return_number', 'like', "%{$search}%")
                      ->orWhereHas('supplier', function ($q) use ($search) {
                          $q->where('name', 'like', "%{$search}%");
                      })
                      ->orWhereHas('purchase', function ($q) use ($search) {
                          $q->where('invoice_number', 'like', "%{$search}%");
                      });
                });
            }

            // Status filter
            if ($request->has('status') && $request->status != '') {
                $query->where('status', $request->status);
            }

            // Date filter
            if ($request->has('date_filter')) {
                $this->applyDateFilter($query, $request->date_filter, $request);
            }

            $purchaseReturns = $query->paginate($request->per_page ?? 20);

            return response()->json([
                'success' => true,
                'purchase_returns' => $purchaseReturns,
                'message' => 'Purchase returns fetched successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch purchase returns: ' . $e->getMessage()
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
                'purchase_id' => 'required|exists:purchases,id',
                'return_date' => 'required|date',
                'reason' => 'required|string|max:500',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.purchase_item_id' => 'required|exists:purchase_items,id',
                'items.*.return_quantity' => 'required|integer|min:1',
                'items.*.unit_cost' => 'required|numeric|min:0',
                'items.*.item_reason' => 'nullable|string|max:255',
                'refund_amount' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string'
            ]);

            $purchase = Purchase::where('branch_id', $defaultBranch->id)
                ->findOrFail($request->purchase_id);

                $purchaseItemMap = [];
foreach ($purchase->items as $pItem) {
    $purchItemId = $pItem->id;
    $alreadyReturned = PurchaseReturnItem::where('purchase_item_id', $purchItemId)
        ->sum('return_quantity') ?? 0;

    $pItem->already_returned = $alreadyReturned;
    $pItem->available_return_qty = $pItem->quantity - $alreadyReturned;

    $purchaseItemMap[$purchItemId] = $pItem;
}


foreach ($request->items as $index => $itemData) {
    $purchaseItemId = $itemData['purchase_item_id'];
    
    if (!isset($purchaseItemMap[$purchaseItemId])) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => "Invalid purchase item ID at position " . ($index + 1)
        ], 422);
    }

    $pItem = $purchaseItemMap[$purchaseItemId];
    $requestedQty = $itemData['return_quantity'];

    if ($requestedQty > $pItem->available_return_qty) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => "Cannot return {$requestedQty} of product '{$pItem->product_name}'. " .
                         "Only {$pItem->available_return_qty} available for return " .
                         "(Purchased: {$pItem->quantity}, Already returned: {$pItem->already_returned})"
        ], 422);
    }

    // Product stock බලන්න (optional extra check)
    $product = Product::where('id', $itemData['product_id'])
        ->where('branch_id', $defaultBranch->id)
        ->firstOrFail();

    if ($product->stock < $requestedQty) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => "Insufficient stock for product '{$product->name}'. " .
                         "Available: {$product->stock}, Requested return: {$requestedQty}"
        ], 422);
    }
}


            // Calculate totals
            $subtotal = 0;
            foreach ($request->items as $item) {
                $itemTotal = $item['unit_cost'] * $item['return_quantity'];
                $subtotal += $itemTotal;
            }

            $grandTotal = $subtotal;

            // Create purchase return
            $purchaseReturn = PurchaseReturn::create([
                'return_number' => PurchaseReturn::generateReturnNumber($defaultBranch->id),
                'purchase_id' => $request->purchase_id,
                'supplier_id' => $purchase->supplier_id,
                'branch_id' => $defaultBranch->id,
                'business_id' => $defaultBranch->business_id,
                'user_id' => $user->id,
                'return_date' => $request->return_date,
                'reason' => $request->reason,
                'subtotal' => $subtotal,
                'grand_total' => $grandTotal,
                'refund_amount' => $request->refund_amount ?? 0,
                'notes' => $request->notes,
                'status' => 'pending' 
            ]);

            // Create purchase return items and update stock
            foreach ($request->items as $itemData) {
                $purchaseReturnItem = PurchaseReturnItem::create([
                    'purchase_return_id' => $purchaseReturn->id,
                    'product_id' => $itemData['product_id'],
                    'purchase_item_id' => $itemData['purchase_item_id'],
                    'return_quantity' => $itemData['return_quantity'],
                    'unit_cost' => $itemData['unit_cost'],
                    'total' => $itemData['unit_cost'] * $itemData['return_quantity'],
                    'reason' => $itemData['item_reason'] ?? null
                ]);

                // Update product stock (reduce stock)
                $product = Product::where('id', $itemData['product_id'])
                    ->where('branch_id', $defaultBranch->id)
                    ->firstOrFail();

                $oldStock = $product->stock;
                $product->stock -= $itemData['return_quantity'];
                $product->save();

                // Record stock movement
                StockMovement::create([
                    'business_id' => $defaultBranch->business_id,
                    'branch_id' => $defaultBranch->id,
                    'product_id' => $itemData['product_id'],
                    'user_id' => $user->id,
                    'reference_type' => 'purchase_return',
                    'reference_id' => $purchaseReturn->id,
                    'movement_type' => 'out',
                    'quantity' => $itemData['return_quantity'],
                    'stock_before' => $oldStock,
                    'stock_after' => $product->stock,
                    'unit_cost' => $itemData['unit_cost'],
                    'reason' => 'Purchase Return - ' . $purchaseReturn->return_number,
                ]);
            }

            DB::commit();

            // Reload with relationships
            $purchaseReturn->load(['supplier', 'branch', 'purchase', 'items.product']);

            return response()->json([
                'success' => true,
                'purchase_return' => $purchaseReturn,
                'message' => 'Purchase return created successfully'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create purchase return: ' . $e->getMessage()
            ], 500);
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

        $purchaseReturn = PurchaseReturn::where('branch_id', $defaultBranch->id)
            ->findOrFail($id);

        // Only allow updates to pending returns
        if ($purchaseReturn->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending purchase returns can be updated'
            ], 422);
        }

        $validated = $request->validate([
            'return_date' => 'required|date',
            'reason' => 'required|string|max:500',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.purchase_item_id' => 'nullable|exists:purchase_items,id',
            'items.*.return_quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.item_reason' => 'nullable|string|max:255',
            'refund_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string'
        ]);

        // First, revert old stock
        foreach ($purchaseReturn->items as $oldItem) {
            $product = Product::where('id', $oldItem->product_id)
                ->where('branch_id', $defaultBranch->id)
                ->first();
                
            if ($product) {
                $oldStock = $product->stock;
                $product->stock += $oldItem->return_quantity; // Add back old returned quantity
                $product->save();

                StockMovement::create([
                    'business_id' => $defaultBranch->business_id,
                    'branch_id' => $defaultBranch->id,
                    'product_id' => $oldItem->product_id,
                    'user_id' => $user->id,
                    'reference_type' => 'purchase_return',
                    'reference_id' => $purchaseReturn->id,
                    'movement_type' => 'in',
                    'quantity' => $oldItem->return_quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $product->stock,
                    'unit_cost' => $oldItem->unit_cost,
                    'reason' => 'Purchase Return Update Reversal - ' . $purchaseReturn->return_number,
                ]);
            }
        }

        // Delete old items
        $purchaseReturn->items()->delete();

        // Calculate new totals
        $subtotal = 0;
        foreach ($request->items as $item) {
            $itemTotal = $item['unit_cost'] * $item['return_quantity'];
            $subtotal += $itemTotal;
        }

        $grandTotal = $subtotal;

        // Update purchase return
        $purchaseReturn->update([
            'return_date' => $request->return_date,
            'reason' => $request->reason,
            'subtotal' => $subtotal,
            'grand_total' => $grandTotal,
            'refund_amount' => $request->refund_amount ?? 0,
            'notes' => $request->notes,
        ]);

        // Create new items and update stock
        foreach ($request->items as $itemData) {
            $purchaseReturnItem = PurchaseReturnItem::create([
                'purchase_return_id' => $purchaseReturn->id,
                'product_id' => $itemData['product_id'],
                'purchase_item_id' => $itemData['purchase_item_id'] ?? null,
                'return_quantity' => $itemData['return_quantity'],
                'unit_cost' => $itemData['unit_cost'],
                'total' => $itemData['unit_cost'] * $itemData['return_quantity'],
                'reason' => $itemData['item_reason'] ?? null
            ]);

            // Update product stock (reduce stock)
            $product = Product::where('id', $itemData['product_id'])
                ->where('branch_id', $defaultBranch->id)
                ->firstOrFail();

            $oldStock = $product->stock;
            $product->stock -= $itemData['return_quantity'];
            $product->save();

            // Record stock movement
            StockMovement::create([
                'business_id' => $defaultBranch->business_id,
                'branch_id' => $defaultBranch->id,
                'product_id' => $itemData['product_id'],
                'user_id' => $user->id,
                'reference_type' => 'purchase_return',
                'reference_id' => $purchaseReturn->id,
                'movement_type' => 'out',
                'quantity' => $itemData['return_quantity'],
                'stock_before' => $oldStock,
                'stock_after' => $product->stock,
                'unit_cost' => $itemData['unit_cost'],
                'reason' => 'Purchase Return Update - ' . $purchaseReturn->return_number,
            ]);
        }

        DB::commit();

        // Reload with relationships
        $purchaseReturn->load(['supplier', 'branch', 'purchase', 'items.product']);

        return response()->json([
            'success' => true,
            'purchase_return' => $purchaseReturn,
            'message' => 'Purchase return updated successfully'
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'Failed to update purchase return: ' . $e->getMessage()
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

            $purchaseReturn = PurchaseReturn::with([
                'supplier', 
                'branch', 
                'purchase', 
                'items.product',
                'items.purchaseItem',
                'user'
            ])
                ->where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'purchase_return' => $purchaseReturn,
                'message' => 'Purchase return fetched successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Purchase return not found: ' . $e->getMessage()
            ], 404);
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

            $purchaseReturn = PurchaseReturn::where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            // Only allow deletion of pending returns
            if ($purchaseReturn->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending purchase returns can be deleted'
                ], 422);
            }

            // Revert stock
            foreach ($purchaseReturn->items as $item) {
                $product = Product::where('id', $item->product_id)
                    ->where('branch_id', $defaultBranch->id)
                    ->first();
                    
                if ($product) {
                    $oldStock = $product->stock;
                    $product->stock += $item->return_quantity; // Add back the returned quantity
                    $product->save();

                    // Record stock movement for reversal
                    StockMovement::create([
                        'business_id' => $defaultBranch->business_id,
                        'branch_id' => $defaultBranch->id,
                        'product_id' => $item->product_id,
                        'user_id' => $user->id,
                        'reference_type' => 'purchase_return',
                        'reference_id' => $purchaseReturn->id,
                        'movement_type' => 'in',
                        'quantity' => $item->return_quantity,
                        'stock_before' => $oldStock,
                        'stock_after' => $product->stock,
                        'unit_cost' => $item->unit_cost,
                        'reason' => 'Purchase Return Deletion Reversal - ' . $purchaseReturn->return_number,
                    ]);
                }
            }

            // Delete items and return
            $purchaseReturn->items()->delete();
            $purchaseReturn->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Purchase return deleted successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete purchase return: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getPurchaseItems(Request $request, $purchaseId)
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

            $purchase = Purchase::with(['items.product.unit'])
                ->where('branch_id', $defaultBranch->id)
                ->findOrFail($purchaseId);

            return response()->json([
                'success' => true,
                'purchase' => $purchase,
                'message' => 'Purchase items fetched successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch purchase items: ' . $e->getMessage()
            ], 500);
        }
    }

    private function applyDateFilter($query, $filter, $request)
    {
        $now = now();

        switch ($filter) {
            case 'today':
                $query->whereDate('return_date', $now->toDateString());
                break;
            case 'thisweek':
                $query->whereBetween('return_date', [
                    $now->startOfWeek()->toDateString(),
                    $now->endOfWeek()->toDateString()
                ]);
                break;
            case 'month':
                $query->whereBetween('return_date', [
                    $now->startOfMonth()->toDateString(),
                    $now->endOfMonth()->toDateString()
                ]);
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
}