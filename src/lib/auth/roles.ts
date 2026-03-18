import { UserRole } from "@prisma/client";

export type Permission =
  | "manage_users"
  | "manage_org_settings"
  | "create_loans"
  | "edit_loans"
  | "view_all_loans"
  | "change_loan_status"
  | "approve_deny"
  | "manage_documents"
  | "view_payments"
  | "record_payments"
  | "manage_capital"
  | "approve_draws"
  | "view_reports"
  | "view_audit_log"
  | "investor_portal"
  | "borrower_portal";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "manage_users",
    "manage_org_settings",
    "create_loans",
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "approve_deny",
    "manage_documents",
    "view_payments",
    "record_payments",
    "manage_capital",
    "approve_draws",
    "view_reports",
    "view_audit_log",
  ],
  ADMIN: [
    "manage_users",
    "manage_org_settings",
    "create_loans",
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "approve_deny",
    "manage_documents",
    "view_payments",
    "record_payments",
    "manage_capital",
    "approve_draws",
    "view_reports",
    "view_audit_log",
  ],
  LOAN_OFFICER: [
    "create_loans",
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "manage_documents",
    "view_payments",
    "view_reports",
  ],
  PROCESSOR: [
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "manage_documents",
    "view_payments",
  ],
  UNDERWRITER: [
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "approve_deny",
    "manage_documents",
  ],
  CLOSER: [
    "edit_loans",
    "view_all_loans",
    "change_loan_status",
    "manage_documents",
  ],
  ACCOUNTING: [
    "view_all_loans",
    "view_payments",
    "record_payments",
    "manage_capital",
    "view_reports",
  ],
  BORROWER: ["manage_documents", "view_payments", "borrower_portal"],
  INVESTOR: ["view_reports", "investor_portal"],
  READ_ONLY: ["view_all_loans", "view_payments", "view_reports"],
};

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
