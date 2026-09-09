import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
    const tableDescription = await queryInterface.describeTable('speedtests');

    if (!tableDescription.jitter) {
        await queryInterface.addColumn('speedtests', 'jitter', {
            type: DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: null
        });
    }
}
