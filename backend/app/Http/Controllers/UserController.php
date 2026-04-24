<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules;

class UserController extends Controller
{
    /**
     * Display a listing of users
     */
   
  public function index()
{
    try {
        $users = User::with(['branches' => function($query) {
            $query->where('branches.is_active', true)
                  ->select('branches.id', 'branches.name', 'branches.code')
                  ->orderBy('branch_user.is_default', 'desc');
        }])->get();

        $usersData = $users->map(function ($user) {
            return [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'branches' => $user->branches->map(function ($branch) {
                    return [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'code' => $branch->code,
                        'is_default' => (bool) $branch->pivot->is_default,
                    ];
                }),
                // Get primary branch (default or first)
                'primary_branch' => $user->branches->first() ? [
                    'id' => $user->branches->first()->id,
                    'name' => $user->branches->first()->name,
                    'code' => $user->branches->first()->code,
                ] : null,
            ];
        });

        return response()->json([
            'success' => true,
            'users' => $usersData,
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch users: ' . $e->getMessage()
        ], 500);
    }
}
    /**
     * Store a newly created user
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'role' => 'required|string|in:admin,manager,cashier',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::create([
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
                'is_active' => true,
            ]);

            // Assign to default branch
            $defaultBranch = Branch::active()->first();
            if ($defaultBranch) {
                $user->branches()->attach($defaultBranch->id, ['is_default' => true]);
            }

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'user' => [
                    'id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_active' => $user->is_active,
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified user
     */
    public function show($id): JsonResponse
    {
        try {
            $user = User::select('id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'created_at')
                        ->find($id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'user' => $user
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified user
     */
    /**
 * Update the specified user
 */
public function update(Request $request, $id): JsonResponse
{
    \Log::info('Update user request:', [
        'user_id' => $id,
        'request_data' => $request->all(),
        'auth_user' => auth()->user() ? auth()->user()->email : 'NO USER'
    ]);

    $user = User::find($id);

    if (!$user) {
        return response()->json([
            'success' => false,
            'message' => 'User not found'
        ], 404);
    }

    $validator = Validator::make($request->all(), [
        'first_name' => 'required|string|max:255',
        'last_name' => 'required|string|max:255',
        'email' => 'required|string|email|max:255|unique:users,email,' . $id,
        'role' => 'required|string|in:admin,manager,cashier',
        'password' => 'sometimes|nullable|min:6|confirmed',
    ]);

    if ($validator->fails()) {
        \Log::error('Validation failed:', $validator->errors()->toArray());
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $updateData = [
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'role' => $request->role,
        ];
        
        // Only update password if provided and not empty
        if ($request->filled('password')) {
            $updateData['password'] = Hash::make($request->password);
        }

        \Log::info('Updating user with data:', $updateData);

        $user->update($updateData);

        \Log::info('User updated successfully:', ['user_id' => $user->id]);

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active,
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Update user error: ' . $e->getMessage());
        \Log::error('Stack trace: ' . $e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to update user: ' . $e->getMessage()
        ], 500);
    }
}
    /**
     * Remove the specified user
     */
    public function destroy($id): JsonResponse
    {
        try {
            $user = User::find($id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Prevent users from deleting themselves
            if ($user->id === auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'You cannot delete your own account'
                ], 403);
            }

            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user: ' . $e->getMessage()
            ], 500);
        }
    }
}