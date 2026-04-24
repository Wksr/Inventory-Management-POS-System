<?php
// app/Http/Controllers/UnitController.php

namespace App\Http\Controllers;

use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
           $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned to your account'
                ], 403);
            }

            $units = Unit::where('business_id', $defaultBranch->business_id)
                ->latest()
                ->paginate(10);

            return response()->json([
                'success' => true,
                'units' => $units
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve units: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
       $defaultBranch = $request->user()->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'You are not assigned to any branch'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'short_name' => 'required|string|max:50',
            'base_unit' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $unit = Unit::create([
                'name' => $request->name,
                'short_name' => $request->short_name,
                'base_unit' => $request->base_unit,
                'business_id' => $defaultBranch->business_id,
                'branch_id' => $defaultBranch->id,
                'created_by' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Unit created successfully',
                'unit' => $unit
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create unit: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show(Request $request, $id): JsonResponse
    {
        try {
            $user = $request->user();
           $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned'
                ], 403);
            }

            $unit = Unit::where('branch_id', $defaultBranch->id)
                ->find($id);

            if (!$unit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unit not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'unit' => $unit
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve unit: ' . $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $defaultBranch = $request->user()->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned'
            ], 403);
        }

        $unit = Unit::where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$unit) {
            return response()->json([
                'success' => false,
                'message' => 'Unit not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'short_name' => 'required|string|max:50',
            'base_unit' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $unit->update([
                'name' => $request->name,
                'short_name' => $request->short_name,
                'base_unit' => $request->base_unit,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Unit updated successfully',
                'unit' => $unit
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update unit: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $user = $request->user();
            $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No branch assigned'
                ], 403);
            }

            $unit = Unit::where('branch_id', $defaultBranch->id)
                ->find($id);

            if (!$unit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unit not found'
                ], 404);
            }

            // Check if unit has products
            if ($unit->products()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete unit with associated products'
                ], 422);
            }

            $unit->delete();

            return response()->json([
                'success' => true,
                'message' => 'Unit deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete unit: ' . $e->getMessage()
            ], 500);
        }
    }
}