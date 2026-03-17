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
        Schema::create('mentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tracked_keyword_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 20);
            $table->string('external_id')->nullable();
            $table->string('author_name')->nullable();
            $table->text('url')->nullable();
            $table->string('title')->nullable();
            $table->longText('body');
            $table->string('sentiment', 20)->default('neutral');
            $table->timestamp('published_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id']);
            $table->index(['project_id', 'published_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mentions');
    }
};
