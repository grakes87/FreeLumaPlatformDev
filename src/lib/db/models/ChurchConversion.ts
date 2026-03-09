import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ChurchConversionAttributes {
  id: number;
  church_id: number;
  order_date: string | null;
  estimated_size: number | null;
  revenue_estimate: number | null;
  notes: string | null;
  created_by: number;
  created_at: Date;
}

export type ChurchConversionCreationAttributes = Optional<ChurchConversionAttributes,
  | 'id'
  | 'order_date'
  | 'estimated_size'
  | 'revenue_estimate'
  | 'notes'
  | 'created_at'
>;

class ChurchConversion extends Model<ChurchConversionAttributes, ChurchConversionCreationAttributes> implements ChurchConversionAttributes {
  declare id: number;
  declare church_id: number;
  declare order_date: string | null;
  declare estimated_size: number | null;
  declare revenue_estimate: number | null;
  declare notes: string | null;
  declare created_by: number;
  declare readonly created_at: Date;
}

ChurchConversion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    church_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    estimated_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    revenue_estimate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'ChurchConversion',
    tableName: 'church_conversions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { ChurchConversion };
