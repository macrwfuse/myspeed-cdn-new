import Sequelize from 'sequelize';
import db from '../config/database.js';

export default db.define("nodes", {
    name: {
        type: Sequelize.STRING,
        defaultValue: "MySpeed Server"
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: true
    }
}, {createdAt: false, updatedAt: false});