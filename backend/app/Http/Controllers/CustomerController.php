<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
   
   public function index(Request $request)
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

       
        $query = Customer::with(['branch', 'creator'])
            ->where('business_id', $defaultBranch->business_id)
            ->latest();

        
        // $query->addSelect(DB::raw("IF(branch_id = {$defaultBranch->id}, 1, 0) as is_current_branch"));

        if ($request->has('branch_id') && $request->branch_id) {
            $query->where('branch_id', $request->branch_id);
        }

        // Search filter
        if ($request->has('search') && $request->search != '') {
            $query->search($request->search);
        }

        // Status filter
        if ($request->has('status') && $request->status != '') {
            $query->where('status', $request->status);
        }

        
        if ($request->has('date_filter')) {
            $this->applyDateFilter($query, $request->date_filter, $request);
        }

        $customers = $query->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'customers' => $customers,
            'message' => 'Customers fetched successfully'
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch customers: ' . $e->getMessage()
        ], 500);
    }
}

 public function store(Request $request)
{
    DB::beginTransaction();

    try {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account. Please contact admin.'
            ], 403);
        }

        if (!$defaultBranch->business_id) {
            \Log::error('Branch has no business_id', ['branch_id' => $defaultBranch->id]);
            return response()->json([
                'success' => false,
                'message' => 'Branch configuration error (no business ID). Contact admin.'
            ], 500);
        }

        // Validation
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'max:20',
                Rule::unique('customers', 'phone')
                    ->where('business_id', $defaultBranch->business_id),
            ],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('customers', 'email')
                    ->where('business_id', $defaultBranch->business_id),
            ],
            'address' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Validation failed'
            ], 422);
        }

        // Create
        $customer = Customer::create([
            'business_id' => $defaultBranch->business_id,
            'branch_id'   => $defaultBranch->id,
            'name'        => $request->name,
            'phone'       => $request->phone,
            'email'       => $request->email,
            'address'     => $request->address,
            'created_by'  => $user->id,
            'status'      => 'active'
        ]);

        DB::commit();

        $customer->load(['branch', 'creator']);

        return response()->json([
            'success' => true,
            'customer' => $customer,
            'message' => 'Customer created successfully'
        ], 201);

    } catch (\Illuminate\Validation\ValidationException $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'errors' => $e->errors(),
            'message' => 'Validation failed'
        ], 422);

    } catch (\Illuminate\Database\QueryException $e) {
        DB::rollBack();

        if ($e->getCode() === '23000') {
            return response()->json([
                'success' => false,
                'message' => 'Phone number or email already exists in this business'
            ], 422);
        }

        \Log::error('Database error in customer creation', [
            'code' => $e->getCode(),
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Database error occurred'
        ], 500);

    } catch (\Exception $e) {
        DB::rollBack();

        \Log::error('Unexpected error in customer creation', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Server error: ' . $e->getMessage()
        ], 500);
    }
}

   public function show(Request $request, $id)
{
    try {
        \Log::info('Fetching customer details', ['id' => $id, 'user_id' => $request->user()->id]);

        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        // Try to find the customer
        $customer = Customer::with(['branch', 'creator'])
            ->where('branch_id', $defaultBranch->id)
            ->find($id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'customer' => $customer,
            'message' => 'Customer fetched successfully'
        ]);

    } catch (\Exception $e) {
        \Log::error('Error in CustomerController@show', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'id' => $id ?? 'null'
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Server error: ' . $e->getMessage()
        ], 500);
    }
}

    public function update(Request $request, $id)
    {
        DB::beginTransaction();

        try {
            $user = $request->user();
             $defaultBranch = $request->user()->default_branch;

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to any branch'
                ], 403);
            }

            $customer = Customer::where('branch_id', $defaultBranch->id)
                ->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'phone' => 'required|string|max:20|unique:customers,phone,' . $customer->id . ',id,branch_id,' . $defaultBranch->id,
                'email' => 'nullable|email|max:255',
                'address' => 'nullable|string|max:500',
                'status' => 'nullable|in:active,inactive',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                    'message' => 'Validation failed'
                ], 422);
            }

            $customer->update($request->only(['name', 'phone', 'email', 'address', 'status']));

            DB::commit();

            $customer->load(['branch', 'creator']);

            return response()->json([
                'success' => true,
                'customer' => $customer,
                'message' => 'Customer updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update customer: ' . $e->getMessage()
            ], 500);
        }
    }

   public function destroy(Request $request, $id)
{
    DB::beginTransaction();

    try {
        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'You are not assigned to any branch'
            ], 403);
        }

        $customer = Customer::where('branch_id', $defaultBranch->id)
            ->findOrFail($id);

        // Check if customer has related sales (optional)
        if ($customer->sales()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete customer with existing sales records'
            ], 422);
        }

        $customer->delete();

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'Customer deleted successfully'
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        
        // Return proper JSON error
        return response()->json([
            'success' => false,
            'message' => 'Failed to delete customer: ' . $e->getMessage()
        ], 500);
    }
}
  public function search(Request $request)
{
    try {
        \Log::info('Searching customers', ['query' => $request->query('query')]);

        $user = $request->user();
        $defaultBranch = $user->default_branch;

        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to your account'
            ], 403);
        }

        $search = $request->query('query', '');

        $customers = Customer::where('branch_id', $defaultBranch->id)
            ->where('status', 'active')
            ->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            })
            ->limit(10)
            ->get(['id', 'name', 'phone', 'email', 'loyalty_points']);

        return response()->json([
            'success' => true,
            'data' => $customers,
            'message' => 'Customers search completed'
        ]);

    } catch (\Exception $e) {
        \Log::error('Error in CustomerController@search', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to search customers: ' . $e->getMessage()
        ], 500);
    }
}
    private function applyDateFilter($query, $filter, $request)
    {
        $now = now();

        switch ($filter) {
            case 'today':
                $query->whereDate('created_at', $now->toDateString());
                break;
            case 'thisweek':
                $query->whereBetween('created_at', [
                    $now->startOfWeek()->toDateString(),
                    $now->endOfWeek()->toDateString()
                ]);
                break;
            case 'month':
                $query->whereBetween('created_at', [
                    $now->startOfMonth()->toDateString(),
                    $now->endOfMonth()->toDateString()
                ]);
                break;
            case 'custom':
                if ($request->has(['start_date', 'end_date'])) {
                    $query->whereBetween('created_at', [
                        $request->start_date,
                        $request->end_date
                    ]);
                }
                break;
        }
    }
}