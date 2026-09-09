import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
    const tableDescription = await queryInterface.describeTable('speedtests');

    if (!tableDescription.serverName) {
        await queryInterface.addColumn('speedtests', 'serverName', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }

    if (!tableDescription.serverHost) {
        await queryInterface.addColumn('speedtests', 'serverHost', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }
}
