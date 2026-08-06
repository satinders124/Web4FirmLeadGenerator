"use client";

import { useEffect, useState } from "react";
import { categoryLabel } from "../lib/lead-utils";
import { Icon } from "./Icons";

function emailTextToHtml(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export default function BusinessProposalDrawer({ lead, isSaved, onClose, onToggleSave, onMarkContacted }) {
  const [proposal, setProposal] = useState(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sms, setSms] = useState("");
  const [audit, setAudit] = useState(null);
  const [auditPhase, setAuditPhase] = useState("idle");
  const [auditMessage, setAuditMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewPhase, setPreviewPhase] = useState("idle");
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setProposal(null);
    setRecipient("");
    setSubject("");
    setBody("");
    setSms("");
    setAudit(null);
    setAuditPhase("idle");
    setAuditMessage("");
    setPreviewUrl("");
    setPreviewPhase("idle");
    setPhase("idle");
    setMessage("");
    setPreview(false);
  }, [lead]);

  async function generateProposal() {
    setPhase("generating");
    setMessage("Claude is reviewing the business details and shaping a tailored pitch…");
    try {
      const response = await fetch("/api/ai/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to generate a proposal.");
      setProposal(data.proposal);
      setSubject(data.proposal.email.subject);
      setBody(data.proposal.email.text);
      setSms(data.proposal.sms || "");
      setPhase("ready");
      setMessage(`Tailored proposal ready${data.model ? ` with ${data.model}` : ""}. Review every detail before sending.`);
    } catch (error) {
      setPhase("error");
      setMessage(error.message || "Unable to generate a proposal.");
    }
  }

  async function generateAudit() {
    setAuditPhase("generating");
    setAuditMessage(lead.website ? "Reviewing visible website signals and creating an opportunity score…" : "Creating a new website opportunity score…");
    try {
      const response = await fetch("/api/ai/website-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create the website audit.");
      setAudit(data.audit);
      setAuditPhase("ready");
      setAuditMessage(`Opportunity score created${data.model ? ` with ${data.model}` : ""}.`);
    } catch (error) {
      setAuditPhase("error");
      setAuditMessage(error.message || "Unable to create the website audit.");
    }
  }

  async function createPreview() {
    if (!proposal) {
      setPreviewPhase("error");
      return;
    }
    setPreviewPhase("creating");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, proposal, audit }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create preview.");
      setPreviewUrl(data.url);
      setPreviewPhase("ready");
    } catch (error) {
      setPreviewPhase("error");
      setMessage(error.message || "Unable to create preview.");
    }
  }

  async function copyPreviewUrl() {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setMessage("Preview link copied to your clipboard.");
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  async function sendEmail() {
    if (!recipient.trim()) {
      setMessage("Enter the business email address before sending.");
      setPhase("error");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessage("Subject and email copy are required.");
      setPhase("error");
      return;
    }
    setPhase("sending");
    setMessage("Sending reviewed email…");
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, subject, html: emailTextToHtml(body), lead, followUps: proposal?.followUps || [] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send email.");
      onMarkContacted(lead.id);
      setPhase("sent");
      setMessage(`Email sent and lead marked as contacted.${data.followUpsScheduled ? ` ${data.followUpsScheduled} follow-up${data.followUpsScheduled === 1 ? "" : "s"} added to the queue.` : ""}`);
    } catch (error) {
      setPhase("error");
      setMessage(error.message || "Unable to send email.");
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setMessage("Reviewed email copied to your clipboard.");
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  async function copySms() {
    try {
      await navigator.clipboard.writeText(sms);
      setMessage("SMS copy copied to your clipboard.");
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  function openSmsDraft() {
    if (!lead.phone) {
      setMessage("This business does not have a phone number listed.");
      setPhase("error");
      return;
    }
    const number = String(lead.phone).replace(/[^+\d]/g, "");
    window.location.href = `sms:${number}?body=${encodeURIComponent(sms)}`;
    setMessage("SMS draft opened. Send it manually, then mark it as sent below.");
  }

  async function markSmsSent() {
    if (!lead.phone || !sms.trim()) {
      setMessage("A phone number and SMS message are required.");
      setPhase("error");
      return;
    }
    try {
      const response = await fetch("/api/crm/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, recipientPhone: lead.phone, bodyText: sms, status: "sent" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save SMS activity.");
      onMarkContacted(lead.id);
      setPhase("sent");
      setMessage("SMS marked as sent and saved in the outreach pipeline.");
    } catch (error) {
      setPhase("error");
      setMessage(error.message || "Unable to save SMS activity.");
    }
  }

  return (
    <div className="proposal-overlay" role="dialog" aria-modal="true" aria-label={`Proposal for ${lead.name}`}>
      <aside className="proposal-drawer">
        <div className="proposal-drawer-header">
          <div><p className="drawer-eyebrow">Business opportunity</p><h2>{lead.name}</h2><p>{categoryLabel(lead.categories)} · {lead.address}</p></div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close business details"><Icon name="close" size={21} /></button>
        </div>

        <div className="proposal-lead-facts">
          <div><Icon name="star" size={15} fill="currentColor" stroke={0} /><span><b>{lead.rating || "—"}</b> · {lead.reviews} reviews</span></div>
          {lead.phone && <a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}><Icon name="phone" size={15} /> {lead.phone}</a>}
          <div className={lead.website ? "website-present" : "website-missing"}><Icon name="globe" size={15} /><span>{lead.website ? "Website listed — prepare a redesign pitch" : "No website listed — prepare a new website pitch"}</span></div>
          <button type="button" onClick={() => onToggleSave(lead)}><Icon name={isSaved ? "bookmarkFilled" : "bookmark"} size={16} /> {isSaved ? "Saved lead" : "Save lead"}</button>
        </div>

        <section className="audit-studio">
          <div className="audit-studio-heading"><div><p className="drawer-eyebrow">AI website audit</p><h3>{lead.website ? "Review current website signals" : "Score the new website opportunity"}</h3><p>{lead.website ? "Review public, visible technical signals and turn them into a respectful redesign opportunity." : "Build an evidence-aware new website opportunity using the business details available."}</p></div><button type="button" onClick={generateAudit} disabled={auditPhase === "generating"}><Icon name="chart" size={16} /> {auditPhase === "generating" ? "Auditing…" : audit ? "Refresh audit" : "Run audit"}</button></div>
          {audit && <div className="audit-result"><div className="audit-score"><strong>{audit.opportunityScore}</strong><span>Opportunity<br />score</span></div><div><h4>{audit.headline}</h4><p>{audit.summary}</p><div className="audit-columns"><div><b>Strengths</b><ul>{audit.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><b>Opportunities</b><ul>{audit.opportunities.map((item) => <li key={item}>{item}</li>)}</ul></div><div><b>Recommended next steps</b><ul>{audit.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ul></div></div></div></div>}
          {auditMessage && <p className={`audit-message ${auditPhase === "error" ? "error" : ""}`}>{auditMessage}</p>}
        </section>

        {!proposal ? <div className="proposal-start"><span className="proposal-ai-icon"><Icon name="spark" size={25} /></span><h3>Build a tailored proposal</h3><p>Claude will use only the business details shown here to create a professional website opportunity and a respectful, reviewable outreach email.</p><button type="button" onClick={generateProposal} disabled={phase === "generating"} className="generate-proposal-button"><Icon name="spark" size={17} /> {phase === "generating" ? "Creating proposal…" : "Generate with Claude"}</button>{message && <p className={`proposal-message ${phase === "error" ? "error" : ""}`}>{message}</p>}</div> : <>
          <div className="proposal-output">
            <div className="proposal-title-row"><span className="proposal-type">{proposal.opportunityType}</span><button type="button" onClick={generateProposal} disabled={phase === "generating"}><Icon name="spark" size={15} /> Refresh</button></div>
            <h3>{proposal.headline}</h3><p>{proposal.summary}</p>
            <div className="proposal-plan"><div><h4>Recommended website shape</h4><ul>{proposal.websitePlan.pages.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div><div><h4>What Web4Firm can include</h4><ul>{proposal.websitePlan.features.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div><div><h4>Business value</h4><ul>{proposal.websitePlan.benefits.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div></div>
            <div className="website-preview-action"><div><span><Icon name="spark" size={17} /></span><div><h4>Instant website concept</h4><p>Create a private, shareable demo page using this proposal—not a live business website.</p></div></div>{previewUrl ? <div className="preview-ready"><a href={previewUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15} /> Open preview</a><button type="button" onClick={copyPreviewUrl}><Icon name="copy" size={15} /> Copy link</button></div> : <button type="button" onClick={createPreview} disabled={previewPhase === "creating"}>{previewPhase === "creating" ? "Creating preview…" : "Create preview"}</button>}</div>
          </div>

          <div className="proposal-email">
            <div className="proposal-email-heading"><div><p className="drawer-eyebrow">Manual email review</p><h3>Ready to personalise and send</h3></div><div className="proposal-tabs"><button type="button" className={!preview ? "active" : ""} onClick={() => setPreview(false)}>Edit</button><button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>Preview</button></div></div>
            {!preview ? <div className="proposal-email-form"><label>Recipient email<input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="owner@business.com" /></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>Email message<textarea rows="12" value={body} onChange={(event) => setBody(event.target.value)} /></label></div> : <div className="email-read-preview"><p><strong>To:</strong> {recipient || "Enter recipient in Edit"}</p><p><strong>Subject:</strong> {subject}</p><div>{body.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || " "}</p>)}</div></div>}
            <div className="proposal-send-row"><div><button type="button" onClick={copyEmail} className="copy-button"><Icon name="copy" size={16} /> Copy email</button><span>AI copy is a draft—review it before sending.</span></div><button type="button" onClick={sendEmail} disabled={phase === "sending"} className="send-reviewed-button"><Icon name="send" size={17} /> {phase === "sending" ? "Sending…" : phase === "sent" ? "Sent" : "Send reviewed email"}</button></div>
            {message && <p className={`proposal-message ${phase === "error" ? "error" : phase === "sent" ? "success" : ""}`}>{message}</p>}
          </div>

          <div className="proposal-sms">
            <div className="proposal-sms-heading"><div><p className="drawer-eyebrow">Manual text message</p><h3>Short, respectful SMS option</h3><p>Open the phone&apos;s message composer, review the draft and send it manually.</p></div><span><Icon name="message" size={18} /></span></div>
            <label>SMS message <small>{sms.length}/320</small><textarea rows="4" value={sms} onChange={(event) => setSms(event.target.value.slice(0, 320))} /></label>
            <div className="proposal-sms-actions"><button type="button" className="copy-button" onClick={copySms}><Icon name="copy" size={16} /> Copy SMS</button><button type="button" className="open-sms-button" onClick={openSmsDraft} disabled={!lead.phone}><Icon name="message" size={16} /> Open SMS draft</button><button type="button" className="mark-sms-button" onClick={markSmsSent} disabled={!lead.phone || !sms.trim()}><Icon name="check" size={16} /> Mark SMS sent</button></div>
            <p>For manual sending only. Web4Firm will not send text messages automatically.</p>
          </div>
        </>}
      </aside>
    </div>
  );
}
