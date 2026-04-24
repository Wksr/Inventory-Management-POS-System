<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'return_no',
        'sale_id',
        'customer_id',
        'branch_id',
        'business_id',
        'user_id',
        'reason',
        'subtotal',
        'discount',
        'tax',
        'total_refund',
        'refund_amount',
        'balance_amount',
        'payment_method',
        'payment_status',
        'status',
        'notes',
        'return_date'
    ];

    protected $casts = [
        'return_date' => 'date:m/d/y',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total_refund' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'balance_amount' => 'decimal:2',
    ];

    // Relationships
    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(SaleReturnItem::class);
    }

    // Scopes
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeToday($query)
    {
        return $query->whereDate('return_date', today());
    }

    public function scopeThisWeek($query)
    {
        return $query->whereBetween('return_date', [
            now()->startOfWeek(),
            now()->endOfWeek()
        ]);
    }

    public function scopeThisMonth($query)
    {
        return $query->whereBetween('return_date', [
            now()->startOfMonth(),
            now()->endOfMonth()
        ]);
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('return_no', 'like', "%{$search}%")
                ->orWhereHas('sale', function ($saleQuery) use ($search) {
                    $saleQuery->where('invoice_no', 'like', "%{$search}%");
                })
                ->orWhereHas('customer', function ($customerQuery) use ($search) {
                    $customerQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
        });
    }

    // Methods
    public static function generateReturnNo($branch)
    {
        $branchCode = strtoupper(substr($branch->name, 0, 3));
        $date = now()->format('Ymd');
        
        $lastReturn = self::where('branch_id', $branch->id)
            ->whereDate('return_date', today())
            ->orderBy('id', 'desc')
            ->first();

        $sequence = $lastReturn ? 
            (int) substr($lastReturn->return_no, -4) + 1 : 1;

        return sprintf('RTN-%s-%s-%04d', $branchCode, $date, $sequence);
    }

    public function restoreStock()
    {
        foreach ($this->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock + $item->return_quantity;
                
                $product->update(['stock' => $newStock]);

                // Record stock movement
                StockMovement::create([
                    'business_id' => $this->business_id,
                    'branch_id' => $this->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $this->user_id,
                    'reference_type' => 'sale_return',
                    'reference_id' => $this->id,
                    'movement_type' => 'in',
                    'quantity' => $item->return_quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->unit_price,
                    'reason' => 'Sales Return - Return No: ' . $this->return_no
                ]);
            }
        }
    }

    public function adjustLoyaltyPoints()
    {
        if ($this->customer && $this->total_refund > 0) {
            $pointsToDeduct = floor($this->total_refund / 100);
            $this->customer->decrement('loyalty_points', $pointsToDeduct);
            $this->customer->decrement('total_purchases', $this->total_refund);
        }
    }

    public function updateSaleStatus()
    {
        $sale = $this->sale;
        if ($sale) {
            $totalRefunded = SaleReturn::where('sale_id', $sale->id)
                ->where('id', '!=', $this->id)
                ->sum('total_refund') + $this->total_refund;
            
            if ($totalRefunded >= $sale->total) {
                $sale->update(['status' => 'refunded']);
            } elseif ($totalRefunded > 0) {
                $sale->update(['status' => 'refunded']);
            }
        }
    }

//       private function getLoyaltySettings($branch)
// {
//     $settings = LoyaltySetting::where('business_id', $branch->business_id)
//         ->where(function($query) use ($branch) {
//             $query->where('branch_id', $branch->id)
//                   ->orWhereNull('branch_id');
//         })
//         ->orderByRaw('branch_id DESC NULLS LAST') // branch-specific first
//         ->first();

//     if (!$settings) {
//         $settings = new LoyaltySetting();
//         $settings->fill([
//             'enabled' => true,
//             'points_per_currency' => 1,
//             'currency_value' => 100
//         ]);
//     }

//     return $settings;
// }

    // Calculate balance amount (amount to be paid to customer)
    public function calculateBalance()
    {
        return $this->total_refund - $this->refund_amount;
    }

  
}