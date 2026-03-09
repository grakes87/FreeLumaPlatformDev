import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface OutreachUnsubscribeAttributes {
  id: number;
  church_id: number | null;
  email: string;
  unsubscribed_at: Date;
  created_at: Date;
}

export type OutreachUnsubscribeCreationAttributes = Optional<OutreachUnsubscribeAttributes,
  | 'id'
  | 'church_id'
  | 'created_at'
>;

class OutreachUnsubscribe extends Model<OutreachUnsubscribeAttributes, OutreachUnsubscribeCreationAttributes> implements OutreachUnsubscribeAttributes {
  declare id: number;
  declare church_id: number | null;
  declare email: string;
  declare unsubscribed_at: Date;
  declare readonly created_at: Date;
}

OutreachUnsubscribe.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    church_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    unsubscribed_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'OutreachUnsubscribe',
    tableName: 'outreach_unsubscribes',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { OutreachUnsubscribe };
