import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface UserAttributes {
  id: number;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  apple_id: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  denomination: string | null;
  church: string | null;
  testimony: string | null;
  profile_privacy: 'public' | 'private';
  location: string | null;
  website: string | null;
  date_of_birth: string | null;
  mode: 'bible' | 'positivity';
  timezone: string;
  preferred_translation: string;
  language: 'en' | 'es';
  email_verified: boolean;
  email_verification_token: string | null;
  onboarding_complete: boolean;
  is_admin: boolean;
  is_verified: boolean;
  status: 'active' | 'deactivated' | 'pending_deletion' | 'banned';
  role: 'user' | 'moderator' | 'admin';
  can_host: boolean;
  deactivated_at: Date | null;
  deletion_requested_at: Date | null;
  last_login_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes,
  | 'id'
  | 'password_hash'
  | 'google_id'
  | 'apple_id'
  | 'avatar_url'
  | 'bio'
  | 'denomination'
  | 'church'
  | 'testimony'
  | 'profile_privacy'
  | 'location'
  | 'website'
  | 'date_of_birth'
  | 'mode'
  | 'timezone'
  | 'preferred_translation'
  | 'language'
  | 'email_verified'
  | 'email_verification_token'
  | 'onboarding_complete'
  | 'is_admin'
  | 'is_verified'
  | 'status'
  | 'role'
  | 'can_host'
  | 'deactivated_at'
  | 'deletion_requested_at'
  | 'last_login_at'
  | 'failed_login_attempts'
  | 'locked_until'
  | 'deleted_at'
  | 'created_at'
  | 'updated_at'
> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare password_hash: string | null;
  declare google_id: string | null;
  declare apple_id: string | null;
  declare display_name: string;
  declare username: string;
  declare avatar_url: string | null;
  declare avatar_color: string;
  declare bio: string | null;
  declare denomination: string | null;
  declare church: string | null;
  declare testimony: string | null;
  declare profile_privacy: 'public' | 'private';
  declare location: string | null;
  declare website: string | null;
  declare date_of_birth: string | null;
  declare mode: 'bible' | 'positivity';
  declare timezone: string;
  declare preferred_translation: string;
  declare language: 'en' | 'es';
  declare email_verified: boolean;
  declare email_verification_token: string | null;
  declare onboarding_complete: boolean;
  declare is_admin: boolean;
  declare is_verified: boolean;
  declare status: 'active' | 'deactivated' | 'pending_deletion' | 'banned';
  declare role: 'user' | 'moderator' | 'admin';
  declare can_host: boolean;
  declare deactivated_at: Date | null;
  declare deletion_requested_at: Date | null;
  declare last_login_at: Date | null;
  declare failed_login_attempts: number;
  declare locked_until: Date | null;
  declare deleted_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    google_id: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
    },
    apple_id: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: false,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    avatar_color: {
      type: DataTypes.STRING(7),
      allowNull: false,
    },
    bio: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    denomination: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    church: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    testimony: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile_privacy: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'public',
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    mode: {
      type: DataTypes.ENUM('bible', 'positivity'),
      defaultValue: 'bible',
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING(50),
      defaultValue: 'America/New_York',
      allowNull: false,
    },
    preferred_translation: {
      type: DataTypes.STRING(10),
      defaultValue: 'KJV',
      allowNull: false,
    },
    language: {
      type: DataTypes.ENUM('en', 'es'),
      defaultValue: 'en',
      allowNull: false,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    onboarding_complete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'deactivated', 'pending_deletion', 'banned'),
      defaultValue: 'active',
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'moderator', 'admin'),
      defaultValue: 'user',
      allowNull: false,
    },
    can_host: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    deactivated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletion_requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export { User };
