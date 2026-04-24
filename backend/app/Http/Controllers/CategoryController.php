<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
   public function index(Request $request): JsonResponse
{
    try {
        $user = $request->user();
        $defaultBranch = $request->user()->default_branch;

if (!$defaultBranch) {
    return response()->json([
        'success' => false,
        'message' => 'No default branch assigned'
    ], 403);
}

$branchId = $defaultBranch->id;

        $categories = Category::withCount('products')
            ->byBranch($branchId)
            ->get();

        return response()->json([
            'success' => true,
            'categories' => $categories
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch categories: ' . $e->getMessage()
        ], 500);
    }
}

public function store(Request $request): JsonResponse
{
    $user = $request->user();
    $defaultBranch = $request->user()->default_branch;

    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255|unique:categories,name,NULL,id,branch_id,' . $defaultBranch->id,
        'description' => 'nullable|string'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $category = Category::create([
            'business_id' => $defaultBranch->business_id,
            'branch_id' => $defaultBranch->id,
            ...$validator->validated()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully',
            'category' => $category
        ], 201);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to create category: ' . $e->getMessage()
        ], 500);
    }
}

    public function update(Request $request, $id): JsonResponse
    {
        $category = Category::find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:categories,name,' . $id,
            'description' => 'nullable|string',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $category->update($validator->validated());

            return response()->json([
                'success' => true,
                'message' => 'Category updated successfully',
                'category' => $category
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update category: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id): JsonResponse
    {
        try {
            $category = Category::find($id);

            if (!$category) {
                return response()->json([
                    'success' => false,
                    'message' => 'Category not found'
                ], 404);
            }

            // Check if category has products
            if ($category->products()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete category with existing products'
                ], 422);
            }

            $category->delete();

            return response()->json([
                'success' => true,
                'message' => 'Category deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete category: ' . $e->getMessage()
            ], 500);
        }
    }
}