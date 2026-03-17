<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'stripe_price_id',
        'price_cents',
        'interval',
        'projects_limit',
        'keywords_limit',
        'mentions_retention_days',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public static function defaultPlan(): ?self
    {
        return static::query()->active()->orderBy('price_cents')->first();
    }

    public static function adminPlan(): ?self
    {
        return static::query()->where('slug', 'admin')->first();
    }
}
