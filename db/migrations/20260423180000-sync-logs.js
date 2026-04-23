'use strict';

/**
 * SyncLogs — audit trail for every ingest attempt. One row per
 * incoming POST to /api/sync/<provider>/ingest, regardless of auth
 * outcome. Lets us answer:
 *   - "did my Shortcut fire at 8 AM this morning?" (yes — row exists)
 *   - "why did it fail?" (status / error columns)
 *   - "how much data came through?" (counts + payloadBytes)
 *
 * Retention: handled by the weekly summary cron later — 30-day
 * rolling window should be plenty.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SyncLogs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      provider: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      payloadBytes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      counts: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      durationMs: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      error: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('SyncLogs', ['userId', 'createdAt'], {
      name: 'sync_logs_user_created_idx',
    });
    await queryInterface.addIndex('SyncLogs', ['provider', 'status', 'createdAt'], {
      name: 'sync_logs_provider_status_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SyncLogs');
  },
};
