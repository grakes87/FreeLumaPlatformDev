import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

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
      type: DataTypes.STRING(500),
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
    ],
  }
);

export { DailyContent };
