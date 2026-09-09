import { DataTypes } from 'sequelize';

const PK_INT = { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true };

const SCHEMA = {
    speedtests: {
        id: PK_INT,
        serverId: { type: DataTypes.INTEGER, defaultValue: 0 },
        ping: { type: DataTypes.INTEGER, allowNull: false },
        download: { type: DataTypes.DOUBLE, allowNull: false },
        upload: { type: DataTypes.DOUBLE, allowNull: false },
        error: { type: DataTypes.STRING, allowNull: true },
        type: { type: DataTypes.STRING, defaultValue: 'auto' },
        resultId: { type: DataTypes.STRING, allowNull: true },
        time: { type: DataTypes.INTEGER, defaultValue: 0 },
        created: {
            type: process.env.DB_TYPE === 'mysql' ? DataTypes.STRING : DataTypes.TIME,
            defaultValue: DataTypes.NOW
        }
    },
    config: {
        key: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
        value: { type: DataTypes.STRING, allowNull: false }
    },
    nodes: {
        id: PK_INT,
        name: { type: DataTypes.STRING, defaultValue: 'MySpeed Server' },
        url: { type: DataTypes.STRING, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: true }
    },
    recommendations: {
        id: PK_INT,
        ping: { type: DataTypes.INTEGER, allowNull: false },
        download: { type: DataTypes.DOUBLE, allowNull: false },
        upload: { type: DataTypes.DOUBLE, allowNull: false }
    },
    integration_data: {
        id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
        displayName: { type: DataTypes.STRING, defaultValue: 'Untitled' },
        name: { type: DataTypes.STRING, allowNull: false },
        data: { type: DataTypes.JSON, defaultValue: {} },
        lastActivity: { type: DataTypes.DATE, allowNull: true },
        activityFailed: { type: DataTypes.BOOLEAN, defaultValue: false }
    }
};

export async function up(queryInterface) {
    const existing = new Set(await queryInterface.showAllTables());
    for (const [name, columns] of Object.entries(SCHEMA)) {
        if (!existing.has(name)) await queryInterface.createTable(name, columns);
    }
}
