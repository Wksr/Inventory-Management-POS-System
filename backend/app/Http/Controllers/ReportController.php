<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\Purchase;
use App\Models\SaleReturn;
use App\Models\PurchaseReturn;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function profitReport(Request $request): JsonResponse
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

            // Total Revenue (Sales total)
            $totalRevenue = Sale::where('branch_id', $defaultBranch->id)
                ->where('status', 'completed')
                ->whereBetween('created_at', [$start, $end])
                ->sum('total');

            // Total Cost of Goods Sold (COGS) - simplified calculation
            $totalCost = $this->calculateCOGS($defaultBranch->id, $start, $end);

            // Returns and refunds
            $totalSaleReturns = SaleReturn::where('branch_id', $defaultBranch->id)
                ->whereBetween('created_at', [$start, $end])
                ->sum('total_refund');

            // Adjust revenue for returns
            $adjustedRevenue = $totalRevenue - $totalSaleReturns;

            // Net Profit
            $netProfit = $adjustedRevenue - $totalCost;

            // Profit margin calculation
            $profitMargin = $adjustedRevenue > 0 ? ($netProfit / $adjustedRevenue) * 100 : 0;

            // Daily profit data for chart (simplified)
            $dailyProfit = $this->getDailyProfitData($defaultBranch->id, $start, $end);

            return response()->json([
                'success' => true,
                'total_revenue' => (float) $adjustedRevenue,
                'total_cost' => (float) $totalCost,
                'net_profit' => (float) $netProfit,
                'profit_margin' => round($profitMargin, 2),
                'sale_returns' => (float) $totalSaleReturns,
                'daily_profit' => $dailyProfit,
                'date_range' => [
                    'start' => $start->format('Y-m-d'),
                    'end' => $end->format('Y-m-d'),
                    'filter' => $filter
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error generating profit report: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate profit report: ' . $e->getMessage()
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

    private function calculateCOGS($branchId, $start, $end)
    {
        try {
            // Simplified COGS calculation using sale items cost
            $cogs = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('sales.branch_id', $branchId)
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$start, $end])
                ->select(DB::raw('COALESCE(SUM(sale_items.quantity * sale_items.cost_price), 0) as total_cost'))
                ->first();

            return $cogs ? (float) $cogs->total_cost : 0;
        } catch (\Exception $e) {
            \Log::error('Error calculating COGS: ' . $e->getMessage());
            return 0;
        }
    }

    private function getDailyProfitData($branchId, $start, $end)
    {
        try {
            $data = [];
            $current = $start->copy();
            
            while ($current <= $end) {
                $dayStart = $current->copy()->startOfDay();
                $dayEnd = $current->copy()->endOfDay();
                
                $revenue = Sale::where('branch_id', $branchId)
                    ->where('status', 'completed')
                    ->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->sum('total');
                    
                $cost = $this->calculateCOGS($branchId, $dayStart, $dayEnd);
                
                $saleReturns = SaleReturn::where('branch_id', $branchId)
                    ->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->sum('total_refund');
                
                $profit = ($revenue - $saleReturns) - $cost;
                
                $data[] = [
                    'date' => $current->format('Y-m-d'),
                    'revenue' => (float) $revenue,
                    'cost' => (float) $cost,
                    'profit' => (float) $profit
                ];
                
                $current->addDay();
            }
            
            return $data;
        } catch (\Exception $e) {
            \Log::error('Error getting daily profit data: ' . $e->getMessage());
            return [];
        }
    }
}