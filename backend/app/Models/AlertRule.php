<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AlertRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'project_id',
        'name',
        'is_active',
        'frequency',
        'sentiment',
        'min_reach',
        'source_filters',
        'tracked_keyword_ids',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'min_reach' => 'integer',
            'source_filters' => 'array',
            'tracked_keyword_ids' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(AlertChannel::class, 'alert_rule_channel');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(AlertDelivery::class);
    }
}
