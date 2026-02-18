import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface SmsLogAttributes {
  id: number;
  recipient_id: number;
  sms_type: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  twilio_sid: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SmsLogCreationAttributes extends Optional<SmsLogAttributes,
  | 'id'
  | 'status'
  | 'twilio_sid'
  | 'sent_at'
  | 'delivered_at'
  | 'created_at'
  | 'updated_at'
> {}

class SmsLog extends Model<SmsLogAttributes, SmsLogCreationAttributes> implements SmsLogAttributes {
  declare id: number;
  declare recipient_id: number;
  declare sms_type: string;
  declare body: string;
  declare status: 'queued' | 'sent' | 'delivered' | 'failed';
  declare twilio_sid: string | null;
  declare sent_at: Date | null;
  declare delivered_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

SmsLog.init(
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
    sms_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    body: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('queued', 'sent', 'delivered', 'failed'),
      allowNull: false,
      defaultValue: 'queued',
    },
    twilio_sid: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'sms_logs',
    timestamps: true,
    underscored: true,
  }
);

export { SmsLog };
