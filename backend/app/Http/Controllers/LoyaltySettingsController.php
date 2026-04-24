<?php

namespace App\Http\Controllers;

use App\Models\LoyaltySetting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class LoyaltySettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $settings = $this->getLoyaltySettings($defaultBranch);

            return response()->json([
                'success' => true,
                'settings' => $settings,
                'message' => 'Loyalty settings fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching loyalty settings: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch loyalty settings'
            ], 500);
        }
    }

    public function update(Request $request): JsonResponse
    {
        DB::beginTransaction();

        try {
            $user = $request->user();
            $defaultBranch = $user->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'enabled' => 'boolean',
                'points_per_currency' => 'required|numeric|min:0.1',
                'currency_value' => 'required|numeric|min:1',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            $applyToAllBranches = $request->input('apply_to_all_branches', false);

            if ($applyToAllBranches) {
                // Update business-level settings
                $settings = LoyaltySetting::updateOrCreate(
                    [
                        'business_id' => $defaultBranch->business_id,
                        'branch_id' => null
                    ],
                    $request->only([
                        'enabled',
                        'points_per_currency',
                        'currency_value'
                    ])
                );

                // Remove branch-specific settings
                LoyaltySetting::where('business_id', $defaultBranch->business_id)
                    ->whereNotNull('branch_id')
                    ->delete();
            } else {
                // Update branch-specific settings
                $settings = LoyaltySetting::updateOrCreate(
                    [
                        'business_id' => $defaultBranch->business_id,
                        'branch_id' => $defaultBranch->id
                    ],
                    $request->only([
                        'enabled',
                        'points_per_currency',
                        'currency_value'
                    ])
                );
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'settings' => $settings,
                'message' => 'Loyalty settings updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating loyalty settings: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update loyalty settings'
            ], 500);
        }
    }

    private function getLoyaltySettings($branch)
    {
        // Try to get branch-specific settings first
        $settings = LoyaltySetting::where('business_id', $branch->business_id)
            ->where('branch_id', $branch->id)
            ->first();

        // If no branch-specific settings, get business-level settings
        if (!$settings) {
            $settings = LoyaltySetting::where('business_id', $branch->business_id)
                ->whereNull('branch_id')
                ->first();
        }

        // If no settings exist at all, create default
        if (!$settings) {
            $settings = new LoyaltySetting();
            $settings->fill([
                'enabled' => true,
                'points_per_currency' => 1,
                'currency_value' => 100
            ]);
        }

        return $settings;
    }
}