import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface LumaShortCreatorAttributes {
  id: number;
  user_id: number;
  name: string;
  bio: string | null;
  link_1: string | null;
  link_2: string | null;
  link_3: string | null;
  languages: string[];
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  is_ai: boolean;
  heygen_avatar_id: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LumaShortCreatorCreationAttributes extends Optional<LumaShortCreatorAttributes,
  | 'id'
  | 'bio'
  | 'link_1'
  | 'link_2'
  | 'link_3'
  | 'languages'
  | 'monthly_capacity'
  | 'can_bible'
  | 'can_positivity'
  | 'is_ai'
  | 'heygen_avatar_id'
  | 'active'
  | 'created_at'
  | 'updated_at'
> {}

class LumaShortCreator extends Model<LumaShortCreatorAttributes, LumaShortCreatorCreationAttributes> implements LumaShortCreatorAttributes {
  declare id: number;
  declare user_id: number;
  declare name: string;
  declare bio: string | null;
  declare link_1: string | null;
  declare link_2: string | null;
  declare link_3: string | null;
  declare languages: string[];
  declare monthly_capacity: number;
  declare can_bible: boolean;
  declare can_positivity: boolean;
  declare is_ai: boolean;
  declare heygen_avatar_id: string | null;
  declare active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

LumaShortCreator.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link_1: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    link_2: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    link_3: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    languages: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['en'],
    },
    monthly_capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    can_bible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    can_positivity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_ai: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    heygen_avatar_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'luma_short_creators',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['active', 'can_bible', 'can_positivity'],
        name: 'idx_active_mode',
      },
    ],
  }
);

export { LumaShortCreator };
