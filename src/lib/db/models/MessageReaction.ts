import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface MessageReactionAttributes {
  id: number;
  message_id: number;
  user_id: number;
  reaction_type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'pray';
  created_at: Date;
  updated_at: Date;
}

export interface MessageReactionCreationAttributes extends Optional<MessageReactionAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class MessageReaction extends Model<MessageReactionAttributes, MessageReactionCreationAttributes> implements MessageReactionAttributes {
  declare id: number;
  declare message_id: number;
  declare user_id: number;
  declare reaction_type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'pray';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageReaction.init(
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reaction_type: {
      type: DataTypes.ENUM('like', 'love', 'haha', 'wow', 'sad', 'pray'),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'message_reactions',
    timestamps: true,
    underscored: true,
  }
);

export { MessageReaction };
