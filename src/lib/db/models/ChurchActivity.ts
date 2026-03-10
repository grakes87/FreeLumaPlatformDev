import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const CHURCH_ACTIVITY_TYPES = [
  'stage_change',
  'email_sent',
  'email_opened',
  'email_clicked',
  'note_added',
  'sample_shipped',
  'converted',
  'created',
  'scrape_completed',
  'ai_researched',
  'auto_discovered',
  'auto_imported',
  'email_approved',
  'email_rejected',
] as const;
export type ChurchActivityType = typeof CHURCH_ACTIVITY_TYPES[number];

export interface ChurchActivityAttributes {
  id: number;
  church_id: number;
  activity_type: ChurchActivityType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  admin_id: number | null;
  created_at: Date;
}

export type ChurchActivityCreationAttributes = Optional<ChurchActivityAttributes,
  | 'id'
  | 'description'
  | 'metadata'
  | 'admin_id'
  | 'created_at'
>;

class ChurchActivity extends Model<ChurchActivityAttributes, ChurchActivityCreationAttributes> implements ChurchActivityAttributes {
  declare id: number;
  declare church_id: number;
  declare activity_type: ChurchActivityType;
  declare description: string | null;
  declare metadata: Record<string, unknown> | null;
  declare admin_id: number | null;
  declare readonly created_at: Date;
}

ChurchActivity.init(
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
    activity_type: {
      type: DataTypes.ENUM(...CHURCH_ACTIVITY_TYPES),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'ChurchActivity',
    tableName: 'church_activities',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { ChurchActivity };
