CREATE TYPE "FlowVersionStatus" AS ENUM ('LOCAL', 'DRAFT', 'PUBLISHED', 'DEPRECATED', 'BLOCKED', 'THROTTLED', 'ERROR');
CREATE TYPE "FlowLaunchStatus" AS ENUM ('PENDING', 'SENT', 'OPENED', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "FlowDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

CREATE TABLE "Flow" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "categories" TEXT[] DEFAULT ARRAY['OTHER']::TEXT[],
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "sensitiveFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "completionWebhookUrl" TEXT,
  "completionSecretEnc" TEXT,
  "activeVersionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowVersion" (
  "id" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "FlowVersionStatus" NOT NULL DEFAULT 'LOCAL',
  "metaFlowId" TEXT,
  "jsonVersion" TEXT NOT NULL DEFAULT '7.3',
  "dataApiVersion" TEXT,
  "flowJson" JSONB NOT NULL,
  "validationErrors" JSONB,
  "endpointEnabled" BOOLEAN NOT NULL DEFAULT false,
  "previewUrl" TEXT,
  "previewExpiresAt" TIMESTAMP(3),
  "clonedFromId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowConnector" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "allowedHosts" TEXT[] NOT NULL,
  "authType" TEXT NOT NULL DEFAULT 'NONE',
  "authConfigEnc" TEXT,
  "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowConnector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowActionBinding" (
  "id" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "screen" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "requestMapping" JSONB NOT NULL,
  "responseMapping" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowActionBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowLaunch" (
  "id" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "status" "FlowLaunchStatus" NOT NULL DEFAULT 'PENDING',
  "initialDataEnc" TEXT,
  "entryScreen" TEXT,
  "error" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowLaunch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowSubmission" (
  "id" TEXT NOT NULL,
  "launchId" TEXT NOT NULL,
  "waMessageId" TEXT,
  "responseEnc" TEXT,
  "responseKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "purgedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "status" "FlowDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "responseStatus" INTEGER,
  "error" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowConnectorInvocation" (
  "id" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "launchId" TEXT,
  "screen" TEXT,
  "action" TEXT,
  "responseStatus" INTEGER,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "durationMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowConnectorInvocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowEncryptionKey" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "publicKeyPem" TEXT NOT NULL,
  "privateKeyEnc" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "registeredAt" TIMESTAMP(3),
  "retireAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowEncryptionKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Flow_activeVersionId_key" ON "Flow"("activeVersionId");
CREATE INDEX "Flow_updatedAt_idx" ON "Flow"("updatedAt");
CREATE UNIQUE INDEX "FlowVersion_metaFlowId_key" ON "FlowVersion"("metaFlowId");
CREATE UNIQUE INDEX "FlowVersion_flowId_revision_key" ON "FlowVersion"("flowId", "revision");
CREATE INDEX "FlowVersion_status_idx" ON "FlowVersion"("status");
CREATE UNIQUE INDEX "FlowConnector_name_key" ON "FlowConnector"("name");
CREATE UNIQUE INDEX "FlowActionBinding_flowVersionId_screen_action_key" ON "FlowActionBinding"("flowVersionId", "screen", "action");
CREATE UNIQUE INDEX "FlowLaunch_messageId_key" ON "FlowLaunch"("messageId");
CREATE UNIQUE INDEX "FlowLaunch_tokenHash_key" ON "FlowLaunch"("tokenHash");
CREATE INDEX "FlowLaunch_flowId_createdAt_idx" ON "FlowLaunch"("flowId", "createdAt");
CREATE INDEX "FlowLaunch_contactId_createdAt_idx" ON "FlowLaunch"("contactId", "createdAt");
CREATE INDEX "FlowLaunch_status_idx" ON "FlowLaunch"("status");
CREATE UNIQUE INDEX "FlowSubmission_launchId_key" ON "FlowSubmission"("launchId");
CREATE UNIQUE INDEX "FlowSubmission_waMessageId_key" ON "FlowSubmission"("waMessageId");
CREATE INDEX "FlowSubmission_completedAt_idx" ON "FlowSubmission"("completedAt");
CREATE INDEX "FlowDeliveryAttempt_status_nextAttemptAt_idx" ON "FlowDeliveryAttempt"("status", "nextAttemptAt");
CREATE INDEX "FlowConnectorInvocation_connectorId_createdAt_idx" ON "FlowConnectorInvocation"("connectorId", "createdAt");
CREATE UNIQUE INDEX "FlowEncryptionKey_fingerprint_key" ON "FlowEncryptionKey"("fingerprint");
CREATE INDEX "FlowEncryptionKey_active_idx" ON "FlowEncryptionKey"("active");

ALTER TABLE "Flow" ADD CONSTRAINT "Flow_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "FlowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FlowVersion" ADD CONSTRAINT "FlowVersion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowVersion" ADD CONSTRAINT "FlowVersion_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "FlowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FlowActionBinding" ADD CONSTRAINT "FlowActionBinding_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "FlowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowActionBinding" ADD CONSTRAINT "FlowActionBinding_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "FlowConnector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowLaunch" ADD CONSTRAINT "FlowLaunch_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowLaunch" ADD CONSTRAINT "FlowLaunch_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "FlowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowLaunch" ADD CONSTRAINT "FlowLaunch_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowLaunch" ADD CONSTRAINT "FlowLaunch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowLaunch" ADD CONSTRAINT "FlowLaunch_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FlowSubmission" ADD CONSTRAINT "FlowSubmission_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "FlowLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowDeliveryAttempt" ADD CONSTRAINT "FlowDeliveryAttempt_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FlowSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowConnectorInvocation" ADD CONSTRAINT "FlowConnectorInvocation_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "FlowConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
