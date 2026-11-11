import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { AccessRole } from "./access-permissions"
import "./access-users.css"

export interface AccessUser {
  id: string
  name: string
  email: string
  role: string
  status: "Active" | "Locked"
  department?: string
  scope?: string
  isOrganizationAdmin?: boolean
}

type UserDraft = Pick<AccessUser, "name" | "email" | "role">

interface UserFilterOption {
  value: string
  label: string
}

function AccessIcon({
  name,
  size = 16,
}: {
  name: "more" | "close" | "mail" | "shield" | "userPlus" | "preview" | "lock" | "unlock" | "search" | "chevronDown"
  size?: number
}) {
  const paths = {
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    close: <path d="m7 7 10 10M17 7 7 17" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Zm-3 9 2 2 4-5" />,
    userPlus: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21a7 7 0 0 1 14 0M19 8v6m-3-3h6" />
      </>
    ),
    preview: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    unlock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M16 10V7a4 4 0 0 0-7.6-1.7" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function AdminIllustration() {
  return (
    <svg
      viewBox="0 0 180 104"
      role="img"
      aria-label="Organization administrator access"
    >
      <rect width="180" height="104" rx="10" fill="#d9ecff" />
      <circle
        cx="90"
        cy="42"
        r="39"
        fill="none"
        stroke="#8bc4ff"
        strokeWidth="2"
      />
      <circle
        cx="90"
        cy="42"
        r="27"
        fill="none"
        stroke="#a9d4ff"
        strokeWidth="2"
      />
      <path
        d="M90 13 76 19v10c0 10 6 17 14 21 8-4 14-11 14-21V19Z"
        fill="#0875e1"
      />
      <path
        d="m83 31 5 4 9-11"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="66" r="12" fill="white" />
      <path d="M66 104c1-21 10-31 24-31s23 10 24 31" fill="#0875e1" />
      <circle cx="55" cy="72" r="9" fill="white" />
      <path d="M38 104c1-15 7-23 17-23 8 0 14 5 16 15" fill="#76b4fb" />
      <circle cx="125" cy="72" r="9" fill="white" />
      <path d="M109 96c2-10 8-15 16-15 10 0 16 8 17 23" fill="#76b4fb" />
    </svg>
  )
}

function roleLabel(role: string) {
  return role === "Org Admin" ? "Admin" : role
}

function roleDescription(role: string, roles: AccessRole[]) {
  if (role === "Org Admin")
    return "Unrestricted access to all organization modules."
  if (role === "Employee")
    return "Access to employee self-service information and actions."
  return (
    roles.find((item) => item.name === role)?.description ||
    "Custom access based on the selected role permissions."
  )
}

function UserSearch({ users, value, onChange }: {
  users: AccessUser[]
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = useMemo(() => {
    const values = new Map<string, { value: string; kind: string }>()
    for (const user of users) {
      for (const [kind, text] of [["Name", user.name], ["Email", user.email], ["Department", user.department], ["Role", roleLabel(user.role)]]) {
        if (text && text.toLowerCase().includes(value.trim().toLowerCase())) {
          values.set(`${kind}:${text}`, { value: text, kind: kind! })
        }
      }
    }
    return Array.from(values.values()).slice(0, 30)
  }, [users, value])
  const selectedIndex = active < suggestions.length ? active : -1
  const select = (text: string) => {
    onChange(text)
    setOpen(false)
    setActive(-1)
    input.current?.focus()
  }
  useEffect(() => {
    if (open && selectedIndex >= 0) {
      document.getElementById(`${id}-option-${selectedIndex}`)?.scrollIntoView({ block: "nearest" })
    }
  }, [id, open, selectedIndex])
  return (
    <div className="access-user-search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
    }}>
      <label htmlFor={id}>Search users</label>
      <div className="access-search-control">
        <AccessIcon name="search" size={17} />
        <input ref={input} id={id} type="search" role="combobox" autoComplete="off"
          aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
          aria-activedescendant={open && selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : undefined}
          aria-keyshortcuts="F4" value={value}
          placeholder="Name, email, department or role…"
          onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1) }}
          onKeyDown={(event) => {
            if (event.key === "F4") { event.preventDefault(); setOpen(!open); setActive(-1) }
            else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1) }
            else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setOpen(true)
              if (suggestions.length) setActive(event.key === "ArrowDown"
                ? (selectedIndex + 1) % suggestions.length
                : (selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1))
            } else if (event.key === "Enter" && open) {
              event.preventDefault()
              if (selectedIndex >= 0) select(suggestions[selectedIndex].value)
              else setOpen(false)
            }
          }} />
        {value && <button type="button" aria-label="Clear user search" onClick={() => {
          onChange(""); setActive(-1); input.current?.focus()
        }}><AccessIcon name="close" size={15} /></button>}
        <button type="button" className="access-value-help" aria-label="Show search suggestions"
          title="Show suggestions" aria-expanded={open} aria-controls={`${id}-list`}
          onClick={() => { setOpen(!open); setActive(-1); input.current?.focus() }}>
          <AccessIcon name="chevronDown" size={15} />
        </button>
      </div>
      {open && <section className="access-search-suggestions">
        <header>Suggested values <span>↑ ↓ to browse · Enter to select</span></header>
        <div id={`${id}-list`} role="listbox" aria-label="Search suggestions">
          {suggestions.map((suggestion, index) => <button type="button" role="option"
            id={`${id}-option-${index}`} key={`${suggestion.kind}:${suggestion.value}`}
            aria-selected={selectedIndex === index} tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(suggestion.value)}>
            <span>{suggestion.value}</span><small>{suggestion.kind}</small>
          </button>)}
          {!suggestions.length && <p role="status">No matching suggestions. Try another search or clear the filters.</p>}
        </div>
      </section>}
    </div>
  )
}

function UserFilterPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: UserFilterOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div
      className="access-filter-picker"
      ref={root}
      onKeyDown={(event) => {
        const trigger = root.current?.querySelector<HTMLButtonElement>(":scope > button")
        if (event.key === "F4" || event.key === "Escape") {
          event.preventDefault()
          setOpen(event.key === "F4" ? !open : false)
          setQuery("")
          if (open) trigger?.focus()
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          if (!open) { setOpen(true); return }
          const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || [])
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1)
          items[next]?.focus()
        }
      }}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node)) {
          setOpen(false)
          setQuery("")
        }
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${label}: ${selected?.label || value}`}
        aria-keyshortcuts="F4"
        title={`${label} suggestions`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || value}</span>
        <AccessIcon name="chevronDown" size={15} />
      </button>
      {open && (
        <div className="access-filter-options">
          <label>
            <AccessIcon name="search" size={15} />
            <input
              autoFocus
              type="search"
              aria-label={`Search ${label.toLowerCase()}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
            />
          </label>
          <div role="listbox" aria-label={label}>
            {filtered.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "is-selected" : ""}
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  root.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus()
                  setOpen(false)
                  setQuery("")
                }}
              >
                {option.label}
                {option.value === value && <span>Selected</span>}
              </button>
            ))}
            {filtered.length === 0 && <p>No matching values</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccessUsers({
  users,
  roles,
  roleOptions,
  roleScope,
  onChange,
  notify,
}: {
  users: AccessUser[]
  roles: AccessRole[]
  roleOptions: string[]
  roleScope: (role: string) => string
  onChange: (users: AccessUser[]) => void
  notify: (
    message: string,
    type?: "success" | "error" | "info" | "warning",
  ) => void
}) {
  const [mode, setMode] = useState<"list" | "invite" | "edit">("list")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<UserDraft>({
    name: "",
    email: "",
    role: "Employee",
  })
  const [errors, setErrors] =
    useState<Partial<Record<keyof UserDraft, string>>>({})
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminCandidate, setAdminCandidate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("All Roles")
  const [statusFilter, setStatusFilter] = useState("All Statuses")
  const previewDialog = useRef<HTMLDialogElement>(null)
  const adminDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (previewOpen) previewDialog.current?.showModal()
    else previewDialog.current?.close()
  }, [previewOpen])

  useEffect(() => {
    if (adminOpen) adminDialog.current?.showModal()
    else adminDialog.current?.close()
  }, [adminOpen])

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null)
    document.addEventListener("click", closeMenu)
    return () => document.removeEventListener("click", closeMenu)
  }, [])

  const activeAdmin = users.find((user) => user.isOrganizationAdmin)
  const eligibleAdmins = users.filter(
    (user) => user.status === "Active" && user.role === "Org Admin",
  )
  const editingUser = users.find((user) => user.id === editingId)
  const sortedUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return users
      .filter(
        (user) =>
          (!normalizedQuery ||
            [user.name, user.email, user.department, roleLabel(user.role)]
              .filter(Boolean)
              .some((item) => item!.toLowerCase().includes(normalizedQuery))) &&
          (roleFilter === "All Roles" || user.role === roleFilter) &&
          (statusFilter === "All Statuses" || user.status === statusFilter),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.isOrganizationAdmin)) -
            Number(Boolean(a.isOrganizationAdmin)) ||
          a.name.localeCompare(b.name),
      )
  }, [roleFilter, searchQuery, statusFilter, users])
  const filtersActive =
    Boolean(searchQuery.trim()) ||
    roleFilter !== "All Roles" ||
    statusFilter !== "All Statuses"
  const clearFilters = () => {
    setSearchQuery("")
    setRoleFilter("All Roles")
    setStatusFilter("All Statuses")
  }

  const startInvite = () => {
    setDraft({ name: "", email: "", role: "Employee" })
    setErrors({})
    setEditingId(null)
    setMode("invite")
  }

  const startEdit = (user: AccessUser) => {
    setDraft({ name: user.name, email: user.email, role: user.role })
    setErrors({})
    setEditingId(user.id)
    setOpenMenu(null)
    setMode("edit")
  }

  const validate = () => {
    const next: Partial<Record<keyof UserDraft, string>> = {}
    if (!draft.name.trim()) next.name = "Enter the user's name."
    if (!draft.email.trim()) next.email = "Enter an email address."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
      next.email = "Enter a valid email address."
    if (!draft.role) next.role = "Select a role."
    const duplicate = users.find(
      (user) =>
        user.id !== editingId &&
        user.email.toLowerCase() === draft.email.trim().toLowerCase(),
    )
    if (duplicate) next.email = "A user with this email address already exists."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = () => {
    if (!validate()) return
    const clean = {
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      role: draft.role,
    }
    if (mode === "edit" && editingUser) {
      onChange(
        users.map((user) =>
          user.id === editingUser.id
            ? { ...user, ...clean, scope: roleScope(clean.role) }
            : user,
        ),
      )
      notify("User updated successfully", "success")
    } else {
      onChange([
        ...users,
        {
          id: crypto.randomUUID(),
          ...clean,
          status: "Active",
          scope: roleScope(clean.role),
        },
      ])
      notify(`Invitation sent to ${clean.email}`, "success")
    }
    setMode("list")
    setEditingId(null)
  }

  const toggleStatus = (user: AccessUser) => {
    const status = user.status === "Active" ? "Locked" : "Active"
    onChange(
      users.map((item) => (item.id === user.id ? { ...item, status } : item)),
    )
    setOpenMenu(null)
    notify(`${user.name}'s account is now ${status.toLowerCase()}.`, "success")
  }

  const assignAdmin = () => {
    if (!adminCandidate) return
    onChange(
      users.map((user) => ({
        ...user,
        isOrganizationAdmin: user.id === adminCandidate,
      })),
    )
    const selected = users.find((user) => user.id === adminCandidate)
    setAdminOpen(false)
    notify(
      `${selected?.name || "User"} assigned as organization administrator.`,
      "success",
    )
  }

  if (mode !== "list") {
    return (
      <section
        className="access-user-card access-user-form"
        aria-label={mode === "edit" ? "Edit user" : "Invite user"}
      >
        <header className="access-user-header">
          <div>
            <h2>{mode === "edit" ? "Edit User" : "Invite User"}</h2>
            <p>
              {mode === "edit"
                ? "Update this user's account and access role."
                : "Invite a user and assign their initial access role."}
            </p>
          </div>
          <div className="access-user-header-actions">
            <button
              className="access-text-button"
              onClick={() => setPreviewOpen(true)}
            >
              <AccessIcon name="preview" /> Preview invitation template
            </button>
            <button
              className="access-icon-button"
              aria-label="Close user form"
              onClick={() => setMode("list")}
            >
              <AccessIcon name="close" />
            </button>
          </div>
        </header>

        <div className="access-user-form-body">
          <div className="access-form-row">
            <label htmlFor="access-user-name">
              Name<span>*</span>
            </label>
            <div>
              <input
                id="access-user-name"
                autoFocus
                value={draft.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
              {errors.name && (
                <p className="access-field-error">{errors.name}</p>
              )}
            </div>
          </div>
          <div className="access-form-row">
            <label htmlFor="access-user-email">
              Email<span>*</span>
            </label>
            <div>
              <input
                id="access-user-email"
                type="email"
                value={draft.email}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) =>
                  setDraft({ ...draft, email: event.target.value })
                }
              />
              {errors.email && (
                <p className="access-field-error">{errors.email}</p>
              )}
            </div>
          </div>
          <div className="access-form-row">
            <label htmlFor="access-user-role">
              Role<span>*</span>
            </label>
            <div>
              <select
                id="access-user-role"
                value={draft.role}
                aria-invalid={Boolean(errors.role)}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value })
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <p className="access-role-description">
                {roleDescription(draft.role, roles)}
              </p>
              {errors.role && (
                <p className="access-field-error">{errors.role}</p>
              )}
            </div>
          </div>
        </div>

        <footer className="access-user-form-footer">
          <div>
            <button className="access-primary-button" onClick={save}>
              {mode === "edit" ? "Update" : "Send Invitation"}
            </button>
            <button
              className="access-secondary-button"
              onClick={() => setMode("list")}
            >
              Cancel
            </button>
          </div>
          <p>
            <span>*</span> indicates mandatory fields
          </p>
        </footer>

        <dialog
          className="access-dialog"
          ref={previewDialog}
          onCancel={() => setPreviewOpen(false)}
        >
          <header>
            <div>
              <h3>Invitation Preview</h3>
              <p>This is the email the user will receive.</p>
            </div>
            <button
              className="access-icon-button"
              aria-label="Close invitation preview"
              onClick={() => setPreviewOpen(false)}
            >
              <AccessIcon name="close" />
            </button>
          </header>
          <div className="access-invite-preview">
            <div className="access-preview-brand">
              <AccessIcon name="mail" size={22} />
              <strong>Naxpayroll</strong>
            </div>
            <p>Hello {draft.name.trim() || "there"},</p>
            <p>
              You have been invited to access the organization payroll workspace
              as <strong>{roleLabel(draft.role)}</strong>.
            </p>
            <button className="access-primary-button" type="button">
              Accept Invitation
            </button>
            <p className="access-preview-note">
              This preview does not send an email.
            </p>
          </div>
        </dialog>
      </section>
    )
  }

  return (
    <section className="access-user-card" aria-label="Users">
      <header className="access-user-header">
        <div>
          <h2>Users</h2>
          <p>Invite users and manage their access roles.</p>
        </div>
        <button className="access-primary-button" onClick={startInvite}>
          <AccessIcon name="userPlus" /> Invite User
        </button>
      </header>

      <div className="access-admin-banner">
        <div className="access-admin-illustration">
          <AdminIllustration />
        </div>
        <div className="access-admin-copy">
          <h3>Organization Administrator Privilege</h3>
          <p>
            An organization administrator has full access to manage users,
            roles, payroll settings, and sensitive organization data. Assign
            this privilege only to a trusted active admin.
          </p>
          {activeAdmin && (
            <span className="access-current-admin">
              <AccessIcon name="shield" /> Current administrator:{" "}
              {activeAdmin.name}
            </span>
          )}
        </div>
        <button
          className="access-primary-button"
          onClick={() => {
            setAdminCandidate(activeAdmin?.id || eligibleAdmins[0]?.id || "")
            setAdminOpen(true)
          }}
          disabled={eligibleAdmins.length === 0}
        >
          Assign Organization Admin
        </button>
      </div>

      <div className="access-user-filters">
        <UserSearch
          users={users.filter((user) =>
            (roleFilter === "All Roles" || user.role === roleFilter) &&
            (statusFilter === "All Statuses" || user.status === statusFilter))}
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <UserFilterPicker
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: "All Roles", label: "All Roles" },
            ...roleOptions.map((role) => ({
              value: role,
              label: roleLabel(role),
            })),
          ]}
        />
        <UserFilterPicker
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All Statuses", label: "All Statuses" },
            { value: "Active", label: "Active" },
            { value: "Locked", label: "Locked" },
          ]}
        />
        <div className="access-filter-summary" role="status" aria-live="polite">
          <span>
            {sortedUsers.length} of {users.length} users
          </span>
          {filtersActive && (
            <button onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      </div>

      <div className="access-user-table-wrap">
        <table className="access-user-table">
          <thead>
            <tr>
              <th>User Details</th>
              <th>Role</th>
              <th>Status</th>
              <th>
                <span className="access-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, index) => (
              <tr key={user.id}>
                <td>
                  <div className={`access-avatar access-avatar-${index % 5}`}>
                    {user.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <button
                      className="access-user-name"
                      onClick={() => startEdit(user)}
                    >
                      {user.name}
                    </button>
                    <span>{user.email}</span>
                    {user.isOrganizationAdmin && (
                      <small>
                        <AccessIcon name="shield" size={13} /> Organization
                        administrator
                      </small>
                    )}
                  </div>
                </td>
                <td>{roleLabel(user.role)}</td>
                <td>
                  <span
                    className={`access-status access-status-${user.status.toLowerCase()}`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="access-user-action-cell">
                  <button
                    className="access-more-button"
                    aria-label={`Actions for ${user.name}`}
                    aria-expanded={openMenu === user.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenMenu(openMenu === user.id ? null : user.id)
                    }}
                  >
                    <AccessIcon name="more" />
                  </button>
                  {openMenu === user.id && (
                    <div
                      className="access-user-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button onClick={() => startEdit(user)}>Edit</button>
                      <button onClick={() => toggleStatus(user)}>
                        <AccessIcon
                          name={user.status === "Active" ? "lock" : "unlock"}
                        />{" "}
                        {user.status === "Active"
                          ? "Lock account"
                          : "Unlock account"}
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenu(null)
                          notify(
                            `Password reset email sent to ${user.email}`,
                            "info",
                          )
                        }}
                      >
                        <AccessIcon name="mail" /> Send password reset
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sortedUsers.length === 0 && (
              <tr className="access-empty-row">
                <td colSpan={4}>
                  <strong>No users found</strong>
                  <span>Try another search or clear the active filters.</span>
                  <button onClick={clearFilters}>Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dialog
        className="access-dialog"
        ref={adminDialog}
        onCancel={() => setAdminOpen(false)}
      >
        <header>
          <div>
            <h3>Assign Organization Administrator</h3>
            <p>Select an active user with the Admin role.</p>
          </div>
          <button
            className="access-icon-button"
            aria-label="Close administrator assignment"
            onClick={() => setAdminOpen(false)}
          >
            <AccessIcon name="close" />
          </button>
        </header>
        <div className="access-dialog-body">
          <label htmlFor="organization-admin-user">Eligible admin</label>
          <select
            id="organization-admin-user"
            value={adminCandidate}
            onChange={(event) => setAdminCandidate(event.target.value)}
          >
            {eligibleAdmins.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.email}
              </option>
            ))}
          </select>
          <p>
            Only one user can hold the organization administrator privilege at a
            time.
          </p>
        </div>
        <footer>
          <button
            className="access-primary-button"
            disabled={!adminCandidate}
            onClick={assignAdmin}
          >
            Assign Administrator
          </button>
          <button
            className="access-secondary-button"
            onClick={() => setAdminOpen(false)}
          >
            Cancel
          </button>
        </footer>
      </dialog>
    </section>
  )
}
