/**
 * In-memory stand-in for `firebase/firestore`, used only by the `e2e` Vite mode.
 *
 * It implements just the surface this app calls, and only well enough that
 * every page renders real content. Writes mutate the in-memory store so the UI
 * stays consistent within a session; nothing is persisted.
 */
import { collections } from './fixtures'

/** Deep-ish clone so tests can't leak mutations between page loads. */
const store = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [name, rows.map(r => ({ ...r }))])
)

let autoId = 0
const nextId = () => `generated-${++autoId}`

export class Timestamp {
    constructor(date) {
        this._date = date
    }

    static fromDate(date) {
        return new Timestamp(date)
    }

    static now() {
        return new Timestamp(new Date())
    }

    toDate() {
        return this._date
    }

    getTime() {
        return this._date.getTime()
    }
}

/** Firestore hands back Timestamps; the app calls `.toDate()` on them. */
function toTimestamp(value) {
    if (value instanceof Timestamp) return value
    if (value instanceof Date) return new Timestamp(value)
    return value
}

function wrapRow(row) {
    const data = {}
    for (const [k, v] of Object.entries(row)) {
        if (k === 'id') continue
        data[k] = v instanceof Date ? toTimestamp(v) : v
    }
    return { id: row.id, exists: () => true, data: () => data }
}

export const serverTimestamp = () => new Timestamp(new Date())

export function getFirestore() {
    return { __db: true }
}

export function collection(_db, name) {
    return { __type: 'collection', name }
}

export function doc(dbOrCollection, a, b) {
    // doc(db, 'users', id) | doc(collectionRef, id)
    if (dbOrCollection && dbOrCollection.__type === 'collection') {
        return { __type: 'doc', name: dbOrCollection.name, id: a ?? nextId() }
    }
    return { __type: 'doc', name: a, id: b ?? nextId() }
}

export const where = (field, op, value) => ({ __c: 'where', field, op, value })
export const orderBy = (field, dir = 'asc') => ({ __c: 'orderBy', field, dir })
export const limit = (n) => ({ __c: 'limit', n })

export function query(coll, ...constraints) {
    return { __type: 'query', name: coll.name, constraints }
}

function valueOf(v) {
    if (v instanceof Timestamp) return v.getTime()
    if (v instanceof Date) return v.getTime()
    return v
}

function matches(row, { field, op, value }) {
    const a = valueOf(row[field])
    const b = valueOf(value)
    switch (op) {
        case '==': return a === b
        case '!=': return a !== b
        case '>': return a > b
        case '>=': return a >= b
        case '<': return a < b
        case '<=': return a <= b
        case 'in': return Array.isArray(value) && value.map(valueOf).includes(a)
        case 'array-contains': return Array.isArray(row[field]) && row[field].includes(value)
        default: return true
    }
}

function resolve(ref) {
    const name = ref.name
    let rows = [...(store[name] || [])]
    const constraints = ref.constraints || []

    for (const c of constraints) {
        if (c.__c === 'where') rows = rows.filter(r => matches(r, c))
    }
    for (const c of constraints) {
        if (c.__c === 'orderBy') {
            rows.sort((x, y) => {
                const a = valueOf(x[c.field]), b = valueOf(y[c.field])
                if (a === b) return 0
                const r = a > b ? 1 : -1
                return c.dir === 'desc' ? -r : r
            })
        }
    }
    for (const c of constraints) {
        if (c.__c === 'limit') rows = rows.slice(0, c.n)
    }
    return rows
}

function snapshot(rows) {
    const docs = rows.map(wrapRow)
    return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (fn) => docs.forEach(fn),
    }
}

export async function getDocs(ref) {
    return snapshot(resolve(ref))
}

/**
 * Fires once with the current data. Live updates are out of scope: these
 * mocks exist to render a deterministic snapshot for layout assertions.
 */
export function onSnapshot(ref, onNext, _onError) {
    const t = setTimeout(() => onNext(snapshot(resolve(ref))), 0)
    return () => clearTimeout(t)
}

/** Sentinels resolved by updateDoc, mirroring the real field transforms. */
export const arrayUnion = (...values) => ({ __op: 'arrayUnion', values })
export const arrayRemove = (...values) => ({ __op: 'arrayRemove', values })

const readPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

/** Immutable set for dotted paths, e.g. `reactions.👍`. */
function writePath(obj, path, value) {
    const [head, ...rest] = path.split('.')
    if (rest.length === 0) return { ...obj, [head]: value }
    return { ...obj, [head]: writePath(obj?.[head] ?? {}, rest.join('.'), value) }
}

/** Resolves arrayUnion/arrayRemove sentinels and dotted field paths. */
function applyFieldOps(current, incoming) {
    let next = { ...current }
    for (const [path, value] of Object.entries(incoming)) {
        if (value && value.__op) {
            const base = readPath(next, path)
            const list = Array.isArray(base) ? base : []
            next = writePath(next, path, value.__op === 'arrayUnion'
                ? [...list, ...value.values.filter(v => !list.includes(v))]
                : list.filter(v => !value.values.includes(v)))
        } else {
            next = writePath(next, path, value)
        }
    }
    return next
}

export async function getDoc(ref) {
    const row = (store[ref.name] || []).find(r => r.id === ref.id)
    if (!row) return { exists: () => false, id: ref.id, data: () => undefined }
    return wrapRow(row)
}

export async function addDoc(coll, data) {
    const row = { id: nextId(), ...data }
    store[coll.name] = [...(store[coll.name] || []), row]
    return { id: row.id }
}

export async function setDoc(ref, data) {
    const rows = store[ref.name] || []
    const i = rows.findIndex(r => r.id === ref.id)
    const row = { id: ref.id, ...data }
    store[ref.name] = i === -1 ? [...rows, row] : rows.map((r, n) => (n === i ? row : r))
}

export async function updateDoc(ref, data) {
    store[ref.name] = (store[ref.name] || []).map(r => (r.id === ref.id ? applyFieldOps(r, data) : r))
}

export async function deleteDoc(ref) {
    store[ref.name] = (store[ref.name] || []).filter(r => r.id !== ref.id)
}

export function writeBatch() {
    const ops = []
    return {
        set: (ref, data) => ops.push(() => setDoc(ref, data)),
        update: (ref, data) => ops.push(() => updateDoc(ref, data)),
        delete: (ref) => ops.push(() => deleteDoc(ref)),
        commit: async () => { for (const op of ops) await op() },
    }
}
