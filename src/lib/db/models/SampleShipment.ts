import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export const CARRIER_TYPES = ['usps', 'ups', 'fedex', 'other'] as const;
export type CarrierType = typeof CARRIER_TYPES[number];

export const SHIPMENT_STATUSES = ['pending', 'shipped', 'delivered'] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export interface SampleShipmentAttributes {
  id: number;
  church_id: number;
  ship_date: string;
  tracking_number: string | null;
  carrier: CarrierType;
  bracelet_type: string | null;
  quantity: number | null;
  shipping_address: string | null;
  notes: string | null;
  status: ShipmentStatus;
  delivered_at: Date | null;
  follow_up_sent_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export type SampleShipmentCreationAttributes = Optional<SampleShipmentAttributes,
  | 'id'
  | 'tracking_number'
  | 'carrier'
  | 'bracelet_type'
  | 'quantity'
  | 'shipping_address'
  | 'notes'
  | 'status'
  | 'delivered_at'
  | 'follow_up_sent_at'
  | 'created_at'
  | 'updated_at'
>;

class SampleShipment extends Model<SampleShipmentAttributes, SampleShipmentCreationAttributes> implements SampleShipmentAttributes {
  declare id: number;
  declare church_id: number;
  declare ship_date: string;
  declare tracking_number: string | null;
  declare carrier: CarrierType;
  declare bracelet_type: string | null;
  declare quantity: number | null;
  declare shipping_address: string | null;
  declare notes: string | null;
  declare status: ShipmentStatus;
  declare delivered_at: Date | null;
  declare follow_up_sent_at: Date | null;
  declare created_by: number | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

SampleShipment.init(
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
    ship_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    carrier: {
      type: DataTypes.ENUM(...CARRIER_TYPES),
      allowNull: false,
      defaultValue: 'usps',
    },
    bracelet_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...SHIPMENT_STATUSES),
      allowNull: false,
      defaultValue: 'shipped',
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    follow_up_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'SampleShipment',
    tableName: 'sample_shipments',
    timestamps: true,
    underscored: true,
  }
);

export { SampleShipment };
