"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";

const statusOptions = ["new", "proposal_ready", "contacted", "delivered", "replied", "qualified", "won", "lost", "bounced"];

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PipelineDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/crm/overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load CRM data.");
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Unable to load CRM data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const emailByLead = useMemo(() => {
    const grouped = new Map();
    (data?.emails || []).forEach((email) => {
      const current = grouped.get(email.lead_id) || [];
      current.push(email);
      grouped.set(email.lead_id, current);
    });
    return grouped;
  }, [data]);

  async function updateStatus(lead, status) {
    setUpdating(lead.id);
    try {
      const response = await fetch("/api/crm/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update status.");
      setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? result.lead : item) }));
    } catch (updateError) {
      setError(updateError.message || "Unable to update status.");
    } finally {
      setUpdating("");
    }
  }

  return <div className="pipeline-shell"><header className="pipeline-topbar"><Link href="/" className="pipeline-brand"><span><Icon name="spark" size={20} /></span><b>Web4Firm</b><small>Outreach pipeline</small></Link><div><button type="button" onClick={load}><Icon name="search" size={15} /> Refresh</button><Link href="/">Lead discovery <Icon name="external" size={14} /></Link></div></header><main className="pipeline-main">{loading ? <div className="pipeline-loading"><span className="loading-ring" />Loading outreach pipeline…</div> : error ? <section className="pipeline-setup"><span><Icon name="chart" size={29} /></span><p className="pipeline-kicker">CRM setup required</p><h1>Your persistent lead<br />pipeline starts here.</h1><p>{error}</p><ol><li>Create a Supabase project.</li><li>Run <code>supabase/schema.sql</code> from this repository in Supabase SQL Editor.</li><li>Add <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> to Vercel.</li><li>Redeploy, then return to this page.</li></ol><button type="button" onClick={load}>Try again</button></section> : <><section className="pipeline-heading"><div><p className="pipeline-kicker">Outreach command centre</p><h1>Every lead, email<br />and next <em>move.</em></h1><p>Track saved prospects, reviewed emails and manually updated reply status from one place.</p></div><div className="pipeline-note"><Icon name="message" size={18} /><span><b>Manual reply tracking</b>When a business replies, choose <strong>Replied</strong> from its status menu. The change is saved permanently in the CRM.</span></div></section><section className="pipeline-metrics"><div><span className="metric-icon leads"><Icon name="building" size={20} /></span><b>{data.metrics.totalLeads}</b><small>Saved leads</small></div><div><span className="metric-icon new"><Icon name="spark" size={20} /></span><b>{data.metrics.newLeads}</b><small>Ready to pitch</small></div><div><span className="metric-icon sent"><Icon name="send" size={20} /></span><b>{data.metrics.emailsSent}</b><small>Emails sent</small></div><div><span className="metric-icon reply"><Icon name="message" size={20} /></span><b>{data.metrics.replies}</b><small>Replies received</small></div></section><section className="pipeline-table-section"><div className="pipeline-table-header"><div><h2><Icon name="chart" size={18} /> Lead activity</h2><p>Update pipeline status as conversations move forward.</p></div><span>{data.leads.length} leads</span></div>{data.leads.length ? <div className="pipeline-table-scroll"><table><thead><tr><th>Business</th><th>Opportunity</th><th>Outreach</th><th>Reply</th><th>Status</th></tr></thead><tbody>{data.leads.map((lead) => { const emails = emailByLead.get(lead.id) || []; const latest = emails[0]; const replied = ["replied", "qualified", "won"].includes(lead.status); return <tr key={lead.id}><td><strong>{lead.business_name}</strong><span>{lead.category || "Business"} · {lead.rating || "—"} ★ · {lead.review_count || 0} reviews</span></td><td><span className={`opportunity-label ${lead.opportunity_type}`}>{lead.opportunity_type === "website_redesign" ? "Redesign" : "New website"}</span></td><td>{latest ? <div className="outreach-cell"><b>{titleCase(latest.status)}</b><span>{latest.recipient_email}</span></div> : <span className="quiet">Not sent</span>}</td><td>{replied ? <span className="reply-count"><Icon name="message" size={14} /> Reply marked</span> : <button type="button" className="mark-reply-button" onClick={() => updateStatus(lead, "replied")} disabled={updating === lead.id}><Icon name="message" size={13} /> Mark reply received</button>}</td><td><select disabled={updating === lead.id} value={lead.status} onChange={(event) => updateStatus(lead, event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></td></tr>; })}</tbody></table></div> : <div className="pipeline-empty"><Icon name="bookmark" size={28} /><h3>No CRM leads yet</h3><p>Save a prospect, generate a Claude proposal or send a reviewed email from Lead Discovery to start the pipeline.</p><Link href="/">Go to Lead Discovery <Icon name="external" size={15} /></Link></div>}</section></>}</main></div>;
}
