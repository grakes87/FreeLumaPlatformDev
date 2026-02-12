import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface UserSettingAttributes {
  id: number;
  user_id: number;
  dark_mode: 'light' | 'dark' | 'system';
  push_enabled: boolean;
  email_notifications: boolean;
  daily_reminder_time: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSettingCreationAttributes extends Optional<UserSettingAttributes,
  | 'id'
  | 'dark_mode'
  | 'push_enabled'
  | 'email_notifications'
  | 'daily_reminder_time'
  | 'quiet_hours_start'
  | 'quiet_hours_end'
  | 'created_at'
  | 'updated_at'
> {}

class UserSetting extends Model<UserSettingAttributes, UserSettingCreationAttributes> implements UserSettingAttributes {
  declare id: number;
  declare user_id: number;
  declare dark_mode: 'light' | 'dark' | 'system';
  declare push_enabled: boolean;
  declare email_notifications: boolean;
  declare daily_reminder_time: string;
  declare quiet_hours_start: string | null;
  declare quiet_hours_end: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

UserSetting.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    dark_mode: {
      type: DataTypes.ENUM('light', 'dark', 'system'),
      defaultValue: 'system',
      allowNull: false,
    },
    push_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    daily_reminder_time: {
      type: DataTypes.STRING(5),
      defaultValue: '08:00',
      allowNull: false,
    },
    quiet_hours_start: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    quiet_hours_end: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'user_settings',
    timestamps: true,
    underscored: true,
  }
);

export { UserSetting };
