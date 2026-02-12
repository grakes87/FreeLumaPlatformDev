import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface UserCategoryAttributes {
  id: number;
  user_id: number;
  category_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserCategoryCreationAttributes extends Optional<UserCategoryAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class UserCategory extends Model<UserCategoryAttributes, UserCategoryCreationAttributes> implements UserCategoryAttributes {
  declare id: number;
  declare user_id: number;
  declare category_id: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

UserCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'user_categories',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'category_id'],
        name: 'unique_user_category',
      },
    ],
  }
);

export { UserCategory };
