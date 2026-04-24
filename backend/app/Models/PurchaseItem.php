<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_id',
        'product_id',
        'unit_cost',
        'quantity',
        'discount',
        'total'
    ];

    protected $casts = [
        'unit_cost' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    // Relationships
    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Calculate total before saving
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($item) {
            $item->total = ($item->unit_cost * $item->quantity) - $item->discount;
        });
    }
}