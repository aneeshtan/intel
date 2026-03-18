<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AlertChannel extends Model
{
    use HasFactory;

    public const TYPE_IN_APP = 'in_app';

    public const TYPE_EMAIL = 'email';

    public const TYPE_SLACK = 'slack';

    public const TYPE_TEAMS = 'teams';

    public const TYPE_DISCORD = 'discord';

    public const TYPE_TELEGRAM = 'telegram';

    public const TYPE_WEBHOOK = 'webhook';

    public const TYPE_SMS = 'sms';

    public const TYPE_WHATSAPP = 'whatsapp';

    protected $fillable = [
        'user_id',
        'type',
        'name',
        'destination',
        'config',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public static function supportedTypes(): array
    {
        return [
            self::TYPE_IN_APP,
            self::TYPE_EMAIL,
            self::TYPE_SLACK,
            self::TYPE_TEAMS,
            self::TYPE_DISCORD,
            self::TYPE_TELEGRAM,
            self::TYPE_WEBHOOK,
            self::TYPE_SMS,
            self::TYPE_WHATSAPP,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rules(): BelongsToMany
    {
        return $this->belongsToMany(AlertRule::class, 'alert_rule_channel');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(AlertDelivery::class);
    }
}
