import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryMediaAttributes {
  id: number;
  category_id: number | null;
  media_url: string;
  media_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryMediaCreationAttributes extends Optional<VerseCategoryMediaAttributes,
  | 'id'
  | 'category_id'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategoryMedia extends Model<VerseCategoryMediaAttributes, VerseCategoryMediaCreationAttributes> implements VerseCategoryMediaAttributes {
  declare id: number;
  declare category_id: number | null;
  declare media_url: string;
  declare media_key: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryMedia.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'verse_categories',
        key: 'id',
      },
    },
    media_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    media_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'verse_category_media',
    timestamps: true,
    underscored: true,
  }
);

export { VerseCategoryMedia };
