-- Customer deactivation no longer soft-deletes (bug fix 2026-11-04).
--
-- The old deactivate path set status='inactive' AND deletedAt=now(), but
-- every customer read filters deletedAt IS NULL, so a deactivated
-- customer vanished from the list, the detail page and search entirely,
-- even under the "Ngừng hoạt động" filter, with no way back from the UI.
-- Deactivation is now status-only (see routes/customers.ts).
--
-- Repair the rows the old path hid: the deactivate handler was the ONLY
-- writer of Customer.deletedAt, so every Customer row with deletedAt set
-- is a deactivated customer that must become visible again. Clearing
-- deletedAt where status is already 'inactive' restores exactly those
-- rows and touches nothing else (no row can have deletedAt set with a
-- different status, and active customers never had deletedAt set).

UPDATE "Customer" SET "deletedAt" = NULL WHERE "status" = 'inactive' AND "deletedAt" IS NOT NULL;
