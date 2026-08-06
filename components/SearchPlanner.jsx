"use client";

import { useState } from "react";
import { Icon } from "./Icons";

export default function SearchPlanner({ location, currentQuery, onUseRecommendation }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/search-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, currentQuery }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to generate search ideas.");
      setData(result);
    } catch (plannerError) {
      setError(plannerError.message || "Unable to generate search ideas.");
    } finally {
      setLoading(false);
    }
  }

  return <section className={`search-planner ${open ? "open" : ""}`}>
    <div className="planner-header"><div><span className="planner-icon"><Icon name="spark" size={16} /></span><div><strong>Claude search planner</strong><small>Find smarter searches to test</small></div></div><button type="button" onClick={() => open ? setOpen(false) : generate()}>{open ? <Icon name="chevronDown" size={16} /> : <Icon name="spark" size={16} />}{open ? "Hide ideas" : "Plan searches"}</button></div>
    {open && <div className="planner-body">{loading ? <div className="planner-loading"><span className="loading-ring" /> Claude is shaping local search hypotheses…</div> : error ? <div className="planner-error"><Icon name="info" size={15} /><span>{error}</span><button type="button" onClick={generate}>Try again</button></div> : data ? <><p className="planner-overview">{data.overview}</p><div className="planner-list">{data.recommendations.map((item, index) => <article key={`${item.query}-${index}`}><div className="planner-recommendation-top"><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span><span>{item.prospectType === "all" ? "Redesign prospects" : "No website listed"}</span></div><h4>{item.query}</h4><p className="planner-location"><Icon name="mapPin" size={13} /> {item.location}</p><p>{item.reason}</p><div className="planner-controls"><span>{item.minRating}+ ★ · {item.minReviews}+ reviews</span><button type="button" onClick={() => onUseRecommendation(item)}><Icon name="search" size={14} /> Use this search</button></div></article>)}</div><p className="planner-note"><Icon name="info" size={13} /> Claude suggestions are search hypotheses, not verified lead counts. Qualify each business before outreach.</p></> : null}</div>}
  </section>;
}
