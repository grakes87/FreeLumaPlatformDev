import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface AnnouncementDismissalAttributes {
  id: number;
  user_id: number;
  announcement_id: number;
  created_at: Date;
}

export type AnnouncementDismissalCreationAttributes = Optional<AnnouncementDismissalAttributes,
  | 'id'
  | 'created_at'
>;

class AnnouncementDismissal extends Model<AnnouncementDismissalAttributes, AnnouncementDismissalCreationAttributes> implements AnnouncementDismissalAttributes {
  declare id: number;
  declare user_id: number;
  declare announcement_id: number;
  declare readonly created_at: Date;
}

AnnouncementDismissal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    announcement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AnnouncementDismissal',
    tableName: 'announcement_dismissals',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { AnnouncementDismissal };
