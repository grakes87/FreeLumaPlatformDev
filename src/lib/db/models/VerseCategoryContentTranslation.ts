import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryContentTranslationAttributes {
  id: number;
  verse_category_content_id: number;
  translation_code: string;
  translated_text: string;
  source: 'database' | 'api';
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryContentTranslationCreationAttributes extends Optional<VerseCategoryContentTranslationAttributes,
  | 'id'
  | 'source'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategoryContentTranslation extends Model<VerseCategoryContentTranslationAttributes, VerseCategoryContentTranslationCreationAttributes> implements VerseCategoryContentTranslationAttributes {
  declare id: number;
  declare verse_category_content_id: number;
  declare translation_code: string;
  declare translated_text: string;
  declare source: 'database' | 'api';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryContentTranslation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    verse_category_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'verse_category_content',
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
    tableName: 'verse_category_content_translations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['verse_category_content_id', 'translation_code'],
        name: 'verse_cat_content_trans_unique',
      },
    ],
  }
);

export { VerseCategoryContentTranslation };
