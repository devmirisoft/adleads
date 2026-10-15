import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { CAN_ACT, requireUser } from '@/modules/auth';
import {
  Button,
  DateTime,
  KeyValueList,
  Money,
  PageHeader,
  Phone,
  SectionCard,
  Separator,
  StatusBadge,
} from '@/modules/core/components';
import { AssignBatchDialog, EnrollmentActions, listOpenBatches } from '@/modules/enrollments';
import {
  getLeadDetail,
  LeadStatusControl,
  LeadTimeline,
  leadName,
  NotesForm,
  ResolveButton,
  SOURCE_LABEL,
} from '@/modules/leads';
import { ChatThread, isWindowOpen, listMessages, ReplyBox } from '@/modules/messaging';
import {
  listPayableEnrollments,
  ManualPaymentDialog,
  METHOD_LABEL,
  requestPaymentAction,
} from '@/modules/payments';
import { userNames } from '@/modules/settings';
import { templateOptions } from './templateOptions';

const UUID = /^[0-9a-f-]{36}$/i;
const ANSWER_LABEL: Record<string, string> = {
  name: 'Name',
  course: 'Course',
  batch: 'Batch',
  confirm: 'Confirmed',
};

export default async function LeadPage({ params }: PageProps<'/leads/[id]'>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [user, lead] = await Promise.all([requireUser(), getLeadDetail(id)]);
  if (!lead) notFound();

  const canAct = CAN_ACT.includes(user.role);
  const [messages, windowOpen, staff, openBatches, payable] = await Promise.all([
    listMessages(id),
    isWindowOpen(lead),
    userNames(),
    canAct ? listOpenBatches() : [],
    canAct ? listPayableEnrollments() : [],
  ]);
  const name = leadName(lead);
  const lastIn = messages.findLast((m) => m.direction === 'IN');
  const unread = lastIn && lastIn === messages.at(-1) && lastIn.status !== 'READ';
  const canAssignBatch = ['ASKING', 'QUALIFIED', 'WAITLISTED'].includes(lead.status);
  const payableHere = payable.filter((p) => lead.enrollments.some((e) => e.id === p.id));

  return (
    <>
      <PageHeader
        title={name}
        description={
          lead.profileName && lead.profileName !== name
            ? `WhatsApp name: ${lead.profileName}`
            : undefined
        }
        backHref="/leads"
        actions={
          canAct && (
            <>
              {(lead.needsHuman || unread) && <ResolveButton leadId={lead.id} />}
              {canAssignBatch && (
                <AssignBatchDialog
                  leadId={lead.id}
                  leadName={name}
                  courseId={lead.courseId}
                  batches={openBatches}
                />
              )}
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard
            title="WhatsApp"
            description={
              windowOpen
                ? 'They wrote within 24 hours: free-form replies allowed.'
                : 'Outside the 24-hour window: templates only.'
            }
          >
            <div className="flex flex-col gap-4">
              <ChatThread leadId={lead.id} initial={messages} />
              {canAct && (
                <>
                  <Separator />
                  <ReplyBox
                    leadId={lead.id}
                    windowOpen={windowOpen}
                    optedOut={!!lead.optedOutAt}
                    templates={templateOptions(lead)}
                  />
                </>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Status history">
            <LeadTimeline events={lead.events} staff={staff} />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard title="Profile">
            <div className="flex flex-col gap-4">
              <KeyValueList
                items={[
                  {
                    label: 'Status',
                    value: (
                      <span className="flex flex-wrap gap-1">
                        <StatusBadge status={lead.status} />
                        {lead.needsHuman && <StatusBadge status="NEEDS_HUMAN" />}
                      </span>
                    ),
                  },
                  { label: 'Phone', value: <Phone e164={lead.phoneE164} /> },
                  {
                    label: 'Source',
                    value: lead.adName
                      ? `${SOURCE_LABEL[lead.source]} · ${lead.adName}`
                      : SOURCE_LABEL[lead.source],
                  },
                  { label: 'Course', value: lead.course?.name ?? '—' },
                  { label: 'Assigned to', value: lead.assignedTo?.name ?? '—' },
                  { label: 'First message', value: <DateTime value={lead.createdAt} /> },
                  {
                    label: 'Last message',
                    value: lead.lastInboundAt ? <DateTime value={lead.lastInboundAt} /> : '—',
                  },
                ]}
              />
              {canAct && (
                <LeadStatusControl leadId={lead.id} leadName={name} status={lead.status} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Answers">
            {lead.answers.length ? (
              <KeyValueList
                items={lead.answers.map((a) => ({
                  label: ANSWER_LABEL[a.questionKey] ?? a.questionKey,
                  value: a.answerLabel,
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No answers yet.</p>
            )}
          </SectionCard>

          {lead.enrollments.map((e) => (
            <SectionCard
              key={e.id}
              title="Enrollment"
              description={`${e.batch.course.name} · ${e.batch.name}`}
              actions={
                canAct && (
                  <EnrollmentActions
                    enrollment={{
                      id: e.id,
                      status: e.status,
                      leadName: name,
                      batch: { id: e.batch.id, name: e.batch.name, courseId: e.batch.courseId },
                    }}
                    batches={openBatches}
                    requestPayment={requestPaymentAction}
                  />
                )
              }
            >
              <KeyValueList
                items={[
                  { label: 'Status', value: <StatusBadge status={e.status} /> },
                  {
                    label: 'Trial',
                    value: (
                      <span>
                        <DateTime value={e.trialStart} dateOnly /> –{' '}
                        <DateTime value={e.trialEnd} dateOnly />
                      </span>
                    ),
                  },
                  {
                    label: 'Zoom link',
                    value: e.zoomJoinUrl ? (
                      <Button variant="link" className="h-auto p-0" asChild>
                        <a href={e.zoomJoinUrl} target="_blank" rel="noreferrer">
                          Open link <ExternalLink className="size-4" aria-hidden />
                        </a>
                      </Button>
                    ) : (
                      'Not sent yet'
                    ),
                  },
                  {
                    label: 'Link sent',
                    value: e.linkSentAt ? <DateTime value={e.linkSentAt} /> : '—',
                  },
                  { label: 'Paid', value: e.paidAt ? <DateTime value={e.paidAt} /> : '—' },
                  ...(e.cancelReason
                    ? [{ label: 'Cancelled because', value: e.cancelReason }]
                    : []),
                ]}
              />
            </SectionCard>
          ))}

          <SectionCard
            title="Payments"
            actions={
              canAct &&
              payableHere.length > 0 && (
                <ManualPaymentDialog enrollments={payableHere} enrollmentId={payableHere[0].id} />
              )
            }
          >
            {lead.enrollments.some((e) => e.payments.length) ? (
              <ul className="flex flex-col gap-3">
                {lead.enrollments.flatMap((e) =>
                  e.payments.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Money paise={p.amountPaise} />
                        <StatusBadge status={p.status} />
                        <span className="text-muted-foreground">{METHOD_LABEL[p.method]}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <DateTime value={p.paidAt ?? p.createdAt} />
                        {p.razorpayPaymentId && ` · ${p.razorpayPaymentId}`}
                      </span>
                    </li>
                  )),
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Notes">
            <NotesForm leadId={lead.id} notes={lead.notes} canEdit={canAct} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
