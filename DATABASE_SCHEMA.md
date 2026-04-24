# Database Schema Reference (Nu_Secure)

## Overview
This document is the human-readable schema reference for Nu_Secure.

It is intended for developers and AI-assisted feature generation so queries use the correct tables, keys, and relationships.

Source of truth: the SQL schema provided in this project context.

Important notes:
- Use `office_staff` for office account mapping. Do not use `office_user`.
- Use `guard` for guard account mapping.
- Use `users` as the identity/account table.
- Use `office` for office metadata.
- Visit tracking is centered on `visit`, `office_expectation`, and `office_scan`.

---

## Core Entities

### `users`
- Purpose: Base user identity and account record.
- Primary Key: `user_id`
- Important Columns: `role_id`, `first_name`, `last_name`, `email`, `password_hash`, `status`, `created_at`
- Foreign Keys: `role_id -> role.role_id`
- Used In System: Authentication, role routing, resolving actor identity in scans/alerts/notifications.

### `visitor`
- Purpose: Visitor identity and pass record.
- Primary Key: `visitor_id`
- Important Columns: `pass_number`, `control_number`, `first_name`, `last_name`, `contact_no`, `visitor_photo_with_id_url`, `address_id`, `created_at`
- Foreign Keys: `address_id -> address.address_id`
- Used In System: Central visitor profile linked to visits, enrollee records, and alerts.

### `address`
- Purpose: Address details used by visitor records.
- Primary Key: `address_id`
- Important Columns: `house_no`, `street`, `barangay`, `city_municipality`, `province`, `region`
- Foreign Keys: None
- Used In System: Referenced by `visitor.address_id`.

### `office`
- Purpose: Office master data.
- Primary Key: `office_id`
- Important Columns: `office_name`, `floor`, `is_active`
- Foreign Keys: None
- Used In System: Routing, visit destination, office expectations, office scans, enrollee steps.

### `visit`
- Purpose: Main visit tracking record.
- Primary Key: `visit_id`
- Important Columns: `visitor_id`, `guard_user_id`, `visit_type_id`, `purpose_reason`, `primary_office_id`, `qr_token`, `entry_time`, `exit_time`, `duration_minutes`, `exit_status_id`, `destination_text`
- Foreign Keys:
  - `visitor_id -> visitor.visitor_id`
  - `guard_user_id -> users.user_id`
  - `visit_type_id -> visit_type.visit_type_id`
  - `primary_office_id -> office.office_id`
  - `exit_status_id -> exit_status.exit_status_id`
- Used In System: Root record for QR flow, office progression, alerts, and exit tracking.

---

## Authentication and Roles

### `role`
- Purpose: Role catalog.
- Primary Key: `role_id`
- Important Columns: `role_name`
- Foreign Keys: None
- Used In System: Classifies users (admin/guard/office staff, etc.).

### `guard`
- Purpose: Guard-specific account mapping and metadata.
- Primary Key: `guard_id`
- Important Columns: `user_id`, `badge_number`, `station`
- Foreign Keys: `user_id -> users.user_id`
- Used In System: Guard profile linkage from base `users` account.

### `office_staff`
- Purpose: Office account mapping and position info.
- Primary Key: `staff_id`
- Important Columns: `user_id`, `office_id`, `position`
- Foreign Keys:
  - `user_id -> users.user_id`
  - `office_id -> office.office_id`
- Used In System: Office dashboard/account context, office-level scoping.

### `sessions`
- Purpose: Session storage table.
- Primary Key: `id`
- Important Columns: `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`
- Foreign Keys: None
- Used In System: Session persistence (framework-level session table).

### `password_reset_tokens`
- Purpose: Password reset token storage.
- Primary Key: `email`
- Important Columns: `token`, `created_at`
- Foreign Keys: None
- Used In System: Password reset lifecycle.

---

## Visitor Flow

### `visit_type`
- Purpose: Visit type lookup.
- Primary Key: `visit_type_id`
- Important Columns: `visit_type_name`
- Foreign Keys: None
- Used In System: Categorizes visit records.

### `exit_status`
- Purpose: Exit status lookup.
- Primary Key: `exit_status_id`
- Important Columns: `exit_status_name`
- Foreign Keys: None
- Used In System: Tracks visit completion/exit state.

### `office_expectation`
- Purpose: Planned office route for each visit.
- Primary Key: `expectation_id`
- Important Columns: `visit_id`, `office_id`, `expected_order`, `expectation_status_id`, `created_at`, `arrived_at`
- Foreign Keys:
  - `visit_id -> visit.visit_id`
  - `office_id -> office.office_id`
  - `expectation_status_id -> expectation_status.expectation_status_id`
- Used In System: Ordered routing and progression through offices.

### `expectation_status`
- Purpose: Status lookup for office expectation items.
- Primary Key: `expectation_status_id`
- Important Columns: `status_name`
- Foreign Keys: None
- Used In System: Indicates expected/arrived/other expectation state values.

### `contractor`
- Purpose: Contractor-specific visit extension.
- Primary Key: `contractor_id`
- Important Columns: `contact_person`, `visit_id`
- Foreign Keys: `visit_id -> visit.visit_id`
- Used In System: Stores contractor context linked to a visit.

---

## Office Flow

### `office_scan`
- Purpose: Scan event logs for office checkpoints.
- Primary Key: `scan_id`
- Important Columns: `visit_id`, `office_id`, `scanned_by_user_id`, `scan_time`, `validation_status_id`, `remarks`
- Foreign Keys:
  - `visit_id -> visit.visit_id`
  - `office_id -> office.office_id`
  - `scanned_by_user_id -> users.user_id`
  - `validation_status_id -> validation_status.validation_status_id`
- Used In System: Check-in/checkpoint history, validation outcome, audit trail.

### `validation_status`
- Purpose: Scan validation result lookup.
- Primary Key: `validation_status_id`
- Important Columns: `status_name`
- Foreign Keys: None
- Used In System: Correct/wrong/other validation outcomes for scans.

---

## Alerts and Notifications

### `alerts`
- Purpose: Security and workflow alerts.
- Primary Key: `alert_id`
- Important Columns: `visit_id`, `visitor_id`, `scan_id`, `alert_type`, `severity`, `message`, `status`, `created_at`, `resolved_at`, `resolved_by`, `resolution_notes`
- Foreign Keys:
  - `visit_id -> visit.visit_id`
  - `visitor_id -> visitor.visitor_id`
  - `scan_id -> office_scan.scan_id`
  - `resolved_by -> users.user_id`
- Used In System: Wrong office, unauthorized, overstay, suspicious event handling and resolution.

### `notification`
- Purpose: Notification delivery log/records.
- Primary Key: `notif_id`
- Important Columns: `scan_id`, `recipient_user_id`, `notif_type_id`, `message`, `sent_at`, `read_at`
- Foreign Keys:
  - `scan_id -> office_scan.scan_id`
  - `recipient_user_id -> users.user_id`
  - `notif_type_id -> notif_type.notif_type_id`
- Used In System: User-targeted operational notifications tied to scan events.

### `notif_type`
- Purpose: Notification type lookup.
- Primary Key: `notif_type_id`
- Important Columns: `notif_type_name`
- Foreign Keys: None
- Used In System: Categorizes notifications.

---

## Enrollee Flow

### `enrollee`
- Purpose: Enrollee record per visitor.
- Primary Key: `enrollee_id`
- Important Columns: `visitor_id` (unique), `enrollee_status_id`, `updated_at`
- Foreign Keys:
  - `visitor_id -> visitor.visitor_id`
  - `enrollee_status_id -> enrollee_status.enrollee_status_id`
- Used In System: Tracks visitor enrollment lifecycle state.

### `enrollee_status`
- Purpose: Enrollee status lookup.
- Primary Key: `enrollee_status_id`
- Important Columns: `status_name`
- Foreign Keys: None
- Used In System: Labels enrollee lifecycle stages.

### `enrollee_step`
- Purpose: Enrollment workflow steps and owning office.
- Primary Key: `step_id`
- Important Columns: `step_name`, `office_id`, `step_order`, `is_active`
- Foreign Keys: `office_id -> office.office_id`
- Used In System: Defines ordered enrollment workflow and office ownership of steps.

### `enrollee_progress`
- Purpose: Per-enrollee status by step.
- Primary Key: `progress_id`
- Important Columns: `enrollee_id`, `step_id`, `step_status_id`, `completed_at`
- Foreign Keys:
  - `enrollee_id -> enrollee.enrollee_id`
  - `step_id -> enrollee_step.step_id`
  - `step_status_id -> step_status.step_status_id`
- Used In System: Tracks progress through enrollee steps.

### `step_status`
- Purpose: Enrollee step status lookup.
- Primary Key: `step_status_id`
- Important Columns: `step_status_name`
- Foreign Keys: None
- Used In System: Pending/completed/etc. statuses for step progress.

### `visit_route`
- Purpose: Route linkage between a visit and enrollee steps.
- Primary Key: `route_id`
- Important Columns: `visit_id`, `step_id`, `step_order`, `route_status_id`
- Foreign Keys:
  - `visit_id -> visit.visit_id`
  - `step_id -> enrollee_step.step_id`
  - `route_status_id -> route_status.route_status_id`
- Used In System: Structured route execution state for visit workflows.

### `route_status`
- Purpose: Route status lookup.
- Primary Key: `route_status_id`
- Important Columns: `route_status_name`
- Foreign Keys: None
- Used In System: Status values for `visit_route` entries.

---

## Lookup and Reference Tables

### `visit_type`
- Purpose: Visit type catalog.
- Primary Key: `visit_type_id`
- Important Columns: `visit_type_name`
- Foreign Keys: None
- Used In System: Visit categorization.

### `exit_status`
- Purpose: Visit exit status catalog.
- Primary Key: `exit_status_id`
- Important Columns: `exit_status_name`
- Foreign Keys: None
- Used In System: Visit closeout states.

### `expectation_status`
- Purpose: Office expectation state catalog.
- Primary Key: `expectation_status_id`
- Important Columns: `status_name`
- Foreign Keys: None
- Used In System: `office_expectation` state values.

### `validation_status`
- Purpose: Office scan validation catalog.
- Primary Key: `validation_status_id`
- Important Columns: `status_name`
- Foreign Keys: None
- Used In System: `office_scan` validation outcomes.

### `notif_type`
- Purpose: Notification type catalog.
- Primary Key: `notif_type_id`
- Important Columns: `notif_type_name`
- Foreign Keys: None
- Used In System: Notification categorization.

### `role`
- Purpose: Role catalog.
- Primary Key: `role_id`
- Important Columns: `role_name`
- Foreign Keys: None
- Used In System: User authorization classification.

### `step_status`
- Purpose: Enrollee step status catalog.
- Primary Key: `step_status_id`
- Important Columns: `step_status_name`
- Foreign Keys: None
- Used In System: `enrollee_progress` status values.

### `route_status`
- Purpose: Route status catalog.
- Primary Key: `route_status_id`
- Important Columns: `route_status_name`
- Foreign Keys: None
- Used In System: `visit_route` status values.

---

## Operational and Framework Tables

These tables are infrastructure/support tables and are usually not part of core visitor-domain feature queries.

### `cache`
- Purpose: Key-value cache entries.
- Primary Key: `key`
- Important Columns: `value`, `expiration`
- Foreign Keys: None
- Used In System: App/framework caching.

### `cache_locks`
- Purpose: Cache lock records.
- Primary Key: `key`
- Important Columns: `owner`, `expiration`
- Foreign Keys: None
- Used In System: Distributed lock support for cache operations.

### `jobs`
- Purpose: Background job queue.
- Primary Key: `id`
- Important Columns: `queue`, `payload`, `attempts`, `reserved_at`, `available_at`, `created_at`
- Foreign Keys: None
- Used In System: Async processing pipeline.

### `job_batches`
- Purpose: Batch metadata for queued jobs.
- Primary Key: `id`
- Important Columns: `name`, `total_jobs`, `pending_jobs`, `failed_jobs`, `failed_job_ids`, `created_at`, `finished_at`
- Foreign Keys: None
- Used In System: Batch queue tracking.

### `failed_jobs`
- Purpose: Failed background job records.
- Primary Key: `id`
- Important Columns: `uuid`, `connection`, `queue`, `payload`, `exception`, `failed_at`
- Foreign Keys: None
- Used In System: Retry/debug queue failures.

### `migrations`
- Purpose: Migration history.
- Primary Key: `id`
- Important Columns: `migration`, `batch`
- Foreign Keys: None
- Used In System: DB migration bookkeeping.

---

## Key Relationships

### Identity and role
- `users.role_id -> role.role_id`
- `guard.user_id -> users.user_id`
- `office_staff.user_id -> users.user_id`
- `office_staff.office_id -> office.office_id`

### Visit and routing
- `visit.visitor_id -> visitor.visitor_id`
- `visit.guard_user_id -> users.user_id`
- `visit.primary_office_id -> office.office_id`
- `visit.visit_type_id -> visit_type.visit_type_id`
- `visit.exit_status_id -> exit_status.exit_status_id`
- `office_expectation.visit_id -> visit.visit_id`
- `office_expectation.office_id -> office.office_id`
- `office_expectation.expectation_status_id -> expectation_status.expectation_status_id`

### Scanning and validation
- `office_scan.visit_id -> visit.visit_id`
- `office_scan.office_id -> office.office_id`
- `office_scan.scanned_by_user_id -> users.user_id`
- `office_scan.validation_status_id -> validation_status.validation_status_id`

### Alerts and notifications
- `alerts.visit_id -> visit.visit_id`
- `alerts.visitor_id -> visitor.visitor_id`
- `alerts.scan_id -> office_scan.scan_id`
- `alerts.resolved_by -> users.user_id`
- `notification.scan_id -> office_scan.scan_id`
- `notification.recipient_user_id -> users.user_id`
- `notification.notif_type_id -> notif_type.notif_type_id`

### Enrollee workflow
- `enrollee.visitor_id -> visitor.visitor_id`
- `enrollee.enrollee_status_id -> enrollee_status.enrollee_status_id`
- `enrollee_progress.enrollee_id -> enrollee.enrollee_id`
- `enrollee_progress.step_id -> enrollee_step.step_id`
- `enrollee_progress.step_status_id -> step_status.step_status_id`
- `visit_route.visit_id -> visit.visit_id`
- `visit_route.step_id -> enrollee_step.step_id`
- `visit_route.route_status_id -> route_status.route_status_id`

---

## Recommended Query Notes (For AI and Developers)

### Correct source tables
- Office account mapping: `office_staff` (not `office_user`)
- Guard account mapping: `guard`
- User identity: `users`
- Office metadata: `office`
- Visit tracking: `visit`, `office_expectation`, `office_scan`

### Office dashboard guidance
- Start with logged-in user in `users`
- Resolve office assignment from `office_staff` by `user_id`
- Join/use `office` for office display fields
- Use `visit` and `office_expectation` scoped by `office_id` for counts

### Guard dashboard guidance
- Resolve guard mapping using `guard.user_id`
- Use `visit` (guard_user_id), `office_scan`, and `alerts` for activity metrics

### Scan flow guidance
- Validate expected office using `office_expectation`
- Record actual scan in `office_scan`
- Use `validation_status` to classify scan result
- Create `alerts` for wrong-office or suspicious events

### Enrollee flow guidance
- `enrollee` links 1:1 to `visitor` via unique `visitor_id`
- Step definitions come from `enrollee_step`
- Current step states come from `enrollee_progress` + `step_status`
- Optional route orchestration can use `visit_route` + `route_status`

### Avoid common mistakes
- Do not query `office_user` (table does not exist)
- Do not treat `office_staff` as identity source; identity is `users`
- Do not infer office assignment from scan logs when `office_staff` exists

---

## Feature Prompt Reference

Use these table sets when generating new feature prompts/code.

### Office dashboard
- `users`, `office_staff`, `office`, `visit`, `office_expectation`, `office_scan`

### Guard dashboard
- `users`, `guard`, `visit`, `office_scan`, `alerts`

### Alerts page
- `alerts`, `visit`, `visitor`, `office_scan`, `users`, `office`

### Visitor details
- `visitor`, `address`, `visit`, `office_expectation`, `office_scan`, `enrollee`

### Scan history
- `office_scan`, `visit`, `visitor`, `office`, `users`, `validation_status`

### Enrollee progress
- `enrollee`, `enrollee_progress`, `enrollee_step`, `step_status`, `office`

---

## Practical Mapping Summary
- Office account data should come from `office_staff`, not `office_user`.
- Guard account data should come from `guard`.
- User identity comes from `users`.
- Office info comes from `office`.
- Visit tracking uses `visit`, `office_expectation`, and `office_scan`.
