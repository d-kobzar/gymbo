'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Users
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      telegramId: {
        type: Sequelize.BIGINT,
        unique: true,
        allowNull: false,
      },
      chatId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      language: {
        type: Sequelize.STRING(2),
        defaultValue: 'en',
      },
      timezone: {
        type: Sequelize.STRING(50),
        defaultValue: 'UTC',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 2. Exercises
    await queryInterface.createTable('Exercises', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('Exercises', ['userId', 'name'], {
      unique: true,
      name: 'exercises_user_id_name_unique',
    });

    // 3. TrainingLogs
    await queryInterface.createTable('TrainingLogs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      exerciseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Exercises', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      setNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reps: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      weight: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      rir: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 4. BodyMeasurements
    await queryInterface.createTable('BodyMeasurements', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      weight: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      shoulders: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      arm: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      chest: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      waist: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      abs: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      glutes: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      thigh: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      calf: {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 5. MeasurementPhotos
    await queryInterface.createTable('MeasurementPhotos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      measurementId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'BodyMeasurements', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      s3Key: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 6. Programs
    await queryInterface.createTable('Programs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('Programs', ['userId', 'version'], {
      unique: true,
      name: 'programs_user_id_version_unique',
    });

    // 7. ProgramDays
    await queryInterface.createTable('ProgramDays', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      programId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Programs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      day: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      isRest: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });

    // 8. ProgramExercises
    await queryInterface.createTable('ProgramExercises', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      programDayId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ProgramDays', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      exerciseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Exercises', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sets: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
    });

    // 9. NotificationSettings
    await queryInterface.createTable('NotificationSettings', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      trainingReminder: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      trainingTime: {
        type: Sequelize.STRING(5),
        defaultValue: '18:00',
      },
      trainingDays: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        defaultValue: [1, 3, 5],
      },
      measurementReminder: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      measurementDay: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      measurementTime: {
        type: Sequelize.STRING(5),
        defaultValue: '09:00',
      },
      weeklySummary: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 10. AiThreads
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
        onUpdate: 'CASCADE',
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AiThreads');
    await queryInterface.dropTable('NotificationSettings');
    await queryInterface.dropTable('ProgramExercises');
    await queryInterface.dropTable('ProgramDays');
    await queryInterface.dropTable('Programs');
    await queryInterface.dropTable('MeasurementPhotos');
    await queryInterface.dropTable('BodyMeasurements');
    await queryInterface.dropTable('TrainingLogs');
    await queryInterface.dropTable('Exercises');
    await queryInterface.dropTable('Users');
  },
};
