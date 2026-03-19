CREATE OR REPLACE VIEW dashboard_portfolio_summary AS
WITH active_loans AS (
  SELECT l.*
  FROM loans l
  WHERE l.loan_stage = 'active'
    AND l.loan_status IN ('active', 'funded')
), upcoming_loans AS (
  SELECT l.*
  FROM loans l
  WHERE l.loan_stage = 'upcoming'
), maturity_30 AS (
  SELECT COUNT(*)::int AS cnt
  FROM active_loans l
  WHERE l.maturity_date IS NOT NULL
    AND l.maturity_date::date - CURRENT_DATE <= 30
    AND l.maturity_date::date - CURRENT_DATE >= 0
), pending_draws AS (
  SELECT COUNT(*)::int AS cnt
  FROM draw_requests dr
  WHERE dr.status IN ('requested', 'under_review')
), cash_totals AS (
  SELECT COALESCE(SUM(ca.current_balance), 0)::numeric(18,2) AS current_cash
  FROM cash_accounts ca
)
SELECT
  COALESCE((SELECT SUM(principal_total) FROM active_loans), 0)::numeric(18,2) AS active_exposure_total,
  COALESCE((SELECT COUNT(*) FROM active_loans), 0)::int AS loan_count_active,
  COALESCE((SELECT cnt FROM maturity_30), 0)::int AS upcoming_maturities_within_30_days,
  COALESCE((SELECT cnt FROM pending_draws), 0)::int AS pending_draw_requests,
  COALESCE((SELECT current_cash FROM cash_totals), 0)::numeric(18,2) AS current_cash,
  COALESCE((
    SELECT SUM(COALESCE(total_cash_currently_needed, upfront_cash_required, 0))
    FROM upcoming_loans
  ), 0)::numeric(18,2) AS total_upcoming_cash_needed;

CREATE OR REPLACE VIEW report_active_exposure AS
SELECT
  l.id,
  b.legal_name AS borrower,
  p.full_address AS property,
  p.state,
  COALESCE(p.market_name, 'Unmapped') AS market_name,
  l.loan_type,
  l.loan_status,
  l.principal_total,
  l.arv,
  l.ltv,
  l.rehab_amount,
  l.draw_reserve,
  l.maturity_date,
  CASE
    WHEN l.maturity_date IS NULL THEN NULL
    ELSE (l.maturity_date::date - CURRENT_DATE)
  END AS days_to_maturity
FROM loans l
LEFT JOIN borrowers b ON b.id = l.borrower_id
LEFT JOIN properties p ON p.id = l.property_id
WHERE l.loan_stage = 'active'
  AND l.loan_status IN ('active', 'funded')
ORDER BY l.maturity_date NULLS LAST, b.legal_name;

CREATE OR REPLACE VIEW report_exposure_by_state AS
SELECT
  COALESCE(p.state, 'Unknown') AS state,
  COUNT(*)::int AS active_loan_count,
  COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS total_exposure,
  AVG(l.ltv)::numeric(12,6) AS average_ltv
FROM loans l
LEFT JOIN properties p ON p.id = l.property_id
WHERE l.loan_stage = 'active'
  AND l.loan_status IN ('active', 'funded')
GROUP BY COALESCE(p.state, 'Unknown')
ORDER BY total_exposure DESC;

CREATE OR REPLACE VIEW report_exposure_by_market AS
SELECT
  COALESCE(p.market_name, 'Unmapped') AS market_name,
  COUNT(*)::int AS active_loan_count,
  COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS total_exposure
FROM loans l
LEFT JOIN properties p ON p.id = l.property_id
WHERE l.loan_stage = 'active'
  AND l.loan_status IN ('active', 'funded')
GROUP BY COALESCE(p.market_name, 'Unmapped')
ORDER BY total_exposure DESC;

CREATE OR REPLACE VIEW report_loan_type_summary AS
SELECT
  COALESCE(l.loan_type, 'Unknown') AS loan_type,
  COUNT(*)::int AS active_count,
  COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS active_principal_total
FROM loans l
WHERE l.loan_stage = 'active'
  AND l.loan_status IN ('active', 'funded')
GROUP BY COALESCE(l.loan_type, 'Unknown')
ORDER BY active_principal_total DESC;

CREATE OR REPLACE VIEW report_upcoming_loans AS
SELECT
  l.id,
  b.legal_name AS borrower,
  p.full_address AS property,
  l.origination_date AS target_funding_date,
  l.principal_total AS total_loan,
  l.draw_reserve,
  COALESCE(l.total_cash_currently_needed, l.upfront_cash_required, 0)::numeric(18,2) AS cash_needed_now,
  l.title_company
FROM loans l
LEFT JOIN borrowers b ON b.id = l.borrower_id
LEFT JOIN properties p ON p.id = l.property_id
WHERE l.loan_stage = 'upcoming'
ORDER BY l.origination_date NULLS LAST, b.legal_name;

CREATE OR REPLACE VIEW report_closed_projects_by_year AS
SELECT
  closed_year AS year,
  COUNT(*)::int AS count,
  COALESCE(SUM(principal), 0)::numeric(18,2) AS principal_total,
  AVG(years_outstanding)::numeric(10,4) AS average_hold_years
FROM annual_loan_history
GROUP BY closed_year
ORDER BY closed_year DESC;

CREATE OR REPLACE VIEW report_1098_prep AS
SELECT
  t.id,
  t.borrower_name AS borrower,
  t.loans_closed_2022_count,
  t.loans_closed_2023_count,
  t.active_or_cashout_count,
  t.total_loan_count,
  t.property_address AS latest_property,
  t.terms_reference AS latest_terms_reference,
  (t.review_flag OR t.source_reference IS NULL OR t.source_reference = '') AS review_flag
FROM tax_1098_prep t
ORDER BY t.borrower_name ASC;
