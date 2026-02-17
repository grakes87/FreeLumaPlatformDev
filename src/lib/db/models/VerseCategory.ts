import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryAttributes {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryCreationAttributes extends Optional<VerseCategoryAttributes,
  | 'id'
  | 'description'
  | 'thumbnail_url'
  | 'sort_order'
  | 'active'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategory extends Model<VerseCategoryAttributes, VerseCategoryCreationAttributes> implements VerseCategoryAttributes {
  declare id: number;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare thumbnail_url: string | null;
  declare sort_order: number;
  declare active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
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
    modelName: 'VerseCategory',
    tableName: 'verse_categories',
    timestamps: true,
    underscored: true,
  }
);

export { VerseCategory };
