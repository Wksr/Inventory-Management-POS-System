<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Category;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class POSController extends Controller
{
    public function getProducts(Request $request): JsonResponse
{
    try {
        $user = $request->user();
        $defaultBranch = $user?->default_branch ?? $user?->branches()?->wherePivot('is_default', true)?->first();

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        $query = Product::where('branch_id', $defaultBranch->id)
            ->where('stock', '>', 0);

            // Category filter
            if ($request->has('category_id') && $request->category_id != 'all') {
                $query->where('category_id', $request->category_id);
            }

            // Search filter
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            }

            // Pagination
            $perPage = $request->per_page ?? 50;
            $products = $query->orderBy('name')
                ->paginate($perPage, ['id', 'name', 'sku', 'price', 'stock', 'image', 'category_id']);

            return response()->json([
                'success' => true,
                'products' => $products,
                'message' => 'Products fetched successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching POS products: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch products: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getCategories(Request $request): JsonResponse
{
    try {
        $user = $request->user();
        $defaultBranch = $user?->default_branch ?? $user?->branches()?->wherePivot('is_default', true)?->first();

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        
        $categories = Category::where('branch_id', $defaultBranch->id)
            ->orderBy('name')
            ->get(['id', 'name']); 

        return response()->json([
            'success' => true,
            'categories' => $categories,
            'message' => 'Categories fetched successfully'
        ]);

    } catch (\Exception $e) {
        \Log::error('Error fetching POS categories: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch categories'
        ], 500);
    }
}
  public function searchCustomer(Request $request): JsonResponse
{
    try {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $defaultBranch = $user->default_branch ?? $user->branches()->wherePivot('is_default', true)->first();
        if (!$defaultBranch) {
            return response()->json(['success' => false, 'message' => 'No branch assigned'], 403);
        }

        $query = $request->query('query', '');
        if (strlen($query) < 2) {
            return response()->json(['success' => true, 'data' => []]);
        }

        // Business-wide search (all branches under same business)
        $customers = Customer::where('business_id', $defaultBranch->business_id)
            ->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('phone', 'like', "%{$query}%")
                  ->orWhere('email', 'like', "%{$query}%");
            })
            ->select('id', 'name', 'phone', 'email', 'loyalty_points', 'branch_id') // branch_id එකත් ගන්න
            ->with('branch:id,name') 
            ->limit(10)
            ->get();

        
        $customers = $customers->map(function ($customer) use ($defaultBranch) {
            $customer->is_current_branch = $customer->branch_id === $defaultBranch->id;
            return $customer;
        });

        return response()->json([
            'success' => true,
            'data' => $customers
        ]);

    } catch (\Exception $e) {
        \Log::error('POS Customer Search Error: ' . $e->getMessage(), [
            'query' => $request->query('query'),
            'user_id' => $user->id ?? null
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Search failed: ' . $e->getMessage()
        ], 500);
    }
}

  public function getProductByBarcode(Request $request, $barcode): JsonResponse
{
    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json(['success' => false, 'message' => 'No branch'], 403);
        }

        
        $product = Product::where('branch_id', $defaultBranch->id)
            ->where('sku', $barcode)  
            ->where('stock', '>', 0)
            ->select('id', 'name', 'sku', 'price as price', 'stock', 'image')
            ->first();

        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        return response()->json([
            'success' => true,
            'product' => $product
        ]);

    } catch (\Exception $e) {
        \Log::error('Barcode Scan Error: ' . $e->getMessage());
        return response()->json(['success' => false, 'message' => 'Scan failed'], 500);
    }
}
}