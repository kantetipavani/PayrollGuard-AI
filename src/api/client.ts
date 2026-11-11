// API Client connecting Frontend with FastAPI Backend

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1"

export function getAuthToken(): string | null {
  return localStorage.getItem("naxpayroll_token")
}

export function setAuthToken(token: string): void {
  localStorage.setItem("naxpayroll_token", token)
}

export function removeAuthToken(): void {
  localStorage.removeItem("naxpayroll_token")
  localStorage.removeItem("naxpayroll_user")
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`
    try {
      const errorJson = await response.json()
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === "string" ? errorJson.detail : JSON.stringify(errorJson.detail)
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail)
  }

  return response.json() as Promise<T>
}

// Normalizers to guarantee 100% camelCase compatibility with Frontend components
export function normalizeEmployee(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || raw.employee_id || "",
    name:
      raw.name ||
      `${raw.first_name || ""} ${raw.last_name || ""}`.trim() ||
      raw.employee_id ||
      "",
    email: raw.email || "",
    department: raw.department || "Engineering",
    designation: raw.designation || "Software Engineer",
    doj: raw.doj || "2026-01-01",
    empType: raw.empType || raw.emp_type || "Full-Time",
    manager: raw.manager || "-",
    location: raw.location || "Bangalore",
    mobile: raw.mobile || "",
    status:
      raw.status ||
      (raw.employment_status === "ACTIVE"
        ? "Active"
        : raw.employment_status
        ? raw.employment_status.charAt(0).toUpperCase() + raw.employment_status.slice(1).toLowerCase()
        : "Active"),
    salaryStructure: raw.salaryStructure || raw.salary_structure || "Junior Engineer",
    grossSalary: Number(raw.grossSalary ?? raw.gross_salary ?? raw.monthly_salary ?? 0),
    pan: raw.pan || raw.tax_identifier || "",
    uan: raw.uan || "",
    bankName: raw.bankName || raw.bank_name || "HDFC Bank",
    accountNumber: raw.accountNumber || raw.account_number || raw.bank_account_token || "",
    ifscCode: raw.ifscCode || raw.ifsc_code || "HDFC0001234",
  }
}

export function normalizeSalaryStructure(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || "",
    name: raw.name || "",
    basic: Number(raw.basic ?? 0),
    hra: Number(raw.hra ?? 0),
    fixedAllowance: Number(raw.fixedAllowance ?? raw.fixed_allowance ?? 0),
    specialAllowance: Number(raw.specialAllowance ?? raw.special_allowance ?? 0),
    gross: Number(raw.gross ?? 0),
    active: raw.active ?? true,
  }
}

export function normalizePayrunInputRow(raw: any): any {
  if (!raw) return raw
  return {
    empId: raw.empId || raw.emp_id || "",
    empName: raw.empName || raw.emp_name || "",
    department: raw.department || "",
    grossSalary: Number(raw.grossSalary ?? raw.gross_salary ?? 0),
    bonus: Number(raw.bonus ?? 0),
    incentive: Number(raw.incentive ?? 0),
    lopDays: Number(raw.lopDays ?? raw.lop_days ?? 0),
    lopDeduction: Number(raw.lopDeduction ?? raw.lop_deduction ?? 0),
    otherDeduction: Number(raw.otherDeduction ?? raw.other_deduction ?? 0),
    pf: Number(raw.pf ?? 0),
    esi: Number(raw.esi ?? 0),
    tds: Number(raw.tds ?? 0),
    profTax: Number(raw.profTax ?? raw.prof_tax ?? 0),
    totalEarnings: Number(raw.totalEarnings ?? raw.total_earnings ?? 0),
    totalDeductions: Number(raw.totalDeductions ?? raw.total_deductions ?? 0),
    netSalary: Number(raw.netSalary ?? raw.net_salary ?? 0),
  }
}

export function normalizePayrun(raw: any): any {
  if (!raw) return raw
  const rows = Array.isArray(raw.rows) ? raw.rows.map(normalizePayrunInputRow) : []
  return {
    id: raw.id || "",
    period: raw.period || "",
    month: Number(raw.month ?? 1),
    year: Number(raw.year ?? 2026),
    status: raw.status || "Draft",
    scope: raw.scope || "All Employees",
    employeeIds: raw.employeeIds || raw.employee_ids || [],
    note: raw.note || "",
    totalEmployees: Number(raw.totalEmployees ?? raw.total_employees ?? rows.length),
    grossPayroll: Number(raw.grossPayroll ?? raw.gross_payroll ?? 0),
    totalDeductions: Number(raw.totalDeductions ?? raw.total_deductions ?? 0),
    netPayroll: Number(raw.netPayroll ?? raw.net_payroll ?? 0),
    generatedBy: raw.generatedBy || raw.generated_by || "Meena Iyer",
    generatedOn: raw.generatedOn || raw.generated_on || "2026-08-28",
    payrunType: raw.payrunType || raw.payrun_type || "Regular",
    oneTimeComponent: raw.oneTimeComponent || raw.one_time_component || "",
    paymentDate: raw.paymentDate || raw.payment_date || "",
    rows,
  }
}

export function normalizeOrganization(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || "",
    name: raw.name || "",
    code: raw.code || "",
    legalName: raw.legalName || raw.legal_name || raw.name || "",
    country: raw.country || "India",
    currency: raw.currency || "INR",
    financialYear: raw.financialYear || raw.financial_year || "April-March",
    status: raw.status || "Active",
    employees: Number(raw.employees ?? 0),
    admin: raw.admin || "Meena Iyer",
    adminEmail: raw.adminEmail || raw.admin_email || "",
  }
}

export function normalizeOrgDocument(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || "",
    title: raw.title || "",
    category: raw.category || "Policy",
    assignedTo: raw.assignedTo || raw.assigned_to || "All Employees",
    assignedCount: Number(raw.assignedCount ?? raw.assigned_count ?? 9),
    owner: raw.owner || "Meena Iyer",
    createdOn: raw.createdOn || raw.created_on || "2026-08-01",
    status: raw.status || "Published",
    description: raw.description || "",
    fileName: raw.fileName || raw.file_name || "",
  }
}

export function normalizeAuditLog(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || "",
    user: raw.user || "",
    org: raw.org || "Naxrita Solutions",
    action: raw.action || "",
    module: raw.module || "",
    oldValue: raw.oldValue || raw.old_value || "-",
    newValue: raw.newValue || raw.new_value || "-",
    timestamp: raw.timestamp || "",
  }
}

export function normalizeErrorLog(raw: any): any {
  if (!raw) return raw
  return {
    id: raw.id || "",
    timestamp: raw.timestamp || "",
    role: raw.role || "org_admin",
    user: raw.user || "",
    module: raw.module || "",
    severity: raw.severity || "Medium",
    issue: raw.issue || "",
    route: raw.route || "/",
    status: raw.status || "Open",
  }
}

// Complete API Client API Services
export const apiClient = {
  auth: {
    login: async (credentials: { email: string; password: string; persona: string; remember_me?: boolean }) => {
      const res = await request<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      })
      if (res.access_token) {
        setAuthToken(res.access_token)
        localStorage.setItem("naxpayroll_user", JSON.stringify(res.user))
      }
      return res
    },
    getMe: () => request<any>("/auth/me"),
    changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
      request<any>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
    resetPassword: (email: string) =>
      request<any>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email }) }),
    toggleMfa: (enabled: boolean) =>
      request<any>("/auth/mfa-toggle", { method: "POST", body: JSON.stringify({ enabled }) }),
  },

  dashboard: {
    getOrgDashboard: () => request<any>("/dashboard/org-admin"),
    getPlatformDashboard: () => request<any>("/dashboard/platform-admin"),
    getEmployeeDashboard: () => request<any>("/dashboard/employee"),
  },

  employees: {
    getAll: async (params?: { department?: string; status_filter?: string; search?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.department) searchParams.append("department", params.department)
      if (params?.status_filter) searchParams.append("status_filter", params.status_filter)
      if (params?.search) searchParams.append("search", params.search)
      const q = searchParams.toString() ? `?${searchParams.toString()}` : ""
      const list = await request<any[]>(`/employees${q}`)
      return Array.isArray(list) ? list.map(normalizeEmployee) : []
    },
    getById: async (id: string) => {
      const emp = await request<any>(`/employees/${id}`)
      return normalizeEmployee(emp)
    },
    create: async (data: any) => {
      const payload = {
        name: data.name,
        email: data.email,
        department: data.department,
        designation: data.designation,
        doj: data.doj,
        emp_type: data.empType || data.emp_type,
        manager: data.manager,
        location: data.location,
        mobile: data.mobile,
        status: data.status || "Active",
        salary_structure: data.salaryStructure || data.salary_structure,
        gross_salary: data.grossSalary || data.gross_salary,
        pan: data.pan,
        uan: data.uan,
        bank_name: data.bankName || data.bank_name,
        account_number: data.accountNumber || data.account_number,
        ifsc_code: data.ifscCode || data.ifsc_code,
      }
      const created = await request<any>("/employees", { method: "POST", body: JSON.stringify(payload) })
      return normalizeEmployee(created)
    },
    update: async (id: string, data: any) => {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.email !== undefined) payload.email = data.email
      if (data.department !== undefined) payload.department = data.department
      if (data.designation !== undefined) payload.designation = data.designation
      if (data.doj !== undefined) payload.doj = data.doj
      if (data.empType !== undefined || data.emp_type !== undefined) payload.emp_type = data.empType ?? data.emp_type
      if (data.manager !== undefined) payload.manager = data.manager
      if (data.location !== undefined) payload.location = data.location
      if (data.mobile !== undefined) payload.mobile = data.mobile
      if (data.status !== undefined) payload.status = data.status
      if (data.salaryStructure !== undefined || data.salary_structure !== undefined)
        payload.salary_structure = data.salaryStructure ?? data.salary_structure
      if (data.grossSalary !== undefined || data.gross_salary !== undefined)
        payload.gross_salary = data.grossSalary ?? data.gross_salary

      const updated = await request<any>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(payload) })
      return normalizeEmployee(updated)
    },
    delete: (id: string) => request<any>(`/employees/${id}`, { method: "DELETE" }),
  },

  salary: {
    getStructures: async () => {
      const list = await request<any[]>("/salary/structures")
      return Array.isArray(list) ? list.map(normalizeSalaryStructure) : []
    },
    createStructure: async (data: any) => {
      const payload = {
        name: data.name,
        basic: Number(data.basic),
        hra: Number(data.hra),
        fixed_allowance: Number(data.fixedAllowance ?? data.fixed_allowance ?? 0),
        special_allowance: Number(data.specialAllowance ?? data.special_allowance ?? 0),
        gross: Number(data.gross),
        active: data.active ?? true,
      }
      const created = await request<any>("/salary/structures", { method: "POST", body: JSON.stringify(payload) })
      return normalizeSalaryStructure(created)
    },
    updateStructure: async (id: string, data: any) => {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.basic !== undefined) payload.basic = Number(data.basic)
      if (data.hra !== undefined) payload.hra = Number(data.hra)
      if (data.fixedAllowance !== undefined || data.fixed_allowance !== undefined)
        payload.fixed_allowance = Number(data.fixedAllowance ?? data.fixed_allowance)
      if (data.specialAllowance !== undefined || data.special_allowance !== undefined)
        payload.special_allowance = Number(data.specialAllowance ?? data.special_allowance)
      if (data.gross !== undefined) payload.gross = Number(data.gross)
      if (data.active !== undefined) payload.active = data.active

      const updated = await request<any>(`/salary/structures/${id}`, { method: "PUT", body: JSON.stringify(payload) })
      return normalizeSalaryStructure(updated)
    },
    deleteStructure: (id: string) => request<any>(`/salary/structures/${id}`, { method: "DELETE" }),
    getComponents: () => request<any[]>("/salary/components"),
    assign: (empIds: string[], salaryStructure: string) =>
      request<any>("/salary/assign", { method: "POST", body: JSON.stringify({ emp_ids: empIds, salary_structure: salaryStructure }) }),
  },

  payruns: {
    getAll: async () => {
      const list = await request<any[]>("/payruns")
      return Array.isArray(list) ? list.map(normalizePayrun) : []
    },
    getById: async (id: string) => {
      const pr = await request<any>(`/payruns/${id}`)
      return normalizePayrun(pr)
    },
    create: async (data: {
      month: number
      year: number
      scope?: string
      employee_ids?: string[]
      note?: string
      bonus?: Record<string, number>
      lop?: Record<string, number>
      payrun_type?: string
      one_time_component?: string
      payment_date?: string
      period?: string
    }) => {
      const pr = await request<any>("/payruns", { method: "POST", body: JSON.stringify(data) })
      return normalizePayrun(pr)
    },
    updateStatus: async (id: string, newStatus: string) => {
      // Backend uses PUT /payruns/{id} with a status field in body
      const pr = await request<any>(`/payruns/${id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) })
      return normalizePayrun(pr)
    },
    updateRow: async (payrunId: string, empId: string, rowData: Record<string, any>) => {
      // Backend uses PUT /payruns/{payrun_id}/rows/{emp_id}
      const res = await request<any>(`/payruns/${payrunId}/rows/${empId}`, {
        method: "PUT",
        body: JSON.stringify(rowData),
      })
      return res
    },
    delete: (id: string) => request<any>(`/payruns/${id}`, { method: "DELETE" }),
  },

  payslips: {
    getMyPayslips: () => request<any[]>("/payslips/my-payslips"),
    getDetail: (payrunId: string, empId: string) => request<any>(`/payslips/${payrunId}/${empId}`),
    sendEmail: (payrunId: string, empId: string) => request<any>(`/payslips/${payrunId}/${empId}/send-email`, { method: "POST" }),
  },

  organizations: {
    getAll: async () => {
      const list = await request<any[]>("/organizations")
      return Array.isArray(list) ? list.map(normalizeOrganization) : []
    },
    create: async (data: any) => {
      const payload = {
        name: data.name,
        code: data.code,
        legal_name: data.legalName || data.legal_name || data.name,
        country: data.country || "India",
        currency: data.currency || "INR",
        financial_year: data.financialYear || data.financial_year || "April-March",
        status: data.status || "Active",
        employees: Number(data.employees ?? 0),
        admin: data.admin || "Meena Iyer",
        admin_email: data.adminEmail || data.admin_email,
      }
      const created = await request<any>("/organizations", { method: "POST", body: JSON.stringify(payload) })
      return normalizeOrganization(created)
    },
    update: async (id: string, data: any) => {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.code !== undefined) payload.code = data.code
      if (data.legalName !== undefined || data.legal_name !== undefined)
        payload.legal_name = data.legalName ?? data.legal_name
      if (data.country !== undefined) payload.country = data.country
      if (data.currency !== undefined) payload.currency = data.currency
      if (data.financialYear !== undefined || data.financial_year !== undefined)
        payload.financial_year = data.financialYear ?? data.financial_year
      if (data.status !== undefined) payload.status = data.status
      if (data.employees !== undefined) payload.employees = Number(data.employees)
      if (data.admin !== undefined) payload.admin = data.admin
      if (data.adminEmail !== undefined || data.admin_email !== undefined)
        payload.admin_email = data.adminEmail ?? data.admin_email

      const updated = await request<any>(`/organizations/${id}`, { method: "PUT", body: JSON.stringify(payload) })
      return normalizeOrganization(updated)
    },
    delete: (id: string) => request<any>(`/organizations/${id}`, { method: "DELETE" }),
  },

  documents: {
    getAll: async () => {
      const list = await request<any[]>("/documents")
      return Array.isArray(list) ? list.map(normalizeOrgDocument) : []
    },
    getMyDocuments: async () => {
      const list = await request<any[]>("/documents/my-documents")
      return Array.isArray(list) ? list.map(normalizeOrgDocument) : []
    },
    create: async (data: any) => {
      const payload = {
        title: data.title,
        category: data.category || "Policy",
        assigned_to: data.assignedTo || data.assigned_to || "All Employees",
        assigned_count: Number(data.assignedCount ?? data.assigned_count ?? 9),
        status: data.status || "Published",
        description: data.description || "",
        file_name: data.fileName || data.file_name,
      }
      const created = await request<any>("/documents", { method: "POST", body: JSON.stringify(payload) })
      return normalizeOrgDocument(created)
    },
    update: async (id: string, data: any) => {
      const payload: any = {}
      if (data.title !== undefined) payload.title = data.title
      if (data.category !== undefined) payload.category = data.category
      if (data.assignedTo !== undefined || data.assigned_to !== undefined)
        payload.assigned_to = data.assignedTo ?? data.assigned_to
      if (data.assignedCount !== undefined || data.assigned_count !== undefined)
        payload.assigned_count = Number(data.assignedCount ?? data.assigned_count)
      if (data.status !== undefined) payload.status = data.status
      if (data.description !== undefined) payload.description = data.description
      if (data.fileName !== undefined || data.file_name !== undefined)
        payload.file_name = data.fileName ?? data.file_name

      const updated = await request<any>(`/documents/${id}`, { method: "PUT", body: JSON.stringify(payload) })
      return normalizeOrgDocument(updated)
    },
    delete: (id: string) => request<any>(`/documents/${id}`, { method: "DELETE" }),
  },

  reports: {
    getSummary: () => request<any>("/reports"),
  },

  access: {
    getUsers: () => request<any[]>("/access/users"),
    updateUser: (id: string, data: { role?: string; status?: string; mfa?: boolean }) =>
      request<any>(`/access/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    getPlatformAdmins: () => request<any[]>("/access/platform-admins"),
    createPlatformAdmin: (data: any) =>
      request<any>("/access/platform-admins", { method: "POST", body: JSON.stringify(data) }),
    updatePlatformAdmin: (id: string, data: any) =>
      request<any>(`/access/platform-admins/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deletePlatformAdmin: (id: string) =>
      request<any>(`/access/platform-admins/${id}`, { method: "DELETE" }),
  },

  audit: {
    getLogs: async () => {
      const list = await request<any[]>("/audit/logs")
      return Array.isArray(list) ? list.map(normalizeAuditLog) : []
    },
    createLog: (data: any) => request<any>("/audit/logs", { method: "POST", body: JSON.stringify(data) }),
    getErrorLogs: async () => {
      const list = await request<any[]>("/audit/error-logs")
      return Array.isArray(list) ? list.map(normalizeErrorLog) : []
    },
    updateErrorLog: (id: string, data: { status?: string; severity?: string }) =>
      request<any>(`/audit/error-logs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  financial: {
    getDeclaration: (empId?: string) => request<any>(`/financial/declaration${empId ? `?emp_id=${empId}` : ""}`),
    updateDeclaration: (data: any, empId?: string) =>
      request<any>(`/financial/declaration${empId ? `?emp_id=${empId}` : ""}`, { method: "PUT", body: JSON.stringify(data) }),
    getComputation: (empId?: string) => request<any>(`/financial/computation${empId ? `?emp_id=${empId}` : ""}`),
  },

  profile: {
    getAdmin: (persona: string) => request<any>(`/profile/admin/${persona}`),
    updateAdmin: (persona: string, data: any) =>
      request<any>(`/profile/admin/${persona}`, { method: "PUT", body: JSON.stringify(data) }),
    getPreferences: (persona: string) => request<any>(`/profile/preferences?persona=${persona}`),
    updatePreferences: (preferences: any, persona: string) =>
      request<any>(`/profile/preferences?persona=${persona}`, { method: "PUT", body: JSON.stringify({ preferences }) }),
  },

  roles: {
    getAll: (persona?: string) => request<any[]>(`/roles${persona ? `?persona=${persona}` : ""}`),
    getById: (id: string) => request<any>(`/roles/${id}`),
    create: (data: any) => request<any>("/roles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/roles/${id}`, { method: "DELETE" }),
    getPermissionsCatalog: (module?: string) => request<any[]>(`/roles/permissions/catalog${module ? `?module=${module}` : ""}`),
    assign: (userId: string, roleId: string) =>
      request<any>("/roles/assign", { method: "POST", body: JSON.stringify({ user_id: userId, role_id: roleId }) }),
  },
}

export default apiClient
