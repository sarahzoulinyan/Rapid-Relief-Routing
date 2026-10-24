import React, { useState, useEffect, useRef } from 'react';
import { ChakraProvider, Box, Input, Button, Heading, Text, VStack, Container, Spinner, Flex, List, ListItem } from '@chakra-ui/react';
import { defaultSystem } from "@chakra-ui/react";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import Papa from 'papaparse';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE_URL = 'http://localhost:5000';

const FIXED_BOX_SIZE_PERCENT = 60;

function FixedBoundingBox({ onBoundsChange }: { onBoundsChange: (bounds: [[number, number], [number, number]]) => void }) {
  const map = useMap();
  const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null);
  
  useMapEvents({
    moveend: () => {
      updateBounds();
    },
    zoomend: () => {
      updateBounds();
    },
    resize: () => {
      updateBounds();
    }
  });
  
  // Calculate the fixed bounding box in the center of the map
  const updateBounds = () => {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    
    const latDiff = northEast.lat - southWest.lat;
    const lngDiff = northEast.lng - southWest.lng;
    
    const boxSize = Math.min(
      latDiff * (FIXED_BOX_SIZE_PERCENT / 100),
      lngDiff * (FIXED_BOX_SIZE_PERCENT / 100)
    );
    
    const fixedBounds: [[number, number], [number, number]] = [
      [center.lat - boxSize/2, center.lng - boxSize/2],
      [center.lat + boxSize/2, center.lng + boxSize/2]
    ];
    
    setBounds(fixedBounds);
    onBoundsChange(fixedBounds);
  };
  
  useEffect(() => {
    if (map) {
      updateBounds();
    }
  }, [map]);
  
  return bounds ? (
    <Rectangle 
      bounds={bounds}
      pathOptions={{ color: 'red', weight: 2, fillOpacity: 0.1 }}
    />
  ) : null;
}

function GraphVisualization({ graphData, fires }: { graphData: any, fires?: any[] }) {
  const map = useMap();
  const legendControlRef = useRef<L.Control | null>(null);
  
  useEffect(() => {
    if (!graphData || !graphData.nodes || !graphData.edges) return;
    
    map.eachLayer((layer) => {
      if ((layer instanceof L.Polyline && !(layer instanceof L.Rectangle)) || 
          (layer instanceof L.CircleMarker)) {
        map.removeLayer(layer);
      }
    });
    
    if (legendControlRef.current) {
      map.removeControl(legendControlRef.current);
      legendControlRef.current = null;
    }
    
    const nodeMarkers: {[key: string]: L.CircleMarker} = {};
    graphData.nodes.forEach((node: any) => {
      let color;
      if (node.route_color) {
        color = node.route_color;
      } else {
        color = node.type === 'building' ? 'blue' : 
                node.type === 'projection' ? 'green' : '#333';
      }
      
      const radius = node.type === 'building' ? 4 : 
                    node.type === 'projection' ? 2.5 : 3;
      
      const weight = node.type === 'street' ? 1.5 : 1;
      
      const marker = L.circleMarker([node.lat, node.lng], {
        radius: radius,
        fillColor: color,
        color: color,
        weight: weight,
        opacity: 0.9,
        fillOpacity: 0.8
      }).addTo(map);
      
      if (node.route_id) {
        marker.bindPopup(`Node: ${node.id}<br>Type: ${node.type}<br>Route: ${node.route_id}`);
      } else {
        marker.bindPopup(`Node: ${node.id}<br>Type: ${node.type}`);
      }
      
      nodeMarkers[node.id] = marker;
    });
    
    graphData.edges.forEach((edge: any) => {
      const sourceNode = graphData.nodes.find((n: any) => n.id === edge.source);
      const targetNode = graphData.nodes.find((n: any) => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        let color;
        if (edge.route_color) {
          color = edge.route_color;
          color = edge.route_color;
        } else {
          color = edge.type === 'perpendicular' ? '#800080' : '#444';
        }
        
        const weight = edge.type === 'perpendicular' ? 2 : 1.5;
        
        L.polyline([[sourceNode.lat, sourceNode.lng], [targetNode.lat, targetNode.lng]], {
          color: color,
          weight: weight,
          opacity: 0.85
        }).addTo(map);
      }
    });
    
    if (graphData.routes && graphData.routes.length > 0) {
      const legendControl = new L.Control({ position: 'bottomright' });
      
      legendControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        
        div.innerHTML = '<h4 style="margin:0 0 5px 0">Legend</h4>';
        
        div.innerHTML += '<div style="margin-bottom:5px;"><strong>Node Types:</strong></div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:blue;margin-right:5px;"></span>Building</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:green;margin-right:5px;"></span>Projection</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#333;margin-right:5px;"></span>Street</div>';
        
        div.innerHTML += '<div style="margin:5px 0;"><strong>Edge Types:</strong></div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:2px;background:#800080;margin-right:5px;"></span>Building-to-street</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:2px;background:#444;margin-right:5px;"></span>Street network</div>';
        
        if (graphData.routes && graphData.routes.length > 0) {
          div.innerHTML += '<div style="margin:5px 0;"><strong>Routes:</strong></div>';
          graphData.routes.forEach((route: any) => {
            div.innerHTML += `<div><span style="display:inline-block;width:12px;height:12px;background:${route.color};margin-right:5px;"></span>Route ${route.display_id} (${route.length} nodes)</div>`;
          });
        }
        
        if (graphData.fire_stations && graphData.fire_stations.length > 0) {
          div.innerHTML += '<div style="margin:5px 0;"><strong>Facilities:</strong></div>';
          div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;background:red;margin-right:5px;"></span>Fire Station</div>';
        }
        
