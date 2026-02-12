import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PlatformSettingAttributes {
  id: number;
  key: string;
  value: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformSettingCreationAttributes extends Optional<PlatformSettingAttributes,
  | 'id'
  | 'description'
  | 'created_at'
  | 'updated_at'
> {}

class PlatformSetting extends Model<PlatformSettingAttributes, PlatformSettingCreationAttributes> implements PlatformSettingAttributes {
  declare id: number;
  declare key: string;
  declare value: string;
  declare description: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;

  /**
   * Get a platform setting value by key.
   * Returns null if the key does not exist.
   */
  static async get(key: string): Promise<string | null> {
    const setting = await PlatformSetting.findOne({ where: { key } });
    return setting ? setting.value : null;
  }

  /**
   * Set a platform setting value by key.
   * Creates the setting if it does not exist, updates if it does.
   */
  static async set(key: string, value: string): Promise<void> {
    const [setting] = await PlatformSetting.findOrCreate({
      where: { key },
      defaults: { key, value },
    });
    if (setting.value !== value) {
      setting.value = value;
      await setting.save();
    }
  }
}

PlatformSetting.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'platform_settings',
    timestamps: true,
    underscored: true,
  }
);

export { PlatformSetting };
