<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_id',
        'branch_id',
        'purchase_id',
        'supplier_id',
        'user_id',
        'return_number',
        'return_date',
        'reason',
        'status',
        'subtotal',
        'tax_amount',
        'grand_total',
        'refund_amount',
        'notes'
    ];

    protected $casts = [
        'return_date' => 'date',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'refund_amount' => 'decimal:2',
    ];

    // Relationships
    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseReturnItem::class);
    }

 public static function generateReturnNumber($branchId)
{
  
    $branch = Branch::find($branchId);
    
    if (!$branch) {
        throw new \Exception("Branch not found for ID: {$branchId}");
    }

   
    $branchCode = $branch->code 
        ? strtoupper($branch->code) 
        : strtoupper(substr($branch->name, 0, 3));

    // 3. Date part (YYYYMMDD) - daily reset
    $datePart = now()->format('Ymd');  // 20260304

    // 4. Prefix
    $prefix = "PR-{$branchCode}-{$datePart}-";

    
    $lastReturn = self::where('branch_id', $branchId)
        ->whereDate('created_at', today())
        ->where('return_number', 'like', $prefix . '%')
        ->latest('id')
        ->first();

    // 6. Next sequence
    $sequence = 1;
    if ($lastReturn) {
        // PR-MAT-20260304-0123 → 0123 
        $lastNumber = (int) substr($lastReturn->return_number, -4);
        $sequence = $lastNumber + 1;
    }

   
    $sequencePadded = str_pad($sequence, 4, '0', STR_PAD_LEFT);

    return $prefix . $sequencePadded;
}
}