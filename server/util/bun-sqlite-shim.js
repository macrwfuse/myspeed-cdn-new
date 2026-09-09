/**
 * Compatibility shim that wraps Bun's built-in bun:sqlite module to match
 * the subset of the sqlite3 npm package's callback API that sequelize uses.
 *
 * This lets sequelize use bun:sqlite directly, which is embedded in the bun
 * runtime and works in compiled binaries without native node_modules.
 */
import { Database as BunDatabase } from "bun:sqlite";

const OPEN_READONLY = 0x00000001;
const OPEN_READWRITE = 0x00000002;
const OPEN_CREATE = 0x00000004;

const parseArgs = (args) => {
    let params = [];
    let callback;
    for (const arg of args) {
        if (typeof arg === "function") callback = arg;
        else if (Array.isArray(arg)) params = arg;
        else if (arg !== null && typeof arg === "object") params = arg;
        else if (arg !== undefined) params.push(arg);
    }
    return [params, callback];
};

class Database {
    constructor(filename, mode, callback) {
        try {
            const readonly = typeof mode === "number" && !(mode & OPEN_READWRITE);
            this.db = new BunDatabase(filename, { readonly, create: !readonly });
            this.filename = filename;
            this.db.exec("PRAGMA journal_mode = WAL");
            if (callback) process.nextTick(() => callback(null));
        } catch (err) {
            if (callback) process.nextTick(() => callback(err));
            else throw err;
        }
    }

    run(sql, ...args) {
        const [params, callback] = parseArgs(args);
        try {
            const result = this.db.prepare(sql).run(params);

            const context = { lastID: result.lastInsertRowid, changes: result.changes, sql };
            if (callback) process.nextTick(() => callback.call(context, null));
        } catch (err) {
            if (callback) process.nextTick(() => callback.call({}, err));
        }
        return this;
    }

    all(sql, ...args) {
        const [params, callback] = parseArgs(args);
        try {
            const rows = this.db.prepare(sql).all(params);
            if (callback) process.nextTick(() => callback(null, rows));
        } catch (err) {
            if (callback) process.nextTick(() => callback(err, []));
        }
        return this;
    }

    serialize(fn) {
        if (fn) fn();
        return this;
    }

    close(callback) {
        try {
            this.db.close();
            if (callback) process.nextTick(() => callback(null));
        } catch (err) {
            if (callback) process.nextTick(() => callback(err));
        }
        return this;
    }
}

const sqlite3 = { Database, OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE };

export default sqlite3;
export { Database, OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE };
