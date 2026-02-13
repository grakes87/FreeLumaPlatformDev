import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface MessageMediaAttributes {
  id: number;
  message_id: number;
  media_url: string;
  media_type: 'image' | 'video' | 'voice';
  duration: number | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface MessageMediaCreationAttributes extends Optional<MessageMediaAttributes,
  | 'id'
  | 'duration'
  | 'sort_order'
  | 'created_at'
  | 'updated_at'
> {}

class MessageMedia extends Model<MessageMediaAttributes, MessageMediaCreationAttributes> implements MessageMediaAttributes {
  declare id: number;
  declare message_id: number;
  declare media_url: string;
  declare media_type: 'image' | 'video' | 'voice';
  declare duration: number | null;
  declare sort_order: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageMedia.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'messages',
        key: 'id',
      },
    },
    media_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    media_type: {
      type: DataTypes.ENUM('image', 'video', 'voice'),
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'message_media',
    timestamps: true,
    underscored: true,
  }
);

export { MessageMedia };
