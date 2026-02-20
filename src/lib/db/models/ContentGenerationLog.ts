import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export type GenerationLogStatus = 'started' | 'success' | 'failed';

export interface ContentGenerationLogAttributes {
  id: number;
  daily_content_id: number;
  field: string;
  translation_code: string | null;
  heygen_video_id: string | null;
  status: GenerationLogStatus;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContentGenerationLogCreationAttributes extends Optional<ContentGenerationLogAttributes,
  | 'id'
  | 'translation_code'
  | 'heygen_video_id'
  | 'status'
  | 'error_message'
  | 'duration_ms'
  | 'created_at'
  | 'updated_at'
> {}

class ContentGenerationLog extends Model<ContentGenerationLogAttributes, ContentGenerationLogCreationAttributes> implements ContentGenerationLogAttributes {
  declare id: number;
  declare daily_content_id: number;
  declare field: string;
  declare translation_code: string | null;
  declare heygen_video_id: string | null;
  declare status: GenerationLogStatus;
  declare error_message: string | null;
  declare duration_ms: number | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

ContentGenerationLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    field: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    translation_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    heygen_video_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('started', 'success', 'failed'),
      allowNull: false,
      defaultValue: 'started',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'content_generation_logs',
    timestamps: true,
    underscored: true,
  }
);

export default ContentGenerationLog;
