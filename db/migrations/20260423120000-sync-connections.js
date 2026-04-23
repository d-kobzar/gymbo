'use strict';

/**
 * External-data sync infrastructure.
 *
 * SyncConnections — one row per (user, provider) pair. Holds the
 * long-lived bearer token the athlete pastes into their iOS
 * Shortcut / Strava / Garmin OAuth flow. `revokedAt` is the
 * soft-delete: when the athlete disconnects we null the token and
 * stamp revokedAt so their side stops authenticating.
 *
 * HealthSamples — generic time-series bucket for everything pouring
 * in from HealthKit that doesn't map 1:1 onto our own models.
 * Weight goes to BodyMeasurement directly; sleep / RHR / HRV /
 * active-energy / steps land here with their units intact.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SyncConnections', {
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
      provider: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      connectedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('SyncConnections', ['userId', 'provider'], {
      unique: true,
      name: 'sync_connections_user_provider_unique',
    });
    await queryInterface.addIndex('SyncConnections', ['token'], {
      unique: true,
      name: 'sync_connections_token_unique',
      where: { token: { [Sequelize.Op.ne]: null } },
    });

    await queryInterface.createTable('HealthSamples', {
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
      metric: {
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
      value: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      unit: {
        type: Sequelize.STRING(16),
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex(
      'HealthSamples',
      ['userId', 'metric', 'startDate'],
      {
        unique: true,
        name: 'health_samples_user_metric_start_unique',
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('HealthSamples');
    await queryInterface.dropTable('SyncConnections');
  },
};
