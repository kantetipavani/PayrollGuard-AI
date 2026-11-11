export type PermissionMap = Record<string, boolean>
export interface AccessRole {
  id: string
  name: string
  description: string
  builtin?: boolean
  permissions: PermissionMap
}
export interface PermissionRow {
  id: string
  label: string
  actions: string[]
  extras?: string[]
}
export interface PermissionSection {
  id: string
  label: string
  columns: string[]
  rows: PermissionRow[]
  options?: string[]
  toggle?: boolean
}
const row = (
  id: string,
  label: string,
  actions: string[],
  extras?: string[],
): PermissionRow => ({ id, label, actions, extras })
const crud = ["View", "Create", "Edit", "Delete"]
export const sections: PermissionSection[] = [
  {
    id: "employee",
    label: "Employee",
    toggle: true,
    columns: crud,
    rows: [
      row("basic", "Basic And Personal Details", crud),
      row("salary", "Salary Details", crud),
      row("payment", "Payment Information", crud),
      row("revision", "Salary Revision", crud),
      row("leave", "Leave", crud),
      row("attendance", "Attendance", crud),
      row("perquisites", "Perquisites", crud),
      row("loan-summary", "Loan Summary", crud),
      row("reimbursement-summary", "Reimbursement Summary", crud),
      row("declarations", "Declarations", crud),
    ],
    options: [
      "Provide access to view and download employee Payslips, TDS worksheets and Forms.",
      "Provide access to terminate an employee from the organisation.",
      "Provide access to delete an employee who isn't associated to any Payrun.",
    ],
  },
  {
    id: "payroll",
    label: "Payroll Run",
    toggle: true,
    columns: ["View", "Create", "Edit", "Approve", "Pay"],
    rows: [
      row("run", "Payroll Run", ["View", "Create", "Edit", "Approve", "Pay"]),
    ],
  },
  {
    id: "loan",
    label: "Loan",
    toggle: true,
    columns: ["View", "Create", "Edit", "Approve", "Record Disbursement"],
    rows: [
      row("loan", "Loan", [
        "View",
        "Create",
        "Edit",
        "Approve",
        "Record Disbursement",
      ]),
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    columns: [...crud, "Approve"],
    rows: [row("reimbursements", "Reimbursements", [...crud, "Approve"])],
    options: [
      "Provide access to approve Proof Of Investments.",
      "Provide access to approve Salary Revisions.",
      "Provide access to approve Leave Requests.",
    ],
  },
  {
    id: "documents",
    label: "Documents",
    columns: [...crud, "Others"],
    rows: [
      row("documents", "Documents", crud, [
        "View documents",
        "Upload documents",
        "Edit documents",
        "Delete documents",
      ]),
      row("organization", "Payroll Organisation Document", crud, [
        "Download documents",
      ]),
      row("employee", "Payroll Employee Document", crud, [
        "Download documents",
      ]),
    ],
  },
]
export const settings = [
  "Update organization profile",
  "Work Location",
  "Department",
  "Designation",
  "Manage Users",
  "Taxes",
  "Pay Schedule",
  "Salary and Statutory Components",
  "Email Templates",
  "Salary Templates",
  "Reporting Tags",
  "Automation",
  "Export data",
  "Custom Fields",
  "Leave",
  "Attendance",
  "Bank Accounts",
  "Provide access to protected data",
  "Integration",
  "Incoming Webhook",
]
export const preferences = [
  "Reimbursement and FBP Settings",
  "IT Declaration Settings",
  "Approval Preferences",
]
export const reports = [
  "Payroll Overview",
  "Statutory Reports",
  "Employee/Contractor Reports",
  "Declarations & Investments",
  "Deduction Reports",
  "Taxes and Forms",
  "Loan Reports",
  "Payroll Journal",
  "Activity",
  "Automation",
]
export const reportActions = ["View", "Export", "Schedule", "Share"]
export const rowKeys = (section: string, r: PermissionRow) => [
  ...r.actions.map((a) => `${section}.${r.id}.${a}`),
  ...(r.extras || []).map((_, i) => `${section}.${r.id}.extra.${i}`),
]
export const sectionKeys = (s: PermissionSection) => [
  ...s.rows.flatMap((r) => rowKeys(s.id, r)),
  ...(s.options || []).map((_, i) => `${s.id}.option.${i}`),
]
export const reportKeys = (group: string) =>
  reportActions.map((a) => `reports.${group}.${a}`)
export const allKeys = [
  ...sections.flatMap(sectionKeys),
  ...settings.map((_, i) => `settings.${i}`),
  ...preferences.map((_, i) => `preferences.${i}`),
  ...reports.flatMap(reportKeys),
]
export function setPermissions(
  current: PermissionMap,
  keys: string[],
  value: boolean,
): PermissionMap {
  const next = { ...current }
  keys.forEach((k) => {
    next[k] = value
  })
  // An action requires read access. Clearing read access revokes its dependent actions.
  for (const s of sections)
    for (const r of s.rows) {
      if (!r.actions.includes("View")) continue
      const view = `${s.id}.${r.id}.View`
      const actions = rowKeys(s.id, r)
      if (!value && keys.includes(view))
        actions.forEach((k) => {
          next[k] = false
        })
      else if (actions.some((k) => next[k])) next[view] = true
    }
  for (const group of reports) {
    const view = `reports.${group}.View`
    if (!value && keys.includes(view))
      reportKeys(group).forEach((k) => {
        next[k] = false
      })
    else if (reportKeys(group).some((k) => next[k])) next[view] = true
  }
  return next
}
export function defaultRoles(): AccessRole[] {
  const all = Object.fromEntries(allKeys.map((k) => [k, true]))
  return [
    {
      id: "admin",
      name: "Admin",
      description: "Unrestricted access to all modules.",
      builtin: true,
      permissions: all,
    },
    {
      id: "manager",
      name: "Manager",
      description: "Access to all modules except organisation settings.",
      builtin: true,
      permissions: Object.fromEntries(
        allKeys.map((k) => [k, !k.startsWith("settings.")]),
      ),
    },
    {
      id: "reviewer",
      name: "Reimbursements and POI Reviewer",
      description: "View and approve reimbursements and proof of investments.",
      builtin: true,
      permissions: {
        "approvals.reimbursements.View": true,
        "approvals.reimbursements.Approve": true,
        "approvals.option.0": true,
      },
    },
  ]
}
export const ROLE_STORAGE = "naxpayroll.access.roles.v1"
export const USER_STORAGE = "naxpayroll.access.users.v1"
export function loadRoles(): AccessRole[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(ROLE_STORAGE) || "[]",
    )
    if (Array.isArray(saved))
      return [
        ...defaultRoles(),
        ...saved.filter(
          (r): r is AccessRole =>
            r &&
            typeof r.id === "string" &&
            !["admin", "manager", "reviewer"].includes(r.id) &&
            !r.builtin &&
            typeof r.name === "string" &&
            typeof r.description === "string" &&
            r.permissions &&
            typeof r.permissions === "object",
        ),
      ]
  } catch {
    /* Use the built-in roles if browser storage is unavailable. */
  }
  return defaultRoles()
}
