import React from 'react';
import { Icon } from './icons.jsx';
import { SimBadge } from './primitives.jsx';

/* ============================================================
   Intelligence Layer — AI field-mapping + prompt-defined logic.
   ============================================================ */

export const MAPPING_PROFILES = {
  'CRM': {
    discovered: 142,
    rows: [
      { from: 'Account.Name',          to: 'customer.legalName',     conf: 99 },
      { from: 'Opportunity.Amount',    to: 'deal.value',             conf: 98 },
      { from: 'Opportunity.StageName', to: 'deal.stage',             conf: 95 },
      { from: 'Opportunity.CloseDate', to: 'deal.expectedClose',     conf: 97 },
      { from: 'Contact.Email',         to: 'contact.email',          conf: 99 },
      { from: 'Lead.Rating',           to: 'lead.priority',          conf: 86 },
    ],
    fields: ['Account.Name','Contact.FirstName','Contact.LastName','Contact.Email','Contact.Phone',
      'Account.BillingStreet','Account.BillingCity','Account.BillingPostalCode','Account.BillingCountry',
      'Opportunity.Amount','Opportunity.StageName','Opportunity.CloseDate','Owner.Name'],
  },
  'Accounting & Finance': {
    discovered: 96,
    rows: [
      { from: 'Invoice.TotalAmount',   to: 'invoice.amount',         conf: 99 },
      { from: 'Invoice.DueDate',       to: 'invoice.dueDate',        conf: 98 },
      { from: 'Payment.Status',        to: 'invoice.paymentStatus',  conf: 96 },
      { from: 'GLAccount.Code',        to: 'ledger.account',         conf: 94 },
      { from: 'Customer.VATNumber',    to: 'customer.taxId',         conf: 97 },
      { from: 'TaxCode',               to: 'invoice.taxCode',        conf: 84 },
    ],
    fields: ['Invoice.Number','Invoice.TotalAmount','Invoice.NetAmount','Invoice.VATAmount','Invoice.VATRate',
      'Invoice.Date','Invoice.DueDate','Payment.Status','Customer.Name','Customer.VATNumber',
      'GLAccount.Code','Currency'],
  },
  'ERP & Supply chain': {
    discovered: 211,
    rows: [
      { from: 'PurchaseOrder.Number',  to: 'order.ref',              conf: 99 },
      { from: 'DeliveryDate',          to: 'order.expectedDelivery', conf: 96 },
      { from: 'Vendor.ID',             to: 'supplier.id',            conf: 98 },
      { from: 'Material.Number',       to: 'part.sku',               conf: 95 },
      { from: 'Plant.Code',            to: 'depot.code',             conf: 88 },
    ],
    fields: ['PurchaseOrder.Number','OrderLine.Position','Material.Number','Material.Description','Quantity',
      'UnitPrice','DeliveryDate','Vendor.ID','Vendor.Name','Plant.Code','Currency'],
  },
  'Productivity & Comms': {
    discovered: 38,
    rows: [
      { from: 'cascade.triggered',     to: 'channel.message',        conf: 99 },
      { from: 'card.statusChange',     to: 'notification.payload',   conf: 97 },
      { from: 'user.mention',          to: 'message.recipient',      conf: 93 },
      { from: 'workspace.channels',    to: 'channel.directory',      conf: 98 },
    ],
    fields: ['card.track','card.title','card.statusChange','card.owner','cascade.triggered',
      'user.mention','user.email','event.timestamp','workspace.channels'],
  },
};

const TRANSFORM_EXAMPLES = {
  'CRM': ['Combine first and last name into a full name', 'Join billing street, postcode and city into one address line'],
  'Accounting & Finance': ['Compute net amount as total ÷ (1 + VAT rate)', 'Format a label like "INV-1187 · €2,460 · due Jun 27"'],
  'ERP & Supply chain': ['Concatenate PO number and line position into a unique key', 'Build a line label from quantity × material description'],
  'Productivity & Comms': ['Build a message from card title and its new status', 'Combine track and owner into a routing tag'],
};

/* Plausible sample values for the fallback / preview. */
const SAMPLE_VALUES = {
  'Contact.FirstName': 'Anke', 'Contact.LastName': 'Vermeulen', 'Account.Name': 'Brussels Energy SA',
  'Account.BillingStreet': 'Rue de la Loi 16', 'Account.BillingCity': 'Brussels', 'Account.BillingPostalCode': '1000',
  'Account.BillingCountry': 'BE', 'Contact.Email': 'a.vermeulen@brusselsenergy.com', 'Contact.Phone': '+32 2 555 0112',
  'Opportunity.Amount': '2460000', 'Invoice.Number': 'INV-1187', 'Invoice.TotalAmount': '2980.60',
  'Invoice.NetAmount': '2463.31', 'Invoice.VATAmount': '517.29', 'Invoice.VATRate': '0.21', 'Currency': 'EUR',
  'Invoice.DueDate': '2026-06-27', 'PurchaseOrder.Number': 'PO-2026-118', 'OrderLine.Position': '20',
  'Material.Number': 'BRK-7702', 'Material.Description': 'Brake disc set', 'Quantity': '4', 'UnitPrice': '310.00',
  'Vendor.Name': 'Bosch Mobility', 'card.title': 'Vehicle ordered', 'card.statusChange': 'In transit',
  'card.track': 'operations', 'card.owner': 'Tom Janssens', 'user.mention': '@tom',
};
const sampleFor = (f) => SAMPLE_VALUES[f] || (f.split('.').pop());

/* ---- Robust JSON extraction from a model response ---- */
const parseTransformJSON = (text) => {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
};

/* ---- Heuristic fallback when the live model is unavailable ---- */
const fallbackTransform = (instruction, fields) => {
  const low = instruction.toLowerCase();
  const used = fields.filter(f => {
    const leaf = f.split('.').pop().toLowerCase();
    return low.includes(leaf) || low.includes(f.toLowerCase());
  });
  const sources = used.length ? used.slice(0, 4) : fields.slice(0, 2);
  const compute = /(sum|divide|multiply|net|gross|×|x |\/|\+|compute|calc)/i.test(low);
  const op = compute ? 'Compute' : /format|label/.test(low) ? 'Format' : 'Concatenate';
  const target = 'derived.' + (low.match(/into (?:a |an |one )?([a-z ]+)/)?.[1] || 'field')
    .trim().split(/\s+/).map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('');
  const formula = op === 'Concatenate'
    ? sources.map(s => s.split('.').pop()).join(" + ' ' + ")
    : sources.map(s => s.split('.').pop()).join(' / ');
  const sampleInputs = {}; sources.forEach(s => sampleInputs[s] = sampleFor(s));
  const sampleOutput = op === 'Concatenate' ? sources.map(s => sampleFor(s)).join(' ') : '—';
  return { target, sources, op, formula, sampleInputs, sampleOutput };
};

/* ---- Ask the live model (or fall back) ---- */
export const generateTransform = async (instruction, provider, fields) => {
  const prompt = `You are the transform engine of an ETL "Intelligence Layer" that maps data from ${provider.name} (${provider.cat}) into a unified DataSource.
Available source fields: ${fields.join(', ')}.
User instruction: "${instruction}"
Design ONE transform. Reply with ONLY a JSON object, no markdown, with keys:
"target": canonical camelCase dotted path (e.g. "contact.fullName"),
"sources": array of source field names used (prefer ones from the available list),
"op": one short word — "Concatenate", "Compute", or "Format",
"formula": a short human-readable expression using the source fields,
"sampleInputs": object mapping each used source field to a realistic example value,
"sampleOutput": the resulting value as a string.`;
  try {
    if (window.claude && window.claude.complete) {
      const text = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const parsed = parseTransformJSON(text);
      if (parsed && parsed.target && Array.isArray(parsed.sources)) {
        if (!parsed.sampleOutput && parsed.sampleInputs) {
          parsed.sampleOutput = Object.values(parsed.sampleInputs).join(' ');
        }
        return parsed;
      }
    }
  } catch (e) { /* fall through */ }
  return fallbackTransform(instruction, fields);
};

/* ---- Transform composer ---- */
const TransformComposer = ({ provider, fields, onAdd }) => {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const examples = TRANSFORM_EXAMPLES[provider.cat] || [];

  const run = async () => {
    const instr = text.trim();
    if (!instr || busy) return;
    setBusy(true);
    const tf = await generateTransform(instr, provider, fields);
    setBusy(false);
    setText('');
    onAdd({ ...tf, prompt: instr });
  };

  return (
    <div className="aimComposer">
      <div className="aimComposerRow">
        <span className="aimPromptIcon"><Icon name="flash" size={13} strokeWidth={2} /></span>
        <input
          value={text}
          disabled={busy}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run(); }}
          placeholder="Describe a transform in plain language…" />
        <button className="aimGenBtn" disabled={!text.trim() || busy} onClick={run}>
          {busy ? <><span className="aimMiniSpin" /> Building…</> : 'Generate'}
        </button>
      </div>
      {!busy && examples.length > 0 && (
        <div className="aimExamples">
          <span>Try:</span>
          {examples.map((ex, i) => (
            <button key={i} className="aimExample" onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const TransformRow = ({ tf, onRemove }) => (
  <div className="aimTfRow">
    <div className="aimTfTop">
      <span className="aimTfBadge">ƒ {tf.op || 'Transform'}</span>
      <div className="aimTfChips">
        {tf.sources.map((s, i) => <code className="tfChip" key={i}>{s}</code>)}
      </div>
      <span className="aimTfArr"><Icon name="arrow" size={12} strokeWidth={2} /></span>
      <code className="aimTfTarget">{tf.target}</code>
      <button className="aimTfX" onClick={onRemove} title="Remove transform">
        <Icon name="close" size={13} />
      </button>
    </div>
    <div className="aimTfFormula"><code>{tf.formula}</code></div>
    {tf.sampleOutput && tf.sampleOutput !== '—' && (
      <div className="aimTfSample">
        <span className="lbl">Preview</span>
        <span className="out">{tf.sampleOutput}</span>
      </div>
    )}
  </div>
);

export const AiMappingFlow = ({ provider, onClose, onComplete }) => {
  const profile = MAPPING_PROFILES[provider.cat] || MAPPING_PROFILES['CRM'];
  const [phase, setPhase] = React.useState('scanning'); // scanning -> mapping -> ready
  const [revealed, setRevealed] = React.useState(0);
  const [transforms, setTransforms] = React.useState([]);

  React.useEffect(() => {
    const t = setTimeout(() => setPhase('mapping'), 1500);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (phase !== 'mapping') return;
    if (revealed >= profile.rows.length) { setPhase('ready'); return; }
    const t = setTimeout(() => setRevealed(r => r + 1), 360);
    return () => clearTimeout(t);
  }, [phase, revealed, profile.rows.length]);

  const review = profile.rows.filter(r => r.conf < 90).length;
  const mapped = profile.rows.length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="aimPanel" onClick={e => e.stopPropagation()}>
        <div className="aimHead">
          <div className="aimSpark"><Icon name="flash" size={13} strokeWidth={2} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="aimKind" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Intelligence Layer · AI field mapping
              <SimBadge title="Demo only — schema discovery & mapping are simulated, not read from a live source system" />
            </div>
            <h2>Mapping {provider.name} → unified DataSource</h2>
          </div>
          <button className="iconBtn" onClick={onClose} title="Cancel"><Icon name="close" size={16} /></button>
        </div>

        <div className="aimBody">
          {phase === 'scanning' ? (
            <div className="aimScan">
              <div className="aimScanBar"><i /></div>
              <div className="aimScanText">
                Reading the {provider.name} schema… <b>{profile.discovered} fields</b> discovered
              </div>
              <div className="aimScanSub">Nango established the connection — the model is now inferring how each source field maps onto the canonical model.</div>
            </div>
          ) : (
            <>
              <p className="aimLead">
                The model matched <b>{mapped} fields</b> automatically.
                {review > 0
                  ? <> <b>{review}</b> low-confidence match{review === 1 ? '' : 'es'} flagged for review — everything else is ready.</>
                  : ' All matches are high-confidence.'}
              </p>
              <div className="aimSchemaHead">
                <span>{provider.name} field</span>
                <span className="arr" />
                <span>DataSource model</span>
                <span className="cf">Confidence</span>
              </div>
              <div className="aimRows">
                {profile.rows.slice(0, revealed).map((r, i) => {
                  const low = r.conf < 90;
                  return (
                    <div className={`aimRow ${low ? 'review' : ''}`} key={i}>
                      <code className="src">{r.from}</code>
                      <span className="arr"><Icon name="arrow" size={12} strokeWidth={2} /></span>
                      <code className="dst">{r.to}</code>
                      <span className={`conf ${low ? 'low' : ''}`}>
                        {low ? 'review' : <><Icon name="check" size={10} strokeWidth={3} /> {r.conf}%</>}
                      </span>
                    </div>
                  );
                })}
              </div>

              {phase === 'ready' && (
                <div className="aimTransforms">
                  <div className="aimSubhead">
                    <span className="fx">ƒ</span> Logic layer
                    <span className="hint">— combine, compute or reshape fields with a prompt</span>
                  </div>
                  {transforms.map((tf, i) => (
                    <TransformRow key={i} tf={tf}
                      onRemove={() => setTransforms(ts => ts.filter((_, j) => j !== i))} />
                  ))}
                  <TransformComposer provider={provider} fields={profile.fields}
                    onAdd={(tf) => setTransforms(ts => [...ts, tf])} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="aimFoot">
          <div className="aimNote">
            {phase === 'ready'
              ? (transforms.length
                  ? <><b>{mapped}</b> mapped · <b>{transforms.length}</b> transform{transforms.length === 1 ? '' : 's'}</>
                  : <>Mappings & transforms are editable later from <b>Config</b>.</>)
              : <>Auto-mapping… powered by the Intelligence Layer</>}
          </div>
          <button className="cta" disabled={phase !== 'ready'}
                  onClick={() => onComplete(provider, transforms)}>
            {phase === 'ready' ? 'Confirm & finish' : 'Mapping…'}
          </button>
        </div>
      </div>
    </div>
  );
};
