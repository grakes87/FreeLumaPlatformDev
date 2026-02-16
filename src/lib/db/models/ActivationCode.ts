import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ActivationCodeAttributes {
  id: number;
  code: string;
  used: boolean;
  used_by: number | null;
  used_at: Date | null;
  mode_hint: 'bible' | 'positivity' | null;
  expires_at: Date;
  created_by: number | null;
  source: 'generated' | 'imported';
  created_at: Date;
  updated_at: Date;
}

export interface ActivationCodeCreationAttributes extends Optional<ActivationCodeAttributes,
  | 'id'
  | 'used'
  | 'used_by'
  | 'used_at'
  | 'mode_hint'
  | 'created_by'
  | 'source'
  | 'created_at'
  | 'updated_at'
> {}

class ActivationCode extends Model<ActivationCodeAttributes, ActivationCodeCreationAttributes> implements ActivationCodeAttributes {
  declare id: number;
  declare code: string;
  declare used: boolean;
  declare used_by: number | null;
  declare used_at: Date | null;
  declare mode_hint: 'bible' | 'positivity' | null;
  declare expires_at: Date;
  declare created_by: number | null;
  declare source: 'generated' | 'imported';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

ActivationCode.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(16),
      unique: true,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    used_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    mode_hint: {
      type: DataTypes.ENUM('bible', 'positivity'),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    source: {
      type: DataTypes.ENUM('generated', 'imported'),
      defaultValue: 'generated',
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'activation_codes',
    timestamps: true,
    underscored: true,
  }
);

export { ActivationCode };
