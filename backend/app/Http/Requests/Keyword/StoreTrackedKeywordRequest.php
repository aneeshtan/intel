<?php

namespace App\Http\Requests\Keyword;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTrackedKeywordRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->has('keyword')) {
            return;
        }

        $this->merge([
            'keyword' => $this->normalizeKeyword($this->input('keyword')),
        ]);
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'keyword' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', Rule::in(['all', 'linkedin', 'reddit', 'x', 'media'])],
            'match_type' => ['nullable', Rule::in(['phrase', 'exact', 'boolean'])],
            'is_active' => ['nullable', 'boolean'],
            'configuration' => ['nullable', 'array'],
        ];
    }

    private function normalizeKeyword(?string $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim((string) $value)) ?? trim((string) $value);

        if (
            strlen($value) >= 2
            && (
                (str_starts_with($value, '"') && str_ends_with($value, '"'))
                || (str_starts_with($value, "'") && str_ends_with($value, "'"))
            )
        ) {
            $value = substr($value, 1, -1);
        }

        return trim($value);
    }
}
