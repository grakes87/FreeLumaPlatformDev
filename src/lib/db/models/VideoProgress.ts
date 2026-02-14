import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VideoProgressAttributes {
  id: number;
  user_id: number;
  video_id: number;
  watched_seconds: number;
  duration_seconds: number;
  last_position: number;
  completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VideoProgressCreationAttributes extends Optional<VideoProgressAttributes,
  | 'id'
  | 'watched_seconds'
  | 'duration_seconds'
  | 'last_position'
  | 'completed'
  | 'created_at'
  | 'updated_at'
> {}

class VideoProgress extends Model<VideoProgressAttributes, VideoProgressCreationAttributes> implements VideoProgressAttributes {
  declare id: number;
  declare user_id: number;
  declare video_id: number;
  declare watched_seconds: number;
  declare duration_seconds: number;
  declare last_position: number;
  declare completed: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VideoProgress.init(
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
    watched_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'video_progress',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'video_id'],
        name: 'unique_user_video_progress',
      },
    ],
  }
);

export { VideoProgress };
