<?php

namespace App\Http\Controllers;

use App\Models\StockMovement;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryReportController extends Controller
{
    public function report(Request $request): JsonResponse
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
            $search = $request->input('search', '');
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);

            // Set date range based on filter
            $dateRange = $this->getDateRange($filter, $startDate, $endDate);
            $start = $dateRange['start'];
            $end = $dateRange['end'];

            // Query stock movements
            $query = StockMovement::with(['product', 'user'])
                ->where('branch_id', $defaultBranch->id)
                ->whereBetween('created_at', [$start, $end]);

            // Apply search filter
            if (!empty($search)) {
                $query->where(function ($q) use ($search) {
                    $q->whereHas('product', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                           ->orWhere('sku', 'like', "%{$search}%");
                    })
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhere('reference_type', 'like', "%{$search}%");
                });
            }

            // Get paginated results
            $movements = $query->orderBy('created_at', 'desc')
                ->paginate($perPage, ['*'], 'page', $page);

            // Get summary statistics without pagination
            $summaryQuery = StockMovement::where('branch_id', $defaultBranch->id)
                ->whereBetween('created_at', [$start, $end]);

            $totalIn = $summaryQuery->clone()
                ->where('movement_type', 'in')
                ->sum('quantity');

            $totalOut = $summaryQuery->clone()
                ->where('movement_type', 'out')
                ->sum('quantity');

            $netChange = $totalIn - $totalOut;

            // Get value change
            $valueChange = StockMovement::where('branch_id', $defaultBranch->id)
                ->whereBetween('created_at', [$start, $end])
                ->selectRaw('SUM(CASE WHEN movement_type = "in" THEN unit_cost * quantity ELSE -unit_cost * quantity END) as total_value_change')
                ->first()
                ->total_value_change ?? 0;

            // Get movement type counts
            $movementTypeCounts = $summaryQuery->clone()
                ->select('movement_type', DB::raw('COUNT(*) as count'))
                ->groupBy('movement_type')
                ->get()
                ->pluck('count', 'movement_type')
                ->toArray();

            // Get reference type counts
            $referenceTypeCounts = $summaryQuery->clone()
                ->select('reference_type', DB::raw('COUNT(*) as count'))
                ->groupBy('reference_type')
                ->get()
                ->pluck('count', 'reference_type')
                ->toArray();

            // Get most common movement type
            $mostCommonMovement = !empty($movementTypeCounts) 
                ? array_search(max($movementTypeCounts), $movementTypeCounts)
                : 'N/A';

            // Get most common reference type
            $mostCommonReference = !empty($referenceTypeCounts)
                ? array_search(max($referenceTypeCounts), $referenceTypeCounts)
                : 'N/A';

            // Get unique product count
            $uniqueProducts = $summaryQuery->clone()
                ->distinct('product_id')
                ->count('product_id');

            // Get daily movement data for chart
            $dailyData = $this->getDailyMovementData($defaultBranch->id, $start, $end);

            // Get top products by movement
            $topProducts = $this->getTopProductsByMovement($defaultBranch->id, $start, $end, 5);

            return response()->json([
                'success' => true,
                'movements' => $movements,
                'summary' => [
                    'total_in' => (int) $totalIn,
                    'total_out' => (int) $totalOut,
                    'net_change' => (int) $netChange,
                    'total_value_change' => (float) $valueChange,
                    'most_common_movement' => ucfirst($mostCommonMovement),
                    'most_common_reference' => ucfirst($mostCommonReference),
                    'total_products' => $uniqueProducts,
                    'movement_type_counts' => $movementTypeCounts,
                    'reference_type_counts' => $referenceTypeCounts,
                ],
                'daily_data' => $dailyData,
                'top_products' => $topProducts,
                'date_range' => [
                    'start' => $start->format('Y-m-d'),
                    'end' => $end->format('Y-m-d'),
                    'filter' => $filter
                ],
                'pagination' => [
                    'current_page' => $movements->currentPage(),
                    'per_page' => $movements->perPage(),
                    'total' => $movements->total(),
                    'last_page' => $movements->lastPage(),
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error generating inventory report: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate inventory report: ' . $e->getMessage()
            ], 500);
        }
    }

    public function exportReport(Request $request): JsonResponse
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
            $search = $request->input('search', '');

            // Set date range based on filter
            $dateRange = $this->getDateRange($filter, $startDate, $endDate);
            $start = $dateRange['start'];
            $end = $dateRange['end'];

            // Query all stock movements for export (no pagination)
            $query = StockMovement::with(['product', 'user'])
                ->where('branch_id', $defaultBranch->id)
                ->whereBetween('created_at', [$start, $end]);

            // Apply search filter
            if (!empty($search)) {
                $query->where(function ($q) use ($search) {
                    $q->whereHas('product', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                           ->orWhere('sku', 'like', "%{$search}%");
                    })
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhere('reference_type', 'like', "%{$search}%");
                });
            }

            $movements = $query->orderBy('created_at', 'desc')->get();

            // Get summary statistics
            $totalIn = $movements->where('movement_type', 'in')->sum('quantity');
            $totalOut = $movements->where('movement_type', 'out')->sum('quantity');
            $netChange = $totalIn - $totalOut;

            $valueChange = $movements->sum(function ($movement) {
                return $movement->movement_type === 'in' 
                    ? $movement->unit_cost * $movement->quantity
                    : -$movement->unit_cost * $movement->quantity;
            });

            return response()->json([
                'success' => true,
                'movements' => $movements,
                'summary' => [
                    'total_in' => (int) $totalIn,
                    'total_out' => (int) $totalOut,
                    'net_change' => (int) $netChange,
                    'total_value_change' => (float) $valueChange,
                    'total_records' => $movements->count(),
                ],
                'date_range' => [
                    'start' => $start->format('Y-m-d'),
                    'end' => $end->format('Y-m-d'),
                    'filter' => $filter
                ],
                'branch_name' => $defaultBranch->name,
                'generated_at' => now()->format('Y-m-d H:i:s'),
                'message' => 'Inventory report data fetched successfully for export'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error exporting inventory report: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export inventory report: ' . $e->getMessage()
            ], 500);
        }
    }

    private function getDateRange($filter, $customStart, $customEnd)
    {
        $now = Carbon::now();
        
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
                $start = $customStart ? Carbon::parse($customStart)->startOfDay() : $now->copy()->startOfDay();
                $end = $customEnd ? Carbon::parse($customEnd)->endOfDay() : $now->copy()->endOfDay();
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

    private function getDailyMovementData($branchId, $start, $end)
    {
        try {
            $data = [];
            $current = $start->copy();
            
            while ($current <= $end) {
                $dayStart = $current->copy()->startOfDay();
                $dayEnd = $current->copy()->endOfDay();
                
                $dailyIn = StockMovement::where('branch_id', $branchId)
                    ->where('movement_type', 'in')
                    ->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->sum('quantity');
                
                $dailyOut = StockMovement::where('branch_id', $branchId)
                    ->where('movement_type', 'out')
                    ->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->sum('quantity');
                
                $dailyNet = $dailyIn - $dailyOut;
                
                $data[] = [
                    'date' => $current->format('Y-m-d'),
                    'in' => (int) $dailyIn,
                    'out' => (int) $dailyOut,
                    'net' => (int) $dailyNet
                ];
                
                $current->addDay();
            }
            
            return $data;
        } catch (\Exception $e) {
            \Log::error('Error getting daily movement data: ' . $e->getMessage());
            return [];
        }
    }

    private function getTopProductsByMovement($branchId, $start, $end, $limit = 5)
    {
        try {
            $topProducts = DB::table('stock_movements')
                ->join('products', 'stock_movements.product_id', '=', 'products.id')
                ->where('stock_movements.branch_id', $branchId)
                ->whereBetween('stock_movements.created_at', [$start, $end])
                ->select(
                    'products.id',
                    'products.name',
                    'products.sku',
                    DB::raw('SUM(CASE WHEN stock_movements.movement_type = "in" THEN stock_movements.quantity ELSE -stock_movements.quantity END) as net_quantity'),
                    DB::raw('SUM(CASE WHEN stock_movements.movement_type = "in" THEN stock_movements.unit_cost * stock_movements.quantity ELSE -stock_movements.unit_cost * stock_movements.quantity END) as net_value')
                )
                ->groupBy('products.id', 'products.name', 'products.sku')
                ->orderByRaw('ABS(SUM(CASE WHEN stock_movements.movement_type = "in" THEN stock_movements.quantity ELSE -stock_movements.quantity END)) DESC')
                ->limit($limit)
                ->get()
                ->map(function ($product) {
                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->sku,
                        'net_quantity' => (int) $product->net_quantity,
                        'net_value' => (float) $product->net_value
                    ];
                })
                ->toArray();

            return $topProducts;
        } catch (\Exception $e) {
            \Log::error('Error getting top products by movement: ' . $e->getMessage());
            return [];
        }
    }

    // Additional method to get low stock products
    public function lowStockReport(Request $request): JsonResponse
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

            $threshold = $request->input('threshold', 10);
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);

            $lowStockProducts = Product::where('branch_id', $defaultBranch->id)
                ->where('stock', '<=', $threshold)
                ->orderBy('stock', 'asc')
                ->paginate($perPage, ['*'], 'page', $page);

            $totalLowStock = Product::where('branch_id', $defaultBranch->id)
                ->where('stock', '<=', $threshold)
                ->count();

            $outOfStock = Product::where('branch_id', $defaultBranch->id)
                ->where('stock', '<=', 0)
                ->count();

            return response()->json([
                'success' => true,
                'low_stock_products' => $lowStockProducts,
                'summary' => [
                    'total_low_stock' => $totalLowStock,
                    'out_of_stock' => $outOfStock,
                    'threshold' => $threshold,
                ],
                'pagination' => [
                    'current_page' => $lowStockProducts->currentPage(),
                    'per_page' => $lowStockProducts->perPage(),
                    'total' => $lowStockProducts->total(),
                    'last_page' => $lowStockProducts->lastPage(),
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error generating low stock report: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate low stock report: ' . $e->getMessage()
            ], 500);
        }
    }
}