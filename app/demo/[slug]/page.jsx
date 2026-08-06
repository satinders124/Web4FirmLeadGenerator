import { notFound } from "next/navigation";
import { getSupabaseAdmin, hasSupabaseConfig } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function WebsiteDemoPage({ params }) {
  const { slug } = await params;
  if (!hasSupabaseConfig()) notFound();

  const supabase = getSupabaseAdmin();
  const { data: preview, error } = await supabase
    .from("website_previews")
    .select("slug,preview_content,status,created_at")
    .eq("slug", slug)
    .single();
  if (error || !preview) notFound();

  const content = preview.preview_content || {};
  return <main className="demo-site"><div className="demo-banner">Web4Firm private website concept · Not a live business website</div><nav className="demo-nav"><strong>{content.businessName}</strong><div><span>Home</span><span>Services</span><span>Contact</span></div><button>Get in touch</button></nav><section className="demo-hero"><p>{content.category || "Local business"}</p><h1>{content.heroHeading}</h1><div className="demo-hero-grid"><div><p>{content.summary}</p><button>Start a conversation</button>{content.phone && <span>{content.phone}</span>}</div><div className="demo-orb-card"><i /><span>Local • Clear • Mobile-first</span></div></div></section><section className="demo-services"><p>Designed around your customers</p><h2>A website structure built<br />to make the next step easy.</h2><div>{(content.services || []).map((service) => <article key={service}><span>0{(content.services || []).indexOf(service) + 1}</span><h3>{service}</h3><p>Clear information, thoughtful hierarchy and a direct path to get in touch.</p></article>)}</div></section><section className="demo-value"><div><p>Proposed website focus</p><h2>{content.auditHeadline || "A clearer online experience"}</h2></div><ul>{(content.features || []).map((feature) => <li key={feature}>✓ {feature}</li>)}</ul></section><footer className="demo-footer"><strong>{content.businessName}</strong><span>{content.address}</span><small>Website concept created by Web4Firm</small></footer></main>;
}
