# Laravel API: Office Exit Scan

This document provides the exact backend files and code to implement Office-side QR Exit Scan for the Expo mobile app.

Frontend endpoint used by the app:
- `POST /api/office/exit-scan`
- `GET /api/test` for connectivity checks

Payload sent by mobile app:
```json
{
  "qrToken": "ABC123TOKEN",
  "scannedByUserId": 42
}
```

## 1) Route Definition

File to edit: `routes/api.php`

```php
<?php

use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Api\Office\ExitScanController;
use Illuminate\Support\Facades\Route;

Route::get('/test', function () {
    Log::info('API test endpoint reached');

    return response()->json([
        'success' => true,
        'message' => 'Laravel API reachable',
        'timestamp' => now()->toDateTimeString(),
    ]);
});

Route::post('/office/exit-scan', [ExitScanController::class, 'process']);
```

If your API already uses auth middleware, you may wrap this route in your existing auth group.

## 2) Request Validation

File to create: `app/Http/Requests/Office/ProcessExitScanRequest.php`

```php
<?php

namespace App\Http\Requests\Office;

use Illuminate\Foundation\Http\FormRequest;

class ProcessExitScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'qrToken' => ['required', 'string', 'max:255'],
            'scannedByUserId' => ['required', 'integer', 'exists:users,user_id'],
        ];
    }
}
```

## 3) Controller

File to create: `app/Http/Controllers/Api/Office/ExitScanController.php`

```php
<?php

namespace App\Http\Controllers\Api\Office;

use App\Http\Controllers\Controller;
use App\Http\Requests\Office\ProcessExitScanRequest;
use App\Services\Office\ExitScanService;
use Illuminate\Http\JsonResponse;

class ExitScanController extends Controller
{
    public function __construct(private ExitScanService $exitScanService)
    {
    }

    public function process(ProcessExitScanRequest $request): JsonResponse
    {
        Log::info('Office exit scan request received', [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'qrToken' => $request->input('qrToken'),
            'scannedByUserId' => $request->input('scannedByUserId'),
        ]);

        $result = $this->exitScanService->process(
            $request->string('qrToken')->toString(),
            (int) $request->input('scannedByUserId')
        );

        Log::info('Office exit scan response prepared', [
            'httpStatus' => $result['httpStatus'],
            'success' => $result['success'],
            'errorCode' => $result['errorCode'] ?? null,
        ]);

        return response()->json($result, $result['httpStatus']);
    }
}
```

## 4) Service Logic

File to create: `app/Services/Office/ExitScanService.php`

```php
<?php

namespace App\Services\Office;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ExitScanService
{
    public function process(string $qrToken, int $scannedByUserId): array
    {
        return DB::transaction(function () use ($qrToken, $scannedByUserId) {
            // 1) Confirm staff identity using real schema mapping
            $officeStaff = DB::table('office_staff')
                ->select('staff_id', 'user_id', 'office_id', 'position')
                ->where('user_id', $scannedByUserId)
                ->first();

            if (! $officeStaff) {
                return $this->error(403, 'OFFICE_STAFF_NOT_FOUND', 'User is not linked to office_staff.');
            }

            // 2) Find visit by QR token
            $visit = DB::table('visit')
                ->where('qr_token', $qrToken)
                ->first();

            if (! $visit) {
                return $this->error(404, 'VISIT_NOT_FOUND', 'QR token not found.');
            }

            // 3) Check already exited
            if (! is_null($visit->exit_time)) {
                return $this->error(409, 'ALREADY_EXITED', 'Exit was already recorded for this visit.');
            }

            // 4) Check active eligibility for exit
            // Rule: all office expectations must be completed before exit
            $pendingExpectations = DB::table('office_expectation')
                ->where('visit_id', $visit->visit_id)
                ->whereNull('arrived_at')
                ->count();

            if ($pendingExpectations > 0) {
                return $this->error(422, 'NOT_ELIGIBLE_FOR_EXIT', 'Visitor still has pending office expectations.');
            }

            // 5) Resolve visitor identity
            $visitor = DB::table('visitor')
                ->select('visitor_id', 'first_name', 'last_name')
                ->where('visitor_id', $visit->visitor_id)
                ->first();

            if (! $visitor) {
                return $this->error(404, 'VISITOR_NOT_FOUND', 'Linked visitor record not found.');
            }

            // 6) Compute exit time + duration
            $exitTime = Carbon::now();
            $entryTime = Carbon::parse($visit->entry_time);
            $durationMinutes = max(0, $entryTime->diffInMinutes($exitTime));

            // 7) Resolve exit_status_id if your lookup has an "Exited" row
            $exitStatusId = DB::table('exit_status')
                ->whereIn('exit_status_name', ['Exited', 'Completed', 'Done'])
                ->value('exit_status_id');

            // 8) Update visit exit fields
            DB::table('visit')
                ->where('visit_id', $visit->visit_id)
                ->update([
                    'exit_time' => $exitTime,
                    'duration_minutes' => $durationMinutes,
                    'exit_status_id' => $exitStatusId,
                ]);

            // 9) Optional: record office_scan entry for exit action
            $validationStatusId = DB::table('validation_status')
                ->whereIn('status_name', ['Correct', 'Valid', 'Approved'])
                ->value('validation_status_id');

            DB::table('office_scan')->insert([
                'visit_id' => $visit->visit_id,
                'office_id' => $officeStaff->office_id,
                'scanned_by_user_id' => $scannedByUserId,
                'scan_time' => $exitTime,
                'validation_status_id' => $validationStatusId,
                'remarks' => 'Exit scan processed',
            ]);

            return [
                'httpStatus' => 200,
                'success' => true,
                'message' => 'Exit recorded successfully.',
                'errorCode' => null,
                'data' => [
                    'visitId' => (int) $visit->visit_id,
                    'visitorId' => (int) $visitor->visitor_id,
                    'visitorName' => trim(($visitor->first_name ?? '') . ' ' . ($visitor->last_name ?? '')),
                    'exitTime' => $exitTime->toDateTimeString(),
                    'durationMinutes' => (int) $durationMinutes,
                    'exitStatusId' => $exitStatusId ? (int) $exitStatusId : null,
                ],
            ];
        });
    }

    private function error(int $httpStatus, string $errorCode, string $message): array
    {
        return [
            'httpStatus' => $httpStatus,
            'success' => false,
            'message' => $message,
            'errorCode' => $errorCode,
            'data' => null,
        ];
    }
}
```

## 5) Response Format

Success:
```json
{
  "success": true,
  "message": "Exit recorded successfully.",
  "errorCode": null,
  "data": {
    "visitId": 101,
    "visitorId": 77,
    "visitorName": "Juan Dela Cruz",
    "exitTime": "2026-04-23 16:30:00",
    "durationMinutes": 95,
    "exitStatusId": 2
  }
}
```

Error examples:
```json
{
  "success": false,
  "message": "QR token not found.",
  "errorCode": "VISIT_NOT_FOUND",
  "data": null
}
```

```json
{
  "success": false,
  "message": "Exit was already recorded for this visit.",
  "errorCode": "ALREADY_EXITED",
  "data": null
}
```

```json
{
  "success": false,
  "message": "Visitor still has pending office expectations.",
  "errorCode": "NOT_ELIGIBLE_FOR_EXIT",
  "data": null
}
```

## 6) Server Command

If Laravel is listening on port 3000, run:

```bash
php artisan serve --host=0.0.0.0 --port=3000
```

For the default Laravel port, use `--port=8000` and update `EXPO_PUBLIC_API_URL` to match.

If the phone still gets `Network request failed`, verify these in order:
1. The phone browser can open `http://YOUR_PC_IP:3000/api/test`.
2. `EXPO_PUBLIC_API_URL` matches the PC's LAN IPv4 address exactly.
3. The Android app build allows HTTP traffic.
4. Laravel is bound to `0.0.0.0`, not `127.0.0.1`.

## 6) Schema Alignment (Important)
- Office user mapping uses `office_staff` (not `office_user`).
- User identity is in `users`.
- Exit updates are in `visit`: `exit_time`, `duration_minutes`, `exit_status_id`.
- Scan record is saved to `office_scan`.
- Status lookups use `exit_status` and `validation_status`.
