-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CREATOR', 'BACKER', 'SUPPLIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReputationTier" AS ENUM ('NEWCOMER', 'SUPPORTER', 'ADVOCATE', 'AMBASSADOR', 'FOUNDER');

-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('TECH', 'DESIGN', 'FILM', 'MUSIC', 'FOOD', 'GAMES', 'PUBLISHING', 'FASHION', 'ART', 'SOCIAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'LIVE', 'SUCCESSFUL', 'FAILED', 'FUNDED', 'IN_PRODUCTION', 'DELIVERED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('HELD', 'CAPTURED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('DONATION', 'ISTISNA', 'SALAM');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'RELEASED');

-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('OPEN', 'AWARDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'AWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('PLEDGE_RECEIVED', 'PROJECT_FUNDED', 'PROJECT_FAILED', 'MILESTONE_APPROVED', 'PAYOUT_SENT', 'UPDATE_POSTED', 'RANK_UP', 'CONTEST_OPENED', 'CONTEST_ANNOUNCED', 'FAQ_ANSWERED', 'COMMENT_REPLY');

-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ANNOUNCED');

-- CreateEnum
CREATE TYPE "FaqQuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "CommunityStatScope" AS ENUM ('CITY', 'COUNTRY', 'TOTALS');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "roles" "UserRole"[] DEFAULT ARRAY['BACKER']::"UserRole"[],
    "nafathVerified" BOOLEAN NOT NULL DEFAULT false,
    "nafathVerifiedAt" TIMESTAMP(3),
    "reputationTier" "ReputationTier" NOT NULL DEFAULT 'NEWCOMER',
    "totalPledgedHalalas" BIGINT NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "postal" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "shortDescAr" TEXT NOT NULL,
    "category" "ProjectCategory" NOT NULL,
    "storyAr" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fundingGoalHalalas" BIGINT NOT NULL,
    "releaseThresholdPct" INTEGER NOT NULL DEFAULT 80,
    "durationDays" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "productSpecAr" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "raisedHalalas" BIGINT NOT NULL DEFAULT 0,
    "backersCount" INTEGER NOT NULL DEFAULT 0,
    "platformPartner" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTier" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "descAr" TEXT NOT NULL,
    "includesPhysicalProduct" BOOLEAN NOT NULL DEFAULT false,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT false,
    "estDeliveryDate" TIMESTAMP(3) NOT NULL,
    "limitQty" INTEGER,
    "claimedQty" INTEGER NOT NULL DEFAULT 0,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "includedItems" JSONB NOT NULL DEFAULT '[]',
    "shipsTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "descAr" TEXT NOT NULL,
    "imageUrl" TEXT,
    "limitQty" INTEGER,
    "claimedQty" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PledgeAddOn" (
    "id" UUID NOT NULL,
    "pledgeId" UUID NOT NULL,
    "addOnId" UUID NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "amountHalalas" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PledgeAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pledge" (
    "id" UUID NOT NULL,
    "backerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "addOnsHalalas" BIGINT NOT NULL DEFAULT 0,
    "status" "PledgeStatus" NOT NULL DEFAULT 'HELD',
    "shipping" JSONB,
    "contractType" "ContractType" NOT NULL DEFAULT 'DONATION',
    "paymentRef" TEXT NOT NULL,
    "backerNo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Pledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "releasePct" INTEGER NOT NULL,
    "evidenceRequired" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "releasedHalalas" BIGINT NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "evidenceUrl" TEXT,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendLog" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "milestoneId" UUID,
    "amountHalalas" BIGINT NOT NULL,
    "descAr" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQ" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "specsAr" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'OPEN',
    "awardedBidId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBid" (
    "id" UUID NOT NULL,
    "rfqId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "specComplianceNote" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "milestoneId" UUID NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "zatcaInvoiceId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "parentId" UUID,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundNum" INTEGER NOT NULL,
    "promptAr" TEXT NOT NULL,
    "prizeRewardTierId" UUID,
    "prizeAddOnId" UUID,
    "prizeCustomAr" TEXT,
    "winnersCount" INTEGER NOT NULL,
    "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    "announcementCommentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestWinner" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "backerId" UUID NOT NULL,
    "backerNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionAr" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqQuestion" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "askerId" UUID,
    "bodyAr" TEXT NOT NULL,
    "status" "FaqQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answeredFaqItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaqQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityStat" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "scope" "CommunityStatScope" NOT NULL,
    "key" TEXT NOT NULL,
    "backers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommunityStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "avatarUrl" TEXT,
    "bioAr" TEXT,
    "websiteUrl" TEXT,
    "collaborators" JSONB NOT NULL DEFAULT '[]',
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "createdProjectsCount" INTEGER NOT NULL DEFAULT 0,
    "backedProjectsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFollow" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "creatorProfileId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOffer" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "profitSharePct" INTEGER NOT NULL,
    "minTicketHalalas" BIGINT NOT NULL,
    "termsAr" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DORMANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_reputationTier_idx" ON "User"("reputationTier");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Project_status_deadline_idx" ON "Project"("status", "deadline");

-- CreateIndex
CREATE INDEX "Project_status_publishedAt_idx" ON "Project"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Project_category_status_idx" ON "Project"("category", "status");

-- CreateIndex
CREATE INDEX "Project_status_raisedHalalas_idx" ON "Project"("status", "raisedHalalas");

-- CreateIndex
CREATE INDEX "Project_status_backersCount_idx" ON "Project"("status", "backersCount");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "RewardTier_projectId_sortOrder_idx" ON "RewardTier"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "RewardTier_projectId_featured_idx" ON "RewardTier"("projectId", "featured");

-- CreateIndex
CREATE INDEX "AddOn_projectId_sortOrder_idx" ON "AddOn"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "PledgeAddOn_pledgeId_idx" ON "PledgeAddOn"("pledgeId");

-- CreateIndex
CREATE INDEX "PledgeAddOn_addOnId_idx" ON "PledgeAddOn"("addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "Pledge_paymentRef_key" ON "Pledge"("paymentRef");

-- CreateIndex
CREATE INDEX "Pledge_projectId_status_idx" ON "Pledge"("projectId", "status");

-- CreateIndex
CREATE INDEX "Pledge_backerId_createdAt_idx" ON "Pledge"("backerId", "createdAt");

-- CreateIndex
CREATE INDEX "Pledge_backerId_status_idx" ON "Pledge"("backerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Pledge_projectId_backerNo_key" ON "Pledge"("projectId", "backerNo");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_projectId_order_key" ON "Milestone"("projectId", "order");

-- CreateIndex
CREATE INDEX "SpendLog_projectId_date_idx" ON "SpendLog"("projectId", "date");

-- CreateIndex
CREATE INDEX "RFQ_projectId_idx" ON "RFQ"("projectId");

-- CreateIndex
CREATE INDEX "RFQ_status_dueDate_idx" ON "RFQ"("status", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierBid_rfqId_status_amountHalalas_idx" ON "SupplierBid"("rfqId", "status", "amountHalalas");

-- CreateIndex
CREATE INDEX "SupplierBid_rfqId_idx" ON "SupplierBid"("rfqId");

-- CreateIndex
CREATE INDEX "SupplierBid_supplierId_createdAt_idx" ON "SupplierBid"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_projectId_status_idx" ON "Payout"("projectId", "status");

-- CreateIndex
CREATE INDEX "Payout_creatorId_status_createdAt_idx" ON "Payout"("creatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_date_idx" ON "ProjectUpdate"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_orderNum_idx" ON "ProjectUpdate"("projectId", "orderNum");

-- CreateIndex
CREATE INDEX "Comment_projectId_parentId_date_idx" ON "Comment"("projectId", "parentId", "date");

-- CreateIndex
CREATE INDEX "Comment_projectId_date_idx" ON "Comment"("projectId", "date");

-- CreateIndex
CREATE INDEX "Comment_userId_date_idx" ON "Comment"("userId", "date");

-- CreateIndex
CREATE INDEX "Comment_projectId_pinned_date_idx" ON "Comment"("projectId", "pinned", "date");

-- CreateIndex
CREATE INDEX "Contest_projectId_status_idx" ON "Contest"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_projectId_roundNum_key" ON "Contest"("projectId", "roundNum");

-- CreateIndex
CREATE INDEX "ContestWinner_contestId_idx" ON "ContestWinner"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestWinner_contestId_backerId_key" ON "ContestWinner"("contestId", "backerId");

-- CreateIndex
CREATE INDEX "FaqItem_projectId_sortOrder_idx" ON "FaqItem"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "FaqQuestion_projectId_status_createdAt_idx" ON "FaqQuestion"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityStat_projectId_scope_backers_idx" ON "CommunityStat"("projectId", "scope", "backers");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityStat_projectId_scope_key_key" ON "CommunityStat"("projectId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- CreateIndex
CREATE INDEX "CreatorFollow_creatorProfileId_idx" ON "CreatorFollow"("creatorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFollow_followerId_creatorProfileId_key" ON "CreatorFollow"("followerId", "creatorProfileId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentOffer_projectId_idx" ON "InvestmentOffer"("projectId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTier" ADD CONSTRAINT "RewardTier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PledgeAddOn" ADD CONSTRAINT "PledgeAddOn_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PledgeAddOn" ADD CONSTRAINT "PledgeAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_backerId_fkey" FOREIGN KEY ("backerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "RewardTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendLog" ADD CONSTRAINT "SpendLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendLog" ADD CONSTRAINT "SpendLog_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBid" ADD CONSTRAINT "SupplierBid_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBid" ADD CONSTRAINT "SupplierBid_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_prizeRewardTierId_fkey" FOREIGN KEY ("prizeRewardTierId") REFERENCES "RewardTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_prizeAddOnId_fkey" FOREIGN KEY ("prizeAddOnId") REFERENCES "AddOn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestWinner" ADD CONSTRAINT "ContestWinner_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestWinner" ADD CONSTRAINT "ContestWinner_backerId_fkey" FOREIGN KEY ("backerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqQuestion" ADD CONSTRAINT "FaqQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqQuestion" ADD CONSTRAINT "FaqQuestion_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityStat" ADD CONSTRAINT "CommunityStat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

