import { sequelize } from '../index';
import { User } from './User';
import { ActivationCode } from './ActivationCode';
import { DailyContent } from './DailyContent';
import { DailyContentTranslation } from './DailyContentTranslation';
import { BibleTranslation } from './BibleTranslation';
import { Category } from './Category';
import { UserCategory } from './UserCategory';
import { UserSetting } from './UserSetting';
import { PushSubscription } from './PushSubscription';

// ---- Associations ----

// User -> PushSubscription (one-to-many)
User.hasMany(PushSubscription, {
  foreignKey: 'user_id',
  as: 'pushSubscriptions',
});
PushSubscription.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User -> UserCategory (one-to-many)
User.hasMany(UserCategory, {
  foreignKey: 'user_id',
  as: 'userCategories',
});
UserCategory.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User -> UserSetting (one-to-one)
User.hasOne(UserSetting, {
  foreignKey: 'user_id',
  as: 'settings',
});
UserSetting.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User -> ActivationCode (one-to-many via used_by)
User.hasMany(ActivationCode, {
  foreignKey: 'used_by',
  as: 'usedCodes',
});
ActivationCode.belongsTo(User, {
  foreignKey: 'used_by',
  as: 'usedByUser',
});

// User -> ActivationCode (one-to-many via created_by)
User.hasMany(ActivationCode, {
  foreignKey: 'created_by',
  as: 'createdCodes',
});
ActivationCode.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'createdByUser',
});

// Category -> UserCategory (one-to-many)
Category.hasMany(UserCategory, {
  foreignKey: 'category_id',
  as: 'userCategories',
});
UserCategory.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category',
});

// DailyContent -> DailyContentTranslation (one-to-many)
DailyContent.hasMany(DailyContentTranslation, {
  foreignKey: 'daily_content_id',
  as: 'translations',
});
DailyContentTranslation.belongsTo(DailyContent, {
  foreignKey: 'daily_content_id',
  as: 'dailyContent',
});

export {
  sequelize,
  User,
  ActivationCode,
  DailyContent,
  DailyContentTranslation,
  BibleTranslation,
  Category,
  UserCategory,
  UserSetting,
  PushSubscription,
};
