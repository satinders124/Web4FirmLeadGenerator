"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { categoryLabel } from "../lib/lead-utils";
import { Icon } from "./Icons";
import BusinessProposalDrawer from "./BusinessProposalDrawer";

const LeadMap = dynamic(() => import("./LeadMap"), {
  ssr: false,
  loading: () => <div className="map-loading"><span className="loading-ring" />Loading map…</div>,
});

const STORAGE_KEY = "web4firm-saved-leads-v2";
const defaultForm = { query: "restaurants", location: "Brisbane, QLD, Australia", minRating: "4", minReviews: "10", prospectType: "noWebsite" };

function leadStatus(lead, savedLeads) {
  return savedLeads.find((item) => item.id === lead.id);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function LeadDashboard() {
  const [form, setForm] = useState(defaultForm);
  const [leads, setLeads] = useState([]);
  const [totals, setTotals] = useState({ found: 0, noWebsite: 0 });
  const [savedLeads, setSavedLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sortBy, setSortBy] = useState("score");
  const [isSearching, setIsSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [detailLead, setDetailLead] = useState(null);
  const [mapVisible, setMapVisible] = useState(true);

  useEffect(() => {
    try {
      setSavedLeads(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      setSavedLeads([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLeads));
  }, [savedLeads]);

  const orderedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating || b.reviews - a.reviews;
      if (sortBy === "reviews") return b.reviews - a.reviews || b.rating - a.rating;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return b.score - a.score;
    });
  }, [leads, sortBy]);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function search(event, overrideForm) {
    event?.preventDefault();
    const activeForm = overrideForm || form;
    if (!activeForm.query.trim()) return;
    setIsSearching(true);
    setNotice("Searching Google Places and checking listed website fields…");
    setNoticeType("info");
    setSelectedLead(null);
    try {
      const response = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: activeForm.query, location: activeForm.location, minRating: activeForm.minRating, minReviews: activeForm.minReviews, prospectType: activeForm.prospectType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search could not be completed.");
      setLeads(data.leads || []);
      setTotals(data.totals || { found: 0, noWebsite: 0 });
      setSelectedLead(data.leads?.[0] || null);
      const message = data.leads?.length
        ? `${data.leads.length} potential no-website leads found after checking ${data.pagesSearched || 1} result page${data.pagesSearched === 1 ? "" : "s"}.`
        : data.totals?.found
          ? `${data.totals.found} businesses were checked; they all list a website or fall below the selected filters.`
          : "No businesses were returned for this search. Try a different category or location.";
      setNotice(message);
      setNoticeType(data.leads?.length ? "success" : "info");
    } catch (error) {
      setLeads([]);
      setTotals({ found: 0, noWebsite: 0 });
      setNotice(error.message || "Search could not be completed.");
      setNoticeType("error");
    } finally {
      setIsSearching(false);
    }
  }

  function runSuggestedSearch(query) {
    const nextForm = { ...form, query, minRating: "3", minReviews: "0" };
    setForm(nextForm);
    search(null, nextForm);
  }

  async function persistLeadToCrm(lead, overrides = {}) {
    try {
      await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, overrides }),
      });
    } catch {
      // Local saved leads remain usable if the CRM has not been configured yet.
    }
  }

  function toggleSave(lead) {
    const existing = leadStatus(lead, savedLeads);
    if (existing) {
      setSavedLeads((current) => current.filter((item) => item.id !== lead.id));
      setNotice(`${lead.name} removed from saved leads.`);
      return;
    }
    setSavedLeads((current) => [...current, { ...lead, status: "New", savedAt: new Date().toISOString() }]);
    persistLeadToCrm(lead, { status: "new" });
    setNotice(`${lead.name} saved to your workspace.`);
    setNoticeType("success");
  }

  function markContacted(id) {
    const matchingLead = leads.find((lead) => lead.id === id);
    setSavedLeads((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) return current.map((item) => item.id === id ? { ...item, status: "Contacted", contactedAt: new Date().toISOString() } : item);
      return matchingLead ? [...current, { ...matchingLead, status: "Contacted", savedAt: new Date().toISOString(), contactedAt: new Date().toISOString() }] : current;
    });
  }

  function exportCsv() {
    if (!savedLeads.length) {
      setNotice("Save at least one lead before exporting.");
      setNoticeType("info");
      return;
    }
    const header = ["Name", "Category", "Address", "Phone", "Rating", "Reviews", "Website", "Lead score", "Status", "Google Maps"];
    const rows = savedLeads.map((lead) => [lead.name, categoryLabel(lead.categories), lead.address, lead.phone, lead.rating, lead.reviews, lead.website || "No website listed", lead.score, lead.status, lead.mapsUrl]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `web4firm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const contacted = savedLeads.filter((lead) => lead.status === "Contacted").length;

  return (
    <div className="lead-app-shell">
      <header className="app-topbar">
        <div className="app-brand"><span><Icon name="spark" size={22} /></span><div><strong>Web4Firm</strong><small>Lead intelligence workspace</small></div></div>
        <div className="app-topbar-actions"><a href="/pipeline" className="pipeline-link"><Icon name="chart" size={16} /> Outreach pipeline</a><button type="button" onClick={exportCsv} className="export-button"><Icon name="download" size={16} /> Export saved leads</button><div className="app-status"><i /> Workspace ready</div></div>
      </header>

      <div className="lead-workspace">
        <aside className="lead-sidebar">
          <div className="sidebar-intro"><p className="sidebar-eyebrow">Lead discovery</p><h1>Find businesses<br />ready for a <em>website.</em></h1><p>Search Google Places, focus on quality local businesses and save leads in one calm workspace.</p></div>
          <form className="lead-search-form" onSubmit={search}>
            <label><span><Icon name="search" size={15} /> Business search</span><input name="query" value={form.query} onChange={updateForm} placeholder="e.g. restaurants" /></label>
            <label><span><Icon name="mapPin" size={15} /> Location</span><input name="location" value={form.location} onChange={updateForm} placeholder="City or area" /></label>
            <label><span><Icon name="globe" size={15} /> Prospect type</span><select name="prospectType" value={form.prospectType} onChange={updateForm}><option value="noWebsite">No website listed</option><option value="all">All businesses — redesign prospects</option></select></label>
            <div className="filter-grid"><label><span><Icon name="star" size={15} /> Min. rating</span><select name="minRating" value={form.minRating} onChange={updateForm}><option value="0">Any rating</option><option value="3">3+ stars</option><option value="3.5">3.5+ stars</option><option value="4">4+ stars</option><option value="4.5">4.5+ stars</option></select></label><label><span><Icon name="message" size={15} /> Min. reviews</span><input name="minReviews" type="number" min="0" value={form.minReviews} onChange={updateForm} /></label></div>
            <button type="submit" className="lead-search-button" disabled={isSearching}><Icon name={isSearching ? "spark" : "search"} size={17} />{isSearching ? "Finding leads…" : "Find businesses"}</button>
          </form>
          <div className="lead-stats"><div><b>{totals.found}</b><span>Found</span></div><div><b>{totals.noWebsite}</b><span>{form.prospectType === "all" ? "Qualified" : "No website"}</span></div><div><b>{contacted}</b><span>Contacted</span></div></div>
          <div className="saved-summary"><div><h2><Icon name="bookmark" size={16} /> Saved leads</h2><span>{savedLeads.length}</span></div>{savedLeads.length ? <div className="saved-mini-list">{savedLeads.slice(-4).reverse().map((lead) => <button type="button" key={lead.id} onClick={() => setSelectedLead(lead)}><span>{lead.name}</span><small>{lead.status}</small></button>)}</div> : <p>Save promising businesses to keep your shortlist here.</p>}</div>
        </aside>

        <main className="lead-main">
          <section className="lead-overview"><div><p className="overview-label">Lead map & results</p><h2>{leads.length ? `${leads.length} high-potential leads` : "Your lead canvas"}</h2><p>{notice || "Search a business category and location to begin."}</p></div><div className={`notice-pill ${noticeType}`}><Icon name={noticeType === "error" ? "info" : "spark"} size={15} />{noticeType === "error" ? "Configuration needed" : isSearching ? "Searching" : "Live workspace"}</div></section>

          <section className="map-panel"><div className="map-panel-header"><div><h3><Icon name="mapPin" size={18} /> Geographic view</h3><p>Map uses OpenStreetMap; Google Places search remains secure on the server.</p></div>{orderedLeads.length > 0 && <button type="button" onClick={() => setMapVisible((value) => !value)}><Icon name="mapPin" size={16} /> {mapVisible ? "Hide map" : "Show map"}</button>}</div>{orderedLeads.length ? (mapVisible && <LeadMap leads={orderedLeads} selectedLead={selectedLead} onSelectLead={setSelectedLead} />) : <div className="map-empty-state"><Icon name="mapPin" size={25} /><div><strong>Map results will appear here</strong><span>Once a search finds potential leads, you can review their locations on the map.</span></div></div>}</section>

          <section className="results-section"><div className="results-header"><div><h3><Icon name="building" size={18} /> {form.prospectType === "all" ? "Website opportunity prospects" : "Businesses without listed websites"} <span>{orderedLeads.length}</span></h3><p>{form.prospectType === "all" ? "Businesses with a listed website receive a redesign opportunity; businesses without one receive a new-site opportunity." : "Website availability is based on the website field returned by Google Places."}</p></div><label className="sort-control"><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="score">Lead score</option><option value="rating">Rating</option><option value="reviews">Reviews</option><option value="name">Name</option></select></label></div>
            {isSearching ? <div className="results-empty"><span className="loading-ring" /><h4>Scanning business results…</h4><p>Checking the returned Google Places website fields and applying your filters.</p></div> : orderedLeads.length ? <div className="lead-grid">{orderedLeads.map((lead) => { const saved = leadStatus(lead, savedLeads); return <article key={lead.id} className={`lead-card ${selectedLead?.id === lead.id ? "selected" : ""}`} onClick={() => { setSelectedLead(lead); setDetailLead(lead); }}><div className="lead-card-top"><span className="lead-score">Score {lead.score}</span><button type="button" className={saved ? "saved" : ""} onClick={(event) => { event.stopPropagation(); toggleSave(lead); }} aria-label={saved ? "Remove saved lead" : "Save lead"}><Icon name={saved ? "bookmarkFilled" : "bookmark"} size={18} /></button></div><h4>{lead.name}</h4><p className="lead-category">{categoryLabel(lead.categories)}</p><div className="lead-rating"><Icon name="star" size={14} fill="currentColor" stroke={0} /><strong>{lead.rating || "—"}</strong><span>{lead.reviews} reviews</span></div><p className="lead-address"><Icon name="mapPin" size={15} /> {lead.address}</p>{lead.phone && <p className="lead-phone"><Icon name="phone" size={15} /> {lead.phone}</p>}<div className={`lead-website-state ${lead.website ? "has-website" : ""}`}><Icon name="globe" size={15} /><span>{lead.website ? "Website listed — redesign opportunity" : "No website listed"}</span></div><div className="lead-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); toggleSave(lead); }}><Icon name="bookmark" size={15} /> {saved ? "Saved" : "Save"}</button><button type="button" onClick={(event) => { event.stopPropagation(); setDetailLead(lead); }}><Icon name="spark" size={15} /> Proposal</button>{lead.mapsUrl && <a onClick={(event) => event.stopPropagation()} href={lead.mapsUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15} /></a>}</div></article>; })}</div> : <div className="results-empty"><span className="empty-icon"><Icon name={totals.found ? "globe" : "search"} size={34} /></span><h4>{totals.found ? "The results all list websites" : "Ready to find leads?"}</h4><p>{totals.found ? `We checked ${totals.found} businesses and none matched the “no website listed” filter. Try a narrower local category or slightly broader quality filters.` : "Search for a business category in a city, then review businesses with no listed website."}</p>{totals.found > 0 && <div className="suggested-searches"><span>Try a broader local search:</span><div><button type="button" onClick={() => runSuggestedSearch("hair salons")}>Hair salons</button><button type="button" onClick={() => runSuggestedSearch("florists")}>Florists</button><button type="button" onClick={() => runSuggestedSearch("electricians")}>Electricians</button></div></div>}</div>}</section>
        </main>
      </div>
      {detailLead && <BusinessProposalDrawer lead={detailLead} isSaved={Boolean(leadStatus(detailLead, savedLeads))} onClose={() => setDetailLead(null)} onToggleSave={toggleSave} onMarkContacted={markContacted} />}
    </div>
  );
}
