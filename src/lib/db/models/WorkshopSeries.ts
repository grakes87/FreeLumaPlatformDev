import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface WorkshopSeriesAttributes {
  id: number;
  host_id: number;
  category_id: number | null;
  title: string;
  description: string | null;
  rrule: string;
  time_of_day: string;
  timezone: string;
  duration_minutes: number | null;
  is_active: boolean;
  mode: 'bible' | 'positivity';
  created_at: Date;
  updated_at: Date;
}

export interface WorkshopSeriesCreationAttributes extends Optional<WorkshopSeriesAttributes,
  | 'id'
  | 'category_id'
  | 'description'
  | 'duration_minutes'
  | 'is_active'
  | 'mode'
  | 'created_at'
  | 'updated_at'
> {}

class WorkshopSeries extends Model<WorkshopSeriesAttributes, WorkshopSeriesCreationAttributes> implements WorkshopSeriesAttributes {
  declare id: number;
  declare host_id: number;
  declare category_id: number | null;
  declare title: string;
  declare description: string | null;
  declare rrule: string;
  declare time_of_day: string;
  declare timezone: string;
  declare duration_minutes: number | null;
  declare is_active: boolean;
  declare mode: 'bible' | 'positivity';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

WorkshopSeries.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    host_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'workshop_categories',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rrule: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    time_of_day: {
      type: DataTypes.STRING(8),
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM('bible', 'positivity'),
      defaultValue: 'bible',
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_series',
    timestamps: true,
    underscored: true,
  }
);

export { WorkshopSeries };
