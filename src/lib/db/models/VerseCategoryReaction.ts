import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export type VerseReactionType = 'like' | 'love' | 'wow' | 'sad' | 'pray';

export interface VerseCategoryReactionAttributes {
  id: number;
  user_id: number;
  verse_category_content_id: number;
  reaction_type: VerseReactionType;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryReactionCreationAttributes extends Optional<VerseCategoryReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategoryReaction extends Model<VerseCategoryReactionAttributes, VerseCategoryReactionCreationAttributes> implements VerseCategoryReactionAttributes {
  declare id: number;
  declare user_id: number;
  declare verse_category_content_id: number;
  declare reaction_type: VerseReactionType;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryReaction.init(
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
    verse_category_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'verse_category_content',
        key: 'id',
      },
    },
    reaction_type: {
      type: DataTypes.ENUM('like', 'love', 'wow', 'sad', 'pray'),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'verse_category_reactions',
    timestamps: true,
    underscored: true,
  }
);

export { VerseCategoryReaction };
