import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface WorkshopNoteAttributes {
  id: number;
  workshop_id: number;
  user_id: number;
  content: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkshopNoteCreationAttributes extends Optional<WorkshopNoteAttributes,
  | 'id'
  | 'content'
  | 'created_at'
  | 'updated_at'
> {}

class WorkshopNote extends Model<WorkshopNoteAttributes, WorkshopNoteCreationAttributes> implements WorkshopNoteAttributes {
  declare id: number;
  declare workshop_id: number;
  declare user_id: number;
  declare content: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

WorkshopNote.init(
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
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_notes',
    timestamps: true,
    underscored: true,
  }
);

export { WorkshopNote };
