import test from "node:test"
import assert from "node:assert/strict"
import {
  allKeys,
  defaultRoles,
  loadRoles,
  reportKeys,
  ROLE_STORAGE,
  sections,
  sectionKeys,
  setPermissions,
} from "../src/access-permissions.ts"

test("every permission has a distinct key and defaults cover all visible categories", () => {
  assert.equal(new Set(allKeys).size, allKeys.length)
  assert.equal(sections[0].rows.length, 10)
  const [admin, manager, reviewer] = defaultRoles()
  assert.ok(allKeys.every((k) => admin.permissions[k]))
  assert.ok(
    allKeys
      .filter((k) => k.startsWith("settings."))
      .every((k) => !manager.permissions[k]),
  )
  assert.ok(
    allKeys
      .filter((k) => !k.startsWith("settings."))
      .every((k) => manager.permissions[k]),
  )
  assert.deepEqual(Object.keys(reviewer.permissions), [
    "approvals.reimbursements.View",
    "approvals.reimbursements.Approve",
    "approvals.option.0",
  ])
})
test("granting a dependent action grants view without mutating the saved map", () => {
  const original = { "employee.salary.Edit": false }
  const next = setPermissions(original, ["employee.salary.Edit"], true)
  assert.equal(next["employee.salary.View"], true)
  assert.equal(original["employee.salary.Edit"], false)
})
test("revoking view also revokes dependent actions, leaving other rows unchanged", () => {
  const next = setPermissions(
    defaultRoles()[0].permissions,
    ["loan.loan.View"],
    false,
  )
  assert.ok(sectionKeys(sections[2]).every((k) => !next[k]))
  assert.equal(next["payroll.run.Pay"], true)
})
test("category toggles cover all rows and supplementary options", () => {
  const keys = sectionKeys(sections[0])
  const enabled = setPermissions({}, keys, true)
  assert.ok(keys.every((k) => enabled[k]))
  assert.ok(keys.some((k) => k.includes(".option.")))
  const disabled = setPermissions(enabled, keys, false)
  assert.ok(keys.every((k) => !disabled[k]))
})
test("document full access includes additional permissions", () => {
  const keys = sectionKeys(sections[4])
  const next = setPermissions({}, keys, true)
  assert.equal(keys.filter((k) => k.includes(".extra.")).length, 6)
  assert.ok(keys.every((k) => next[k]))
})
test("report operations require view, and read revocation clears the group", () => {
  const next = setPermissions({}, ["reports.Payroll Overview.Share"], true)
  assert.equal(next["reports.Payroll Overview.View"], true)
  const cleared = setPermissions(next, ["reports.Payroll Overview.View"], false)
  assert.ok(reportKeys("Payroll Overview").every((k) => !cleared[k]))
})
test("browser persistence restores custom roles and keeps system roles protected", () => {
  const custom = {
    id: "custom",
    name: "Payroll clerk",
    description: "",
    permissions: { "payroll.run.View": true },
  }
  globalThis.localStorage = {
    getItem: (key) =>
      key === ROLE_STORAGE
        ? JSON.stringify([custom, { ...custom, id: "admin" }])
        : null,
  }
  const loaded = loadRoles()
  assert.equal(loaded.length, 4)
  assert.deepEqual(loaded[3], custom)
  assert.equal(loaded[0].builtin, true)
  globalThis.localStorage = { getItem: () => "{broken" }
  assert.equal(loadRoles().length, 3)
  delete globalThis.localStorage
})

test("every action cell is selectable and included in full access", () => {
  for (const section of sections) {
    const columns = section.columns.filter((action) => action !== "Others")
    for (const row of section.rows) {
      assert.deepEqual(row.actions, columns, `${section.label}: ${row.label}`)
      for (const action of columns) {
        const key = `${section.id}.${row.id}.${action}`
        assert.ok(sectionKeys(section).includes(key))
        const selected = setPermissions({}, [key], true)
        assert.equal(selected[key], true)
        assert.equal(setPermissions(selected, [key], false)[key], false)
      }
    }
  }
})
