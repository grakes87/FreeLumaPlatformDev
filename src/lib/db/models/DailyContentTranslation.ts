import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface DailyContentTranslationAttributes {
  id: number;
  daily_content_id: number;
  translation_code: string;
  translated_text: string;
  verse_reference: string | null;
  source: 'database' | 'api';
  created_at: Date;
  updated_at: Date;
}

export interface DailyContentTranslationCreationAttributes extends Optional<DailyContentTranslationAttributes,
  | 'id'
  | 'verse_reference'
  | 'source'
  | 'created_at'
  | 'updated_at'
> {}

class DailyContentTranslation extends Model<DailyContentTranslationAttributes, DailyContentTranslationCreationAttributes> implements DailyContentTranslationAttributes {
  declare id: number;
  declare daily_content_id: number;
  declare translation_code: string;
  declare translated_text: string;
  declare verse_reference: string | null;
  declare source: 'database' | 'api';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DailyContentTranslation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'daily_content',
        key: 'id',
      },
    },
    translation_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    translated_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    verse_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM('database', 'api'),
      defaultValue: 'database',
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'daily_content_translations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['daily_content_id', 'translation_code'],
        name: 'unique_content_translation',
      },
    ],
  }
);

export { DailyContentTranslation };
