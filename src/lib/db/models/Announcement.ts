import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface AnnouncementAttributes {
  id: number;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  target_mode: 'all' | 'bible' | 'positivity';
  priority: number;
  active: boolean;
  starts_at: Date | null;
  expires_at: Date | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export type AnnouncementCreationAttributes = Optional<AnnouncementAttributes,
  | 'id'
  | 'link_url'
  | 'link_label'
  | 'media_url'
  | 'media_type'
  | 'target_mode'
  | 'priority'
  | 'active'
  | 'starts_at'
  | 'expires_at'
  | 'created_at'
  | 'updated_at'
>;

class Announcement extends Model<AnnouncementAttributes, AnnouncementCreationAttributes> implements AnnouncementAttributes {
  declare id: number;
  declare title: string;
  declare body: string;
  declare link_url: string | null;
  declare link_label: string | null;
  declare media_url: string | null;
  declare media_type: 'image' | 'video' | null;
  declare target_mode: 'all' | 'bible' | 'positivity';
  declare priority: number;
  declare active: boolean;
  declare starts_at: Date | null;
  declare expires_at: Date | null;
  declare created_by: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Announcement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    link_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    link_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    media_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    media_type: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: true,
    },
    target_mode: {
      type: DataTypes.ENUM('all', 'bible', 'positivity'),
      allowNull: false,
      defaultValue: 'all',
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Announcement',
    tableName: 'announcements',
    timestamps: true,
    underscored: true,
  }
);

export { Announcement };
