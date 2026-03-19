CREATE TABLE remediation_audits (
  id TEXT PRIMARY KEY,
  import_row_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  actor_id TEXT,
  note TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT remediation_audits_import_row_id_fkey
    FOREIGN KEY (import_row_id) REFERENCES import_rows(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX remediation_audits_import_row_id_idx ON remediation_audits(import_row_id);
CREATE INDEX remediation_audits_action_type_idx ON remediation_audits(action_type);
CREATE INDEX remediation_audits_created_at_idx ON remediation_audits(created_at);