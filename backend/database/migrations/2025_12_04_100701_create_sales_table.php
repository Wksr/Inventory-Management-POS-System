// database/migrations/xxxx_xx_xx_create_sales_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_no')->unique();
            $table->foreignId('customer_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('branch_id')->constrained()->onDelete('cascade');
            $table->foreignId('business_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('shipping', 10, 2)->default(0);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('change_amount', 10, 2)->default(0);
            
            $table->enum('payment_method', ['cash', 'card', 'transfer', 'credit', 'mobile_money'])->default('cash');
            $table->enum('payment_status', ['pending', 'paid', 'partial', 'refunded'])->default('paid');
            $table->enum('status', ['completed', 'hold', 'cancelled', 'refunded'])->default('completed');
            
            $table->text('notes')->nullable();
            $table->timestamp('hold_until')->nullable();
            $table->timestamp('completed_at')->nullable();
            
            $table->timestamps();
            $table->softDeletes();

            $table->index(['branch_id', 'status']);
            $table->index(['customer_id', 'created_at']);
            $table->index(['invoice_no']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};