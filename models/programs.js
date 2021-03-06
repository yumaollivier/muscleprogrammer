const { Sequelize, DataTypes } = require('sequelize');

const sequelize = require('../database/database');

const programSchema = sequelize.define('Program', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "",
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0.
  },
  trainingNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0.
  },
  trainingsIds: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "",
  },
});

module.exports = programSchema;
