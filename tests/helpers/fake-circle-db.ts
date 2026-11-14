/**
 * A small in-memory stand-in for the database and file storage, for tests of the circle key.
 * It follows the rules that matter here: a signed-in caregiver sees only their own circle's rows
 * (as row security does), the version checks the triggers make, and reset_own_circle_key as
 * migration 0017 defines it. supabase/tests/held_keys.test.sql checks the real database.
 */
type Row = Record<string, unknown>;

export type FakeState = {
  circles: { id: string; key_version: number; deleted_at: string | null }[];
  circle_caregivers: { circle_id: string; user_id: string; role: string; circle_key_wrapped: string | null; key_version: number }[];
  visit_documents: {
    id: string;
    circle_id: string;
    visit_date: string | null;
    clinic: string | null;
    kind: "photos" | "pdf";
    page_count: number;
    paths: string[];
    created_at: string;
    key_version: number | null;
    file_key_wrapped: string | null;
    file_key_iv: string | null;
  }[];
  activity: { circle_id: string; action: string }[];
  storage: Map<string, Uint8Array>;
  /** Every table or function a client touched, so a test can show the database was never reached. */
  touched: string[];
};

export function emptyState(): FakeState {
  return { circles: [], circle_caregivers: [], visit_documents: [], activity: [], storage: new Map(), touched: [] };
}

const AV1 = /^av1\.600000\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;
const AV2 = /^av2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;

type Table = "circles" | "circle_caregivers" | "visit_documents";

class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" | "delete" = "select";
  private patch: Row = {};
  private added: Row = {};
  private head = false;

  constructor(
    private state: FakeState,
    private table: Table,
    private userId: string | null,
  ) {}

  select(_columns?: string, options?: { head?: boolean }) {
    if (options?.head) this.head = true;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.added = row;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  /** Only `.neq("paths", "{}")` is used by the code under test: rows with at least one path. */
  neq(column: string, value: string) {
    if (value !== "{}") throw new Error("unsupported filter");
    this.filters.push((row) => Array.isArray(row[column]) && (row[column] as unknown[]).length > 0);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  /** Only `.not(column, "is", null)` is used by the code under test. */
  not(column: string, ...rest: ["is", null]) {
    if (rest[0] !== "is" || rest[1] !== null) throw new Error("unsupported filter");
    this.filters.push((row) => (row[column] ?? null) !== null);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }

  /** What row security lets this client see. The server's own client sees everything. */
  private visible(row: Row): boolean {
    if (this.userId === null) return true;
    const mine = (circleId: unknown) => this.state.circle_caregivers.some((item) => item.circle_id === circleId && item.user_id === this.userId);
    if (this.table === "circle_caregivers") return row.user_id === this.userId;
    if (this.table === "circles") return mine(row.id);
    return mine(row.circle_id);
  }

  private rows(): Row[] {
    return (this.state[this.table] as Row[]).filter((row) => this.visible(row) && this.filters.every((test) => test(row)));
  }

  private run(): { data: Row[] | null; error: { message: string } | null; count: number | null } {
    this.state.touched.push(this.table);
    const fail = (message: string) => ({ data: null, error: { message }, count: null });
    const circleVersion = (circleId: unknown) => this.state.circles.find((circle) => circle.id === circleId)?.key_version;
    if (this.op === "insert") {
      const row: Row = { id: crypto.randomUUID(), paths: [], created_at: new Date().toISOString(), visit_date: null, clinic: null, ...this.added };
      if (!this.visible(row)) return fail("new row violates row-level security policy");
      if (this.table === "visit_documents" && row.key_version != null && row.key_version !== circleVersion(row.circle_id)) return fail("the file key version must match the circle");
      (this.state[this.table] as Row[]).push(row);
      return { data: [row], error: null, count: 1 };
    }
    const rows = this.rows();
    if (this.op === "update") {
      for (const row of rows) {
        const next = { ...row, ...this.patch };
        if (this.table === "circle_caregivers") {
          const wrapped = next.circle_key_wrapped;
          if (wrapped != null && !(typeof wrapped === "string" && (AV1.test(wrapped) || AV2.test(wrapped)))) return fail("wrapped key is not valid");
          if (next.key_version !== circleVersion(next.circle_id)) return fail("the wrapped key version must match the circle");
        }
        Object.assign(row, this.patch);
      }
      return { data: rows, error: null, count: rows.length };
    }
    if (this.op === "delete") {
      const table = this.state[this.table] as Row[];
      for (const row of rows) table.splice(table.indexOf(row), 1);
      return { data: rows, error: null, count: rows.length };
    }
    return { data: this.head ? null : rows, error: null, count: rows.length };
  }

  maybeSingle() {
    const result = this.run();
    return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error });
  }
  single() {
    const result = this.run();
    const row = result.data?.[0] ?? null;
    return Promise.resolve({ data: row, error: result.error ?? (row ? null : { message: "no rows" }) });
  }
  then<T>(resolve: (value: ReturnType<Query["run"]>) => T, reject?: (reason: unknown) => T) {
    return Promise.resolve(this.run()).then(resolve, reject);
  }
}

/** reset_own_circle_key, as in migration 0017. */
function resetOwnCircleKey(state: FakeState, userId: string | null, args: { p_circle: string; p_wrapped: string; p_version: number }) {
  const fail = (message: string) => ({ data: null, error: { message } });
  if (!AV2.test(args.p_wrapped ?? "")) return fail("stored key is not valid");
  const own = state.circle_caregivers.find((row) => row.circle_id === args.p_circle && row.user_id === userId);
  if (!own || own.role !== "owner") return fail("only the owner can change the circle key");
  const circle = state.circles.find((row) => row.id === args.p_circle && row.deleted_at === null);
  if (!circle) return fail("that circle was not found");
  if (args.p_version !== circle.key_version + 1) return fail("key version moves forward one step");
  if (own.circle_key_wrapped?.startsWith("av2.") && own.key_version === circle.key_version) return fail("the key for this circle is held");
  const gone = state.visit_documents.filter((row) => row.circle_id === args.p_circle && row.file_key_wrapped !== null);
  state.visit_documents = state.visit_documents.filter((row) => !gone.includes(row));
  circle.key_version = args.p_version;
  own.circle_key_wrapped = args.p_wrapped;
  own.key_version = args.p_version;
  if (gone.some((row) => row.paths.length)) state.activity.push({ circle_id: args.p_circle, action: "circle_key_reset" });
  return { data: gone.flatMap((row) => row.paths), error: null };
}

export function fakeClient(state: FakeState, userId: string | null) {
  return {
    from(table: Table) {
      return new Query(state, table, userId);
    },
    async rpc(name: string, args: Row) {
      state.touched.push(name);
      if (name === "reset_own_circle_key") return resetOwnCircleKey(state, userId, args as { p_circle: string; p_wrapped: string; p_version: number });
      return { data: null, error: { message: `unknown function ${name}` } };
    },
    storage: {
      from() {
        return {
          async upload(path: string, bytes: Uint8Array) {
            if (state.storage.has(path)) return { error: { message: "exists" } };
            state.storage.set(path, new Uint8Array(bytes));
            return { error: null };
          },
          async download(path: string) {
            const bytes = state.storage.get(path);
            if (!bytes) return { data: null, error: { message: "not found" } };
            return { data: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]), error: null };
          },
          async remove(paths: string[]) {
            for (const path of paths) state.storage.delete(path);
            return { error: null };
          },
        };
      },
    },
  };
}
