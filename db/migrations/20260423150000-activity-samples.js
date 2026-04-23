'use strict';

/**
 * ActivitySamples — structured workout / cardio / calorie history
 * coming from HealthKit (Apple Watch rings, outdoor runs, cycling,
 * etc.) or Strava / Garmin in future waves. Kept in its own table
 * so:
 *   - the columns match workout semantics (kind, duration, energy,
 *     distance, HR min/avg/max) instead of the generic (metric,
 *     value, unit) shape HealthSamples uses for instantaneous
 *     measurements,
 *   - queries on the coach side ("how many sessions this week",
 *     "total weekly cardio energy") don't have to LIKE-match on
 *     metric-prefix strings.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ActivitySamples', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      source: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'apple_health',
      },
      kind: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      energy: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      distance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      avgHr: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      maxHr: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(
      'ActivitySamples',
      ['userId', 'kind', 'startDate'],
      {
        unique: true,
        name: 'activity_samples_user_kind_start_unique',
      },
    );

    await queryInterface.addIndex('ActivitySamples', ['userId', 'startDate'], {
      name: 'activity_samples_user_start_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ActivitySamples');
  },
};
