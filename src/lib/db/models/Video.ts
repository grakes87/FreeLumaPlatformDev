import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VideoAttributes {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  video_url: string;
  thumbnail_url: string | null;
  caption_url: string | null;
  duration_seconds: number;
  view_count: number;
  is_hero: boolean;
  min_age: number;
  published: boolean;
  published_at: Date | null;
  uploaded_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface VideoCreationAttributes extends Optional<VideoAttributes,
  | 'id'
  | 'category_id'
  | 'description'
  | 'thumbnail_url'
  | 'caption_url'
  | 'duration_seconds'
  | 'view_count'
  | 'is_hero'
  | 'min_age'
  | 'published'
  | 'published_at'
  | 'created_at'
  | 'updated_at'
> {}

class Video extends Model<VideoAttributes, VideoCreationAttributes> implements VideoAttributes {
  declare id: number;
  declare title: string;
  declare description: string | null;
  declare category_id: number | null;
  declare video_url: string;
  declare thumbnail_url: string | null;
  declare caption_url: string | null;
  declare duration_seconds: number;
  declare view_count: number;
  declare is_hero: boolean;
  declare min_age: number;
  declare published: boolean;
  declare published_at: Date | null;
  declare uploaded_by: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Video.init(
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'video_categories',
        key: 'id',
      },
    },
    video_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    caption_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    view_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_hero: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    min_age: {
      type: DataTypes.TINYINT.UNSIGNED,
      defaultValue: 0,
      allowNull: false,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'videos',
    timestamps: true,
    underscored: true,
  }
);

export { Video };
