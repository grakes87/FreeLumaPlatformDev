import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface EmailLogAttributes {
  id: number;
  recipient_id: number;
  email_type: 'dm_batch' | 'follow_request' | 'prayer_response' | 'daily_reminder';
  subject: string;
  status: 'queued' | 'sent' | 'bounced' | 'opened';
  sent_at: Date | null;
  opened_at: Date | null;
  tracking_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailLogCreationAttributes extends Optional<EmailLogAttributes,
  | 'id'
  | 'status'
  | 'sent_at'
  | 'opened_at'
  | 'tracking_id'
  | 'created_at'
  | 'updated_at'
> {}

class EmailLog extends Model<EmailLogAttributes, EmailLogCreationAttributes> implements EmailLogAttributes {
  declare id: number;
  declare recipient_id: number;
  declare email_type: 'dm_batch' | 'follow_request' | 'prayer_response' | 'daily_reminder';
  declare subject: string;
  declare status: 'queued' | 'sent' | 'bounced' | 'opened';
  declare sent_at: Date | null;
  declare opened_at: Date | null;
  declare tracking_id: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

EmailLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    email_type: {
      type: DataTypes.ENUM('dm_batch', 'follow_request', 'prayer_response', 'daily_reminder'),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('queued', 'sent', 'bounced', 'opened'),
      allowNull: false,
      defaultValue: 'queued',
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    opened_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tracking_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'email_logs',
    timestamps: true,
    underscored: true,
  }
);

export { EmailLog };
