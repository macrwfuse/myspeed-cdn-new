import Sequelize from 'sequelize';
import db from '../config/database.js';

export default db.define("recommendations", {
    ping: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    download: {
        type: Sequelize.DOUBLE,
        allowNull: false
    },
    upload: {
        type: Sequelize.DOUBLE,
        allowNull: false
    }
}, {createdAt: false, updatedAt: false});