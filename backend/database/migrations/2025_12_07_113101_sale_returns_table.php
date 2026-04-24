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
        Schema::create('sale_returns', function (Blueprint $table) {
    $table->id();
    $table->string('return_no')->unique();
    $table->foreignId('sale_id')->constrained()->onDelete('cascade');
    $table->foreignId('customer_id')->nullable()->constrained()->onDelete('set null');
    $table->foreignId('branch_id')->constrained()->onDelete('cascade');
    $table->foreignId('business_id')->constrained()->onDelete('cascade');
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->string('reason');
    $table->decimal('subtotal', 10, 2);
    $table->decimal('discount', 10, 2)->default(0);
    $table->decimal('tax', 10, 2)->default(0);
    $table->decimal('total_refund', 10, 2);
    $table->decimal('refund_amount', 10, 2);
    $table->decimal('balance_amount', 10, 2)->default(0);
    $table->string('payment_method');
    $table->string('payment_status')->default('completed');
    $table->string('status')->default('completed');
    $table->text('notes')->nullable();
    $table->date('return_date');
    $table->timestamps();
    
    $table->index('return_no');
    $table->index('sale_id');
    $table->index('customer_id');
    $table->index(['branch_id', 'return_date']);
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_returns');
         
    }
};
