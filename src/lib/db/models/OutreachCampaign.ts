import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const CAMPAIGN_STATUSES = ['draft', 'sending', 'sent', 'cancelled'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export interface OutreachCampaignAttributes {
  id: number;
  name: string;
  template_id: number;
  filter_criteria: Record<string, unknown> | null;
  status: CampaignStatus;
  sent_count: number;
  open_count: number;
  click_count: number;
  created_by: number;
  sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type OutreachCampaignCreationAttributes = Optional<OutreachCampaignAttributes,
  | 'id'
  | 'filter_criteria'
  | 'status'
  | 'sent_count'
  | 'open_count'
  | 'click_count'
  | 'sent_at'
  | 'created_at'
  | 'updated_at'
>;

class OutreachCampaign extends Model<OutreachCampaignAttributes, OutreachCampaignCreationAttributes> implements OutreachCampaignAttributes {
  declare id: number;
  declare name: string;
  declare template_id: number;
  declare filter_criteria: Record<string, unknown> | null;
  declare status: CampaignStatus;
  declare sent_count: number;
  declare open_count: number;
  declare click_count: number;
  declare created_by: number;
  declare sent_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

OutreachCampaign.init(
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
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    filter_criteria: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...CAMPAIGN_STATUSES),
      allowNull: false,
      defaultValue: 'draft',
    },
    sent_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    open_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    click_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'OutreachCampaign',
    tableName: 'outreach_campaigns',
    timestamps: true,
    underscored: true,
  }
);

export { OutreachCampaign };
