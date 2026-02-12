import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';
import type { ReactionType } from '@/lib/utils/constants';

export interface PostCommentReactionAttributes {
  id: number;
  user_id: number;
  comment_id: number;
  reaction_type: ReactionType;
  created_at: Date;
  updated_at: Date;
}

export interface PostCommentReactionCreationAttributes extends Optional<PostCommentReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class PostCommentReaction extends Model<PostCommentReactionAttributes, PostCommentReactionCreationAttributes> implements PostCommentReactionAttributes {
  declare id: number;
  declare user_id: number;
  declare comment_id: number;
  declare reaction_type: ReactionType;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PostCommentReaction.init(
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
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'post_comments',
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
    tableName: 'post_comment_reactions',
    timestamps: true,
    underscored: true,
  }
);

export { PostCommentReaction };
