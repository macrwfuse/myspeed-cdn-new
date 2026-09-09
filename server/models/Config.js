import Sequelize from 'sequelize';
import db from '../config/database.js';

export default db.define("config", {
    key: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
    },
    value: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, {freezeTableName: true, createdAt: false, updatedAt: false});