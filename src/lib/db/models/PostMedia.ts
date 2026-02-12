import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PostMediaAttributes {
  id: number;
  post_id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface PostMediaCreationAttributes extends Optional<PostMediaAttributes,
  | 'id'
  | 'thumbnail_url'
  | 'width'
  | 'height'
  | 'duration'
  | 'sort_order'
  | 'created_at'
  | 'updated_at'
> {}

class PostMedia extends Model<PostMediaAttributes, PostMediaCreationAttributes> implements PostMediaAttributes {
  declare id: number;
  declare post_id: number;
  declare media_type: 'image' | 'video';
  declare url: string;
  declare thumbnail_url: string | null;
  declare width: number | null;
  declare height: number | null;
  declare duration: number | null;
  declare sort_order: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PostMedia.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    media_type: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_media',
    timestamps: true,
    underscored: true,
  }
);

export { PostMedia };
