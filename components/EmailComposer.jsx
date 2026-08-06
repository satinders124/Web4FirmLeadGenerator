"use client";

import { useEffect, useState } from "react";
import { categoryLabel } from "../lib/lead-utils";
import { Icon } from "./Icons";

function createTemplate(lead) {
  const category = categoryLabel(lead.categories).toLowerCase();
  return `<p>Hi ${lead.name},</p>
<p>I came across your ${category} business and noticed there may not be a website linked to your Google Business Profile.</p>
<p>At Web4Firm, we help local businesses build clear, mobile-friendly websites that make it easier for customers to find you, understand what you offer and get in touch.</p>
<p>Would you be open to a quick, no-pressure chat about what a simple website could do for ${lead.name}?</p>
<p>Kind regards,<br />Web4Firm</p>`;
}

export default function EmailComposer({ lead, onClose, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setTo("");
    setSubject(`Quick question about ${lead.name}`);
    setHtml(createTemplate(lead));
    setStatus("");
    setPreview(false);
  }, [lead]);

  async function send() {
    if (!to.trim()) {
      setStatus("Enter a recipient email address first.");
      return;
    }
    setStatus("Sending…");
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send email.");
      onSent(lead.id);
      setStatus("Email sent successfully.");
    } catch (error) {
      setStatus(error.message || "Unable to send email.");
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(html.replace(/<[^>]*>/g, "").replace(/\n\s*\n/g, "\n\n"));
      setStatus("Email copy copied to your clipboard.");
    } catch {
      setStatus("Copy is unavailable in this browser.");
    }
  }

  return (
    <div className="composer-overlay" role="dialog" aria-modal="true" aria-label={`Compose email to ${lead.name}`}>
      <div className="email-composer">
        <div className="composer-header"><div><p className="composer-eyebrow">Cold email composer</p><h2>{lead.name}</h2><span>{lead.address}</span></div><button type="button" onClick={onClose} aria-label="Close email composer"><Icon name="close" size={21} /></button></div>
        <div className="composer-tabs"><button className={!preview ? "active" : ""} type="button" onClick={() => setPreview(false)}>Compose</button><button className={preview ? "active" : ""} type="button" onClick={() => setPreview(true)}>Preview</button></div>
        {!preview ? <div className="composer-body"><label>Recipient email<input type="email" value={to} onChange={(event) => setTo(event.target.value)} placeholder="owner@business.com" /></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>Email body (HTML)<textarea value={html} onChange={(event) => setHtml(event.target.value)} rows="12" /></label></div> : <div className="composer-preview"><p className="preview-subject"><strong>Subject:</strong> {subject}</p><div dangerouslySetInnerHTML={{ __html: html }} /></div>}
        <div className="composer-footer"><div><button type="button" className="composer-copy" onClick={copyMessage}><Icon name="copy" size={16} /> Copy text</button>{status && <span className={status.includes("success") ? "success" : ""}>{status}</span>}</div><button type="button" className="composer-send" onClick={send}><Icon name="send" size={17} /> Send email</button></div>
      </div>
    </div>
  );
}
