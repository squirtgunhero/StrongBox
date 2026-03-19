CREATE TYPE "SbLoanStage" AS ENUM ('application', 'upcoming', 'active', 'closed');

CREATE TYPE "SbLoanStatus" AS ENUM (
  'pending',
  'approved',
  'funded',
  'active',
  'matured',
  'paid_off',
  'closed',
  'rejected',
  'on_hold'
);

CREATE TYPE "SbDrawRequestStatus" AS ENUM (
  'requested',
  'under_review',
  'approved',
  'rejected',
  'funded'
);

CREATE TYPE "SbImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'PUBLISHED', 'FAILED');

CREATE TYPE "SbImportRowStatus" AS ENUM (
  'PENDING',
  'VALID',
  'INVALID',
  'NEEDS_REVIEW',
  'CORRECTED',
  'PUBLISHED'
);

CREATE TABLE "borrowers" (
  "id" TEXT NOT NULL,
  "legal_name" TEXT NOT NULL,
  "contact_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "ein" TEXT,
  "mailing_address" TEXT,
  "source" TEXT,
  "active_flag" BOOLEAN NOT NULL DEFAULT true,
  "home_state" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "properties" (
  "id" TEXT NOT NULL,
  "borrower_id" TEXT,
  "full_address" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "market_name" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loans" (
  "id" TEXT NOT NULL,
  "borrower_id" TEXT NOT NULL,
  "property_id" TEXT,
  "loan_stage" "SbLoanStage" NOT NULL,
  "loan_status" "SbLoanStatus" NOT NULL,
  "loan_type" TEXT,
  "origination_date" TIMESTAMP(3),
  "payoff_date" TIMESTAMP(3),
  "maturity_date" TIMESTAMP(3),
  "term_months" INTEGER,
  "terms_text" TEXT,
  "principal_total" DECIMAL(18,2),
  "purchase_amount" DECIMAL(18,2),
  "rehab_amount" DECIMAL(18,2),
  "draw_reserve" DECIMAL(18,2),
  "arv" DECIMAL(18,2),
  "ltv" DECIMAL(12,6),
  "rehab_percent_of_loan" DECIMAL(12,6),
  "interest_rate" DECIMAL(8,4),
  "origination_fee" DECIMAL(18,2),
  "uw_fee" DECIMAL(18,2),
  "rush_fee" DECIMAL(18,2),
  "upfront_cash_required" DECIMAL(18,2),
  "monthly_payment" DECIMAL(18,2),
  "total_cash_currently_needed" DECIMAL(18,2),
  "calculation_notes" TEXT,
  "accrued_interest_mode" TEXT,
  "title_company" TEXT,
  "title_contact" TEXT,
  "notes" TEXT,
  "source_sheet" TEXT,
  "source_row_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "draw_requests" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "property_id" TEXT,
  "request_date" TIMESTAMP(3),
  "amount_requested" DECIMAL(18,2) NOT NULL,
  "payment_method" TEXT,
  "status" "SbDrawRequestStatus" NOT NULL,
  "notes" TEXT,
  "approved_amount" DECIMAL(18,2),
  "processed_date" TIMESTAMP(3),
  "admin_override" BOOLEAN NOT NULL DEFAULT false,
  "exception_flag" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "draw_request_audit" (
  "id" TEXT NOT NULL,
  "draw_request_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "requested_amount" DECIMAL(18,2),
  "approved_amount" DECIMAL(18,2),
  "action_by" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draw_request_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_reference" (
  "id" TEXT NOT NULL,
  "market_name" TEXT NOT NULL,
  "state" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_future_market" BOOLEAN NOT NULL DEFAULT false,
  "is_expansion_market" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "market_reference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_accounts" (
  "id" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "current_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "updated_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,

  CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_snapshots" (
  "id" TEXT NOT NULL,
  "snapshot_date" TIMESTAMP(3) NOT NULL,
  "total_loans_out" DECIMAL(18,2),
  "total_company_cash" DECIMAL(18,2),
  "company_cash_out" DECIMAL(18,2),
  "total_draw_reserve" DECIMAL(18,2),
  "upcoming_hml_loans" INTEGER,
  "loc_business_balance" DECIMAL(18,2),
  "current_cash_balance" DECIMAL(18,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "annual_loan_history" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT,
  "closed_year" INTEGER NOT NULL,
  "borrower_name" TEXT NOT NULL,
  "origination_date" TIMESTAMP(3),
  "payoff_date" TIMESTAMP(3),
  "years_outstanding" DECIMAL(10,4),
  "principal" DECIMAL(18,2),
  "purchase_amount" DECIMAL(18,2),
  "rehab_amount" DECIMAL(18,2),
  "city" TEXT,
  "state" TEXT,
  "loan_type" TEXT,
  "terms_text" TEXT,
  "property_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "annual_loan_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tax_1098_prep" (
  "id" TEXT NOT NULL,
  "borrower_id" TEXT,
  "borrower_name" TEXT NOT NULL,
  "loans_closed_2022_count" INTEGER NOT NULL DEFAULT 0,
  "loans_closed_2023_count" INTEGER NOT NULL DEFAULT 0,
  "active_or_cashout_count" INTEGER NOT NULL DEFAULT 0,
  "total_loan_count" INTEGER NOT NULL DEFAULT 0,
  "terms_reference" TEXT,
  "property_address" TEXT,
  "notes" TEXT,
  "source_reference" TEXT,
  "review_flag" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tax_1098_prep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_batches" (
  "id" TEXT NOT NULL,
  "source_sheet_family" TEXT NOT NULL,
  "source_sheet_name" TEXT NOT NULL,
  "uploaded_by" TEXT,
  "status" "SbImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "valid_rows" INTEGER NOT NULL DEFAULT 0,
  "invalid_rows" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_rows" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_sheet_name" TEXT NOT NULL,
  "source_row_number" INTEGER,
  "source_row_key" TEXT,
  "payload" JSONB NOT NULL,
  "normalized_payload" JSONB,
  "status" "SbImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "missing_critical" BOOLEAN NOT NULL DEFAULT false,
  "validation_errors" JSONB,
  "admin_correction" JSONB,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loans_source_sheet_source_row_key_key"
ON "loans"("source_sheet", "source_row_key");

CREATE UNIQUE INDEX "market_reference_market_name_state_key"
ON "market_reference"("market_name", "state");

CREATE UNIQUE INDEX "cash_accounts_account_name_key"
ON "cash_accounts"("account_name");

CREATE INDEX "borrowers_legal_name_idx" ON "borrowers"("legal_name");
CREATE INDEX "borrowers_email_idx" ON "borrowers"("email");
CREATE INDEX "borrowers_active_flag_idx" ON "borrowers"("active_flag");

CREATE INDEX "properties_borrower_id_idx" ON "properties"("borrower_id");
CREATE INDEX "properties_state_idx" ON "properties"("state");
CREATE INDEX "properties_market_name_idx" ON "properties"("market_name");

CREATE INDEX "loans_borrower_id_idx" ON "loans"("borrower_id");
CREATE INDEX "loans_property_id_idx" ON "loans"("property_id");
CREATE INDEX "loans_loan_stage_idx" ON "loans"("loan_stage");
CREATE INDEX "loans_loan_status_idx" ON "loans"("loan_status");
CREATE INDEX "loans_maturity_date_idx" ON "loans"("maturity_date");
CREATE INDEX "loans_source_sheet_idx" ON "loans"("source_sheet");

CREATE INDEX "draw_requests_loan_id_idx" ON "draw_requests"("loan_id");
CREATE INDEX "draw_requests_status_idx" ON "draw_requests"("status");
CREATE INDEX "draw_requests_request_date_idx" ON "draw_requests"("request_date");

CREATE INDEX "draw_request_audit_draw_request_id_created_at_idx"
ON "draw_request_audit"("draw_request_id", "created_at");

CREATE INDEX "market_reference_is_active_idx" ON "market_reference"("is_active");
CREATE INDEX "portfolio_snapshots_snapshot_date_idx" ON "portfolio_snapshots"("snapshot_date");
CREATE INDEX "annual_loan_history_closed_year_idx" ON "annual_loan_history"("closed_year");
CREATE INDEX "annual_loan_history_borrower_name_idx" ON "annual_loan_history"("borrower_name");
CREATE INDEX "tax_1098_prep_borrower_name_idx" ON "tax_1098_prep"("borrower_name");
CREATE INDEX "tax_1098_prep_review_flag_idx" ON "tax_1098_prep"("review_flag");
CREATE INDEX "import_batches_source_sheet_family_idx" ON "import_batches"("source_sheet_family");
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");
CREATE INDEX "import_rows_batch_id_idx" ON "import_rows"("batch_id");
CREATE INDEX "import_rows_status_idx" ON "import_rows"("status");
CREATE INDEX "import_rows_missing_critical_idx" ON "import_rows"("missing_critical");

ALTER TABLE "properties"
ADD CONSTRAINT "properties_borrower_id_fkey"
FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loans"
ADD CONSTRAINT "loans_borrower_id_fkey"
FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loans"
ADD CONSTRAINT "loans_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "draw_requests"
ADD CONSTRAINT "draw_requests_loan_id_fkey"
FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "draw_requests"
ADD CONSTRAINT "draw_requests_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "draw_request_audit"
ADD CONSTRAINT "draw_request_audit_draw_request_id_fkey"
FOREIGN KEY ("draw_request_id") REFERENCES "draw_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "annual_loan_history"
ADD CONSTRAINT "annual_loan_history_loan_id_fkey"
FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_1098_prep"
ADD CONSTRAINT "tax_1098_prep_borrower_id_fkey"
FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_rows"
ADD CONSTRAINT "import_rows_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;