import Sequelize from 'sequelize';
import db from '../config/database.js';

export default db.define("speedtests", {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    serverId: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    serverName: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    serverHost: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    ping: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    jitter: {
        type: Sequelize.DOUBLE,
        allowNull: true,
        defaultValue: null
    },
    download: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    upload: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    error: {
        type: Sequelize.STRING,
        allowNull: true
    },
    type: {
        type: Sequelize.STRING,
        defaultValue: "auto"
    },
    resultId: {
        type: Sequelize.STRING,
        allowNull: true
    },
    time: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    created: {
        type: process.env.DB_TYPE === "mysql" ? Sequelize.STRING : Sequelize.TIME,
        defaultValue: Sequelize.NOW
    }
}, {createdAt: false, updatedAt: false});