<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Business extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
          'logo',
        'is_active',
        
    ];
    protected $casts = [
        'is_active' => 'boolean',
    ];

    

    public function branches()
    {
        return $this->hasMany(Branch::class);
    }

    public function activeBranches()
    {
        return $this->branches()->where('is_active', true);
    }

    public function users()
    {
        return $this->hasManyThrough(User::class, Branch::class,
         'business_id', 'id', 'id', 'id')
         ->distinct();
    }

 
}