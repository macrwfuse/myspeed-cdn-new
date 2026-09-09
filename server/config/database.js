import { Sequelize } from 'sequelize';
import sqlite3Shim from '../util/bun-sqlite-shim.js';

const STORAGE_PATH = `data/storage${process.env.PREVIEW_MODE === "true" ? "_preview" : ""}.db`;

Sequelize.DATE.prototype._stringify = () => {
    return new Date().toISOString();
}

let db;

if (process.env.DB_TYPE === "mysql") {

    if (!process.env.DB_NAME || !process.env.DB_PASS || !process.env.DB_USER)
        throw new Error("Missing database environment variables");

    db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST || "localhost",
        dialect: 'mysql',
        logging: false,
        query: {raw: true}
    });
} else if (!process.env.DB_TYPE || process.env.DB_TYPE === "sqlite") {
    db = new Sequelize({
        dialect: 'sqlite',
        dialectModule: sqlite3Shim,
        storage: STORAGE_PATH,
        logging: false,
        query: {raw: true}
    });
} else {
    throw new Error("Invalid database type");
}

export default db;