<?php

namespace App\Models;

use App\Jobs\EvaluateMentionAlertsJob;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mention extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'tracked_keyword_id',
        'source',
        'external_id',
        'author_name',
        'url',
        'title',
        'body',
        'sentiment',
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

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function trackedKeyword(): BelongsTo
    {
        return $this->belongsTo(TrackedKeyword::class);
    }

    protected static function booted(): void
    {
        static::created(function (Mention $mention): void {
            EvaluateMentionAlertsJob::dispatch($mention->id)->afterCommit();
        });
    }
}
