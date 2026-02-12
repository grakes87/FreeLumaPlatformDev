import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface BlockAttributes {
  id: number;
  blocker_id: number;
  blocked_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface BlockCreationAttributes extends Optional<BlockAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class Block extends Model<BlockAttributes, BlockCreationAttributes> implements BlockAttributes {
  declare id: number;
  declare blocker_id: number;
  declare blocked_id: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Block.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    blocker_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    blocked_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'blocks',
    timestamps: true,
    underscored: true,
  }
);

export { Block };
