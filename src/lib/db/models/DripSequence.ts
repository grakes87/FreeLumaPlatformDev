import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const DRIP_TRIGGERS = ['manual', 'sample_shipped', 'stage_change'] as const;
export type DripTrigger = typeof DRIP_TRIGGERS[number];

export interface DripSequenceAttributes {
  id: number;
  name: string;
  description: string | null;
  trigger: DripTrigger;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type DripSequenceCreationAttributes = Optional<DripSequenceAttributes,
  | 'id'
  | 'description'
  | 'trigger'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>;

class DripSequence extends Model<DripSequenceAttributes, DripSequenceCreationAttributes> implements DripSequenceAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare trigger: DripTrigger;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DripSequence.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trigger: {
      type: DataTypes.ENUM(...DRIP_TRIGGERS),
      allowNull: false,
      defaultValue: 'manual',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'DripSequence',
    tableName: 'drip_sequences',
    timestamps: true,
    underscored: true,
  }
);

export { DripSequence };
