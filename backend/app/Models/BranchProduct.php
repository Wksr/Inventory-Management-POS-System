<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class BranchProduct extends Pivot
{
    protected $table = 'branch_product';

    protected $casts = [
        'stock' => 'integer',
        'low_stock_alert' => 'integer',
        'is_available' => 'boolean'
    ];
}