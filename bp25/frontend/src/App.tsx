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
