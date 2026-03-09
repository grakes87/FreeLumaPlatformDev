import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface DripStepAttributes {
  id: number;
  sequence_id: number;
  step_order: number;
  template_id: number;
  delay_days: number;
  created_at: Date;
  updated_at: Date;
}

export type DripStepCreationAttributes = Optional<DripStepAttributes,
  | 'id'
  | 'delay_days'
  | 'created_at'
  | 'updated_at'
>;

class DripStep extends Model<DripStepAttributes, DripStepCreationAttributes> implements DripStepAttributes {
  declare id: number;
  declare sequence_id: number;
  declare step_order: number;
  declare template_id: number;
  declare delay_days: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DripStep.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sequence_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    step_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    delay_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'DripStep',
    tableName: 'drip_steps',
    timestamps: true,
    underscored: true,
  }
);

export { DripStep };
