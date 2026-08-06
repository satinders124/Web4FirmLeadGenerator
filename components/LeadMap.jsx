"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { categoryLabel } from "../lib/lead-utils";

function AutoFit({ leads, selectedLead }) {
  const map = useMap();
  useEffect(() => {
    const mappable = leads.filter((lead) => Number.isFinite(lead.lat) && Number.isFinite(lead.lng));
    if (selectedLead?.lat && selectedLead?.lng) {
      map.flyTo([selectedLead.lat, selectedLead.lng], 15, { duration: 0.7 });
    } else if (mappable.length === 1) {
      map.flyTo([mappable[0].lat, mappable[0].lng], 14, { duration: 0.7 });
    } else if (mappable.length > 1) {
      map.fitBounds(mappable.map((lead) => [lead.lat, lead.lng]), { padding: [42, 42], maxZoom: 13 });
    }
  }, [leads, map, selectedLead]);
  return null;
}

export default function LeadMap({ leads, selectedLead, onSelectLead }) {
  const center = selectedLead?.lat && selectedLead?.lng ? [selectedLead.lat, selectedLead.lng] : [-27.4698, 153.0251];
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="lead-map-canvas" aria-label="Lead results map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <AutoFit leads={leads} selectedLead={selectedLead} />
      {leads.filter((lead) => Number.isFinite(lead.lat) && Number.isFinite(lead.lng)).map((lead) => (
        <CircleMarker
          key={lead.id}
          center={[lead.lat, lead.lng]}
          radius={selectedLead?.id === lead.id ? 11 : 8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: selectedLead?.id === lead.id ? "#13b7a3" : "#5d5be7", fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelectLead(lead) }}
        >
          <Popup>
            <div className="map-popup"><strong>{lead.name}</strong><span>{categoryLabel(lead.categories)}</span><small>{lead.rating || "—"} ★ · {lead.reviews} reviews</small></div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
