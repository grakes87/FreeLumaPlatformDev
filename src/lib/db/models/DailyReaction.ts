import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';
import type { ReactionType } from '@/lib/utils/constants';

export interface DailyReactionAttributes {
  id: number;
  user_id: number;
  daily_content_id: number;
  reaction_type: ReactionType;
  created_at: Date;
  updated_at: Date;
}

export interface DailyReactionCreationAttributes extends Optional<DailyReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class DailyReaction extends Model<DailyReactionAttributes, DailyReactionCreationAttributes> implements DailyReactionAttributes {
  declare id: number;
  declare user_id: number;
  declare daily_content_id: number;
  declare reaction_type: ReactionType;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DailyReaction.init(
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
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'daily_content',
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
    tableName: 'daily_reactions',
    timestamps: true,
    underscored: true,
  }
);

export { DailyReaction };
