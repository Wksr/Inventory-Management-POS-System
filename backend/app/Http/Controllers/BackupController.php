<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BackupController extends Controller
{
    public function create()
    {
        try {
            $dbName = env('DB_DATABASE');
            $backupFileName = 'pos_backup_' . date('Y-m-d_H-i-s') . '.sql';
            $backupPath = storage_path('app/backup/' . $backupFileName);

           
            if (!file_exists(storage_path('app/backup'))) {
                mkdir(storage_path('app/backup'), 0755, true);
            }

            $tables = DB::select('SHOW TABLES');
            $sqlContent = "-- POS Database Backup\n";
            $sqlContent .= "-- Generated: " . date('Y-m-d H:i:s') . "\n\n";

            foreach ($tables as $tableObj) {
                $tableName = array_values((array)$tableObj)[0];

                // Table Structure
                $create = DB::select("SHOW CREATE TABLE `{$tableName}`");
                $sqlContent .= "\n-- Table structure for `{$tableName}`\n";
                $sqlContent .= $create[0]->{'Create Table'} . ";\n\n";

                // Data
                $rows = DB::table($tableName)->get();
                if ($rows->count() > 0) {
                    $sqlContent .= "-- Dumping data for table `{$tableName}`\n";
                    foreach ($rows as $row) {
                        $values = array_map(function($value) {
                            return $value === null ? 'NULL' : "'" . addslashes($value) . "'";
                        }, (array)$row);

                        $sqlContent .= "INSERT INTO `{$tableName}` VALUES (" . implode(',', $values) . ");\n";
                    }
                    $sqlContent .= "\n";
                }
            }

            file_put_contents($backupPath, $sqlContent);

            return response()->json([
                'success' => true,
                'message' => 'Database Backup Successful!',
                'filename' => $backupFileName,
                'download_url' => url('/api/backup/download/' . $backupFileName)
            ]);

        } catch (\Exception $e) {
            \Log::error('Backup Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Backup Failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function download($filename)
    {
        $path = storage_path('app/backup/' . $filename);

        if (file_exists($path)) {
            return response()->download($path, $filename);
        }

        return response()->json(['message' => 'File not found'], 404);
    }
}