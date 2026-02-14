import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';
import type { ReactionType } from '@/lib/utils/constants';

export interface VideoReactionAttributes {
  id: number;
  user_id: number;
  video_id: number;
  reaction_type: ReactionType;
  created_at: Date;
  updated_at: Date;
}

export interface VideoReactionCreationAttributes extends Optional<VideoReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class VideoReaction extends Model<VideoReactionAttributes, VideoReactionCreationAttributes> implements VideoReactionAttributes {
  declare id: number;
  declare user_id: number;
  declare video_id: number;
  declare reaction_type: ReactionType;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VideoReaction.init(
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
    video_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'videos',
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
    tableName: 'video_reactions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'video_id'],
        name: 'unique_user_video_reaction',
      },
    ],
  }
);

export { VideoReaction };
