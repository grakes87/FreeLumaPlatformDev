import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export type WorkshopStatus = 'scheduled' | 'lobby' | 'live' | 'ended' | 'cancelled';

export interface WorkshopAttributes {
  id: number;
  series_id: number | null;
  host_id: number;
  category_id: number | null;
  title: string;
  description: string | null;
  scheduled_at: Date;
  duration_minutes: number | null;
  actual_started_at: Date | null;
  actual_ended_at: Date | null;
  status: WorkshopStatus;
  is_private: boolean;
  max_capacity: number | null;
  recording_url: string | null;
  recording_sid: string | null;
  recording_resource_id: string | null;
  agora_channel: string | null;
  attendee_count: number;
  mode: 'bible' | 'positivity';
  created_by_admin_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkshopCreationAttributes extends Optional<WorkshopAttributes,
  | 'id'
  | 'series_id'
  | 'category_id'
  | 'description'
  | 'duration_minutes'
  | 'actual_started_at'
  | 'actual_ended_at'
  | 'status'
  | 'is_private'
  | 'max_capacity'
  | 'recording_url'
  | 'recording_sid'
  | 'recording_resource_id'
  | 'agora_channel'
  | 'attendee_count'
  | 'mode'
  | 'created_by_admin_id'
  | 'created_at'
  | 'updated_at'
> {}

class Workshop extends Model<WorkshopAttributes, WorkshopCreationAttributes> implements WorkshopAttributes {
  declare id: number;
  declare series_id: number | null;
  declare host_id: number;
  declare category_id: number | null;
  declare title: string;
  declare description: string | null;
  declare scheduled_at: Date;
  declare duration_minutes: number | null;
  declare actual_started_at: Date | null;
  declare actual_ended_at: Date | null;
  declare status: WorkshopStatus;
  declare is_private: boolean;
  declare max_capacity: number | null;
  declare recording_url: string | null;
  declare recording_sid: string | null;
  declare recording_resource_id: string | null;
  declare agora_channel: string | null;
  declare attendee_count: number;
  declare mode: 'bible' | 'positivity';
  declare created_by_admin_id: number | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Workshop.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    series_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'workshop_series',
        key: 'id',
      },
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
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actual_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actual_ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'lobby', 'live', 'ended', 'cancelled'),
      defaultValue: 'scheduled',
      allowNull: false,
    },
    is_private: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    max_capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recording_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    recording_sid: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    recording_resource_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    agora_channel: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    attendee_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM('bible', 'positivity'),
      defaultValue: 'bible',
      allowNull: false,
    },
    created_by_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'workshops',
    timestamps: true,
    underscored: true,
  }
);

export { Workshop };
