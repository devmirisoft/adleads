-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASKING', 'QUALIFIED', 'WAITLISTED', 'TRIAL_ACTIVE', 'PAYMENT_PENDING', 'ENROLLED', 'EXPIRED', 'DROPPED', 'OPTED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CTWA_AD', 'LEAD_FORM', 'ORGANIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('TRIAL', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY', 'CASH', 'BANK', 'UPI_MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'EXPIRED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'INTERACTIVE', 'TEMPLATE', 'MEDIA');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionInput" AS ENUM ('TEXT', 'BUTTONS', 'LIST');

-- CreateEnum
CREATE TYPE "OptionsSource" AS ENUM ('STATIC', 'COURSES', 'BATCHES');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('META', 'RAZORPAY', 'ZOOM');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'VIEWER');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(72) NOT NULL,
    "fee_paise" INTEGER NOT NULL,
    "trial_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "days_of_week" INTEGER[],
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "seats_taken" INTEGER NOT NULL DEFAULT 0,
    "zoom_meeting_id" BIGINT,
    "zoom_host_user" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "wa_id" TEXT,
    "name" TEXT,
    "profile_name" TEXT,
    "course_id" UUID,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "current_step" INTEGER,
    "needs_human" BOOLEAN NOT NULL DEFAULT false,
    "source" "LeadSource" NOT NULL,
    "ad_id" TEXT,
    "ad_name" TEXT,
    "campaign_id" TEXT,
    "ctwa_clid" TEXT,
    "last_inbound_at" TIMESTAMP(3),
    "free_window_until" TIMESTAMP(3),
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "opted_out_at" TIMESTAMP(3),
    "assigned_to_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_events" (
    "id" BIGSERIAL NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus" NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "input_type" "QuestionInput" NOT NULL,
    "options_source" "OptionsSource" NOT NULL,
    "validation_regex" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value" VARCHAR(24) NOT NULL,
    "label" VARCHAR(24) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "question_key" TEXT NOT NULL,
    "answer_value" TEXT NOT NULL,
    "answer_label" TEXT NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL,
    "trial_start" DATE NOT NULL,
    "trial_end" DATE NOT NULL,
    "zoom_registrant_id" TEXT,
    "zoom_join_url" TEXT,
    "link_sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "razorpay_link_id" TEXT,
    "razorpay_link_url" TEXT,
    "razorpay_payment_id" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "link_expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "wa_message_id" TEXT,
    "type" "MessageType" NOT NULL,
    "template_name" TEXT,
    "body" JSONB NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "error_code" TEXT,
    "sent_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "event_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "batches_course_id_status_idx" ON "batches"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_e164_key" ON "leads"("phone_e164");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_needs_human_idx" ON "leads"("needs_human");

-- CreateIndex
CREATE INDEX "lead_events_lead_id_idx" ON "lead_events"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_step_key" ON "questions"("step");

-- CreateIndex
CREATE UNIQUE INDEX "answers_lead_id_question_key_key" ON "answers"("lead_id", "question_key");

-- CreateIndex
CREATE INDEX "enrollments_batch_id_status_idx" ON "enrollments"("batch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_lead_id_batch_id_key" ON "enrollments"("lead_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "payments_enrollment_id_idx" ON "payments"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_wa_message_id_key" ON "messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "messages_lead_id_created_at_idx" ON "messages"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_key_key" ON "webhook_events"("event_key");

-- CreateIndex
CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
