import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PrayerSupportAttributes {
  id: number;
  user_id: number;
  prayer_request_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface PrayerSupportCreationAttributes extends Optional<PrayerSupportAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class PrayerSupport extends Model<PrayerSupportAttributes, PrayerSupportCreationAttributes> implements PrayerSupportAttributes {
  declare id: number;
  declare user_id: number;
  declare prayer_request_id: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PrayerSupport.init(
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
    prayer_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'prayer_requests',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'prayer_supports',
    timestamps: true,
    underscored: true,
  }
);

export { PrayerSupport };
