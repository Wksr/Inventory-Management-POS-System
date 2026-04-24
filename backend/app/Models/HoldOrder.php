<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class HoldOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference_no',
        'customer_id',
        'branch_id',
        'business_id',
        'user_id',
        'items',
        'subtotal',
        'discount',
        'shipping',
        'tax',
        'total',
        'notes',
        'expires_at',
        'is_active'
    ];

    protected $casts = [
        'items' => 'array',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'shipping' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'expires_at' => 'datetime',
        'is_active' => 'boolean'
    ];

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

    public static function generateReferenceNo($branch)
    {
        $branchCode = strtoupper(substr($branch->name, 0, 3));
        $date = now()->format('md');
        $random = strtoupper(substr(uniqid(), -4));
        
        return sprintf('HOLD-%s-%s-%s', $branchCode, $date, $random);
    }
}