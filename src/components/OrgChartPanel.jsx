import { useState } from "react"
import { Card, Button, Pill, Modal, Field, TextInput, Textarea, FilterSelect, EmptyState } from "./ui.jsx"
import { PersonPlusIcon, PencilIcon, TrashIcon } from "./icons.jsx"

const ROLE_OPTIONS = [
  { value: "economic_buyer", label: "Economic Buyer" },
  { value: "champion", label: "Champion" },
  { value: "coach", label: "Coach" },
  { value: "blocker", label: "Blocker" },
  { value: "decision_maker", label: "Decision Maker" },
  { value: "user", label: "User" },
  { value: "other", label: "Other" },
]

const ROLE_PILL_TONE = {
  economic_buyer: "emerald",
  champion: "emerald",
  coach: "sky",
  blocker: "rose",
  decision_maker: "brand",
  user: "slate",
  other: "slate",
}

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? null
}

function emptyForm() {
  return { fullName: "", title: "", reportsToId: "", meddpiccRole: "", notes: "" }
}

function PersonForm({ open, onClose, onSubmit, people, editing }) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          fullName: editing.fullName,
          title: editing.title ?? "",
          reportsToId: editing.reportsToId ? String(editing.reportsToId) : "",
          meddpiccRole: editing.meddpiccRole ?? "",
          notes: editing.notes ?? "",
        }
      : emptyForm(),
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    onSubmit({
      fullName: form.fullName.trim(),
      title: form.title.trim() || null,
      reportsToId: form.reportsToId ? Number(form.reportsToId) : null,
      meddpiccRole: form.meddpiccRole || null,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit person" : "Add person"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name">
          <TextInput
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Jane Lee"
            autoFocus
          />
        </Field>
        <Field label="Title">
          <TextInput
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Chief Revenue Officer"
          />
        </Field>
        <Field label="Reports to">
          <FilterSelect
            label="No one (top of chart)"
            value={form.reportsToId || null}
            onChange={(v) => setForm((f) => ({ ...f, reportsToId: v ?? "" }))}
            options={people
              .filter((p) => p.id !== editing?.id)
              .map((p) => ({ value: String(p.id), label: p.fullName }))}
          />
        </Field>
        <Field label="MEDDPICC role" hint="Optional — tags this person in the account's MEDDPICC worksheet.">
          <FilterSelect
            label="No role tagged"
            value={form.meddpiccRole || null}
            onChange={(v) => setForm((f) => ({ ...f, meddpiccRole: v ?? "" }))}
            options={ROLE_OPTIONS}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="How they influence this deal, what they care about, anything worth remembering."
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {editing ? "Save changes" : "Add person"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PersonNode({ person, people, depth, onEdit, onRemove }) {
  const reports = people.filter((p) => p.reportsToId === person.id)
  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink-900 dark:text-zinc-50">{person.fullName}</p>
            {person.meddpiccRole && <Pill tone={ROLE_PILL_TONE[person.meddpiccRole] ?? "slate"}>{roleLabel(person.meddpiccRole)}</Pill>}
          </div>
          {person.title && <p className="text-xs text-body-500 dark:text-zinc-400">{person.title}</p>}
          {person.notes && <p className="mt-1 text-xs text-body-600 dark:text-zinc-300">{person.notes}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(person)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={`Edit ${person.fullName}`}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(person.id)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            aria-label={`Remove ${person.fullName}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {reports.map((r) => (
        <PersonNode key={r.id} person={r} people={people} depth={depth + 1} onEdit={onEdit} onRemove={onRemove} />
      ))}
    </div>
  )
}

// Manual org chart for one account — a working sketch of who's who, not
// a verified-provider contact list (see db/migrations/010's comment).
// Real LinkedIn/contact-data integration is a later step; this is
// what you type in yourself in the meantime, and each person can carry
// a MEDDPICC role tag so the worksheet and the org chart stay linked.
function OrgChartPanel({ people, loading, onAdd, onUpdate, onRemove }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const topLevel = people.filter((p) => !p.reportsToId || !people.some((other) => other.id === p.reportsToId))

  const handleSubmit = (values) => {
    const promise = editing ? onUpdate(editing.id, values) : onAdd(values)
    promise.then(() => {
      setFormOpen(false)
      setEditing(null)
    })
  }

  if (loading) return <Card className="h-48 animate-pulse" />

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-dense text-body-600 dark:text-zinc-400">
          {people.length} {people.length === 1 ? "person" : "people"} mapped
        </p>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <PersonPlusIcon className="h-4 w-4" />
          Add Person
        </Button>
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState
            title="No one mapped yet"
            description="Add the people you know at this account — who they report to, and their role in the deal (Economic Buyer, Champion, etc.)."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                Add Person
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="px-4">
          {topLevel.map((p) => (
            <PersonNode
              key={p.id}
              person={p}
              people={people}
              depth={0}
              onEdit={(person) => {
                setEditing(person)
                setFormOpen(true)
              }}
              onRemove={onRemove}
            />
          ))}
        </Card>
      )}

      <PersonForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        people={people}
        editing={editing}
      />
    </>
  )
}

export default OrgChartPanel
