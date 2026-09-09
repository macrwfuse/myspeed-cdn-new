import { DataTypes, QueryTypes } from 'sequelize';
import db from '../config/database.js';
import migrations from '../migrations/index.js';

const META_TABLE = 'SequelizeMeta';

const ensureMetaTable = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes(META_TABLE)) return;

    await queryInterface.createTable(META_TABLE, {
        name: { type: DataTypes.STRING, allowNull: false, primaryKey: true }
    });
    console.log(`Created ${META_TABLE} table for tracking migrations`);
};

const getExecutedMigrations = async () => {
    const rows = await db.query(`SELECT name FROM ${META_TABLE} ORDER BY name ASC`,
        { type: QueryTypes.SELECT });
    return new Set(rows.map(row => row.name));
};

export const runMigrations = async () => {
    const queryInterface = db.getQueryInterface();
    await ensureMetaTable(queryInterface);

    const executed = await getExecutedMigrations();
    const pending = migrations.filter(m => !executed.has(m.name));

    if (pending.length === 0) {
        console.log('No pending migrations found');
        return;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    for (const { name, up } of pending) {
        console.log(`Running migration: ${name}`);
        try {
            await up(queryInterface, DataTypes);
            await db.query(`INSERT INTO ${META_TABLE} (name) VALUES (?)`, { replacements: [name] });
            console.log(`Migration ${name} completed successfully`);
        } catch (error) {
            console.error(`Migration ${name} failed:`, error.message);
            throw error;
        }
    }

    console.log('All migrations completed successfully');
};

export default runMigrations;
