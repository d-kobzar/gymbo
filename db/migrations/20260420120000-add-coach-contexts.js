'use strict';

/**
 * Phase 3 — managed memory layer on top of the OpenAI thread.
 *
 * One row per user. Profile holds structured goal/level/equipment;
 * rollingSummary is a compressed story of past coaching sessions
 * regenerated asynchronously; recentDecisions is a FIFO capped at 20.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CoachContexts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      profile: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      rollingSummary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      recentDecisions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      messagesSinceSummary: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      summaryStale: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CoachContexts');
  },
};
