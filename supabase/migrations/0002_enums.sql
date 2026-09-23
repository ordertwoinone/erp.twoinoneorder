create type user_status as enum ('active', 'inactive', 'suspended');

create type purchase_status as enum (
  'draft', 'pending_approval', 'returned', 'rejected', 'approved', 'posted', 'cancelled'
);

create type purchase_request_status as enum (
  'requested', 'under_review', 'approved', 'rejected', 'ordered', 'received', 'invoiced', 'cancelled'
);

create type purchase_order_status as enum (
  'draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled'
);

create type goods_receipt_status as enum ('draft', 'confirmed', 'cancelled');

create type payment_status as enum ('unpaid', 'partially_paid', 'paid', 'overpaid');

create type voucher_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'posted', 'cancelled');

create type approval_action as enum ('submitted', 'approved', 'rejected', 'returned', 'commented', 'posted', 'reversed');

create type transfer_status as enum ('dispatched', 'in_transit', 'received', 'cancelled');

create type card_settlement_status as enum ('unmatched', 'partially_matched', 'matched', 'disputed');

create type delivery_settlement_status as enum ('unmatched', 'partially_matched', 'matched', 'disputed');

create type ai_scan_status as enum ('queued', 'processing', 'completed', 'failed', 'reviewed');

create type ai_review_status as enum ('pending_review', 'confirmed', 'discarded');

create type employee_match_status as enum ('matched', 'new', 'changed', 'uncertain', 'ignored');

create type employment_status as enum ('active', 'on_leave', 'terminated', 'resigned');

create type salary_payment_status as enum ('pending', 'partially_paid', 'paid');

create type accounting_period_status as enum ('open', 'locked');

create type journal_entry_status as enum ('posted', 'reversed');

create type attachment_category as enum (
  'invoices', 'purchase-documents', 'supplier-documents', 'employee-documents',
  'salary-documents', 'sales-receipts', 'bank-receipts', 'settlement-documents',
  'transfer-documents', 'expense-documents', 'attachments'
);

create type notification_status as enum ('unread', 'read', 'archived');

create type integration_status as enum ('not_available', 'pending_configuration', 'connected', 'configured');
