<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MediaArticle extends Model
{
    use HasFactory;

    protected $fillable = [
        'source_key',
        'source_name',
        'source_url',
        'external_id',
        'url',
        'author_name',
        'title',
        'body',
        'published_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'published_at' => 'datetime',
        ];
    }
}
