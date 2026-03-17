<?php

namespace App\Http\Controllers\Api;

use App\Models\Plan;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BillingController extends Controller
{
    public function checkout(Request $request, Plan $plan): JsonResponse
    {
        $request->validate([
            'success_url' => ['required', 'url'],
            'cancel_url' => ['required', 'url'],
        ]);

        abort_unless($plan->is_active, 404);
        abort_if(blank($plan->stripe_price_id), 422, 'This plan is not linked to a Stripe price yet.');
        abort_if(blank(config('cashier.secret')), 422, 'Stripe is not configured yet.');

        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->subscribed('default')) {
            return response()->json([
                'billing_portal_url' => $user->billingPortalUrl($request->string('success_url')->toString()),
                'message' => 'An active subscription already exists. Use the billing portal to manage it.',
            ]);
        }

        $checkout = $user
            ->newSubscription('default', $plan->stripe_price_id)
            ->checkout([
                'success_url' => $request->string('success_url')->toString(),
                'cancel_url' => $request->string('cancel_url')->toString(),
                'metadata' => [
                    'plan_slug' => $plan->slug,
                    'user_id' => (string) $user->id,
                ],
            ]);

        return response()->json([
            'checkout_url' => $checkout->url,
        ]);
    }

    public function portal(Request $request): JsonResponse
    {
        $request->validate([
            'return_url' => ['required', 'url'],
        ]);

        abort_if(blank(config('cashier.secret')), 422, 'Stripe is not configured yet.');

        /** @var \App\Models\User $user */
        $user = $request->user();

        return response()->json([
            'billing_portal_url' => $user->billingPortalUrl($request->string('return_url')->toString()),
        ]);
    }
}
