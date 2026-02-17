import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface BibleTranslationAttributes {
  id: number;
  code: string;
  name: string;
  api_bible_id: string | null;
  language: string;
  is_public_domain: boolean;
  attribution_text: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BibleTranslationCreationAttributes extends Optional<BibleTranslationAttributes,
  | 'id'
  | 'api_bible_id'
  | 'language'
  | 'is_public_domain'
  | 'attribution_text'
  | 'active'
  | 'created_at'
  | 'updated_at'
> {}

class BibleTranslation extends Model<BibleTranslationAttributes, BibleTranslationCreationAttributes> implements BibleTranslationAttributes {
  declare id: number;
  declare code: string;
  declare name: string;
  declare api_bible_id: string | null;
  declare language: string;
  declare is_public_domain: boolean;
  declare attribution_text: string | null;
  declare active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

BibleTranslation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(10),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    api_bible_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    language: {
      type: DataTypes.STRING(10),
      defaultValue: 'en',
      allowNull: false,
    },
    is_public_domain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    attribution_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'bible_translations',
    timestamps: true,
    underscored: true,
  }
);

export { BibleTranslation };
