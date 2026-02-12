import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PrayerRequestAttributes {
  id: number;
  post_id: number;
  privacy: 'public' | 'followers' | 'private';
  status: 'active' | 'answered';
  answered_at: Date | null;
  answered_testimony: string | null;
  pray_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PrayerRequestCreationAttributes extends Optional<PrayerRequestAttributes,
  | 'id'
  | 'privacy'
  | 'status'
  | 'answered_at'
  | 'answered_testimony'
  | 'pray_count'
  | 'created_at'
  | 'updated_at'
> {}

class PrayerRequest extends Model<PrayerRequestAttributes, PrayerRequestCreationAttributes> implements PrayerRequestAttributes {
  declare id: number;
  declare post_id: number;
  declare privacy: 'public' | 'followers' | 'private';
  declare status: 'active' | 'answered';
  declare answered_at: Date | null;
  declare answered_testimony: string | null;
  declare pray_count: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PrayerRequest.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    privacy: {
      type: DataTypes.ENUM('public', 'followers', 'private'),
      allowNull: false,
      defaultValue: 'public',
    },
    status: {
      type: DataTypes.ENUM('active', 'answered'),
      allowNull: false,
      defaultValue: 'active',
    },
    answered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    answered_testimony: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pray_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'prayer_requests',
    timestamps: true,
    underscored: true,
  }
);

export { PrayerRequest };
