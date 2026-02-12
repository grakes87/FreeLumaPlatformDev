import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PushSubscriptionAttributes {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PushSubscriptionCreationAttributes extends Optional<PushSubscriptionAttributes,
  | 'id'
  | 'user_agent'
  | 'active'
  | 'created_at'
  | 'updated_at'
> {}

class PushSubscription extends Model<PushSubscriptionAttributes, PushSubscriptionCreationAttributes> implements PushSubscriptionAttributes {
  declare id: number;
  declare user_id: number;
  declare endpoint: string;
  declare p256dh: string;
  declare auth_key: string;
  declare user_agent: string | null;
  declare active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PushSubscription.init(
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
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    p256dh: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    auth_key: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'push_subscriptions',
    timestamps: true,
    underscored: true,
  }
);

export { PushSubscription };
