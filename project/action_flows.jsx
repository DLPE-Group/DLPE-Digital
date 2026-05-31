/* ============================================================
   Action flow modal — generic multi-step flow framework
   + 6 concrete flow definitions for the main CTAs
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

const ActionFlow = ({ flow, onClose, onComplete }) => {
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

/* ---------- Flow definitions ----------
   Each flow takes the source item and returns a flow config.
   onComplete receives the final state and returns a "patch"
   describing how the source card should change.
*/

const FOLLOWUP_TEMPLATES = [
  { id: 'gentle',   label: 'Gentle nudge',
    description: '"Just checking in — do you have any questions on our offer?" Friendly tone, no pressure.',
    tag: 'Default' },
  { id: 'status',   label: 'Status check',
    description: 'Asks for an explicit timeline. Useful when the deal has gone quiet for >10 days.' },
  { id: 'director', label: 'Escalate to director',
    description: 'CC the customer\'s procurement director. Use sparingly — reserved for renewals at risk.',
    tag: 'High urgency' },
];

const sendFollowUpFlow = (item) => ({
  kind: 'Sales action',
  icon: 'mail',
  title: `Send follow-up — ${item.customer}`,
  subtitle: `${item.stageName} · ${item.daysLabel || item.days + ' days in stage'} · owned by ${item.owner}`,
  item,
  initialState: { template: 'gentle' },
  steps: [
    {
      label: 'Choose template',
      validate: (s) => !!s.template,
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">Pick a template — the email is drafted in the customer's primary language ({item.customer.includes('GmbH') ? 'German' : item.customer.includes('B.V.') ? 'Dutch' : 'English'}) and saved to the CRM thread for {item.customer}.</p>
          <ChoiceList value={state.template}
                      onChange={v => setState(s => ({ ...s, template: v }))}
                      options={FOLLOWUP_TEMPLATES} />
        </>
      ),
    },
    {
      label: 'Preview',
      render: ({ state }) => {
        const tpl = FOLLOWUP_TEMPLATES.find(t => t.id === state.template);
        return (
          <>
            <p className="flowLead">Preview of the email — sent from your CRM account, threaded to the existing conversation.</p>
            <EmailPreview
              from="markus.weber@dlpe-group.eu"
              to={`procurement@${item.customer.split(' ')[0].toLowerCase()}.com`}
              subject={
                state.template === 'director' ? `RE: Fleet refresh proposal — request for status (escalated)` :
                state.template === 'status' ? `RE: Fleet refresh proposal — timeline check-in` :
                `Following up on our proposal — ${item.customer}`
              }
              body={
                <>
                  <p>Hi team,</p>
                  <p>{state.template === 'gentle'
                    ? `Just a quick note to follow up on the proposal we sent ${item.daysLabel || item.days + ' days ago'}. Happy to walk through any questions on pricing, vehicle specs, or contract terms.`
                    : state.template === 'status'
                    ? `It has been ${item.daysLabel || item.days + ' days'} since we sent the offer for ${item.sub}. To keep the delivery window of Q3 realistic we'd like to lock the timeline this week — could you share where things stand internally?`
                    : `Escalating this thread to make sure it does not slip — the renewal window for the current contract closes in 18 days. We need to either sign or formally extend by then.`}</p>
                  <p>Best,<br/>Markus Weber<br/>Account Director · Benelux</p>
                </>
              }
            />
          </>
        );
      },
    },
    {
      label: 'Confirm',
      render: ({ state, item }) => (
        <>
          <p className="flowLead">Ready to send. The card moves to <strong>"Follow-up sent · day 0"</strong> and resets the days-in-stage counter.</p>
          <SummaryRows rows={[
            { k: 'Recipient', v: `Procurement contact · ${item.customer}` },
            { k: 'Template', v: FOLLOWUP_TEMPLATES.find(t => t.id === state.template).label },
            { k: 'Logged to', v: 'CRM thread · Salesforce' },
            { k: 'Owner', v: item.owner },
            { k: 'Status after send', v: 'Amber → days-in-stage counter resets to 0' },
          ]} />
        </>
      ),
    },
  ],
  confirmLabel: 'Send email',
  successTitle: 'Follow-up sent',
  successDetail: (s) =>
    `Email logged in CRM · ${FOLLOWUP_TEMPLATES.find(t => t.id === s.template).label} template. The card is now amber and the counter has reset.`,
  onPatch: (item) => ({ status: 'amber', daysLabel: 'just now', days: 0 }),
});

/* Sign Brussels Energy — cascade demo */
const signContractFlow = (item) => ({
  kind: 'Sales action · cascades to 3 tracks',
  icon: 'bolt',
  title: `Mark contract signed — ${item.customer}`,
  subtitle: `${item.stageName} · ${fmtMoney(item.value)} · ${item.sub}`,
  item,
  steps: [
    {
      label: 'Confirm signature',
      render: () => (
        <>
          <p className="flowLead">All signature blocks have been received. Final check before the cascade runs across Operations, Finance and the customer portal.</p>
          <SummaryRows rows={[
            { k: 'Contract value', v: fmtMoney(item.value) + ' over 60 months' },
            { k: 'Vehicles', v: '78 commercial · mixed (45 vans · 33 trucks)' },
            { k: 'Signed by', v: 'Brussels Energy SA · Anke Vermeulen, COO' },
            { k: 'Signed at', v: 'May 28, 2026 · 09:14 CET' },
            { k: 'Original', v: 'Filed in DMS · BES-2026-04-signed.pdf' },
          ]} />
        </>
      ),
    },
    {
      label: 'Preview cascade',
      render: () => (
        <>
          <p className="flowLead">Marking this contract signed will trigger the following downstream actions automatically. All are reversible from each track's audit log.</p>
          <div className="cascadePreviewList">
            <div className="cascadePrevItem">
              <TrackTag track="operations">operations</TrackTag>
              <div>
                <div className="t">New card · "Vehicle ordered · day 0 of 90"</div>
                <div className="d">Assigned to Tom Janssens · supplier confirmation due within 5 working days</div>
              </div>
            </div>
            <div className="cascadePrevItem">
              <TrackTag track="finance">finance</TrackTag>
              <div>
                <div className="t">New card · "Invoice to create · {fmtMoney(item.value)}"</div>
                <div className="d">Assigned to Ines Vandeput · master invoice for first delivery</div>
              </div>
            </div>
            <div className="cascadePrevItem">
              <TrackTag track="sales">portal</TrackTag>
              <div>
                <div className="t">Customer portal updated for {item.customer}</div>
                <div className="d">"Order confirmed — delivery dates being coordinated"</div>
              </div>
            </div>
          </div>
        </>
      ),
    },
  ],
  confirmLabel: 'Confirm & cascade',
  successTitle: 'Contract signed — cascade triggered',
  successDetail: () => 'Three downstream actions fired. Watch the dashboard — Operations and Finance now show new cards with a brief highlight.',
  cascadePreview: [
    { track: 'operations', text: '"Vehicle ordered" · 78 vehicles · day 0 of 90' },
    { track: 'finance',    text: '"Invoice to create" · €2.46M' },
    { track: 'sales',      text: 'Customer portal · "Order confirmed"' },
  ],
  onPatch: () => ({ stageId: 'signed', stageName: 'Signed', status: 'green', daysLabel: 'signed now', cta: 'Open in CRM' }),
  cascade: 'sign-brussels',
});

const REPLACEMENT_OPTIONS = [
  { id: 'van-7720', label: 'VAN-7720 · Mercedes Sprinter', description: 'Available from Jun 02 · 14 days · same depot' },
  { id: 'van-7811', label: 'VAN-7811 · Ford Transit',      description: 'Available from Jun 04 · 10 days · transferred from Rotterdam' },
  { id: 'van-8412', label: 'VAN-8412 · Iveco Daily',       description: 'Available from Jun 09 · 7 days · same depot', tag: 'Last resort' },
];

const planWorkshopVisitFlow = (item) => ({
  kind: 'Operations action',
  icon: 'truck',
  title: `Plan workshop visit — ${item.customer}`,
  subtitle: `${item.vehicle} · ${item.sub} · ${item.daysLabel}`,
  item,
  initialState: { date: '2026-06-04', replacement: 'van-7811' },
  steps: [
    {
      label: 'Pick a date',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">The annual inspection window for {item.vehicle} closes on Jun 12. Workshop capacity calendar below — pick a day in the green band.</p>
          <div className="capacityCal">
            {['Mon Jun 02','Tue Jun 03','Wed Jun 04','Thu Jun 05','Fri Jun 06','Mon Jun 09','Tue Jun 10','Wed Jun 11'].map((d, i) => {
              const cap = [80, 60, 30, 45, 90, 50, 75, 95][i];
              const dateVal = `2026-06-0${[2,3,4,5,6,9,10,11][i]}`;
              return (
                <button key={d} type="button"
                  className={`capDay ${state.date === dateVal ? 'selected' : ''}`}
                  onClick={() => setState(s => ({ ...s, date: dateVal }))}>
                  <div className="capDate">{d}</div>
                  <div className={`capBar ${cap > 80 ? 'full' : cap > 60 ? 'busy' : 'open'}`}>
                    <i style={{ width: `${cap}%` }} />
                  </div>
                  <div className="capLabel">{cap}% booked</div>
                </button>
              );
            })}
          </div>
        </>
      ),
    },
    {
      label: 'Replacement',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">A loaner is needed for the duration. Three vehicles match the operator's spec — auto-ranked by availability and depot proximity.</p>
          <ChoiceList value={state.replacement}
                      onChange={v => setState(s => ({ ...s, replacement: v }))}
                      options={REPLACEMENT_OPTIONS} />
        </>
      ),
    },
    {
      label: 'Notify operator',
      render: ({ state }) => {
        const r = REPLACEMENT_OPTIONS.find(o => o.id === state.replacement);
        return (
          <>
            <p className="flowLead">An automated message will be posted to the customer portal and emailed to the operator's fleet contact.</p>
            <EmailPreview
              from="ops@dlpe-group.eu"
              to={`fleet@${item.customer.split(' ')[0].toLowerCase()}.com`}
              subject={`Annual inspection scheduled — ${item.vehicle}`}
              body={
                <>
                  <p>Hello,</p>
                  <p>We have scheduled the annual inspection for <strong>{item.vehicle}</strong> on <strong>{state.date}</strong>. A replacement vehicle (<strong>{r.label}</strong>) will be delivered to your depot the same morning at 07:30.</p>
                  <p>Please confirm by replying to this message or via the customer portal.</p>
                  <p>Best,<br/>Operations · DLPE-Group</p>
                </>
              }
            />
          </>
        );
      },
    },
  ],
  confirmLabel: 'Schedule & notify',
  successTitle: 'Workshop visit scheduled',
  successDetail: (s) =>
    `Booked for ${s.date} · replacement vehicle reserved · operator notified via portal and email. The card moves to "Contact fleet operator with date".`,
  cascadePreview: [
    { track: 'workshop', text: 'New work order · vehicle expected on the date' },
    { track: 'operations', text: 'This card advances to "Contact fleet operator with date"' },
  ],
  onPatch: () => ({ stageId: 'replacement', stageName: 'Contact fleet operator with date', status: 'green', daysLabel: 'scheduled now' }),
});

const generateInvoiceFlow = (item) => ({
  kind: 'Finance action',
  icon: 'invoice',
  title: `Generate invoice — ${item.customer}`,
  subtitle: `${fmtMoney(item.value)} · ${item.sub}`,
  item,
  initialState: { channel: 'peppol' },
  steps: [
    {
      label: 'Verify lines',
      render: () => (
        <>
          <p className="flowLead">Invoice lines pulled from the contract. Edit any line by clicking it — the demo version is read-only.</p>
          <div className="invoiceTable">
            <div className="invHead">
              <span>Line item</span>
              <span className="num">Qty</span>
              <span className="num">Rate / mo</span>
              <span className="num">Total</span>
            </div>
            <div className="invRow">
              <span>Full-service lease · commercial van (45 units)</span>
              <span className="num">45</span>
              <span className="num">€680</span>
              <span className="num">€30,600</span>
            </div>
            <div className="invRow">
              <span>Full-service lease · truck (33 units)</span>
              <span className="num">33</span>
              <span className="num">€2,150</span>
              <span className="num">€70,950</span>
            </div>
            <div className="invRow">
              <span>Telematics package · per vehicle</span>
              <span className="num">78</span>
              <span className="num">€18</span>
              <span className="num">€1,404</span>
            </div>
            <div className="invRow total">
              <span>Monthly subtotal</span>
              <span className="num">—</span>
              <span className="num">—</span>
              <span className="num">€102,954</span>
            </div>
            <div className="invRow grand">
              <span>Full contract value · 24 months prepaid</span>
              <span className="num">—</span>
              <span className="num">—</span>
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
          <p className="flowLead">{item.customer} is registered on the PEPPOL network — recommended for Benelux customers. Falls back to email-PDF if delivery fails.</p>
          <ChoiceList value={state.channel}
                      onChange={v => setState(s => ({ ...s, channel: v }))}
                      options={[
            { id: 'peppol', label: 'PEPPOL e-invoice',       description: 'Pan-European standard · receipt confirmation within minutes', tag: 'Recommended' },
            { id: 'email',  label: 'Email PDF',              description: 'PDF attached, no machine-readable feed. Use only if PEPPOL fails.' },
            { id: 'csv',    label: 'CSV upload to portal',   description: 'For operators without a PEPPOL access point.' },
          ]} />
        </>
      ),
    },
    {
      label: 'Confirm',
      render: ({ state }) => (
        <>
          <p className="flowLead">Once sent, the card moves to <strong>"Awaiting payment"</strong>. Payment terms: net 30 days · auto-reminder fires at day 21.</p>
          <SummaryRows rows={[
            { k: 'Amount', v: fmtMoney(item.value) },
            { k: 'Channel', v: state.channel === 'peppol' ? 'PEPPOL · access point AP-NL-002' : state.channel === 'email' ? 'Email PDF · procurement@brusselsenergy.com' : 'CSV upload to portal' },
            { k: 'Due date', v: 'Jun 27, 2026 (net 30)' },
            { k: 'Reminder', v: 'Auto at day 21 if unpaid' },
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
  title: `Dunning notice — ${item.customer}`,
  subtitle: `${item.sub} · ${fmtMoney(item.value)} · ${item.daysLabel}`,
  item,
  initialState: { level: 'formal' },
  steps: [
    {
      label: 'Escalation level',
      render: ({ state, setState }) => (
        <>
          <p className="flowLead">This is the third overdue notice on this invoice. Picking "Formal" is recommended at 31+ days. "Collections" hands off the receivable to the agency under your master contract.</p>
          <ChoiceList value={state.level}
                      onChange={v => setState(s => ({ ...s, level: v }))}
                      options={[
            { id: 'reminder',    label: 'Polite reminder',       description: 'Soft tone — escalates auto-tone progressively. Already sent twice on this invoice.', tag: 'Sent x2' },
            { id: 'formal',      label: 'Formal notice',         description: '14-day pay-or-escalate notice. Citation of contract clause 9.2.', tag: 'Recommended' },
            { id: 'collections', label: 'Hand off to collections', description: 'Removes receivable from the dashboard. Final step.' },
          ]} />
        </>
      ),
    },
    {
      label: 'Preview',
      render: ({ state }) => (
        <EmailPreview
          from="finance@dlpe-group.eu"
          to={`ap@${item.customer.split(' ')[0].toLowerCase()}.com`}
          subject={state.level === 'formal'
            ? `FORMAL NOTICE — Invoice MFL-2024-1187 · 31 days overdue`
            : state.level === 'collections'
            ? `Notice of handoff to collections — Invoice MFL-2024-1187`
            : `Friendly reminder — Invoice MFL-2024-1187 unpaid`}
          body={
            <>
              <p>Dear accounts payable team,</p>
              <p>{state.level === 'formal'
                ? `Per the master service agreement (clause 9.2), invoice MFL-2024-1187 for ${fmtMoney(item.value)} is now 31 days past the agreed due date. We require payment within 14 calendar days, failing which the receivable will be referred to our collections partner.`
                : state.level === 'collections'
                ? `We confirm that invoice MFL-2024-1187 for ${fmtMoney(item.value)} has been referred to our collections partner today. All future correspondence on this receivable will come from them.`
                : `Just a reminder that invoice MFL-2024-1187 for ${fmtMoney(item.value)} is past due. Please confirm a payment date at your earliest convenience.`}</p>
              <p>Best regards,<br/>Ines Vandeput · Finance</p>
            </>
          }
        />
      ),
    },
  ],
  confirmLabel: 'Send notice',
  successTitle: 'Dunning notice sent',
  successDetail: (s) => `${s.level === 'collections' ? 'Receivable handed off to collections partner. Card removed from dashboard.' : 'Notice sent via PEPPOL + email. Card stays red until payment is received.'}`,
  onPatch: (s) => s.level === 'collections'
    ? { stageId: 'paid', stageName: 'In collections', status: 'amber', daysLabel: 'handed off', cta: 'View collections file' }
    : { daysLabel: 'notice sent now', cta: 'Awaiting response' },
});

const peppolApprovalFlow = (item) => ({
  kind: 'Workshop · supplier invoice',
  icon: 'receipt',
  title: `Approve PEPPOL invoice — ${item.customer}`,
  subtitle: `${fmtMoney(item.value)} · ${item.sub}`,
  item,
  steps: [
    {
      label: 'Match to order',
      render: () => (
        <>
          <p className="flowLead">Supplier invoice received via PEPPOL. The intelligence layer has auto-matched it against the purchase order on workshop order WO-2026-118.</p>
          <SummaryRows rows={[
            { k: 'Supplier', v: 'Bosch Mobility Solutions · DE-VAT-987654321' },
            { k: 'Invoice ref', v: 'BMS-2026-04421 · PEPPOL inbox · 1 day ago' },
            { k: 'Matched against', v: 'WO-2026-118 · brake-system overhaul · TRK-7702' },
            { k: 'Auto-match score', v: '98% · 3-way match (PO · GR · invoice) clean' },
            { k: 'Net amount', v: fmtMoney(item.value) + ' incl. 19% VAT' },
          ]} />
        </>
      ),
    },
    {
      label: 'Approve',
      render: () => (
        <>
          <p className="flowLead">The auto-match is clean. Approving routes the invoice to Finance for scheduled payment under net-30 terms with this supplier.</p>
          <div className="approveBox">
            <Icon name="check" size={16} strokeWidth={2.5} />
            <div>
              <div className="t">Approve for payment</div>
              <div className="d">Hands off to Finance · payment scheduled for Jun 27, 2026</div>
            </div>
          </div>
        </>
      ),
    },
  ],
  confirmLabel: 'Approve & route to Finance',
  successTitle: 'Invoice approved',
  successDetail: () => 'Workshop card archived. A new card now exists in Finance under "Approved & paid" — payment scheduled for Jun 27.',
  cascadePreview: [
    { track: 'finance', text: 'New card · "Bosch Mobility · approved · scheduled Jun 27"' },
  ],
  onPatch: () => ({ stageId: 'invoiced', stageName: 'Invoice approved', status: 'green', daysLabel: 'approved now', cta: 'View in Finance' }),
});

const notifyPickupFlow = (item) => ({
  kind: 'Operations action',
  icon: 'mail',
  title: `Notify fleet operator — pickup ready`,
  subtitle: `${item.customer} · ${item.vehicle}`,
  item,
  steps: [
    {
      label: 'Compose',
      render: () => (
        <EmailPreview
          from="ops@dlpe-group.eu"
          to={`fleet@${item.customer.split(' ')[0].toLowerCase()}.com`}
          subject={`${item.vehicle} ready for collection`}
          body={
            <>
              <p>Hello,</p>
              <p><strong>{item.vehicle}</strong> is ready for collection at the workshop. Inspection certificate and service notes are attached and visible in the customer portal.</p>
              <p>Pickup window: today and tomorrow, 07:00–18:00. The replacement vehicle will be collected at the same time.</p>
              <p>Operations · DLPE-Group</p>
            </>
          }
        />
      ),
    },
    {
      label: 'Confirm',
      render: () => (
        <>
          <p className="flowLead">A push notification will also appear in {item.customer}'s customer portal under "Recent messages".</p>
          <SummaryRows rows={[
            { k: 'Channel', v: 'Portal + email · automatic SMS at 06:00 next day if not collected' },
            { k: 'Card moves to', v: '"Vehicle picked up — loop close pending"' },
          ]} />
        </>
      ),
    },
  ],
  confirmLabel: 'Send notification',
  successTitle: 'Operator notified',
  successDetail: () => 'Message delivered to portal + email. Card moves to "Awaiting pickup confirmation".',
  onPatch: () => ({ stageName: 'Awaiting pickup confirmation', daysLabel: 'notified now', cta: 'Mark as collected' }),
});

/* ---------- Resolver: pick the right flow for a card ---------- */

const resolveFlow = (item) => {
  // Specific cases first
  if (item.id === 's5' && item.stageId !== 'signed') return signContractFlow(item);
  if (item.id === 'f2') return sendDunningFlow(item);
  if (item.id === 'w4') return peppolApprovalFlow(item);
  if (item.id === 'o3') return planWorkshopVisitFlow(item);
  if (item.id === 'o5' || (item.stageId === 'pickup')) return notifyPickupFlow(item);
  if (item.type === 'INVOICE' && (item.stageId === 'to_make' || item.stageId === 'overdue' === false && item.cta === 'Generate invoice')) return generateInvoiceFlow(item);
  if (item.stageId === 'to_make') return generateInvoiceFlow(item);
  // Default: follow-up (sales)
  return sendFollowUpFlow(item);
};

Object.assign(window, { ActionFlow, resolveFlow,
  sendFollowUpFlow, signContractFlow, planWorkshopVisitFlow,
  generateInvoiceFlow, sendDunningFlow, peppolApprovalFlow, notifyPickupFlow });
