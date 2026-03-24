<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use jeremykenedy\LaravelRoles\Traits\HasRoleAndPermission;
use Laravel\Cashier\Billable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use Billable, HasApiTokens, HasFactory, HasRoleAndPermission, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'avatar_url',
        'email_verified_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function alertChannels(): HasMany
    {
        return $this->hasMany(AlertChannel::class);
    }

    public function alertRules(): HasMany
    {
        return $this->hasMany(AlertRule::class);
    }

    public function alertDeliveries(): HasMany
    {
        return $this->hasMany(AlertDelivery::class);
    }

    public function activePlan(): ?Plan
    {
        if ($this->hasRole('admin')) {
            return Plan::adminPlan() ?? new Plan([
                'name' => 'Admin',
                'slug' => 'admin',
                'projects_limit' => null,
                'keywords_limit' => null,
                'mentions_retention_days' => 3650,
            ]);
        }

        $subscription = $this->subscription('default');

        if (! $subscription) {
            return Plan::defaultPlan();
        }

        $priceId = optional($subscription->items->sortByDesc('created_at')->first())->stripe_price;

        return Plan::query()
            ->where('stripe_price_id', $priceId)
            ->orWhere('slug', 'starter')
            ->orderByRaw('case when stripe_price_id = ? then 0 else 1 end', [$priceId])
            ->first();
    }

    public function projectLimitReached(): bool
    {
        if ($this->hasRole('admin')) {
            return false;
        }

        $limit = $this->activePlan()?->projects_limit;

        if ($limit === null) {
            return false;
        }

        return $this->projects()->count() >= $limit;
    }

    public function keywordLimitReached(): bool
    {
        if ($this->hasRole('admin')) {
            return false;
        }

        $limit = $this->activePlan()?->keywords_limit;

        if ($limit === null) {
            return false;
        }

        return TrackedKeyword::query()
            ->whereHas('project', fn ($query) => $query->where('user_id', $this->id))
            ->count() >= $limit;
    }
}
