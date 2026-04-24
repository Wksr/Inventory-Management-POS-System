<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class BranchController extends Controller
{
    /**
     * Display a listing of branches for the authenticated user
     */
    public function index(): JsonResponse
    {
        try {
            $user = Auth::user();
            
            Log::info('Fetching branches for user', [
                'user_id' => $user->id,
                'user_email' => $user->email
            ]);
            
            // Get user's branches with pivot data
            $branches = $user->branches()
                ->where('branches.is_active', true)
                ->withCount('users')
                ->orderBy('branch_user.is_default', 'desc')
                ->orderBy('branches.name')
                ->get()
                ->map(function ($branch) {
                    return [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'code' => $branch->code ?? strtoupper(substr($branch->name, 0, 2)),
                        'address' => $branch->address,
                        'phone' => $branch->phone,
                        'email' => $branch->email,
                        'is_active' => $branch->is_active,
                        'is_default' => (bool) $branch->pivot->is_default,
                        'users_count' => $branch->users_count,
                    ];
                });

            // Get user's default branch ID
            $userDefaultBranch = $user->branches()
                ->where('branch_user.is_default', true)
                ->where('branches.is_active', true)
                ->first();

            Log::info('Branches fetched successfully', [
                'total_branches' => count($branches),
                'default_branch_id' => $userDefaultBranch ? $userDefaultBranch->id : null
            ]);

            return response()->json([
                'success' => true,
                'branches' => $branches,
                'default_branch' => $userDefaultBranch ? [
                    'id' => $userDefaultBranch->id,
                    'name' => $userDefaultBranch->name,
                    'code' => $userDefaultBranch->code ?? strtoupper(substr($userDefaultBranch->name, 0, 2)),
                ] : null
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch branches', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch branches: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Set user's current branch
     */
    public function setUserBranch(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'branch_id' => 'required|exists:branches,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();
            $branchId = $request->branch_id;

            Log::info('Setting user branch', [
                'user_id' => $user->id,
                'branch_id' => $branchId
            ]);

            // Check if user has access to this branch
            $hasAccess = $user->branches()
                ->where('branches.id', $branchId)
                ->where('branches.is_active', true)
                ->exists();

            if (!$hasAccess) {
                Log::warning('User does not have access to branch', [
                    'user_id' => $user->id,
                    'branch_id' => $branchId
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have access to this branch'
                ], 403);
            }

            // Reset all branches to not default for this user
            $user->branches()->updateExistingPivot(
                $user->branches->pluck('id')->toArray(),
                ['is_default' => false]
            );

            // Set the selected branch as default
            $user->branches()->updateExistingPivot($branchId, ['is_default' => true]);

            // Get the updated branch info
            $branch = Branch::find($branchId);

            Log::info('Branch changed successfully', [
                'user_id' => $user->id,
                'branch_id' => $branchId,
                'branch_name' => $branch->name
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Branch changed successfully',
                'current_branch' => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'code' => $branch->code ?? strtoupper(substr($branch->name, 0, 2)),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to change branch', [
                'user_id' => Auth::id(),
                'branch_id' => $request->branch_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to change branch: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created branch (Admin only)
     */
  public function store(Request $request): JsonResponse
{
    // Only admin can create branches
    if (Auth::user()->role !== 'admin') {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized'
        ], 403);
    }

    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255',
        'code' => 'nullable|string|max:10|unique:branches',
        'address' => 'nullable|string|max:500',
        'phone' => 'nullable|string|max:20',
        'email' => 'nullable|email|max:255',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $user = Auth::user();
        
        // Get business ID from user's default branch
        $defaultBranch = $user->default_branch;
        
        if (!$defaultBranch) {
            return response()->json([
                'success' => false,
                'message' => 'User does not have a default branch to get business from'
            ], 400);
        }
        
        // Use the business ID from the user's default branch
        $businessId = $defaultBranch->business_id;

        // Generate code if not provided
        $code = $request->code ?? strtoupper(substr($request->name, 0, 2) . rand(10, 99));

        $branch = Branch::create([
            'name' => $request->name,
            'code' => $code,
            'address' => $request->address,
            'phone' => $request->phone,
            'email' => $request->email,
            'business_id' => $businessId,
            'is_active' => true,
        ]);

        // Assign current admin user to the new branch (not as default)
        $user->branches()->attach($branch->id, ['is_default' => false]);

        Log::info('Branch created successfully', [
            'branch_id' => $branch->id,
            'branch_name' => $branch->name,
            'business_id' => $businessId,
            'created_by' => $user->id
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Branch created successfully',
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'address' => $branch->address,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'business_id' => $businessId,
                'is_active' => $branch->is_active,
            ]
        ], 201);

    } catch (\Exception $e) {
        Log::error('Failed to create branch', [
            'user_id' => Auth::id(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to create branch: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Update the specified branch (Admin only)
     */
    public function update(Request $request, $id): JsonResponse
    {
        // Only admin can update branches
        if (Auth::user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:10|unique:branches,code,' . $id,
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $branch = Branch::find($id);

            if (!$branch) {
                return response()->json([
                    'success' => false,
                    'message' => 'Branch not found'
                ], 404);
            }

            // Generate code if not provided and not already set
            $code = $request->code ?? ($branch->code ?? strtoupper(substr($request->name, 0, 2) . rand(10, 99)));

            $branch->update([
                'name' => $request->name,
                'code' => $code,
                'address' => $request->address,
                'phone' => $request->phone,
                'email' => $request->email,
                'is_active' => $request->is_active ?? $branch->is_active,
            ]);

            Log::info('Branch updated successfully', [
                'branch_id' => $branch->id,
                'updated_by' => Auth::id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Branch updated successfully',
                'branch' => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'code' => $branch->code,
                    'address' => $branch->address,
                    'phone' => $branch->phone,
                    'email' => $branch->email,
                    'is_active' => $branch->is_active,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update branch', [
                'branch_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update branch: ' . $e->getMessage()
            ], 500);
        }
    }

   public function destroy($id): JsonResponse
{
    // Only admin can delete branches
    if (Auth::user()->role !== 'admin') {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized. Admin access required.'
        ], 403);
    }

    try {
        $branch = Branch::find($id);

        if (!$branch) {
            return response()->json([
                'success' => false,
                'message' => 'Branch not found'
            ], 404);
        }

        // Check if it's the default branch
        if ($branch->is_default) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete the default branch. Please set another branch as default first.'
            ], 400);
        }

        // Get current admin user
        $currentUser = Auth::user();
        
        // Get users count excluding current admin
        $usersCount = $branch->users()
            ->where('users.id', '!=', $currentUser->id)
            ->count();

        // Check if branch has other users (excluding current admin)
        if ($usersCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete this branch. There are other users assigned to it.'
            ], 400);
        }

        // Detach current admin from the branch before deleting
        $currentUser->branches()->detach($id);

        // Deactivate the branch
        $branch->update(['is_active' => false]);

        Log::info('Branch deactivated', [
            'branch_id' => $branch->id,
            'deactivated_by' => $currentUser->id
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Branch deactivated successfully'
        ]);

    } catch (\Exception $e) {
        Log::error('Failed to delete branch', [
            'branch_id' => $id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to delete branch: ' . $e->getMessage()
        ], 500);
    }
}
    /**
     * Get users for a specific branch (Admin only)
     */
    public function getBranchUsers($id): JsonResponse
    {
        // Only admin can view branch users
        if (Auth::user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        try {
            $branch = Branch::with(['users' => function ($query) {
                $query->select('users.id', 'first_name', 'last_name', 'email', 'role', 'is_active');
            }])->find($id);

            if (!$branch) {
                return response()->json([
                    'success' => false,
                    'message' => 'Branch not found'
                ], 404);
            }

            $users = $branch->users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_active' => $user->is_active,
                    'is_default' => (bool) $user->pivot->is_default,
                ];
            });

            return response()->json([
                'success' => true,
                'branch' => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'users' => $users
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch branch users', [
                'branch_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch branch users: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign user to branch (Admin only)
     */
    public function assignUser(Request $request): JsonResponse
    {
        // Only admin can assign users to branches
        if (Auth::user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'branch_id' => 'required|exists:branches,id',
            'is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::find($request->user_id);
            $branch = Branch::find($request->branch_id);

            if (!$user || !$branch) {
                return response()->json([
                    'success' => false,
                    'message' => 'User or branch not found'
                ], 404);
            }

            // Check if already assigned
            $alreadyAssigned = $user->branches()
                ->where('branches.id', $branch->id)
                ->exists();

            if ($alreadyAssigned) {
                // Update existing assignment
                $user->branches()->updateExistingPivot($branch->id, [
                    'is_default' => $request->is_default ?? false
                ]);
            } else {
                // Create new assignment
                $user->branches()->attach($branch->id, [
                    'is_default' => $request->is_default ?? false
                ]);
            }

            // If setting as default, remove default from other branches for this user
            if ($request->is_default) {
                $user->branches()
                    ->where('branches.id', '!=', $branch->id)
                    ->update(['branch_user.is_default' => false]);
            }

            Log::info('User assigned to branch', [
                'user_id' => $user->id,
                'branch_id' => $branch->id,
                'is_default' => $request->is_default ?? false,
                'assigned_by' => Auth::id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'User assigned to branch successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to assign user to branch', [
                'user_id' => $request->user_id,
                'branch_id' => $request->branch_id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to assign user to branch: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current user's default branch
     */
    public function getCurrentBranch(): JsonResponse
    {
        try {
            $user = Auth::user();
            
            $defaultBranch = $user->branches()
                ->where('branch_user.is_default', true)
                ->where('branches.is_active', true)
                ->first();

            if (!$defaultBranch) {
                // Try to get any active branch
                $defaultBranch = $user->branches()
                    ->where('branches.is_active', true)
                    ->first();
                
                if (!$defaultBranch) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No active branches found for user'
                    ], 404);
                }
                
                // Set this as default
                $user->branches()->updateExistingPivot($defaultBranch->id, ['is_default' => true]);
            }

            return response()->json([
                'success' => true,
                'current_branch' => [
                    'id' => $defaultBranch->id,
                    'name' => $defaultBranch->name,
                    'code' => $defaultBranch->code ?? strtoupper(substr($defaultBranch->name, 0, 2)),
                    'address' => $defaultBranch->address,
                    'phone' => $defaultBranch->phone,
                    'email' => $defaultBranch->email,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get current branch', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to get current branch: ' . $e->getMessage()
            ], 500);
        }
    }
}