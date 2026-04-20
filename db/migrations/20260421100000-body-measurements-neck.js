'use strict';

/**
 * Add neck circumference to body measurements. Nullable so historic
 * rows stay valid and new entries can omit it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('BodyMeasurements', 'neck', {
      type: Sequelize.DECIMAL(5, 1),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('BodyMeasurements', 'neck');
  },
};
