<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_return_id',
        'sale_item_id',
        'product_id',
        'product_name',
        'sku',
        'unit_price',
        'return_quantity',
        'max_return_quantity',
        'item_reason',
        'subtotal',
        'tax',
        'total'
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'return_quantity' => 'integer',
        'max_return_quantity' => 'integer',
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2'
    ];

    public function saleReturn()
    {
        return $this->belongsTo(SaleReturn::class);
    }

    public function saleItem()
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Validation: Ensure return quantity doesn't exceed max allowed
    public function validateReturnQuantity()
    {
        if ($this->saleItem) {
            $alreadyReturned = SaleReturnItem::where('sale_item_id', $this->sale_item_id)
                ->where('id', '!=', $this->id)
                ->sum('return_quantity');
            
            $availableToReturn = $this->saleItem->quantity - $alreadyReturned;
            return $this->return_quantity <= $availableToReturn;
        }
        return true;
    }
}