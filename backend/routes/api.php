<?php

use App\Http\Controllers\Api\AdminMediaArticleController;
use App\Http\Controllers\Api\AdminMediaCaptureController;
use App\Http\Controllers\Api\AdminMediaCoverageController;
use App\Http\Controllers\Api\AlertChannelController;
use App\Http\Controllers\Api\AlertInboxController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ProjectAlertRuleController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectListeningController;
use App\Http\Controllers\Api\TrackedKeywordController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
});

Route::get('plans', [PlanController::class, 'index']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('me', [ProfileController::class, 'show']);
    Route::patch('me', [ProfileController::class, 'update']);
    Route::get('alerts/channels', [AlertChannelController::class, 'index']);
    Route::post('alerts/channels', [AlertChannelController::class, 'store']);
    Route::patch('alerts/channels/{alertChannel}', [AlertChannelController::class, 'update']);
    Route::delete('alerts/channels/{alertChannel}', [AlertChannelController::class, 'destroy']);
    Route::get('alerts/inbox', [AlertInboxController::class, 'index']);
    Route::patch('alerts/inbox/{alertDelivery}/read', [AlertInboxController::class, 'markRead']);
    Route::get('admin/media-articles', AdminMediaArticleController::class);
    Route::post('admin/media-capture', AdminMediaCaptureController::class);
    Route::get('admin/media-coverage', AdminMediaCoverageController::class);

    Route::post('billing/checkout/{plan:slug}', [BillingController::class, 'checkout']);
    Route::get('billing/portal', [BillingController::class, 'portal']);

    Route::apiResource('projects', ProjectController::class);
    Route::post('projects/{project}/sources/mute', [ProjectListeningController::class, 'muteSource']);
    Route::delete('projects/{project}/sources/mute/{domain}', [ProjectListeningController::class, 'unmuteSource']);
    Route::post('projects/{project}/influencers/mute', [ProjectListeningController::class, 'muteInfluencer']);
    Route::delete('projects/{project}/influencers/mute/{author}', [ProjectListeningController::class, 'unmuteInfluencer']);
    Route::get('projects/{project}/alerts', [ProjectAlertRuleController::class, 'index']);
    Route::post('projects/{project}/alerts', [ProjectAlertRuleController::class, 'store']);
    Route::patch('projects/{project}/alerts/{alertRule}', [ProjectAlertRuleController::class, 'update']);
    Route::delete('projects/{project}/alerts/{alertRule}', [ProjectAlertRuleController::class, 'destroy']);
    Route::apiResource('projects.keywords', TrackedKeywordController::class)
        ->parameters(['keywords' => 'trackedKeyword']);
});
