<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_articles', function (Blueprint $table) {
            $table->id();
            $table->string('source_key', 80);
            $table->string('source_name')->nullable();
            $table->text('source_url')->nullable();
            $table->string('external_id', 64);
            $table->text('url');
            $table->string('author_name')->nullable();
            $table->string('title')->nullable();
            $table->longText('body');
            $table->timestamp('published_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['source_key', 'external_id']);
            $table->index(['source_key', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_articles');
    }
};
