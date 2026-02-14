import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VideoCategoryAttributes {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VideoCategoryCreationAttributes extends Optional<VideoCategoryAttributes,
  | 'id'
  | 'description'
  | 'sort_order'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
> {}

class VideoCategory extends Model<VideoCategoryAttributes, VideoCategoryCreationAttributes> implements VideoCategoryAttributes {
  declare id: number;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare sort_order: number;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VideoCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'video_categories',
    timestamps: true,
    underscored: true,
  }
);

export { VideoCategory };
