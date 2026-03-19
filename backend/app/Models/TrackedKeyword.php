<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrackedKeyword extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'keyword',
        'platform',
        'match_type',
        'is_active',
        'configuration',
    ];

    protected function casts(): array
    {
        return [
            'configuration' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function mentions(): HasMany
    {
        return $this->hasMany(Mention::class);
    }
}
