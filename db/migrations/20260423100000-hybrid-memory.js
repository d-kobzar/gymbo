'use strict';

/**
 * Hybrid rolling-window memory for the coach.
 *
 * - CoachMessages gains `summaryStatus` enum ('none' | 'processed').
 *   Rows with summarizedAt already set are backfilled to 'processed'.
 * - CoachContexts gains `entityMap` JSONB — the structured-facts
 *   layer that sits alongside the textual runningSummary.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('CoachMessages', 'summaryStatus', {
      type: Sequelize.ENUM('none', 'processed'),
      allowNull: false,
      defaultValue: 'none',
    });

    await queryInterface.sequelize.query(`
      UPDATE "CoachMessages"
      SET "summaryStatus" = 'processed'
      WHERE "summarizedAt" IS NOT NULL;
    `);

    await queryInterface.addIndex('CoachMessages', ['userId', 'summaryStatus'], {
      name: 'coach_messages_user_summary_status_idx',
    });

    await queryInterface.addColumn('CoachContexts', 'entityMap', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('CoachContexts', 'entityMap');
    await queryInterface.removeIndex(
      'CoachMessages',
      'coach_messages_user_summary_status_idx',
    );
    await queryInterface.removeColumn('CoachMessages', 'summaryStatus');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_CoachMessages_summaryStatus";`,
    );
  },
};
