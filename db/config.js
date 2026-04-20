// Sequelize CLI config — loaded by .sequelizerc for `npx sequelize-cli`.
// Separate from the NestJS runtime config in src/core/config/database.config.ts.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gymbo',
    dialect: 'postgres',
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
};
