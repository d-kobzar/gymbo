'use strict';

/**
 * Resync all auto-increment sequences to MAX(id) + 1.
 *
 * Symptom we're fixing: creating a new row fails with
 * "id: id must be unique" because the sequence is behind the
 * highest id in the table. Usually happens after a backup restore
 * / JSON import where rows were inserted with explicit ids without
 * bumping the sequence.
 *
 * We SELECT setval(pg_get_serial_sequence('"Table"', 'id'),
 * GREATEST(MAX(id), 1)) for every table we manage. No-op if the
 * sequence is already ahead.
 */
const TABLES = [
  'Users',
  'Exercises',
  'TrainingLogs',
  'BodyMeasurements',
  'MeasurementPhotos',
  'Programs',
  'ProgramDays',
  'ProgramExercises',
  'NotificationSettings',
  'CoachContexts',
  'CoachMessages',
];

module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT to_regclass('"${table}"') AS reg;`,
      );
      if (!exists?.[0]?.reg) continue;

      await queryInterface.sequelize.query(
        `SELECT setval(
           pg_get_serial_sequence('"${table}"', 'id'),
           GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1)
         );`,
      );
    }
  },

  async down() {
    // No-op — resyncing sequences is idempotent and cannot be
    // meaningfully reversed.
  },
};
