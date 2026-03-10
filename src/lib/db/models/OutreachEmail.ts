import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const OUTREACH_EMAIL_STATUSES = ['queued', 'sent', 'bounced', 'opened', 'clicked', 'pending_review', 'rejected'] as const;
export type OutreachEmailStatus = typeof OUTREACH_EMAIL_STATUSES[number];

export interface OutreachEmailAttributes {
  id: number;
  church_id: number;
  campaign_id: number | null;
  drip_enrollment_id: number | null;
  template_id: number;
  to_email: string;
  subject: string;
  status: OutreachEmailStatus;
  tracking_id: string;
  sent_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  ai_html: string | null;
  rendered_html: string | null;
  ai_subject: string | null;
  rejection_reason: string | null;
  created_at: Date;
}

export type OutreachEmailCreationAttributes = Optional<OutreachEmailAttributes,
  | 'id'
  | 'campaign_id'
  | 'drip_enrollment_id'
  | 'status'
  | 'sent_at'
  | 'opened_at'
  | 'clicked_at'
  | 'reviewed_by'
  | 'reviewed_at'
  | 'ai_html'
  | 'rendered_html'
  | 'ai_subject'
  | 'rejection_reason'
  | 'created_at'
>;

class OutreachEmail extends Model<OutreachEmailAttributes, OutreachEmailCreationAttributes> implements OutreachEmailAttributes {
  declare id: number;
  declare church_id: number;
  declare campaign_id: number | null;
  declare drip_enrollment_id: number | null;
  declare template_id: number;
  declare to_email: string;
  declare subject: string;
  declare status: OutreachEmailStatus;
  declare tracking_id: string;
  declare sent_at: Date | null;
  declare opened_at: Date | null;
  declare clicked_at: Date | null;
  declare reviewed_by: number | null;
  declare reviewed_at: Date | null;
  declare ai_html: string | null;
  declare rendered_html: string | null;
  declare ai_subject: string | null;
  declare rejection_reason: string | null;
  declare readonly created_at: Date;
}

OutreachEmail.init(
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
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    drip_enrollment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    to_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...OUTREACH_EMAIL_STATUSES),
      allowNull: false,
      defaultValue: 'queued',
    },
    tracking_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    opened_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clicked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ai_html: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    rendered_html: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    ai_subject: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'OutreachEmail',
    tableName: 'outreach_emails',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { OutreachEmail };
