import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface OutreachTemplateAttributes {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[] | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export type OutreachTemplateCreationAttributes = Optional<OutreachTemplateAttributes,
  | 'id'
  | 'merge_fields'
  | 'is_default'
  | 'created_at'
  | 'updated_at'
>;

class OutreachTemplate extends Model<OutreachTemplateAttributes, OutreachTemplateCreationAttributes> implements OutreachTemplateAttributes {
  declare id: number;
  declare name: string;
  declare subject: string;
  declare html_body: string;
  declare merge_fields: string[] | null;
  declare is_default: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

OutreachTemplate.init(
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
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    html_body: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    merge_fields: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'OutreachTemplate',
    tableName: 'outreach_templates',
    timestamps: true,
    underscored: true,
  }
);

export { OutreachTemplate };
