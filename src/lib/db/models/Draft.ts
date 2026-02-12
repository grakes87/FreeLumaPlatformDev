import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface DraftAttributes {
  id: number;
  user_id: number;
  draft_type: 'post' | 'prayer_request';
  body: string | null;
  media_keys: unknown | null;
  metadata: unknown | null;
  created_at: Date;
  updated_at: Date;
}

export interface DraftCreationAttributes extends Optional<DraftAttributes,
  | 'id'
  | 'draft_type'
  | 'body'
  | 'media_keys'
  | 'metadata'
  | 'created_at'
  | 'updated_at'
> {}

class Draft extends Model<DraftAttributes, DraftCreationAttributes> implements DraftAttributes {
  declare id: number;
  declare user_id: number;
  declare draft_type: 'post' | 'prayer_request';
  declare body: string | null;
  declare media_keys: unknown | null;
  declare metadata: unknown | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Draft.init(
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
    draft_type: {
      type: DataTypes.ENUM('post', 'prayer_request'),
      allowNull: false,
      defaultValue: 'post',
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    media_keys: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'drafts',
    timestamps: true,
    underscored: true,
  }
);

export { Draft };
