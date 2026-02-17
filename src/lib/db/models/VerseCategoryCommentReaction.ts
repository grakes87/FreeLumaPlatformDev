import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryCommentReactionAttributes {
  id: number;
  comment_id: number;
  user_id: number;
  created_at: Date;
}

export interface VerseCategoryCommentReactionCreationAttributes extends Optional<VerseCategoryCommentReactionAttributes,
  | 'id'
  | 'created_at'
> {}

class VerseCategoryCommentReaction extends Model<VerseCategoryCommentReactionAttributes, VerseCategoryCommentReactionCreationAttributes> implements VerseCategoryCommentReactionAttributes {
  declare id: number;
  declare comment_id: number;
  declare user_id: number;
  declare readonly created_at: Date;
}

VerseCategoryCommentReaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'verse_category_comments',
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
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'verse_category_comment_reactions',
    timestamps: true,
    underscored: true,
    updatedAt: false,
  }
);

export { VerseCategoryCommentReaction };
