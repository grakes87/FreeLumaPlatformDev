import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface DailyContentBackgroundAttributes {
  id: number;
  url: string;
  created_at: Date;
  updated_at: Date;
}

export interface DailyContentBackgroundCreationAttributes
  extends Optional<DailyContentBackgroundAttributes, 'id' | 'created_at' | 'updated_at'> {}

class DailyContentBackground
  extends Model<DailyContentBackgroundAttributes, DailyContentBackgroundCreationAttributes>
  implements DailyContentBackgroundAttributes
{
  declare id: number;
  declare url: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DailyContentBackground.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'daily_content_backgrounds',
    timestamps: true,
    underscored: true,
  }
);

export { DailyContentBackground };
