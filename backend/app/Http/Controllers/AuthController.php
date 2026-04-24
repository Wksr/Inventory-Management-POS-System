<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Business;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules;

class AuthController extends Controller
{
  
public function register(Request $request)
{
    $validator = Validator::make($request->all(), [
        'firstName' => 'required|string|max:255',
        'lastName'  => 'required|string|max:255',
        'email'     => 'required|string|email|max:255|unique:users',
        'password'  => ['required', 'confirmed', Rules\Password::defaults()],
        'role'      => 'required|string|in:admin,manager,cashier',
        'branch_id' => 'nullable|exists:branches,id', // Add branch validation
    ]);

    if ($validator->fails()) {
        return response()->json([
            'message' => 'Validation failed',
            'errors'  => $validator->errors()
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    $user = User::create([
        'first_name' => $request->firstName,
        'last_name'  => $request->lastName,
        'email'      => $request->email,
        'password'   => Hash::make($request->password),
        'role'       => $request->role,
        'is_active'  => true,
    ]);

    // Determine which branch to assign
    if ($request->has('branch_id') && $request->branch_id) {
        // Assign to selected branch
        $branch = Branch::find($request->branch_id);
        if ($branch && $branch->is_active) {
            $user->branches()->attach($branch->id, ['is_default' => true]);
        } else {
            // If branch not found or inactive, assign to default branch
            $defaultBranch = Branch::active()->first();
            if ($defaultBranch) {
                $user->branches()->attach($defaultBranch->id, ['is_default' => true]);
            }
        }
    } else {
        // Auto-setup for first user or assign to default branch
        if (User::count() === 1) {
            $business = Business::create([
                'name'      => 'Main Business',
                'email'     => $request->email,
                'is_active' => true,
            ]);

            $branch = Branch::create([
                'business_id' => $business->id,
                'name'        => 'Main Branch',
                'is_active'   => true,
            ]);

            $user->branches()->attach($branch->id, ['is_default' => true]);
        } else {
            $defaultBranch = Branch::active()->first();
            if ($defaultBranch) {
                $user->branches()->attach($defaultBranch->id, ['is_default' => true]);
            }
        }
    }

    $token = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'message' => 'User registered successfully',
        'user'    => $this->getUserData($user),
        'token'   => $token
    ], Response::HTTP_CREATED);
}

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials'
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Your account is deactivated'
            ], Response::HTTP_FORBIDDEN);
        }

        if ($user->branches()->where('branches.is_active', true)->count() === 0) {
            return response()->json([
                'message' => 'No active branches assigned'
            ], Response::HTTP_FORBIDDEN);
        }

        // CREATE TOKEN FIRST — this is the key!
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user'    => $this->getUserData($user),
            'token'   => $token
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }

    public function user(Request $request)
    {
        return response()->json([
            'user' => $this->getUserData($request->user())
        ]);
    }

    // HELPER METHOD — keeps code clean and safe
    private function getUserData(User $user)
    {
        // Load branches only once
        $user->loadMissing('branches');

        $defaultBranch = $user->branches
            ->where('pivot.is_default', true)
            ->first();

        return [
            'id'         => $user->id,
            'firstName'  => $user->first_name,
            'lastName'   => $user->last_name,
            'email'      => $user->email,
            'role'       => $user->role,
            'branches'   => $user->branches->map(function ($branch) {
                return [
                    'id'           => $branch->id,
                    'name'         => $branch->name,
                    'business_id'  => $branch->business_id,
                    'is_default'   => (bool) $branch->pivot->is_default,
                ];
            }),
            'default_branch' => $defaultBranch ? [
                'id'           => $defaultBranch->id,
                'name'         => $defaultBranch->name,
                'business_id'  => $defaultBranch->business_id,
            ] : null,
        ];
    }
}