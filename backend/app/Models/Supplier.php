<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class Supplier extends Model
{
    
    use HasFactory ;

    protected $fillable = [
        'name',
        'company',
        'phone',
        'email',
        'business_id',
        'branch_id',
        'created_by'
    ];
     public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function purchases()
    {
         return $this->hasMany(Purchase::class);
    }
     
}
