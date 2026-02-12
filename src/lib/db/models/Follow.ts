import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface FollowAttributes {
  id: number;
  follower_id: number;
  following_id: number;
  status: 'active' | 'pending';
  created_at: Date;
  updated_at: Date;
}

export interface FollowCreationAttributes extends Optional<FollowAttributes,
  | 'id'
  | 'status'
  | 'created_at'
  | 'updated_at'
> {}

class Follow extends Model<FollowAttributes, FollowCreationAttributes> implements FollowAttributes {
  declare id: number;
  declare follower_id: number;
  declare following_id: number;
  declare status: 'active' | 'pending';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Follow.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    follower_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    following_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'pending'),
      allowNull: false,
      defaultValue: 'active',
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'follows',
    timestamps: true,
    underscored: true,
  }
);

export { Follow };
