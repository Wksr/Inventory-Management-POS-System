<?php


namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
  public function index(Request $request): JsonResponse
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

        // Get per_page from request (default 50, max 200 for performance)
        $perPage = min($request->input('per_page', 50), 200);

        $query = Product::with(['category', 'unit', 'supplier'])
            ->where('branch_id', $defaultBranch->id);  

        // Server-side search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%")
                  ->orWhereHas('category', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('supplier', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  });
            });
        }

       
        if ($request->filled('date_filter')) {
            // implement date filtering logic here if needed
        }

        $products = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'products' => $products  // this includes data, current_page, last_page, total, etc.
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to retrieve products: ' . $e->getMessage()
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
            'sku' => 'required|string|max:100|unique:products,sku,NULL,id,business_id,' . $defaultBranch->business_id . ',branch_id,' . $defaultBranch->id,
            'category_id' => 'required|exists:categories,id',
            'cost_price' => 'required|numeric|min:0',
            'price' => 'required|numeric|min:0',
            'low_stock_alert' => 'required|integer|min:0',
            'unit_id' => 'nullable|exists:units,id',
            'unit' => 'nullable|string|max:50',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier' => 'nullable|string|max:255',
            'stock' => 'nullable|integer|min:0',
            'color' => 'nullable|string|max:50',
            'size' => 'nullable|string|max:50',
            'expire_date' => 'nullable|date|after:today',
            'description' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $validator->validated();

            // Assign correct business_id and branch_id from user's default branch
            $data['business_id'] = $defaultBranch->business_id;
            $data['branch_id']   = $defaultBranch->id;
            $data['created_by']   = $user->id;
            $data['stock']        = $data['stock'] ?? 0;
            $data['supplier_id'] = $request->supplier_id;
            $data['unit_id'] = $request->unit_id;

            // Handle image upload
            if ($request->hasFile('image')) {
                $data['image'] = $request->file('image')->store('products', 'public');
            }

            $product = Product::create($data);
            $product->load('category','supplier','unit');

            return response()->json([
                'success' => true,
                'message' => 'Product created successfully',
                'product' => $product
            ], 201);

        } catch (\Exception $e) {
            if (isset($data['image']) && Storage::disk('public')->exists($data['image'])) {
                Storage::disk('public')->delete($data['image']);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to create product: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $defaultBranch = $request->user()->default_branch;

        if (!$defaultBranch) {
            return response()->json(['success' => false, 'message' => 'No branch assigned'], 403);
        }

        $product = Product::with('category','unit','supplier')
            ->where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        return response()->json([
            'success' => true,
            'product' => $product
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $defaultBranch = $request->user()->default_branch;

        if (!$defaultBranch) {
            return response()->json(['success' => false, 'message' => 'No branch assigned'], 403);
        }

        $product = Product::where('branch_id', $defaultBranch->id)->find($id);

        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'sku' => 'required|string|max:100|unique:products,sku,' . $id . ',id,branch_id,' . $defaultBranch->id,
            'category_id' => 'required|exists:categories,id',
            'cost_price' => 'required|numeric|min:0',
            'price' => 'required|numeric|min:0',
            'low_stock_alert' => 'required|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier' => 'nullable|string|max:255',
            'stock' => 'nullable|integer|min:0',
            'color' => 'nullable|string|max:50',
            'size' => 'nullable|string|max:50',
            'expire_date' => 'nullable|date|after:today',
            'description' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();
        $data['stock'] = $data['stock'] ?? $product->stock;

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        $product->update($data);
        $product->load('category','supplier','unit');

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'product' => $product
        ]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $defaultBranch = $request->user()->default_branch;

        if (!$defaultBranch) {
            return response()->json(['success' => false, 'message' => 'No branch assigned'], 403);
        }

        $product = Product::where('branch_id', $defaultBranch->id)->find($id);

        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully'
        ]);
    }


public function lowStock(Request $request): JsonResponse
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

            $products = Product::where('branch_id', $defaultBranch->id)
                ->whereColumn('stock', '<=', 'low_stock_alert')
                ->where('stock', '>', 0)
                ->select('id', 'name', 'sku', 'stock', 'low_stock_alert', 'image')
                ->get();

            return response()->json([
                'success' => true,
                'low_stock_products' => $products,
                'count' => $products->count()
            ]);

        } catch (\Exception $e) {
            \Log::error('Low Stock Alert Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load low stock products'
            ], 500);
        }
    }

    public function expiring(Request $request): JsonResponse
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

        $today = now()->startOfDay();
        $thirtyDaysFromNow = now()->addDays(30)->endOfDay();

        $products = Product::where('branch_id', $defaultBranch->id)
            ->whereNotNull('expire_date')
            ->where('expire_date', '<=', $thirtyDaysFromNow)
            ->where('expire_date', '>=', $today)
            ->select('id', 'name', 'sku', 'stock', 'expire_date')
            ->orderBy('expire_date', 'asc')
            ->get()
            ->map(function ($product) use ($today) {
                $expireDate = \Carbon\Carbon::parse($product->expire_date);
                $product->days_to_expire = $today->diffInDays($expireDate, false);
                return $product;
            });

        return response()->json([
            'success' => true,
            'expiring_products' => $products,
            'count' => $products->count()
        ]);

    } catch (\Exception $e) {
        \Log::error('Expiring Products Error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to load expiring products'
        ], 500);
    }
}

    
}
