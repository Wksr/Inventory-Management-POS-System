<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Customer extends Model
{
    use HasFactory;

   protected $fillable = [
        'branch_id',
        'business_id',
        'name',
        'phone',
        'email',
        'address',
        'loyalty_points',
        'total_purchases',
        'total_visits',
        'last_visit',
        'status',
        'custom_fields',
        'created_by',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'last_visit' => 'date',
        'loyalty_points' => 'decimal:2',
        'total_purchases' => 'decimal:2',
    ];

       public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function creditNotes()
    {
        return $this->hasMany(CreditNote::class);
    }

    public function loyaltyTransactions()
    {
        return $this->hasMany(LoyaltyTransaction::class);
    }

 /*   public function recordPurchase($amount)
    {
    $this->increment('total_purchases', $amount);
    $this->increment('total_visits');
    $this->last_visit = now();
    $this->save();
    }*/

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
              ->orWhere('phone', 'like', "%{$search}%")
              ->orWhere('email', 'like', "%{$search}%");
        });
    }

    // Methods
    public function incrementLoyaltyPoints($points)
    {
        $this->increment('loyalty_points', $points);
        return $this;
    }

    public function decrementLoyaltyPoints($points)
    {
        $this->decrement('loyalty_points', $points);
        return $this;
    }

    public function recordPurchase($amount)
    {
        $this->increment('total_purchases', $amount);
        $this->increment('total_visits');
        $this->last_visit = now();
        $this->save();
        
        return $this;
    }

    public function canUseLoyaltyPoints($points)
    {
        return $this->loyalty_points >= $points;
    }
}

