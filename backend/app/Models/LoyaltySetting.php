<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class LoyaltySetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_id',
        'branch_id',
        'enabled',
        'points_per_currency',
        'currency_value'
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'points_per_currency' => 'decimal:2',
        'currency_value' => 'decimal:2'
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

    // Scopes
    public function scopeForBusiness($query, $businessId)
    {
        return $query->where('business_id', $businessId);
    }

    public function scopeForBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

 public function calculatePoints($amount)
{
    if (!$this->enabled || $this->currency_value <= 0) {
        return 0;
    }

    return floor(($amount / $this->currency_value) * $this->points_per_currency);
}
}