<?php


namespace App\Http\Controllers;

use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class BusinessController extends Controller
{
   // In BusinessController.php - update the show() method
public function show(): JsonResponse
{
    try {
        $user = Auth::user();
        
        // Try to get the business from user's default branch
        $defaultBranch = $user->branches()
            ->where('branch_user.is_default', true)
            ->where('branches.is_active', true)
            ->first();

        if ($defaultBranch) {
            $business = Business::find($defaultBranch->business_id);
        } else {
            // If no default branch, get first business or create one
            $business = Business::first();
            
            if (!$business) {
                // Create a default business
                $business = Business::create([
                    'name' => 'My Business',
                    'email' => 'business@example.com',
                    'phone' => '0000000000',
                    'address' => 'Business Address',
                    'is_active' => true,
                ]);
            }
        }

        if (!$business) {
            return response()->json([
                'success' => false,
                'message' => 'Business not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'business' => [
                'id' => $business->id,
                'name' => $business->name,
                'email' => $business->email,
                'phone' => $business->phone,
                'address' => $business->address,
                'is_active' => $business->is_active,
                'logo' => $business->logo,
               'logo_url' => $business->logo ? asset('storage/' . $business->logo) : null,
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Failed to fetch business details: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch business details'
        ], 500);
    }
}
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'logo' => 'nullable|image|max:5120',
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
            
            // Get user's default branch
            $defaultBranch = $user->branches()
                ->where('branch_user.is_default', true)
                ->where('branches.is_active', true)
                ->first();

            if (!$defaultBranch) {
                return response()->json([
                    'success' => false,
                    'message' => 'No active branch found'
                ], 400);
            }

            $data = $request->only(['name', 'email', 'phone', 'address']);
            $data['is_active'] = true;

            // Handle logo upload
            if ($request->hasFile('logo')) {
                $path = $request->file('logo')->store('business-logos', 'public');
                $data['logo'] = $path;
            }

            // Update or create business
            $business = Business::updateOrCreate(
                ['id' => $defaultBranch->business_id],
                $data
            );

            return response()->json([
                'success' => true,
                'message' => 'Business details saved successfully',
                'business' => [
                    'id' => $business->id,
                    'name' => $business->name,
                    'email' => $business->email,
                    'phone' => $business->phone,
                    'address' => $business->address,
                    'is_active' => $business->is_active,
                    'logo_url' => $business->logo,
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save business details'
            ], 500);
        }
    }
public function update(Request $request, $id): JsonResponse
{
    \Log::info('Business update with file check:', [
        'has_logo' => $request->hasFile('logo') ? 'YES' : 'NO',
        'all_input' => $request->all()
    ]);

    // Validate all fields including logo
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255',
        'email' => 'nullable|email|max:255',
        'phone' => 'nullable|string|max:20',
        'address' => 'nullable|string',
        'is_active' => 'nullable|boolean',
        'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // 5MB max
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
        $business = Business::find($id);

        if (!$business) {
            return response()->json([
                'success' => false,
                'message' => 'Business not found'
            ], 404);
        }

        // Prepare update data
        $data = [
            'name' => $request->input('name'),
            'email' => $request->input('email') ?: null,
            'phone' => $request->input('phone') ?: null,
            'address' => $request->input('address') ?: null,
        ];

        // Handle is_active
        if ($request->has('is_active')) {
            $data['is_active'] = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN);
        }

        // Handle logo upload - THIS IS THE KEY PART
        if ($request->hasFile('logo')) {
            \Log::info('Logo file received:', [
                'name' => $request->file('logo')->getClientOriginalName(),
                'size' => $request->file('logo')->getSize(),
                'mime' => $request->file('logo')->getMimeType()
            ]);

            // Delete old logo if exists
            if ($business->logo && Storage::disk('public')->exists($business->logo)) {
                Storage::disk('public')->delete($business->logo);
                \Log::info('Old logo deleted:', ['path' => $business->logo]);
            }

            // Store new logo
            $path = $request->file('logo')->store('business-logos', 'public');
            $data['logo'] = $path; // Save path to database
            
            \Log::info('New logo stored:', ['path' => $path]);
        }

        \Log::info('Updating business with data:', $data);
        
        // Update the business
        $business->update($data);

        // Refresh to get updated data
        $business->refresh();

        \Log::info('Business updated successfully:', [
            'id' => $business->id,
            'has_logo' => $business->logo ? 'YES' : 'NO',
            'logo_path' => $business->logo
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Business details updated successfully',
            'business' => [
                'id' => $business->id,
                'name' => $business->name,
                'email' => $business->email,
                'phone' => $business->phone,
                'address' => $business->address,
                'is_active' => $business->is_active,
                'logo' => $business->logo, 
                'logo_url' => $business->logo ? asset('storage/' . $business->logo) : null,
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('Failed to update business: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to update business details: ' . $e->getMessage()
        ], 500);
    }
}

public function uploadLogo(Request $request, $id): JsonResponse
{
    \Log::info('Logo upload request for business:', ['id' => $id]);

    $validator = Validator::make($request->all(), [
        'logo' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'Logo validation failed',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $business = Business::find($id);
        
        if (!$business) {
            return response()->json([
                'success' => false,
                'message' => 'Business not found'
            ], 404);
        }

        $file = $request->file('logo');
        
        // Delete old logo
        if ($business->logo && Storage::disk('public')->exists($business->logo)) {
            Storage::disk('public')->delete($business->logo);
        }

        // Store new logo
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path = $file->storeAs('business-logos', $fileName, 'public');
        
        // Update business with logo path
        $business->update(['logo' => $path]);

        \Log::info('Logo uploaded successfully:', ['path' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Logo uploaded successfully',
            'logo_path' => $path,
           'logo_url' => $business->logo ? asset('storage/' . $business->logo) : null,
        ]);

    } catch (\Exception $e) {
        \Log::error('Logo upload error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to upload logo'
        ], 500);
    }
}
}