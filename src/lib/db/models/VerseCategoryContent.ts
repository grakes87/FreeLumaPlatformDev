import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryContentAttributes {
  id: number;
  category_id: number;
  verse_reference: string;
  content_text: string;
  book: string;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryContentCreationAttributes extends Optional<VerseCategoryContentAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategoryContent extends Model<VerseCategoryContentAttributes, VerseCategoryContentCreationAttributes> implements VerseCategoryContentAttributes {
  declare id: number;
  declare category_id: number;
  declare verse_reference: string;
  declare content_text: string;
  declare book: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryContent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'verse_categories',
        key: 'id',
      },
    },
    verse_reference: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    book: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'verse_category_content',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['category_id', 'verse_reference'],
        name: 'verse_category_content_category_verse_unique',
      },
    ],
  }
);

export { VerseCategoryContent };
