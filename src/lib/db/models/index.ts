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
import { ListenLog } from './ListenLog';
import { DailyReaction } from './DailyReaction';
import { DailyComment } from './DailyComment';
import { Post } from './Post';
import { PostMedia } from './PostMedia';
import { PostReaction } from './PostReaction';
import { PostComment } from './PostComment';
import { PostCommentReaction } from './PostCommentReaction';
import { Follow } from './Follow';
import { Bookmark } from './Bookmark';
import { PrayerRequest } from './PrayerRequest';
import { PrayerSupport } from './PrayerSupport';
import { Report } from './Report';
import { Block } from './Block';
import { Repost } from './Repost';
import { PlatformSetting } from './PlatformSetting';
import { Draft } from './Draft';

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

// User -> ListenLog (one-to-many)
User.hasMany(ListenLog, {
  foreignKey: 'user_id',
  as: 'listenLogs',
});
ListenLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// DailyContent -> ListenLog (one-to-many)
DailyContent.hasMany(ListenLog, {
  foreignKey: 'daily_content_id',
  as: 'listenLogs',
});
ListenLog.belongsTo(DailyContent, {
  foreignKey: 'daily_content_id',
  as: 'dailyContent',
});

// User -> DailyReaction (one-to-many)
User.hasMany(DailyReaction, {
  foreignKey: 'user_id',
  as: 'dailyReactions',
});
DailyReaction.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// DailyContent -> DailyReaction (one-to-many)
DailyContent.hasMany(DailyReaction, {
  foreignKey: 'daily_content_id',
  as: 'reactions',
});
DailyReaction.belongsTo(DailyContent, {
  foreignKey: 'daily_content_id',
  as: 'dailyContent',
});

// User -> DailyComment (one-to-many)
User.hasMany(DailyComment, {
  foreignKey: 'user_id',
  as: 'dailyComments',
});
DailyComment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// DailyContent -> DailyComment (one-to-many)
DailyContent.hasMany(DailyComment, {
  foreignKey: 'daily_content_id',
  as: 'comments',
});
DailyComment.belongsTo(DailyContent, {
  foreignKey: 'daily_content_id',
  as: 'dailyContent',
});

// DailyComment -> DailyComment (self-referencing for replies)
DailyComment.hasMany(DailyComment, {
  foreignKey: 'parent_id',
  as: 'replies',
});
DailyComment.belongsTo(DailyComment, {
  foreignKey: 'parent_id',
  as: 'parent',
});

// ---- Phase 2: Core Social Associations ----

// User -> Post (one-to-many)
User.hasMany(Post, {
  foreignKey: 'user_id',
  as: 'posts',
});
Post.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Post -> PostMedia (one-to-many)
Post.hasMany(PostMedia, {
  foreignKey: 'post_id',
  as: 'media',
});
PostMedia.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// User -> PostReaction (one-to-many)
User.hasMany(PostReaction, {
  foreignKey: 'user_id',
  as: 'postReactions',
});
PostReaction.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Post -> PostReaction (one-to-many)
Post.hasMany(PostReaction, {
  foreignKey: 'post_id',
  as: 'reactions',
});
PostReaction.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// User -> PostComment (one-to-many)
User.hasMany(PostComment, {
  foreignKey: 'user_id',
  as: 'postComments',
});
PostComment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Post -> PostComment (one-to-many)
Post.hasMany(PostComment, {
  foreignKey: 'post_id',
  as: 'comments',
});
PostComment.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// PostComment -> PostComment (self-referencing for replies)
PostComment.hasMany(PostComment, {
  foreignKey: 'parent_id',
  as: 'replies',
});
PostComment.belongsTo(PostComment, {
  foreignKey: 'parent_id',
  as: 'parent',
});

// User -> PostCommentReaction (one-to-many)
User.hasMany(PostCommentReaction, {
  foreignKey: 'user_id',
  as: 'postCommentReactions',
});
PostCommentReaction.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// PostComment -> PostCommentReaction (one-to-many)
PostComment.hasMany(PostCommentReaction, {
  foreignKey: 'comment_id',
  as: 'reactions',
});
PostCommentReaction.belongsTo(PostComment, {
  foreignKey: 'comment_id',
  as: 'comment',
});

// User -> Follow (as follower)
User.hasMany(Follow, {
  foreignKey: 'follower_id',
  as: 'following',
});
Follow.belongsTo(User, {
  foreignKey: 'follower_id',
  as: 'follower',
});

// User -> Follow (as following)
User.hasMany(Follow, {
  foreignKey: 'following_id',
  as: 'followers',
});
Follow.belongsTo(User, {
  foreignKey: 'following_id',
  as: 'followedUser',
});

// User -> Bookmark (one-to-many)
User.hasMany(Bookmark, {
  foreignKey: 'user_id',
  as: 'bookmarks',
});
Bookmark.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Post -> Bookmark (one-to-many)
Post.hasMany(Bookmark, {
  foreignKey: 'post_id',
  as: 'bookmarks',
});
Bookmark.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// DailyContent -> Bookmark (one-to-many)
DailyContent.hasMany(Bookmark, {
  foreignKey: 'daily_content_id',
  as: 'bookmarks',
});
Bookmark.belongsTo(DailyContent, {
  foreignKey: 'daily_content_id',
  as: 'dailyContent',
});

// Post -> PrayerRequest (one-to-one)
Post.hasOne(PrayerRequest, {
  foreignKey: 'post_id',
  as: 'prayerRequest',
});
PrayerRequest.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// User -> PrayerSupport (one-to-many)
User.hasMany(PrayerSupport, {
  foreignKey: 'user_id',
  as: 'prayerSupports',
});
PrayerSupport.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// PrayerRequest -> PrayerSupport (one-to-many)
PrayerRequest.hasMany(PrayerSupport, {
  foreignKey: 'prayer_request_id',
  as: 'supports',
});
PrayerSupport.belongsTo(PrayerRequest, {
  foreignKey: 'prayer_request_id',
  as: 'prayerRequest',
});

// User -> Report (as reporter)
User.hasMany(Report, {
  foreignKey: 'reporter_id',
  as: 'reportsFiled',
});
Report.belongsTo(User, {
  foreignKey: 'reporter_id',
  as: 'reporter',
});

// User -> Report (as reviewer)
User.hasMany(Report, {
  foreignKey: 'reviewed_by',
  as: 'reportsReviewed',
});
Report.belongsTo(User, {
  foreignKey: 'reviewed_by',
  as: 'reviewer',
});

// Post -> Report (one-to-many)
Post.hasMany(Report, {
  foreignKey: 'post_id',
  as: 'reports',
});
Report.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'post',
});

// User -> Block (as blocker)
User.hasMany(Block, {
  foreignKey: 'blocker_id',
  as: 'blockedUsers',
});
Block.belongsTo(User, {
  foreignKey: 'blocker_id',
  as: 'blocker',
});

// User -> Block (as blocked)
User.hasMany(Block, {
  foreignKey: 'blocked_id',
  as: 'blockedBy',
});
Block.belongsTo(User, {
  foreignKey: 'blocked_id',
  as: 'blockedUser',
});

// User -> Repost (one-to-many)
User.hasMany(Repost, {
  foreignKey: 'user_id',
  as: 'reposts',
});
Repost.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Post -> Repost (original post being reposted)
Post.hasMany(Repost, {
  foreignKey: 'post_id',
  as: 'reposts',
});
Repost.belongsTo(Post, {
  foreignKey: 'post_id',
  as: 'originalPost',
});

// Post -> Repost (quote post)
Post.hasOne(Repost, {
  foreignKey: 'quote_post_id',
  as: 'repostOf',
});
Repost.belongsTo(Post, {
  foreignKey: 'quote_post_id',
  as: 'quotePost',
});

// User -> Draft (one-to-many)
User.hasMany(Draft, {
  foreignKey: 'user_id',
  as: 'drafts',
});
Draft.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
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
  ListenLog,
  DailyReaction,
  DailyComment,
  Post,
  PostMedia,
  PostReaction,
  PostComment,
  PostCommentReaction,
  Follow,
  Bookmark,
  PrayerRequest,
  PrayerSupport,
  Report,
  Block,
  Repost,
  PlatformSetting,
  Draft,
};
