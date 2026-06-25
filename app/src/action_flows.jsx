import React from 'react';
import { Icon } from './icons.jsx';
import { TrackTag, fmtMoney } from './primitives.jsx';

/* ============================================================
   Action flow modal — generic multi-step flow framework
   + concrete flow definitions for the main CTAs.

   Every flow is DATA-DRIVEN from the source card (customer, value,
   owner, vehicle, sub, stage). No tenant-specific business content
   is hardcoded — the same flows work for any tenant's records.
   ============================================================ */

/* ---------- Generic shell ---------- */

const Stepper = ({ steps, currentIdx, completed }) => (
  <div className="stepper">
    {steps.map((s, i) => {
      const state = completed ? 'done'
                  : i < currentIdx ? 'done'
                  : i === currentIdx ? 'active'
                  : 'future';
      return (
        <React.Fragment key={s.label}>
          <div className={`stepNode ${state}`}>
            <span className="stepDot">
              {state === 'done' ? <Icon name="check" size={10} strokeWidth={3} /> : i + 1}
            </span>
            <span className="stepLabel">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`stepLine ${state}`} />}
        </React.Fragment>
      );
    })}
  </div>
);

export const ActionFlow = ({ flow, onClose, onComplete }) => {
  const [stepIdx, setStepIdx] = React.useState(0);
  const [state, setState] = React.useState(flow.initialState || {});
  const [completed, setCompleted] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const step = flow.steps[stepIdx];
  const isLast = stepIdx === flow.steps.length - 1;

  const next = () => {
    if (step.validate && !step.validate(state)) return;
    if (isLast) {
      setCompleted(true);
      setTimeout(() => {
        onComplete && onComplete(state);
        onClose();
      }, 1800);
    } else {
      setStepIdx(s => s + 1);
    }
  };
  const back = () => stepIdx > 0 && setStepIdx(s => s - 1);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="flowPanel" onClick={e => e.stopPropagation()}>
        <div className="flowHead">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flowKind">
              <Icon name={flow.icon || 'bolt'} size={12} strokeWidth={2} />
              {flow.kind}
            </div>
            <h2>{flow.title}</h2>
            <div className="sub">{flow.subtitle}</div>
          </div>
          <button className="iconBtn" onClick={onClose} title="Cancel">
            <Icon name="close" size={16} />
          </button>
        </div>

        {!completed && (
          <div className="flowStepperWrap">
            <Stepper steps={flow.steps} currentIdx={stepIdx} />
          </div>
        )}

        <div className="flowBody">
          {completed ? (
            <div className="flowSuccess">
              <div className="successMark">
                <Icon name="check" size={28} strokeWidth={2.5} />
              </div>
              <h3>{flow.successTitle}</h3>
              <p>{typeof flow.successDetail === 'function' ? flow.successDetail(state) : flow.successDetail}</p>
              {flow.cascadePreview && (
                <div className="cascadeList">
                  {flow.cascadePreview.map((c, i) => (
                    <div className="cascadeItem" key={i}>
                      <span className="cascadeArrow"><Icon name="arrow" size={11} strokeWidth={2} /></span>
                      <TrackTag track={c.track}>{c.track}</TrackTag>
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            step.render({ state, setState, next, back, item: flow.item })
          )}
        </div>

        {!completed && (
          <div className="flowFoot">
            <button className="cta ghost" onClick={stepIdx > 0 ? back : onClose}>
              {stepIdx > 0 ? '← Back' : 'Cancel'}
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Step {stepIdx + 1} of {flow.steps.length}
            </div>
            <button className="cta" onClick={next}
                    disabled={step.validate && !step.validate(state)}>
              {isLast ? (flow.confirmLabel || 'Confirm & send') : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Reusable step UI primitives ---------- */

const ChoiceList = ({ value, onChange, options }) => (
  <div className="choiceList">
    {options.map(opt => (
      <button key={opt.id} type="button"
        className={`choiceCard ${value === opt.id ? 'selected' : ''}`}
        onClick={() => onChange(opt.id)}>
        <span className="choiceRadio">
          <span />
        </span>
        <div className="choiceMain">
          <div className="choiceTitle">{opt.label}</div>
          {opt.description && <div className="choiceDesc">{opt.description}</div>}
        </div>
        {opt.tag && <span className="choiceTag">{opt.tag}</span>}
      </button>
    ))}
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);

const EmailPreview = ({ from, to, subject, body }) => (
  <div className="emailPreview">
    <div className="emailHead">
      <div className="row"><span className="k">From</span><span>{from}</span></div>
      <div className="row"><span className="k">To</span><span>{to}</span></div>
      <div className="row"><span className="k">Subject</span><span className="subj">{subject}</span></div>
    </div>
    <div className="emailBody">{body}</div>
  </div>
);

const SummaryRows = ({ rows }) => (
  <div className="summaryRows">
    {rows.map((r, i) => (
      <div className="summaryRow" key={i}>
        <div className="k">{r.k}</div>
        <div className="v">{r.v}</div>
      </div>
    ))}
  </div>
);

/* ---------- Helpers: derive generic, data-driven values from the card ---------- */

// A plausible contact address derived from the customer name (preview only).
const contactEmail = (item, prefix) => {
  const slug = String(item.customer || 'customer').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${prefix}@${slug || 'customer'}.example`;
};
// Who the message is shown as coming from — the card's owner (the acting user).
const senderLabel = (item) => item.owner || 'Your account';
const daysPhrase = (item) => item.daysLabel || (item.days != null ? `${item.days} days in stage` : 'in progress');

/* ---------- Flow definitions ----------
   Each flow takes the source item and returns a flow config.
   onComplete receives the final state and returns a "patch"
   describing how the source card should change.
*/

const FOLLOWUP_TEMPLATES = [
  { id: 'gentle',   label: 'Gentle nudge',
    description: '"Just checking in — do you have any questions?" Friendly tone, no pressure.',
    tag: 'Default' },
  { id: 'status',   label: 'Status check',
    description: 'Asks for an explicit timeline. Useful when the item has gone quiet.' },
  { id: 'director', label: 'Escalate',
    description: 'CC the customer\'s decision-maker. Use sparingly — for items at risk.',
    tag: 'High urgency' },
];

const sendFollowUpFlow = (item) => ({
  kind: 'Follow-up',
  icon: 'mail',
  title: `Send follow-up — ${item.customer}`,
  subtitle: `${item.stageName} · ${daysPhrase(item)} · owned by ${item.owner}`,
  item,
  initialState: { template: 'gentle' },
  steps: [
    {
      label: 'Choose template',
      validate: (s) => !!s.template,
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">Pick a template — the message is drafted and saved to the thread for {item.customer}.</p>
          <ChoiceList value={state.template}
                      onChange={v => setState(s => ({ ...s, template: v }))}
                      options={FOLLOWUP_TEMPLATES} />
        </>
      ),
    },
    {
      label: 'Preview',
      render: ({ state }) => (
        <>
          <p className="flowLead">Preview of the message — sent from your account and threaded to the existing conversation.</p>
          <EmailPreview
            from={senderLabel(item)}
            to={contactEmail(item, 'contact')}
            subject={
              state.template === 'director' ? `Request for status — ${item.customer} (escalated)` :
              state.template === 'status' ? `Timeline check-in — ${item.sub || item.customer}` :
              `Following up — ${item.customer}`
            }
            body={
              <>
                <p>Hi,</p>
                <p>{state.template === 'gentle'
                  ? `Just a quick note to follow up on ${item.sub || 'our last exchange'} (${daysPhrase(item)}). Happy to walk through any questions.`
                  : state.template === 'status'
                  ? `It has been ${daysPhrase(item)} on ${item.sub || 'this item'}. Could you share where things stand so we can keep the timeline on track?`
                  : `Escalating this thread so it does not slip — could we align on next steps this week?`}</p>
                <p>Best,<br/>{senderLabel(item)}</p>
              </>
            }
          />
        </>
      ),
    },
    {
      label: 'Confirm',
      render: ({ state, item }) => (
        <>
          <p className="flowLead">Ready to send. The card resets its days-in-stage counter.</p>
          <SummaryRows rows={[
            { k: 'Recipient', v: `Contact · ${item.customer}` },
            { k: 'Template', v: FOLLOWUP_TEMPLATES.find(t => t.id === state.template).label },
            { k: 'Owner', v: item.owner },
            { k: 'Status after send', v: 'Days-in-stage counter resets to 0' },
          ]} />
        </>
      ),
    },
  ],
  confirmLabel: 'Send message',
  successTitle: 'Follow-up sent',
  successDetail: (s) =>
    `Message logged · ${FOLLOWUP_TEMPLATES.find(t => t.id === s.template).label} template. The counter has reset.`,
  onPatch: () => ({ status: 'amber', daysLabel: 'just now', days: 0 }),
});

const signContractFlow = (item) => ({
  kind: 'Sign · cascades downstream',
  icon: 'bolt',
  title: `Mark signed — ${item.customer}`,
  subtitle: `${item.stageName} · ${fmtMoney(item.value)}${item.sub ? ' · ' + item.sub : ''}`,
  item,
  steps: [
    {
      label: 'Confirm signature',
      render: () => (
        <>
          <p className="flowLead">Final check before the cascade runs across the downstream tracks and the customer portal.</p>
          <SummaryRows rows={[
            { k: 'Value', v: fmtMoney(item.value) },
            { k: 'Customer', v: item.customer },
            ...(item.sub ? [{ k: 'Reference', v: item.sub }] : []),
            { k: 'Owner', v: item.owner },
          ]} />
        </>
      ),
    },
    {
      label: 'Preview cascade',
      render: () => (
        <>
          <p className="flowLead">Marking this signed triggers the following downstream actions automatically. All are reversible from each track's audit log.</p>
          <div className="cascadePreviewList">
            <div className="cascadePrevItem">
              <TrackTag track="operations">operations</TrackTag>
              <div>
                <div className="t">New card · "Order started"</div>
                <div className="d">Fulfilment kicked off for {item.customer}</div>
              </div>
            </div>
            <div className="cascadePrevItem">
              <TrackTag track="finance">finance</TrackTag>
              <div>
                <div className="t">New card · "Invoice to create · {fmtMoney(item.value)}"</div>
                <div className="d">First invoice for this agreement</div>
              </div>
            </div>
            <div className="cascadePrevItem">
              <TrackTag track="sales">portal</TrackTag>
              <div>
                <div className="t">Customer portal updated for {item.customer}</div>
                <div className="d">"Order confirmed — next steps being coordinated"</div>
              </div>
            </div>
          </div>
        </>
      ),
    },
  ],
  confirmLabel: 'Confirm & cascade',
  successTitle: 'Signed — cascade triggered',
  successDetail: () => 'Downstream actions fired. Watch the dashboard — Operations and Finance now show new cards with a brief highlight.',
  cascadePreview: [
    { track: 'operations', text: '"Order started"' },
    { track: 'finance',    text: `"Invoice to create" · ${fmtMoney(item.value)}` },
    { track: 'sales',      text: 'Customer portal · "Order confirmed"' },
  ],
  onPatch: () => ({ stageId: 'signed', stageName: 'Signed', status: 'green', daysLabel: 'signed now', cta: 'Open record' }),
});

const planWorkshopVisitFlow = (item) => ({
  kind: 'Operations action',
  icon: 'truck',
  title: `Plan service visit — ${item.customer}`,
  subtitle: `${item.vehicle || item.sub || ''}${item.daysLabel ? ' · ' + item.daysLabel : ''}`,
  item,
  initialState: { date: '', replacement: '' },
  steps: [
    {
      label: 'Pick a date',
      validate: (s) => !!s.date,
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">Choose a date for the service visit{item.vehicle ? ` for ${item.vehicle}` : ''}.</p>
          <Field label="Visit date">
            <input type="date" className="textInput" value={state.date}
                   onChange={e => setState(s => ({ ...s, date: e.target.value }))} />
          </Field>
        </>
      ),
    },
    {
      label: 'Replacement',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">If a loaner is needed for the duration, note it here (optional).</p>
          <Field label="Replacement vehicle / note" hint="Leave blank if no replacement is required.">
            <input type="text" className="textInput" value={state.replacement}
                   placeholder="e.g. loaner vehicle reference"
                   onChange={e => setState(s => ({ ...s, replacement: e.target.value }))} />
          </Field>
        </>
      ),
    },
    {
      label: 'Notify operator',
      render: ({ state }) => (
        <>
          <p className="flowLead">An automated message will be posted to the customer portal and emailed to the operator's contact.</p>
          <EmailPreview
            from={senderLabel(item)}
            to={contactEmail(item, 'fleet')}
            subject={`Service visit scheduled${item.vehicle ? ' — ' + item.vehicle : ''}`}
            body={
              <>
                <p>Hello,</p>
                <p>We have scheduled a service visit{item.vehicle ? ` for ${item.vehicle}` : ''} on <strong>{state.date || '(date)'}</strong>.{state.replacement ? ` A replacement (${state.replacement}) will be arranged.` : ''}</p>
                <p>Please confirm by replying or via the customer portal.</p>
                <p>Best,<br/>{senderLabel(item)}</p>
              </>
            }
          />
        </>
      ),
    },
  ],
  confirmLabel: 'Schedule & notify',
  successTitle: 'Service visit scheduled',
  successDetail: (s) =>
    `Booked for ${s.date}${s.replacement ? ' · replacement noted' : ''} · operator notified via portal and email.`,
  cascadePreview: [
    { track: 'workshop', text: 'New work order on the chosen date' },
  ],
  onPatch: () => ({ status: 'green', daysLabel: 'scheduled now' }),
});

const generateInvoiceFlow = (item) => ({
  kind: 'Finance action',
  icon: 'invoice',
  title: `Generate invoice — ${item.customer}`,
  subtitle: `${fmtMoney(item.value)}${item.sub ? ' · ' + item.sub : ''}`,
  item,
  initialState: { channel: 'peppol' },
  steps: [
    {
      label: 'Verify total',
      render: () => (
        <>
          <p className="flowLead">Invoice total is drawn from the record. Detailed lines come from the linked contract.</p>
          <div className="invoiceTable">
            <div className="invHead">
              <span>Item</span>
              <span className="num">Amount</span>
            </div>
            <div className="invRow">
              <span>{item.sub || 'Contract charges'}</span>
              <span className="num">{fmtMoney(item.value)}</span>
            </div>
            <div className="invRow grand">
              <span>Total</span>
              <span className="num">{fmtMoney(item.value)}</span>
            </div>
          </div>
        </>
      ),
    },
    {
      label: 'Channel',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">Choose a delivery channel. PEPPOL e-invoicing is recommended where the customer supports it; it falls back to email-PDF otherwise.</p>
          <ChoiceList value={state.channel}
                      onChange={v => setState(s => ({ ...s, channel: v }))}
                      options={[
            { id: 'peppol', label: 'PEPPOL e-invoice',     description: 'Pan-European standard · receipt confirmation within minutes', tag: 'Recommended' },
            { id: 'email',  label: 'Email PDF',            description: 'PDF attached, no machine-readable feed.' },
            { id: 'csv',    label: 'CSV upload to portal', description: 'For customers without a PEPPOL access point.' },
          ]} />
        </>
      ),
    },
    {
      label: 'Confirm',
      render: ({ state }) => (
        <>
          <p className="flowLead">Once sent, the card moves to <strong>"Awaiting payment"</strong> on net-30 terms.</p>
          <SummaryRows rows={[
            { k: 'Amount', v: fmtMoney(item.value) },
            { k: 'Channel', v: state.channel === 'peppol' ? 'PEPPOL e-invoice' : state.channel === 'email' ? 'Email PDF' : 'CSV upload to portal' },
            { k: 'Customer', v: item.customer },
            { k: 'Terms', v: 'Net 30 · auto-reminder if unpaid' },
          ]} />
        </>
      ),
    },
  ],
  confirmLabel: 'Generate & send',
  successTitle: 'Invoice generated',
  successDetail: (s) => `Sent via ${s.channel === 'peppol' ? 'PEPPOL — delivery receipt expected within minutes' : s.channel === 'email' ? 'email PDF' : 'CSV portal upload'}. The card is now in "Awaiting payment".`,
  onPatch: () => ({ stageId: 'awaiting', stageName: 'Awaiting payment', status: 'green', daysLabel: 'sent now', cta: 'View invoice' }),
});

const sendDunningFlow = (item) => ({
  kind: 'Finance action',
  icon: 'mail',
  title: `Payment reminder — ${item.customer}`,
  subtitle: `${item.sub || 'Invoice'} · ${fmtMoney(item.value)}${item.daysLabel ? ' · ' + item.daysLabel : ''}`,
  item,
  initialState: { level: 'formal' },
  steps: [
    {
      label: 'Escalation level',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">Pick the tone. "Formal" is recommended once an invoice is well past due; "Collections" hands the receivable to your agency.</p>
          <ChoiceList value={state.level}
                      onChange={v => setState(s => ({ ...s, level: v }))}
                      options={[
            { id: 'reminder',    label: 'Polite reminder',       description: 'Soft tone — a gentle nudge.' },
            { id: 'formal',      label: 'Formal notice',         description: 'Pay-or-escalate notice citing the agreed terms.', tag: 'Recommended' },
            { id: 'collections', label: 'Hand off to collections', description: 'Removes the receivable from the dashboard. Final step.' },
          ]} />
        </>
      ),
    },
    {
      label: 'Preview',
      render: ({ state }) => (
        <EmailPreview
          from={senderLabel(item)}
          to={contactEmail(item, 'ap')}
          subject={state.level === 'formal'
            ? `Formal notice — ${item.sub || 'invoice'} overdue`
            : state.level === 'collections'
            ? `Notice of handoff to collections — ${item.sub || 'invoice'}`
            : `Reminder — ${item.sub || 'invoice'} unpaid`}
          body={
            <>
              <p>Dear accounts payable team,</p>
              <p>{state.level === 'formal'
                ? `Per our agreed terms, ${item.sub || 'this invoice'} for ${fmtMoney(item.value)} is now past due. We require payment within 14 calendar days, failing which the receivable will be referred to our collections partner.`
                : state.level === 'collections'
                ? `We confirm that ${item.sub || 'this invoice'} for ${fmtMoney(item.value)} has been referred to our collections partner today.`
                : `Just a reminder that ${item.sub || 'this invoice'} for ${fmtMoney(item.value)} is past due. Please confirm a payment date at your convenience.`}</p>
              <p>Best regards,<br/>{senderLabel(item)}</p>
            </>
          }
        />
      ),
    },
  ],
  confirmLabel: 'Send notice',
  successTitle: 'Reminder sent',
  successDetail: (s) => `${s.level === 'collections' ? 'Receivable handed off to collections. Card removed from dashboard.' : 'Notice sent. Card stays flagged until payment is received.'}`,
  onPatch: (s) => s.level === 'collections'
    ? { stageId: 'paid', stageName: 'In collections', status: 'amber', daysLabel: 'handed off', cta: 'View collections file' }
    : { daysLabel: 'notice sent now', cta: 'Awaiting response' },
});

const approveSupplierInvoiceFlow = (item) => ({
  kind: 'Supplier invoice',
  icon: 'receipt',
  title: `Approve invoice — ${item.customer}`,
  subtitle: `${fmtMoney(item.value)}${item.sub ? ' · ' + item.sub : ''}`,
  item,
  steps: [
    {
      label: 'Match to order',
      render: () => (
        <>
          <p className="flowLead">Supplier invoice received. It has been auto-matched against the linked order.</p>
          <SummaryRows rows={[
            { k: 'Supplier', v: item.customer },
            ...(item.sub ? [{ k: 'Reference', v: item.sub }] : []),
            { k: 'Amount', v: fmtMoney(item.value) },
            { k: 'Match', v: 'Auto-matched against the linked order' },
          ]} />
        </>
      ),
    },
    {
      label: 'Approve',
      render: () => (
        <>
          <p className="flowLead">Approving routes the invoice to Finance for scheduled payment under your agreed terms with this supplier.</p>
          <div className="approveBox">
            <Icon name="check" size={16} strokeWidth={2.5} />
            <div>
              <div className="t">Approve for payment</div>
              <div className="d">Hands off to Finance · payment scheduled under net terms</div>
            </div>
          </div>
        </>
      ),
    },
  ],
  confirmLabel: 'Approve & route to Finance',
  successTitle: 'Invoice approved',
  successDetail: () => 'This card is archived. A new card now exists in Finance under "Approved" for scheduled payment.',
  cascadePreview: [
    { track: 'finance', text: `New card · "${item.customer} · approved"` },
  ],
  onPatch: () => ({ stageId: 'invoiced', stageName: 'Invoice approved', status: 'green', daysLabel: 'approved now', cta: 'View in Finance' }),
});

const notifyPickupFlow = (item) => ({
  kind: 'Operations action',
  icon: 'mail',
  title: `Notify customer — ready for collection`,
  subtitle: `${item.customer}${item.vehicle ? ' · ' + item.vehicle : ''}`,
  item,
  steps: [
    {
      label: 'Compose',
      render: () => (
        <EmailPreview
          from={senderLabel(item)}
          to={contactEmail(item, 'fleet')}
          subject={`${item.vehicle || 'Your item'} ready for collection`}
          body={
            <>
              <p>Hello,</p>
              <p><strong>{item.vehicle || 'Your item'}</strong> is ready for collection. Relevant documents are attached and visible in the customer portal.</p>
              <p>Please collect at your convenience. Any replacement will be collected at the same time.</p>
              <p>Best,<br/>{senderLabel(item)}</p>
            </>
          }
        />
      ),
    },
    {
      label: 'Confirm',
      render: () => (
        <>
          <p className="flowLead">A notification will also appear in {item.customer}'s portal under "Recent messages".</p>
          <SummaryRows rows={[
            { k: 'Channel', v: 'Portal + email' },
            { k: 'Card moves to', v: '"Awaiting collection confirmation"' },
          ]} />
        </>
      ),
    },
  ],
  confirmLabel: 'Send notification',
  successTitle: 'Customer notified',
  successDetail: () => 'Message delivered to portal + email. Card moves to "Awaiting collection confirmation".',
  onPatch: () => ({ stageName: 'Awaiting collection confirmation', daysLabel: 'notified now', cta: 'Mark as collected' }),
});

/* ---------- Resolver: pick the right flow for a card ----------
   Keyed on generic signals (track + CTA + stage), not demo ids,
   so it works for any tenant's records. */

export const resolveFlow = (item) => {
  const track = String(item.track || '').toLowerCase();
  const cta = String(item.cta || '').toLowerCase();
  const stage = String(item.stageId || '').toLowerCase();
  const type = String(item.type || '').toUpperCase();

  const isSales = track.includes('sale');
  const isFinance = track.includes('financ');
  const isWorkshop = track.includes('workshop');
  const isOps = track.includes('oper');

  // Sales: signing a contract (cascades downstream)
  if (isSales && (cta.includes('sign') || item.awaitingSign || stage === 'contract' || stage === 'signed')) {
    return signContractFlow(item);
  }
  // Finance: overdue payment reminder / dunning
  if (isFinance && (cta.includes('dun') || cta.includes('remind') || stage === 'overdue' || item.status === 'red' || item.status === 'late')) {
    return sendDunningFlow(item);
  }
  // Finance / invoices: generate an invoice
  if ((isFinance || type === 'INVOICE') && (cta.includes('invoice') || stage === 'to_make' || stage === 'to_create')) {
    return generateInvoiceFlow(item);
  }
  // Workshop: approve a supplier invoice
  if (isWorkshop && (cta.includes('approve') || stage.includes('approv'))) {
    return approveSupplierInvoiceFlow(item);
  }
  // Operations: ready for pickup / collection
  if ((isOps || isWorkshop) && (cta.includes('pickup') || cta.includes('collect') || stage === 'pickup')) {
    return notifyPickupFlow(item);
  }
  // Operations / workshop: plan a service visit
  if (isOps || isWorkshop) {
    return planWorkshopVisitFlow(item);
  }
  // Default: a follow-up message
  return sendFollowUpFlow(item);
};
