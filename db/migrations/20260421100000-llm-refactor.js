'use strict';

/**
 * Move off the deprecated OpenAI Assistants API.
 *
 * - Drop AiThreads (per-user OpenAI thread + assistant id): we no
 *   longer chain via previous_response_id / threads; the whole
 *   conversation lives in our DB.
 * - Create CoachMessages: one row per user/assistant turn. Rows are
 *   persisted BEFORE we call the LLM so a crash during processing
 *   never loses user input. `processedAt` flips when the message has
 *   been included in an LLM batch; `summarizedAt` flips when the row
 *   has been folded into CoachContexts.rollingSummary and is safe to
 *   garbage-collect. An index on (userId, processedAt) speeds up the
 *   debounce/recovery scan that runs on every batch fire.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('AiThreads');

    await queryInterface.createTable('CoachMessages', {
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
      role: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      summarizedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('CoachMessages', ['userId', 'processedAt'], {
      name: 'coach_messages_user_unprocessed_idx',
    });
    await queryInterface.addIndex('CoachMessages', ['userId', 'createdAt'], {
      name: 'coach_messages_user_created_idx',
    });
    await queryInterface.addIndex('CoachMessages', ['summarizedAt'], {
      name: 'coach_messages_summarized_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CoachMessages');

    await queryInterface.createTable('AiThreads', {
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
      threadId: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      assistantId: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
};
