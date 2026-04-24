<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->onDelete('cascade');
            $table->foreignId('branch_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // Reference to source document
            $table->string('reference_type'); // purchase, sale, adjustment, return
            $table->unsignedBigInteger('reference_id'); // purchase_id, sale_id, etc.
            
            $table->enum('movement_type', ['in', 'out']); // stock in or out
            $table->integer('quantity');
            $table->integer('stock_before');
            $table->integer('stock_after');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->text('reason'); // Purchase, Sale, Stock Adjustment, etc.
            $table->text('notes')->nullable();
            
            $table->timestamps();

            // Indexes for better performance
            $table->index(['business_id', 'branch_id']);
            $table->index(['product_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};