import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';
import type { ReactionType } from '@/lib/utils/constants';

export interface PostReactionAttributes {
  id: number;
  user_id: number;
  post_id: number;
  reaction_type: ReactionType;
  created_at: Date;
  updated_at: Date;
}

export interface PostReactionCreationAttributes extends Optional<PostReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class PostReaction extends Model<PostReactionAttributes, PostReactionCreationAttributes> implements PostReactionAttributes {
  declare id: number;
  declare user_id: number;
  declare post_id: number;
  declare reaction_type: ReactionType;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PostReaction.init(
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
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    reaction_type: {
      type: DataTypes.ENUM('like', 'love', 'haha', 'wow', 'sad', 'pray'),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_reactions',
    timestamps: true,
    underscored: true,
  }
);

export { PostReaction };
