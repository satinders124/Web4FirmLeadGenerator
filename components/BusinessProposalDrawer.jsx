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
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setProposal(null);
    setRecipient("");
    setSubject("");
    setBody("");
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
      setPhase("ready");
      setMessage("Tailored proposal ready. Review every detail before sending.");
    } catch (error) {
      setPhase("error");
      setMessage(error.message || "Unable to generate a proposal.");
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
        body: JSON.stringify({ to: recipient, subject, html: emailTextToHtml(body) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send email.");
      onMarkContacted(lead.id);
      setPhase("sent");
      setMessage("Email sent and lead marked as contacted.");
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

        {!proposal ? <div className="proposal-start"><span className="proposal-ai-icon"><Icon name="spark" size={25} /></span><h3>Build a tailored proposal</h3><p>Claude will use only the business details shown here to create a professional website opportunity and a respectful, reviewable outreach email.</p><button type="button" onClick={generateProposal} disabled={phase === "generating"} className="generate-proposal-button"><Icon name="spark" size={17} /> {phase === "generating" ? "Creating proposal…" : "Generate with Claude"}</button>{message && <p className={`proposal-message ${phase === "error" ? "error" : ""}`}>{message}</p>}</div> : <>
          <div className="proposal-output">
            <div className="proposal-title-row"><span className="proposal-type">{proposal.opportunityType}</span><button type="button" onClick={generateProposal} disabled={phase === "generating"}><Icon name="spark" size={15} /> Refresh</button></div>
            <h3>{proposal.headline}</h3><p>{proposal.summary}</p>
            <div className="proposal-plan"><div><h4>Recommended website shape</h4><ul>{proposal.websitePlan.pages.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div><div><h4>What Web4Firm can include</h4><ul>{proposal.websitePlan.features.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div><div><h4>Business value</h4><ul>{proposal.websitePlan.benefits.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul></div></div>
          </div>

          <div className="proposal-email">
            <div className="proposal-email-heading"><div><p className="drawer-eyebrow">Manual email review</p><h3>Ready to personalise and send</h3></div><div className="proposal-tabs"><button type="button" className={!preview ? "active" : ""} onClick={() => setPreview(false)}>Edit</button><button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>Preview</button></div></div>
            {!preview ? <div className="proposal-email-form"><label>Recipient email<input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="owner@business.com" /></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>Email message<textarea rows="12" value={body} onChange={(event) => setBody(event.target.value)} /></label></div> : <div className="email-read-preview"><p><strong>To:</strong> {recipient || "Enter recipient in Edit"}</p><p><strong>Subject:</strong> {subject}</p><div>{body.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || " "}</p>)}</div></div>}
            <div className="proposal-send-row"><div><button type="button" onClick={copyEmail} className="copy-button"><Icon name="copy" size={16} /> Copy email</button><span>AI copy is a draft—review it before sending.</span></div><button type="button" onClick={sendEmail} disabled={phase === "sending"} className="send-reviewed-button"><Icon name="send" size={17} /> {phase === "sending" ? "Sending…" : phase === "sent" ? "Sent" : "Send reviewed email"}</button></div>
            {message && <p className={`proposal-message ${phase === "error" ? "error" : phase === "sent" ? "success" : ""}`}>{message}</p>}
          </div>
        </>}
      </aside>
    </div>
  );
}
