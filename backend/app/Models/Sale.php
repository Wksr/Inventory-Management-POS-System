<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_no',
        'customer_id',
        'branch_id',
        'business_id',
        'user_id',
        'subtotal',
        'discount',
        'shipping',
        'tax',
        'total',
        'paid_amount',
        'change_amount',
        'payment_method',
        'payment_status',
        'status',
        'notes',
        'hold_until',
        'completed_at'
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'shipping' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'hold_until' => 'datetime',
        'completed_at' => 'datetime'
    ];

    // Relationships
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
        return $this->hasMany(SaleItem::class);
    }

    // Scopes
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeToday($query)
    {
        return $query->whereDate('created_at', today());
    }

    public function scopeThisWeek($query)
    {
        return $query->whereBetween('created_at', [
            now()->startOfWeek(),
            now()->endOfWeek()
        ]);
    }

    public function scopeThisMonth($query)
    {
        return $query->whereBetween('created_at', [
            now()->startOfMonth(),
            now()->endOfMonth()
        ]);
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('invoice_no', 'like', "%{$search}%")
                ->orWhereHas('customer', function ($customerQuery) use ($search) {
                    $customerQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                })
                ->orWhere('payment_method', 'like', "%{$search}%");
        });
    }

    // Methods
    public static function generateInvoiceNo($branch)
    {
        $branchCode = strtoupper(substr($branch->name, 0, 3));
        $date = now()->format('Ymd');
        
        $lastInvoice = self::where('branch_id', $branch->id)
            ->whereDate('created_at', today())
            ->orderBy('id', 'desc')
            ->first();

        $sequence = $lastInvoice ? 
            (int) substr($lastInvoice->invoice_no, -4) + 1 : 1;

        return sprintf('%s-%s-%04d', $branchCode, $date, $sequence);
    }

    public function updateStock()
    {
        foreach ($this->items as $item) {
            $product = $item->product;
            if ($product) {
                $oldStock = $product->stock;
                $newStock = $oldStock - $item->quantity;
                
                $product->update(['stock' => $newStock]);

                // Record stock movement
                StockMovement::create([
                    'business_id' => $this->business_id,
                    'branch_id' => $this->branch_id,
                    'product_id' => $product->id,
                    'user_id' => $this->user_id,
                    'reference_type' => 'sale',
                    'reference_id' => $this->id,
                    'movement_type' => 'out',
                    'quantity' => $item->quantity,
                    'stock_before' => $oldStock,
                    'stock_after' => $newStock,
                    'unit_cost' => $item->cost_price,
                    'reason' => 'Sale - Invoice: ' . $this->invoice_no
                ]);
            }
        }
    }

    // public function recordLoyaltyPoints()
    // {
    //     if ($this->customer && $this->total > 0) {
    //         $points = floor($this->total / 100); // 1 point per 100 currency
    //         $this->customer->increment('loyalty_points', $points);
    //         $this->customer->recordPurchase($this->total);
    //     }
    // }

    public function recordLoyaltyPoints()
{
    if (!$this->customer || $this->total <= 0) {
        return;
    }

    try {
        $branch = $this->branch;
        $settings = $this->getLoyaltySettings($branch);
        
        if (!$settings->enabled) {
            return;
        }

        // Calculate points for this sale
        $points = $settings->calculatePoints($this->total);

        // Update customer points
        $this->customer->increment('loyalty_points', $points);
        $this->customer->increment('total_purchases', $this->total);

        // Record points transaction if you have the model
        if (class_exists('App\Models\LoyaltyTransaction')) {
            LoyaltyTransaction::create([
                'customer_id' => $this->customer_id,
                'sale_id' => $this->id,
                'points' => $points,
                'type' => 'earned',
                'balance' => $this->customer->loyalty_points,
                'notes' => 'Purchase - Invoice: ' . $this->invoice_no
            ]);
        }

    } catch (\Exception $e) {
        \Log::error('Error recording loyalty points: ' . $e->getMessage());
    }
}

private function getLoyaltySettings($branch)
{
    // Get loyalty settings from database
    $settings = LoyaltySetting::where('business_id', $branch->business_id)
        ->where(function($query) use ($branch) {
            $query->where('branch_id', $branch->id)
                  ->orWhereNull('branch_id');
        })
        ->orderBy('branch_id', 'desc') // Prefer branch-specific settings
        ->first();

    if (!$settings) {
        // Return a new instance with defaults
        $settings = new LoyaltySetting();
        $settings->fill([
            'enabled' => true,
            'points_per_currency' => 1,
            'currency_value' => 100
        ]);
    }

    return $settings;
}
}