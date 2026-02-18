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
  messaging_access: 'everyone' | 'followers' | 'mutual' | 'nobody';
  email_dm_notifications: boolean;
  email_follow_notifications: boolean;
  email_prayer_notifications: boolean;
  email_daily_reminder: boolean;
  email_reaction_comment_notifications: boolean;
  email_workshop_notifications: boolean;
  email_new_video_notifications: boolean;
  sms_notifications_enabled: boolean;
  sms_dm_notifications: boolean;
  sms_follow_notifications: boolean;
  sms_prayer_notifications: boolean;
  sms_daily_reminder: boolean;
  sms_workshop_notifications: boolean;
  reminder_timezone: string | null;
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
  | 'messaging_access'
  | 'email_dm_notifications'
  | 'email_follow_notifications'
  | 'email_prayer_notifications'
  | 'email_daily_reminder'
  | 'email_reaction_comment_notifications'
  | 'email_workshop_notifications'
  | 'email_new_video_notifications'
  | 'sms_notifications_enabled'
  | 'sms_dm_notifications'
  | 'sms_follow_notifications'
  | 'sms_prayer_notifications'
  | 'sms_daily_reminder'
  | 'sms_workshop_notifications'
  | 'reminder_timezone'
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
  declare messaging_access: 'everyone' | 'followers' | 'mutual' | 'nobody';
  declare email_dm_notifications: boolean;
  declare email_follow_notifications: boolean;
  declare email_prayer_notifications: boolean;
  declare email_daily_reminder: boolean;
  declare email_reaction_comment_notifications: boolean;
  declare email_workshop_notifications: boolean;
  declare email_new_video_notifications: boolean;
  declare sms_notifications_enabled: boolean;
  declare sms_dm_notifications: boolean;
  declare sms_follow_notifications: boolean;
  declare sms_prayer_notifications: boolean;
  declare sms_daily_reminder: boolean;
  declare sms_workshop_notifications: boolean;
  declare reminder_timezone: string | null;
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
    messaging_access: {
      type: DataTypes.ENUM('everyone', 'followers', 'mutual', 'nobody'),
      allowNull: false,
      defaultValue: 'mutual',
    },
    email_dm_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_follow_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_prayer_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_daily_reminder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_reaction_comment_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_workshop_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    email_new_video_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_notifications_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sms_dm_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_follow_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_prayer_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_daily_reminder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_workshop_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    reminder_timezone: {
      type: DataTypes.STRING(50),
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
