import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ReportAttributes {
  id: number;
  reporter_id: number;
  post_id: number | null;
  comment_id: number | null;
  content_type: 'post' | 'comment';
  reason: 'spam' | 'harassment' | 'hate_speech' | 'inappropriate' | 'self_harm' | 'other';
  details: string | null;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  admin_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReportCreationAttributes extends Optional<ReportAttributes,
  | 'id'
  | 'post_id'
  | 'comment_id'
  | 'details'
  | 'status'
  | 'admin_notes'
  | 'reviewed_by'
  | 'reviewed_at'
  | 'created_at'
  | 'updated_at'
> {}

class Report extends Model<ReportAttributes, ReportCreationAttributes> implements ReportAttributes {
  declare id: number;
  declare reporter_id: number;
  declare post_id: number | null;
  declare comment_id: number | null;
  declare content_type: 'post' | 'comment';
  declare reason: 'spam' | 'harassment' | 'hate_speech' | 'inappropriate' | 'self_harm' | 'other';
  declare details: string | null;
  declare status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  declare admin_notes: string | null;
  declare reviewed_by: number | null;
  declare reviewed_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Report.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reporter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    content_type: {
      type: DataTypes.ENUM('post', 'comment'),
      allowNull: false,
    },
    reason: {
      type: DataTypes.ENUM('spam', 'harassment', 'hate_speech', 'inappropriate', 'self_harm', 'other'),
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'actioned', 'dismissed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'reports',
    timestamps: true,
    underscored: true,
  }
);

export { Report };
