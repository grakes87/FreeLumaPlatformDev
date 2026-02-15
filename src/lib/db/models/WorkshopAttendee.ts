import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export type AttendeeStatus = 'rsvp' | 'joined' | 'left';

export interface WorkshopAttendeeAttributes {
  id: number;
  workshop_id: number;
  user_id: number;
  status: AttendeeStatus;
  joined_at: Date | null;
  left_at: Date | null;
  is_co_host: boolean;
  can_speak: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WorkshopAttendeeCreationAttributes extends Optional<WorkshopAttendeeAttributes,
  | 'id'
  | 'status'
  | 'joined_at'
  | 'left_at'
  | 'is_co_host'
  | 'can_speak'
  | 'created_at'
  | 'updated_at'
> {}

class WorkshopAttendee extends Model<WorkshopAttendeeAttributes, WorkshopAttendeeCreationAttributes> implements WorkshopAttendeeAttributes {
  declare id: number;
  declare workshop_id: number;
  declare user_id: number;
  declare status: AttendeeStatus;
  declare joined_at: Date | null;
  declare left_at: Date | null;
  declare is_co_host: boolean;
  declare can_speak: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

WorkshopAttendee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    workshop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workshops',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('rsvp', 'joined', 'left'),
      defaultValue: 'rsvp',
      allowNull: false,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_co_host: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    can_speak: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_attendees',
    timestamps: true,
    underscored: true,
  }
);

export { WorkshopAttendee };
