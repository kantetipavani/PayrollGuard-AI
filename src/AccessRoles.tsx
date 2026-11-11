import { Fragment, useEffect, useRef, useState } from "react"
import {
  allKeys,
  preferences,
  reportActions,
  reportKeys,
  reports,
  rowKeys,
  sectionKeys,
  sections,
  setPermissions,
  settings,
} from "./access-permissions"
import type { AccessRole, PermissionMap } from "./access-permissions"
import "./access-roles.css"

function RoleIcon({
  name,
  size = 16,
}: {
  name: "lock" | "more" | "close" | "info" | "chevron"
  size?: number
}) {
  const paths = {
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    close: <path d="m7 7 10 10M17 7 7 17" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5h.01" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
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

function PermissionCheck({
  label,
  keys,
  permissions,
  disabled,
  onChange,
}: {
  label: string
  keys: string[]
  permissions: PermissionMap
  disabled?: boolean
  onChange: (keys: string[], value: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const count = keys.filter((k) => permissions[k]).length
  useEffect(() => {
    if (ref.current)
      ref.current.indeterminate = count > 0 && count < keys.length
  }, [count, keys.length])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={keys.length > 0 && count === keys.length}
      disabled={disabled}
      onChange={(e) => onChange(keys, e.target.checked)}
    />
  )
}

export default function AccessRoles({
  roles,
  onSave,
  onDelete,
  assignedCount,
}: {
  roles: AccessRole[]
  onSave: (role: AccessRole) => boolean
  onDelete: (role: AccessRole) => boolean
  assignedCount: (role: AccessRole) => number
}) {
  const [draft, setDraft] = useState<AccessRole | null>(null)
  const [original, setOriginal] = useState("")
  const [error, setError] = useState("")
  const [more, setMore] = useState<{
    label: string
    keys: string[]
    labels: string[]
  } | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const dirty = !!draft && JSON.stringify(draft) !== original
  useEffect(() => {
    if (!dirty) return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", prevent)
    return () => window.removeEventListener("beforeunload", prevent)
  }, [dirty])
  useEffect(() => {
    if (more) dialog.current?.showModal()
  }, [more])
  const open = (role?: AccessRole, clone = false) => {
    const next: AccessRole = role
      ? {
          ...role,
          permissions: { ...role.permissions },
          ...(clone
            ? {
                id: crypto.randomUUID(),
                name: `${role.name} (copy)`,
                builtin: false,
              }
            : {}),
        }
      : {
          id: crypto.randomUUID(),
          name: "",
          description: "",
          permissions: Object.fromEntries(allKeys.map((k) => [k, true])),
        }
    setDraft(next)
    setOriginal(JSON.stringify(next))
    setError("")
    setExpanded([])
  }
  const close = () => {
    if (!dirty || window.confirm("Discard unsaved changes to this role?")) {
      setDraft(null)
      setMore(null)
    }
  }
  const update = (keys: string[], value: boolean) =>
    setDraft((d) =>
      d && !d.builtin
        ? { ...d, permissions: setPermissions(d.permissions, keys, value) }
        : d,
    )
  const check = (label: string, keys: string[]) => (
    <PermissionCheck
      label={label}
      keys={keys}
      permissions={draft!.permissions}
      disabled={draft!.builtin}
      onChange={update}
    />
  )
  const save = () => {
    if (!draft || draft.builtin) return
    const name = draft.name.trim()
    if (!name) return setError("Enter a role name.")
    if (
      ["employee", "org admin"].includes(name.toLowerCase()) ||
      roles.some(
        (r) => r.id !== draft.id && r.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return setError(
        "A role with this name already exists. Choose a unique name.",
      )
    if (!allKeys.some((k) => draft.permissions[k]))
      return setError("Select at least one permission for this role.")
    if (onSave({ ...draft, name, description: draft.description.trim() }))
      setDraft(null)
  }
  if (!draft)
    return (
      <section className="access-roles">
        <div className="ar-card">
          <div className="ar-heading">
            <div>
              <h2>Roles</h2>
              <p>Define what each role can access and manage.</p>
            </div>
            <button
              type="button"
              id="btn-new-role"
              className="ar-button ar-primary"
              onClick={() => open()}
            >
              + New Role
            </button>
          </div>
          <div className="ar-table-wrap">
            <table className="ar-table ar-role-list">
              <thead>
                <tr>
                  <th>Role name</th>
                  <th>Description</th>
                  <th>Users</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <button className="ar-link" onClick={() => open(role)}>
                        {role.name}
                      </button>
                      {role.builtin && (
                        <span
                          className="ar-lock"
                          title="Protected system role"
                          aria-label="Protected system role"
                        >
                          <RoleIcon name="lock" />
                        </span>
                      )}
                    </td>
                    <td>{role.description || "—"}</td>
                    <td>{assignedCount(role)}</td>
                    <td>
                      <details className="ar-menu">
                        <summary aria-label={`Actions for ${role.name}`}>
                          <RoleIcon name="more" />
                        </summary>
                        <div>
                          <button onClick={() => open(role)}>
                            {role.builtin ? "View permissions" : "Edit role"}
                          </button>
                          <button onClick={() => open(role, true)}>
                            Clone role
                          </button>
                          {!role.builtin && (
                            <button
                              className="ar-danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete the role “${role.name}”?`,
                                  )
                                )
                                  onDelete(role)
                              }}
                            >
                              Delete role
                            </button>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ar-note">
            Protected roles can be viewed or cloned. Create a custom role to
            tailor permissions.
          </div>
        </div>
      </section>
    )

  return (
    <section
      className="access-roles ar-editor"
      aria-label={draft.builtin ? "Role permissions" : "Role editor"}
    >
      <header className="ar-heading">
        <div>
          <h2>
            {draft.builtin
              ? draft.name
              : roles.some((r) => r.id === draft.id)
                ? "Edit Role"
                : "New Role"}
          </h2>
          <p>
            {draft.builtin
              ? "This is a protected system role. Clone it to customize permissions."
              : "Choose what this role can access or manage."}
          </p>
        </div>
        <button
          className="ar-button"
          aria-label="Close role editor"
          onClick={close}
        >
          <RoleIcon name="close" />
        </button>
      </header>
      <div className="ar-editor-body">
        <div className="ar-fields">
          <label htmlFor="access-role-name">
            Role Name <span className="ar-danger">*</span>
          </label>
          <input
            id="access-role-name"
            autoFocus
            required
            maxLength={100}
            disabled={draft.builtin}
            value={draft.name}
            aria-invalid={!!error}
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value })
              setError("")
            }}
          />
          <label htmlFor="access-role-description">Description</label>
          <div>
            <textarea
              id="access-role-description"
              maxLength={500}
              rows={3}
              disabled={draft.builtin}
              placeholder="Max 500 Characters"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
            <div className="ar-count">{draft.description.length}/500</div>
          </div>
        </div>
        <div className="ar-section-intro">
          <h3>Permission Categories</h3>
          <p>Choose what this role can access or manage.</p>
        </div>
        {sections.map((section) => (
          <div className="ar-card" key={section.id}>
            <div className="ar-section-heading">
              <h3>{section.label}</h3>
              {section.toggle && (
                <button
                  type="button"
                  role="switch"
                  aria-label={`${section.label} access`}
                  aria-checked={sectionKeys(section).some(
                    (k) => draft.permissions[k],
                  )}
                  disabled={draft.builtin}
                  className={`ar-switch ${
                    sectionKeys(section).some((k) => draft.permissions[k])
                      ? "is-on"
                      : ""
                  }`}
                  onClick={() =>
                    update(
                      sectionKeys(section),
                      !sectionKeys(section).some((k) => draft.permissions[k]),
                    )
                  }
                >
                  <span />
                </button>
              )}
            </div>
            <div className="ar-table-wrap">
              <table className="ar-table ar-permissions">
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">Permission</span>
                    </th>
                    <th className="ar-full">Full Access</th>
                    {section.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      <td className="ar-full">
                        {check(
                          `${row.label}: Full Access`,
                          rowKeys(section.id, row),
                        )}
                      </td>
                      {section.columns.map((action) => (
                        <td key={action}>
                          {action === "Others" && row.extras ? (
                            <button
                              className="ar-link"
                              onClick={() =>
                                setMore({
                                  label: row.label,
                                  keys: row.extras!.map(
                                    (_, i) =>
                                      `${section.id}.${row.id}.extra.${i}`,
                                  ),
                                  labels: row.extras!,
                                })
                              }
                            >
                              More Permissions ({row.extras.length})
                            </button>
                          ) : (
                            check(
                              `${section.label} / ${row.label}: ${action}`,
                              [`${section.id}.${row.id}.${action}`],
                            )
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {section.options && (
              <div className="ar-options">
                {section.options.map((option, i) => (
                  <label key={option}>
                    {check(option, [`${section.id}.option.${i}`])}
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        {[
          { id: "settings", label: "Settings", options: settings },
          { id: "preferences", label: "Preferences", options: preferences },
        ].map((section) => (
          <div className="ar-card" key={section.id}>
            <div className="ar-section-heading">
              <label>
                {check(
                  `${section.label}: Full Access`,
                  section.options.map((_, i) => `${section.id}.${i}`),
                )}
                <h3>{section.label}</h3>
              </label>
            </div>
            <div className="ar-options">
              {section.options.map((option, i) => (
                <label key={option}>
                  {check(option, [`${section.id}.${i}`])}
                  <span>{option}</span>
                  {[
                    "Automation",
                    "Provide access to protected data",
                    "Incoming Webhook",
                  ].includes(option) && (
                    <span
                      tabIndex={0}
                      className="ar-info"
                      title={
                        option === "Automation"
                          ? "Manage automated workflows and their configuration."
                          : option === "Incoming Webhook"
                            ? "Manage incoming webhook configurations."
                            : "View sensitive employee and payroll information."
                      }
                      aria-label={`About ${option}`}
                    >
                      <RoleIcon name="info" size={15} />
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="ar-card">
          <div className="ar-section-heading">
            <label>
              {check(
                "Enable full access for all reports",
                reports.flatMap(reportKeys),
              )}
              <h3>Enable full access for all reports</h3>
              <span
                className="ar-info"
                title="Select all view, export, schedule and share permissions across every report group."
                tabIndex={0}
              >
                <RoleIcon name="info" size={15} />
              </span>
            </label>
          </div>
          <div className="ar-table-wrap">
            <table className="ar-table ar-permissions">
              <thead>
                <tr>
                  <th>Report Groups</th>
                  <th className="ar-full">Full Access</th>
                  {reportActions.map((a) => (
                    <th key={a}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((group) => (
                  <Fragment key={group}>
                    <tr>
                      <th colSpan={6}>
                        <button
                          className="ar-report-toggle"
                          aria-expanded={expanded.includes(group)}
                          onClick={() =>
                            setExpanded((old) =>
                              old.includes(group)
                                ? old.filter((g) => g !== group)
                                : [...old, group],
                            )
                          }
                        >
                          <span
                            className={expanded.includes(group) ? "is-expanded" : ""}
                          >
                            <RoleIcon name="chevron" />
                          </span>
                          {group}
                        </button>
                      </th>
                    </tr>
                    {expanded.includes(group) && (
                      <tr>
                        <th scope="row">All {group} reports</th>
                        <td className="ar-full">
                          {check(`${group}: Full Access`, reportKeys(group))}
                        </td>
                        {reportActions.map((action) => (
                          <td key={action}>
                            {check(`${group}: ${action}`, [
                              `reports.${group}.${action}`,
                            ])}
                          </td>
                        ))}
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <footer className="ar-footer">
        {error && (
          <p role="alert" className="ar-error">
            {error}
          </p>
        )}
        <div>
          {draft.builtin ? (
            <button
              className="ar-button ar-primary"
              onClick={() => open(draft, true)}
            >
              Clone Role
            </button>
          ) : (
            <button className="ar-button ar-primary" onClick={save}>
              Save
            </button>
          )}
          <button className="ar-button" onClick={close}>
            {draft.builtin ? "Close" : "Cancel"}
          </button>
        </div>
      </footer>
      {more && (
        <dialog
          className="ar-dialog"
          ref={dialog}
          onCancel={() => setMore(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMore(null)
          }}
        >
          <div className="ar-heading">
            <h3>{more.label} — More Permissions</h3>
            <button
              className="ar-button"
              aria-label="Close more permissions"
              onClick={() => setMore(null)}
            >
              <RoleIcon name="close" />
            </button>
          </div>
          <div className="ar-options">
            {more.labels.map((label, i) => (
              <label key={label}>
                {check(`${more.label}: ${label}`, [more.keys[i]])}
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="ar-footer">
            <button
              className="ar-button ar-primary"
              onClick={() => setMore(null)}
            >
              Done
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}
