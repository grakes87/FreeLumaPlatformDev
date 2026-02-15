import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface WorkshopInviteAttributes {
  id: number;
  workshop_id: number;
  user_id: number;
  invited_by: number;
  created_at: Date;
}

export interface WorkshopInviteCreationAttributes extends Optional<WorkshopInviteAttributes,
  | 'id'
  | 'created_at'
> {}

class WorkshopInvite extends Model<WorkshopInviteAttributes, WorkshopInviteCreationAttributes> implements WorkshopInviteAttributes {
  declare id: number;
  declare workshop_id: number;
  declare user_id: number;
  declare invited_by: number;
  declare readonly created_at: Date;
}

WorkshopInvite.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    workshop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workshops',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    invited_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_invites',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { WorkshopInvite };
