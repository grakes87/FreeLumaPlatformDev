import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const PIPELINE_STAGES = ['new_lead', 'contacted', 'engaged', 'sample_requested', 'sample_sent', 'converted', 'lost'] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

export const CHURCH_SOURCES = ['google_places', 'manual', 'sample_request'] as const;
export type ChurchSource = typeof CHURCH_SOURCES[number];

export interface ChurchAttributes {
  id: number;
  google_place_id: string | null;
  name: string;
  pastor_name: string | null;
  staff_names: string[] | null;
  denomination: string | null;
  congregation_size_estimate: string | null;
  youth_programs: string[] | null;
  service_times: string[] | null;
  website_url: string | null;
  social_media: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  pipeline_stage: PipelineStage;
  ai_summary: string | null;
  source: ChurchSource;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ChurchCreationAttributes = Optional<ChurchAttributes,
  | 'id'
  | 'google_place_id'
  | 'pastor_name'
  | 'staff_names'
  | 'denomination'
  | 'congregation_size_estimate'
  | 'youth_programs'
  | 'service_times'
  | 'website_url'
  | 'social_media'
  | 'contact_email'
  | 'contact_phone'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'zip_code'
  | 'country'
  | 'latitude'
  | 'longitude'
  | 'pipeline_stage'
  | 'ai_summary'
  | 'source'
  | 'notes'
  | 'created_at'
  | 'updated_at'
>;

class Church extends Model<ChurchAttributes, ChurchCreationAttributes> implements ChurchAttributes {
  declare id: number;
  declare google_place_id: string | null;
  declare name: string;
  declare pastor_name: string | null;
  declare staff_names: string[] | null;
  declare denomination: string | null;
  declare congregation_size_estimate: string | null;
  declare youth_programs: string[] | null;
  declare service_times: string[] | null;
  declare website_url: string | null;
  declare social_media: Record<string, string> | null;
  declare contact_email: string | null;
  declare contact_phone: string | null;
  declare address_line1: string | null;
  declare address_line2: string | null;
  declare city: string | null;
  declare state: string | null;
  declare zip_code: string | null;
  declare country: string;
  declare latitude: number | null;
  declare longitude: number | null;
  declare pipeline_stage: PipelineStage;
  declare ai_summary: string | null;
  declare source: ChurchSource;
  declare notes: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Church.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    google_place_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pastor_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    staff_names: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    denomination: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    congregation_size_estimate: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    youth_programs: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    service_times: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    website_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    social_media: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contact_phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    address_line1: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address_line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    zip_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'US',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    pipeline_stage: {
      type: DataTypes.ENUM(...PIPELINE_STAGES),
      allowNull: false,
      defaultValue: 'new_lead',
    },
    ai_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM(...CHURCH_SOURCES),
      allowNull: false,
      defaultValue: 'manual',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Church',
    tableName: 'churches',
    timestamps: true,
    underscored: true,
  }
);

export { Church };
