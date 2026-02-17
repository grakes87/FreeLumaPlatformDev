import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface WorkshopBanAttributes {
  id: number;
  host_id: number;
  banned_user_id: number;
  banned_by: number;
  workshop_id: number;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkshopBanCreationAttributes extends Optional<WorkshopBanAttributes,
  | 'id'
  | 'reason'
  | 'created_at'
  | 'updated_at'
> {}

class WorkshopBan extends Model<WorkshopBanAttributes, WorkshopBanCreationAttributes> implements WorkshopBanAttributes {
  declare id: number;
  declare host_id: number;
  declare banned_user_id: number;
  declare banned_by: number;
  declare workshop_id: number;
  declare reason: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

WorkshopBan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    host_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    banned_user_id: {
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
    workshop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workshops',
        key: 'id',
      },
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_bans',
    timestamps: true,
    underscored: true,
  }
);

export { WorkshopBan };
