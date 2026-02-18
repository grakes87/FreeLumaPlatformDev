import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export type DailyContentStatus = 'empty' | 'generated' | 'assigned' | 'submitted' | 'rejected' | 'approved';

export interface DailyContentAttributes {
  id: number;
  post_date: string;
  mode: 'bible' | 'positivity';
  title: string;
  content_text: string;
  verse_reference: string | null;
  chapter_reference: string | null;
  video_background_url: string;
  lumashort_video_url: string | null;
  language: 'en' | 'es';
  published: boolean;
  status: DailyContentStatus;
  creator_id: number | null;
  camera_script: string | null;
  devotional_reflection: string | null;
  meditation_script: string | null;
  meditation_audio_url: string | null;
  background_prompt: string | null;
  rejection_note: string | null;
  creator_video_url: string | null;
  creator_video_thumbnail: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DailyContentCreationAttributes extends Optional<DailyContentAttributes,
  | 'id'
  | 'verse_reference'
  | 'chapter_reference'
  | 'lumashort_video_url'
  | 'language'
  | 'published'
  | 'status'
  | 'creator_id'
  | 'camera_script'
  | 'devotional_reflection'
  | 'meditation_script'
  | 'meditation_audio_url'
  | 'background_prompt'
  | 'rejection_note'
  | 'creator_video_url'
  | 'creator_video_thumbnail'
  | 'created_at'
  | 'updated_at'
> {}

class DailyContent extends Model<DailyContentAttributes, DailyContentCreationAttributes> implements DailyContentAttributes {
  declare id: number;
  declare post_date: string;
  declare mode: 'bible' | 'positivity';
  declare title: string;
  declare content_text: string;
  declare verse_reference: string | null;
  declare chapter_reference: string | null;
  declare video_background_url: string;
  declare lumashort_video_url: string | null;
  declare language: 'en' | 'es';
  declare published: boolean;
  declare status: DailyContentStatus;
  declare creator_id: number | null;
  declare camera_script: string | null;
  declare devotional_reflection: string | null;
  declare meditation_script: string | null;
  declare meditation_audio_url: string | null;
  declare background_prompt: string | null;
  declare rejection_note: string | null;
  declare creator_video_url: string | null;
  declare creator_video_thumbnail: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DailyContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM('bible', 'positivity'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    verse_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    chapter_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    video_background_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    lumashort_video_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    language: {
      type: DataTypes.ENUM('en', 'es'),
      defaultValue: 'en',
      allowNull: false,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('empty', 'generated', 'assigned', 'submitted', 'rejected', 'approved'),
      allowNull: false,
      defaultValue: 'empty',
    },
    creator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'luma_short_creators',
        key: 'id',
      },
    },
    camera_script: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    devotional_reflection: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meditation_script: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meditation_audio_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    background_prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejection_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    creator_video_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    creator_video_thumbnail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'daily_content',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['post_date', 'mode', 'language'],
        name: 'unique_post_date_mode_language',
      },
      {
        fields: ['status', 'mode', 'post_date'],
        name: 'idx_status_mode_date',
      },
    ],
  }
);

export { DailyContent };
