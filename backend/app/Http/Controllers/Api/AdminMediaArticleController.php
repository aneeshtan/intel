<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaArticle;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class AdminMediaArticleController extends Controller
{
    public function __invoke(): JsonResponse
    {
        /** @var User $user */
        $user = request()->user();

        abort_unless($user && $user->hasRole('admin'), 403, 'Admin access is required.');

        $search = trim((string) request()->query('q', ''));
        $perPage = min(50, max(10, request()->integer('per_page', 20)));

        $articles = MediaArticle::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('body', 'like', "%{$search}%")
                        ->orWhere('source_name', 'like', "%{$search}%")
                        ->orWhere('author_name', 'like', "%{$search}%")
                        ->orWhere('url', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => [
                'items' => collect($articles->items())->map(fn (MediaArticle $article) => [
                    'id' => $article->id,
                    'source_key' => $article->source_key,
                    'source_name' => $article->source_name,
                    'source_url' => $article->source_url,
                    'url' => $article->url,
                    'author_name' => $article->author_name,
                    'title' => $article->title,
                    'body' => $article->body,
                    'published_at' => $article->published_at?->toIso8601String(),
                ]),
                'meta' => [
                    'current_page' => $articles->currentPage(),
                    'last_page' => $articles->lastPage(),
                    'per_page' => $articles->perPage(),
                    'total' => $articles->total(),
                ],
                'query' => $search !== '' ? $search : null,
            ],
        ]);
    }
}
