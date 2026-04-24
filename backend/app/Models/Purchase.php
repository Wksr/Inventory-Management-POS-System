<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Purchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_number',
        'supplier_id',
       // 'business_id',
        'branch_id',
        'date',
        'subtotal',
        'discount',
        'transport_cost',
        'grand_total',
        'paid_amount',
        'balance',
        'notes',
        'status',
        'created_by'
    ];

    protected $casts = [
        'date' => 'date',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'transport_cost' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance' => 'decimal:2',
    ];

    // Relationships
    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

   /* public function business()
    {
        return $this->belongsTo(Business::class);
    }*/

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getDateAttribute($value)
    {
    return Carbon::parse($value)->format('d M Y');
    }

   public static function generateInvoiceNumber($branchId)
{
   
    $branch = Branch::find($branchId);
    
    if (!$branch) {
        throw new \Exception("Branch not found for ID: {$branchId}");
    }

   
    $branchCode = strtoupper($branch->code ?? substr($branch->name, 0, 3));

    // 3. Date part (YYYYMMDD)
    $datePart = now()->format('Ymd');  // 20260304

    // 4. Prefix
    $prefix = "PUR-{$branchCode}-{$datePart}-";

    
    $lastPurchase = self::where('branch_id', $branchId)
        ->whereDate('created_at', today())         
        ->where('invoice_number', 'like', $prefix . '%')
        ->latest('id')
        ->first();

    // 6. Next sequence number
    $sequence = 1;
    if ($lastPurchase) {
        // PUR-MAT-20260304-0123 → 0123 
        $lastNumber = (int) substr($lastPurchase->invoice_number, -4);
        $sequence = $lastNumber + 1;
    }

    
    $sequencePadded = str_pad($sequence, 4, '0', STR_PAD_LEFT);

    return $prefix . $sequencePadded;
}
}