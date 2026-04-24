<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->onDelete('cascade');
            $table->foreignId('branch_id')->nullable()->constrained()->onDelete('cascade');
            $table->boolean('enabled')->default(true);
            $table->decimal('points_per_currency', 8, 2)->default(1);
            $table->decimal('currency_value', 10, 2)->default(100);
            $table->timestamps();

            $table->unique(['business_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_settings');
    }
};