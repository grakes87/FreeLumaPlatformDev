import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const ENROLLMENT_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;
export type EnrollmentStatus = typeof ENROLLMENT_STATUSES[number];

export interface DripEnrollmentAttributes {
  id: number;
  church_id: number;
  sequence_id: number;
  current_step: number;
  status: EnrollmentStatus;
  next_step_at: Date | null;
  enrolled_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type DripEnrollmentCreationAttributes = Optional<DripEnrollmentAttributes,
  | 'id'
  | 'current_step'
  | 'status'
  | 'next_step_at'
  | 'completed_at'
  | 'created_at'
  | 'updated_at'
>;

class DripEnrollment extends Model<DripEnrollmentAttributes, DripEnrollmentCreationAttributes> implements DripEnrollmentAttributes {
  declare id: number;
  declare church_id: number;
  declare sequence_id: number;
  declare current_step: number;
  declare status: EnrollmentStatus;
  declare next_step_at: Date | null;
  declare enrolled_at: Date;
  declare completed_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DripEnrollment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    church_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sequence_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    current_step: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(...ENROLLMENT_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    next_step_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    enrolled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'DripEnrollment',
    tableName: 'drip_enrollments',
    timestamps: true,
    underscored: true,
  }
);

export { DripEnrollment };
