import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface CategoryAttributes {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryCreationAttributes extends Optional<CategoryAttributes,
  | 'id'
  | 'description'
  | 'icon'
  | 'sort_order'
  | 'active'
  | 'created_at'
  | 'updated_at'
> {}

class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  declare id: number;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare icon: string | null;
  declare sort_order: number;
  declare active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Category.init(
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
    icon: {
      type: DataTypes.STRING(50),
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
    tableName: 'categories',
    timestamps: true,
    underscored: true,
  }
);

export { Category };
