import { useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { TableName } from '../lib/types'
import { Button, IconButton, Modal, useAction, useFeedback } from './ui'

/** Shared add/edit modal + delete confirmation for simple record lists. */
export function useCrud<T extends { id: string }>(table: TableName, opts: {
  setData: (fn: (l: T[] | undefined) => T[] | undefined) => void
  label: string
  prepare?: (form: Partial<T>) => Partial<T>
}) {
  const [editing, setEditing] = useState<Partial<T> | null>(null)
  const { run, busy } = useAction()
  const { confirm } = useFeedback()

  const save = () => run(async () => {
    if (!editing) return
    const payload = opts.prepare ? opts.prepare(editing) : editing
    const { id, created_at, updated_at, user_id, search, ...rest } = payload as any
    void created_at; void updated_at; void user_id; void search
    const row = id ? await db.update<T>(table, id, rest) : await db.insert<T>(table, rest)
    opts.setData((l) => (id ? (l ?? []).map((x) => (x.id === id ? row : x)) : [row, ...(l ?? [])]))
    setEditing(null)
  }, `${opts.label} saved`)

  const remove = async (row: T, name?: string) => {
    if (!(await confirm({ title: `Delete ${opts.label.toLowerCase()}?`, body: `${name ? `“${name}” ` : 'This item '}will be permanently deleted.`, confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await db.remove(table, row.id); opts.setData((l) => l?.filter((x) => x.id !== row.id)) }, 'Deleted')
  }

  const modal = (title: string, body: (form: Partial<T>, set: (p: Partial<T>) => void) => ReactNode, canSave: (f: Partial<T>) => boolean = () => true) => (
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${title.toLowerCase()}` : title}
      footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!editing || !canSave(editing)} onClick={save}>Save</Button></>}>
      {editing && body(editing, (p) => setEditing((e) => ({ ...(e ?? {}), ...p })))}
    </Modal>
  )

  return { editing, setEditing, save, remove, modal, busy }
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex gap-0.5 opacity-60 transition group-hover:opacity-100">
      <IconButton label="Edit" className="size-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit() }}><Pencil className="size-3.5" /></IconButton>
      <IconButton label="Delete" className="size-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}><Trash2 className="size-3.5" /></IconButton>
    </span>
  )
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <Button variant="primary" icon={<Plus className="size-4" />} onClick={onClick}>{children}</Button>
}
