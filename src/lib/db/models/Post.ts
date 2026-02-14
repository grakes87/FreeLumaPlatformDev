import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PostAttributes {
  id: number;
  user_id: number;
  body: string;
  post_type: 'text' | 'prayer_request';
  visibility: 'public' | 'followers';
  mode: 'bible' | 'positivity';
  edited: boolean;
  is_anonymous: boolean;
  flagged: boolean;
  hidden: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PostCreationAttributes extends Optional<PostAttributes,
  | 'id'
  | 'post_type'
  | 'visibility'
  | 'edited'
  | 'is_anonymous'
  | 'flagged'
  | 'hidden'
  | 'deleted_at'
  | 'created_at'
  | 'updated_at'
> {}

class Post extends Model<PostAttributes, PostCreationAttributes> implements PostAttributes {
  declare id: number;
  declare user_id: number;
  declare body: string;
  declare post_type: 'text' | 'prayer_request';
  declare visibility: 'public' | 'followers';
  declare mode: 'bible' | 'positivity';
  declare edited: boolean;
  declare is_anonymous: boolean;
  declare flagged: boolean;
  declare hidden: boolean;
  declare deleted_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Post.init(
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
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    post_type: {
      type: DataTypes.ENUM('text', 'prayer_request'),
      allowNull: false,
      defaultValue: 'text',
    },
    visibility: {
      type: DataTypes.ENUM('public', 'followers'),
      allowNull: false,
      defaultValue: 'public',
    },
    mode: {
      type: DataTypes.ENUM('bible', 'positivity'),
      allowNull: false,
    },
    edited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'posts',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export { Post };
