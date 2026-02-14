import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PostImpressionAttributes {
  id: number;
  post_id: number;
  user_id: number;
  created_at: Date;
}

export interface PostImpressionCreationAttributes extends Optional<PostImpressionAttributes,
  | 'id'
  | 'created_at'
> {}

class PostImpression extends Model<PostImpressionAttributes, PostImpressionCreationAttributes> implements PostImpressionAttributes {
  declare id: number;
  declare post_id: number;
  declare user_id: number;
  declare readonly created_at: Date;
}

PostImpression.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_impressions',
    timestamps: false,
    underscored: true,
  }
);

export { PostImpression };
