'use strict';

/**
 * Gate: a user who hasn't filled the onboarding quiz (profile +
 * first measurement) is force-redirected to /onboarding on the
 * Mini App. Backing flag is nullable TIMESTAMP on Users.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'onboardedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'onboardedAt');
  },
};
