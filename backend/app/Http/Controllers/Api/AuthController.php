<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->safe()->only(['name', 'email', 'password']));
        $this->attachDefaultRole($user);

        return response()->json([
            'token' => $user->createToken($request->input('device_name', 'web'))->plainTextToken,
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->safe()->only(['email', 'password']);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        return response()->json([
            'token' => $user->createToken($request->input('device_name', 'web'))->plainTextToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(): JsonResponse
    {
        request()->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function redirectToGoogle(): RedirectResponse
    {
        return Socialite::driver('google')
            ->stateless()
            ->scopes(['openid', 'profile', 'email'])
            ->redirect();
    }

    public function handleGoogleCallback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable) {
            return $this->redirectToFrontendWithFragment([
                'auth_error' => 'Google sign-in could not be completed.',
            ]);
        }

        $email = Str::lower(trim((string) $googleUser->getEmail()));
        $googleId = trim((string) $googleUser->getId());

        if ($email === '' || $googleId === '') {
            return $this->redirectToFrontendWithFragment([
                'auth_error' => 'Google did not return the required account details.',
            ]);
        }

        $user = User::query()
            ->where('google_id', $googleId)
            ->orWhere('email', $email)
            ->first();

        $wasCreated = false;
        $displayName = trim((string) ($googleUser->getName() ?: $googleUser->getNickname() ?: Str::before($email, '@')));
        $avatarUrl = trim((string) ($googleUser->getAvatar() ?? ''));

        if (! $user) {
            $user = User::create([
                'name' => $displayName !== '' ? $displayName : 'Google User',
                'email' => $email,
                'password' => Str::password(40),
                'google_id' => $googleId,
                'avatar_url' => $avatarUrl !== '' ? $avatarUrl : null,
                'email_verified_at' => now(),
            ]);
            $this->attachDefaultRole($user);
            $wasCreated = true;
        } else {
            $updates = [];

            if (! $user->google_id) {
                $updates['google_id'] = $googleId;
            }

            if ($user->avatar_url !== ($avatarUrl !== '' ? $avatarUrl : null)) {
                $updates['avatar_url'] = $avatarUrl !== '' ? $avatarUrl : null;
            }

            if (! $user->email_verified_at) {
                $updates['email_verified_at'] = now();
            }

            if (trim((string) $user->name) === '' && $displayName !== '') {
                $updates['name'] = $displayName;
            }

            if ($updates !== []) {
                $user->fill($updates);
                $user->save();
            }

            if (! $user->roles()->exists()) {
                $this->attachDefaultRole($user);
            }
        }

        $token = $user->createToken('google-web')->plainTextToken;

        return $this->redirectToFrontendWithFragment([
            'auth_token' => $token,
            'auth_provider' => 'google',
            'auth_message' => $wasCreated
                ? 'Your account was created with Google.'
                : 'Signed in with Google.',
        ]);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('slug')->values(),
            'plan' => $user->activePlan()?->only(['name', 'slug', 'projects_limit', 'keywords_limit']),
        ];
    }

    private function attachDefaultRole(User $user): void
    {
        $defaultRole = config('roles.models.role')::query()->where('slug', 'user')->first();

        if ($defaultRole && ! $user->hasRole('user')) {
            $user->attachRole($defaultRole);
        }
    }

    private function redirectToFrontendWithFragment(array $payload): RedirectResponse
    {
        $frontendUrl = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
        $fragment = http_build_query(
            array_filter($payload, fn ($value) => $value !== null && $value !== ''),
            '',
            '&',
            PHP_QUERY_RFC3986,
        );

        return redirect()->away($frontendUrl.'/login'.($fragment !== '' ? '#'.$fragment : ''));
    }
}
