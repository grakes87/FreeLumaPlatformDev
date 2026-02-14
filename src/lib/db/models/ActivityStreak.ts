import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ActivityStreakAttributes {
  id: number;
  user_id: number;
  activity_date: string;
  activities: string;
  created_at: Date;
  updated_at: Date;
}

export interface ActivityStreakCreationAttributes extends Optional<ActivityStreakAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class ActivityStreak extends Model<ActivityStreakAttributes, ActivityStreakCreationAttributes> implements ActivityStreakAttributes {
  declare id: number;
  declare user_id: number;
  declare activity_date: string;
  declare activities: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

ActivityStreak.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    activity_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    activities: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'activity_streaks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'activity_date'],
        name: 'idx_activity_streaks_user_date',
      },
    ],
  }
);

export { ActivityStreak };
