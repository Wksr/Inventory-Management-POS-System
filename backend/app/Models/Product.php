<?php
// app/Models/Product.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_id',
        'branch_id',
        'category_id',
        'unit_id',
        'supplier_id',
        'created_by',
        'name',
        'sku',
        'unit',
        'cost_price',
        'price',
        'supplier',
        'stock',
        'low_stock_alert',
        'color',
        'size',
        'expire_date',
        'description',
        'image',
        'is_active'
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'price' => 'decimal:2',
        'expire_date' => 'date',
        'is_active' => 'boolean'
    ];

    protected $appends = ['image_url'];

     public function unit()
    {
        return $this->belongsTo(Unit::class);
    }
    // Relationships
    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier()
    {
    return $this->belongsTo(Supplier::class); 
    }

     public function purchaseItems()
    {
        return $this->hasMany(PurchaseItem::class);
    }

     
    public function updateStock($quantity)
    {
        $this->stock += $quantity;
        $this->save();
    }

    public function sales()
{
    return $this->hasMany(SaleItem::class);
}

public function stockMovements()
{
    return $this->hasMany(StockMovement::class);
}

     // Update cost price from purchase
   /* public function updateCostPrice($newCostPrice)
    {
        $this->cost_price = $newCostPrice;
        $this->save();
    }*/

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getImageUrlAttribute()
    {
    if ($this->image) {
        return asset('storage/' . $this->image); 
    }
    return null;
    }

    // Scopes
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    
}