<?php
// app/Http/Controllers/SupplierController.php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
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

           $query = Supplier::with(['branch', 'creator'])
                ->where('business_id', $defaultBranch->business_id)
                ->latest();

            if ($request->has('branch_id') && $request->branch_id) {
                $query->where('branch_id', $request->branch_id);
            }

            $suppliers = $query->paginate(10);

            return response()->json([
                'success' => true,
                'suppliers' => $suppliers
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve suppliers: ' . $e->getMessage()
            ], 500);
        }

        
    $suppliers = Supplier::withTrashed()
    ->where('branch_id', $defaultBranch->id)
    ->latest()
    ->paginate(10);
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
            'company' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')
                    ->where('business_id', $defaultBranch->business_id),
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $supplier = Supplier::create([
                'name' => $request->name,
                'company' => $request->company,
                'phone' => $request->phone,
                'email' => $request->email,
                'business_id' => $defaultBranch->business_id,
                'branch_id' => $defaultBranch->id,
                'created_by' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Supplier created successfully',
                'supplier' => $supplier
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create supplier: ' . $e->getMessage()
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

          $supplier = Supplier::where('business_id', $defaultBranch->business_id)
                ->with(['branch', 'creator'])
                ->find($id);

            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'Supplier not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'supplier' => $supplier
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve supplier: ' . $e->getMessage()
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

       $supplier = Supplier::where('business_id', $defaultBranch->business_id)
            ->find($id);

        if (!$supplier) {
            return response()->json([
                'success' => false,
                'message' => 'Supplier not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'company' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')
                    ->where('business_id', $defaultBranch->business_id)
                    ->ignore($supplier->id),
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $supplier->update([
                'name' => $request->name,
                'company' => $request->company,
                'phone' => $request->phone,
                'email' => $request->email,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Supplier updated successfully',
                'supplier' => $supplier
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update supplier: ' . $e->getMessage()
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

           $supplier = Supplier::where('business_id', $defaultBranch->business_id)
                ->find($id);

            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'Supplier not found'
                ], 404);
            }

            // Check if supplier has products
          /* if ($supplier->products()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete supplier with associated products'
                ], 422);
            }*/

            $supplier->delete();

            return response()->json([
                'success' => true,
                'message' => 'Supplier deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete supplier: ' . $e->getMessage()
            ], 500);
        }
    }
}