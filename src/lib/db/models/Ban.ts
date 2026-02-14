import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface BanAttributes {
  id: number;
  user_id: number;
  banned_by: number;
  reason: string;
  duration: '24h' | '7d' | '30d' | 'permanent';
  expires_at: Date | null;
  lifted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BanCreationAttributes extends Optional<BanAttributes,
  | 'id'
  | 'expires_at'
  | 'lifted_at'
  | 'created_at'
  | 'updated_at'
> {}

class Ban extends Model<BanAttributes, BanCreationAttributes> implements BanAttributes {
  declare id: number;
  declare user_id: number;
  declare banned_by: number;
  declare reason: string;
  declare duration: '24h' | '7d' | '30d' | 'permanent';
  declare expires_at: Date | null;
  declare lifted_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Ban.init(
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
    banned_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    duration: {
      type: DataTypes.ENUM('24h', '7d', '30d', 'permanent'),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lifted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'bans',
    timestamps: true,
    underscored: true,
  }
);

export { Ban };
