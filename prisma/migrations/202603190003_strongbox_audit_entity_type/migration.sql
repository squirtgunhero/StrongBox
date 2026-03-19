ALTER TABLE remediation_audits
ADD COLUMN entity_type TEXT;

UPDATE remediation_audits AS ra
SET entity_type = CASE ib.source_sheet_family
  WHEN 'open_applications' THEN 'loans'
  WHEN 'upcoming_loans' THEN 'loans'
  WHEN 'cash_out' THEN 'loans'
  WHEN 'exposure' THEN 'loans'
  WHEN 'closed_projects' THEN 'loans'
  WHEN 'draw_requests' THEN 'draw_requests'
  WHEN 'client_list' THEN 'borrowers'
  WHEN 'markets' THEN 'market_references'
  WHEN 'cash_accounts' THEN 'cash_accounts'
  WHEN 'portfolio_snapshots' THEN 'portfolio_snapshots'
  WHEN 'tax_1098_prep' THEN 'tax_1098_prep'
  ELSE 'import_rows'
END
FROM import_rows AS ir
JOIN import_batches AS ib
  ON ib.id = ir.batch_id
WHERE ra.import_row_id = ir.id;

UPDATE remediation_audits
SET entity_type = 'import_rows'
WHERE entity_type IS NULL;

ALTER TABLE remediation_audits
ALTER COLUMN entity_type SET NOT NULL;

CREATE INDEX remediation_audits_entity_type_idx ON remediation_audits(entity_type);