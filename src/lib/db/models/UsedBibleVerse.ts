import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface UsedBibleVerseAttributes {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  verse_reference: string;
  used_date: string;
  daily_content_id: number;
  created_at: Date;
}

export interface UsedBibleVerseCreationAttributes extends Optional<UsedBibleVerseAttributes,
  | 'id'
  | 'created_at'
> {}

class UsedBibleVerse extends Model<UsedBibleVerseAttributes, UsedBibleVerseCreationAttributes> implements UsedBibleVerseAttributes {
  declare id: number;
  declare book: string;
  declare chapter: number;
  declare verse: number;
  declare verse_reference: string;
  declare used_date: string;
  declare daily_content_id: number;
  declare readonly created_at: Date;
}

UsedBibleVerse.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    book: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    chapter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verse: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verse_reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    used_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'daily_content',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'used_bible_verses',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['book', 'chapter', 'verse'],
        name: 'unique_verse_usage',
      },
      {
        fields: ['used_date'],
        name: 'idx_used_date',
      },
    ],
  }
);

export { UsedBibleVerse };
