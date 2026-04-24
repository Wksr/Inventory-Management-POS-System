<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sale_return_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('sale_return_id')->constrained()->onDelete('cascade');
    $table->foreignId('sale_item_id')->constrained()->onDelete('cascade');
    $table->foreignId('product_id')->constrained()->onDelete('cascade');
    $table->string('product_name');
    $table->string('sku')->nullable();
    $table->decimal('unit_price', 10, 2);
    $table->integer('return_quantity');
    $table->integer('max_return_quantity');
    $table->string('item_reason')->nullable();
    $table->decimal('subtotal', 10, 2);
    $table->decimal('tax', 10, 2)->default(0);
    $table->decimal('total', 10, 2);
    $table->timestamps();
    
    $table->index('sale_return_id');
    $table->index('sale_item_id');
    $table->index('product_id');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_return_items');
    }
};
